#!/usr/bin/env python3
"""
Inventar Pro — Pi Web-Dashboard
Port: 8080  |  http://PI-IP:8080
"""
import subprocess, os, time, threading
from fastapi import FastAPI, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn, psutil

app = FastAPI(title="Pi Dashboard")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

SERVICES     = ["inventar-backend", "inventar-frontend", "mongod"]
INSTALL      = os.path.expanduser("~/inventar")
VERSION_FILE = os.path.join(INSTALL, "VERSION")
UPDATE_SH    = os.path.join(INSTALL, "pi-setup", "update.sh")
BACKUP_SH    = os.path.join(INSTALL, "pi-setup", "backup.sh")

def _read_version() -> str:
    try:
        with open(VERSION_FILE) as f:
            return f.read().strip()
    except FileNotFoundError:
        return "?"

def _git_short_hash() -> str:
    try:
        r = subprocess.run(["git", "rev-parse", "--short", "HEAD"],
                           capture_output=True, text=True, timeout=5, cwd=INSTALL)
        return r.stdout.strip() if r.returncode == 0 else ""
    except Exception:
        return ""

_update_log: list[str] = []
_backup_log: list[str] = []
_updating = False
_backing_up = False
_last_update: str = ""
_last_backup: str = ""
_lock = threading.Lock()

# ── Helpers ────────────────────────────────────────────────────

def _run(cmd: list, timeout: int = 30) -> tuple[int, str]:
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.returncode, (r.stdout + r.stderr).strip()
    except subprocess.TimeoutExpired:
        return 1, "Timeout"
    except Exception as e:
        return 1, str(e)

def _svc_status(svc: str) -> str:
    rc, _ = _run(["systemctl", "is-active", svc])
    return "running" if rc == 0 else "stopped"

def _timestamp() -> str:
    from datetime import datetime
    return datetime.now().strftime("%d.%m.%Y %H:%M")

# ── API ────────────────────────────────────────────────────────

@app.get("/api/version")
def version():
    return {"version": _read_version(), "commit": _git_short_hash()}

@app.get("/api/status")
def status():
    return {s: _svc_status(s) for s in SERVICES}

@app.post("/api/service/{svc}/{action}")
def svc_action(svc: str, action: str):
    if svc not in SERVICES or action not in ("start", "stop", "restart"):
        return JSONResponse({"ok": False, "msg": "Ungültig"}, 400)
    rc, out = _run(["sudo", "systemctl", action, svc])
    return {"ok": rc == 0, "msg": out or "OK"}

@app.get("/api/logs/{svc}")
def logs(svc: str, n: int = 60):
    if svc not in SERVICES + ["system"]:
        return JSONResponse({"error": "Ungültig"}, 400)
    if svc == "system":
        _, out = _run(["journalctl", "-n", str(n), "--no-pager", "-p", "warning"])
    else:
        _, out = _run(["journalctl", "-n", str(n), "-u", svc, "--no-pager"])
    return {"logs": out}

@app.get("/api/sysinfo")
def sysinfo():
    cpu  = psutil.cpu_percent(interval=0.3)
    mem  = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    temp = ""
    try:
        _, t = _run(["vcgencmd", "measure_temp"])
        temp = t.replace("temp=", "").replace("'C", " °C")
    except Exception:
        pass
    up = int(time.time() - psutil.boot_time())
    d, r = divmod(up, 86400)
    h, r = divmod(r, 3600)
    m = r // 60
    if d > 0:
        uptime_str = f"{d}d {h}h {m}min"
    else:
        uptime_str = f"{h}h {m}min"
    # MongoDB size
    db_size = ""
    try:
        db_path = "/var/lib/mongodb"
        if os.path.isdir(db_path):
            total = sum(
                os.path.getsize(os.path.join(dp, f))
                for dp, _, fns in os.walk(db_path) for f in fns
            )
            db_size = f"{total / 1024**2:.0f} MB"
    except Exception:
        pass
    return {
        "cpu":        round(cpu, 1),
        "ram_used":   round(mem.used  / 1024**3, 2),
        "ram_total":  round(mem.total / 1024**3, 2),
        "ram_pct":    mem.percent,
        "disk_used":  round(disk.used  / 1024**3, 1),
        "disk_total": round(disk.total / 1024**3, 1),
        "disk_pct":   round(disk.percent, 1),
        "temp":       temp,
        "uptime":     uptime_str,
        "db_size":    db_size,
    }

@app.get("/api/network")
def network():
    _, out = _run(["hostname", "-I"])
    parts = out.split() if out else []
    ip = parts[0] if parts else "–"
    rc2, ts = _run(["tailscale", "ip", "-4"])
    tailscale_ip = ts.strip() if rc2 == 0 else "–"
    rc3, _ = _run(["tailscale", "status", "--json"])
    ts_online = "verbunden" if rc3 == 0 else "getrennt"
    return {"local_ip": ip, "tailscale_ip": tailscale_ip, "tailscale_status": ts_online}

@app.post("/api/backup")
def backup(bg: BackgroundTasks):
    global _backing_up, _backup_log
    with _lock:
        if _backing_up:
            return {"ok": False, "msg": "Backup läuft bereits"}
        if _updating:
            return {"ok": False, "msg": "Update läuft — bitte warten"}
        _backup_log = []
        _backing_up = True
    bg.add_task(_do_backup)
    return {"ok": True, "msg": "Backup gestartet"}

@app.get("/api/backup/log")
def backup_log():
    return {"running": _backing_up, "lines": _backup_log[-200:], "last": _last_backup}

@app.post("/api/expo-clear")
def expo_clear():
    rc, out = _run(["sudo", "systemctl", "restart", "inventar-frontend"])
    return {"ok": rc == 0, "msg": "Frontend-Cache geleert und neu gestartet" if rc == 0 else out}

@app.post("/api/update")
def update(bg: BackgroundTasks):
    global _updating, _update_log
    with _lock:
        if _updating:
            return {"ok": False, "msg": "Update läuft bereits"}
        if _backing_up:
            return {"ok": False, "msg": "Backup läuft — bitte warten"}
        _update_log = []
        _updating = True
    bg.add_task(_do_update)
    return {"ok": True, "msg": "Update gestartet"}

@app.get("/api/update/log")
def update_log():
    return {"running": _updating, "lines": _update_log[-200:], "last": _last_update}

@app.post("/api/reboot")
def reboot():
    subprocess.Popen(["sudo", "shutdown", "-r", "+0"])
    return {"ok": True}

@app.post("/api/shutdown")
def shutdown():
    subprocess.Popen(["sudo", "shutdown", "-h", "+0"])
    return {"ok": True}

def _do_backup():
    global _backing_up, _backup_log, _last_backup
    try:
        _backup_log.append("=== Backup gestartet ===")
        if os.path.exists(BACKUP_SH):
            cmd = ["bash", BACKUP_SH]
        else:
            cmd = ["bash", "-c", f"cd {INSTALL} && mongodump --out ~/inventar-backup/$(date +%Y%m%d_%H%M%S)"]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                text=True, cwd=INSTALL)
        for line in proc.stdout:
            _backup_log.append(line.rstrip())
        proc.wait(timeout=300)
        _backup_log.append(f"=== Fertig (Code {proc.returncode}) ===")
        _last_backup = _timestamp()
    except subprocess.TimeoutExpired:
        _backup_log.append("FEHLER: Timeout nach 5 Minuten")
        proc.kill()
    except Exception as e:
        _backup_log.append(f"FEHLER: {e}")
    finally:
        _backing_up = False

def _do_update():
    global _updating, _update_log, _last_update
    try:
        _update_log.append("=== Update gestartet ===")
        cmd = ["bash", UPDATE_SH] if os.path.exists(UPDATE_SH) else \
              ["bash", "-c",
               f"cd {INSTALL} && git pull && "
               f"source backend/.venv/bin/activate && "
               f"pip install --quiet --prefer-binary -r backend/requirements.txt && "
               f"cd frontend && npm install --silent && "
               f"sudo systemctl restart inventar-backend inventar-frontend"]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                text=True, cwd=INSTALL)
        for line in proc.stdout:
            _update_log.append(line.rstrip())
        proc.wait(timeout=600)
        _update_log.append(f"=== Fertig (Code {proc.returncode}) ===")
        _last_update = _timestamp()
        if proc.returncode == 0:
            _update_log.append("Dashboard wird in 3s neu gestartet...")
            subprocess.Popen(
                ["bash", "-c", "sleep 3 && sudo systemctl restart inventar-dashboard"],
                start_new_session=True,
            )
    except subprocess.TimeoutExpired:
        _update_log.append("FEHLER: Timeout nach 10 Minuten")
        proc.kill()
    except Exception as e:
        _update_log.append(f"FEHLER: {e}")
    finally:
        _updating = False

# ── HTML UI ────────────────────────────────────────────────────

HTML = """<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Inventar Pro — Pi Dashboard</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍓</text></svg>">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif;min-height:100vh}
.hdr{background:#161b22;border-bottom:1px solid #30363d;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.hdr h1{font-size:17px;font-weight:700;color:#58a6ff}
.hdr .sub{font-size:12px;color:#8b949e}
.ver-tag{font-size:11px;font-weight:600;color:#3fb950;background:#0d1117;padding:2px 8px;border-radius:12px;border:1px solid #238636;margin-left:8px}
.commit-tag{font-size:10px;color:#8b949e;font-family:monospace;margin-left:4px}
.live-badge{display:flex;align-items:center;gap:6px;font-size:11px;color:#3fb950;font-weight:600}
.live-dot{width:8px;height:8px;border-radius:50%;background:#3fb950;animation:pulse 1.5s infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(0.8)}}
.last-upd{font-size:10px;color:#8b949e;margin-top:2px}
.body{padding:20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}
@media(max-width:700px){.body{grid-template-columns:1fr;padding:12px;gap:12px}.hdr{padding:12px 16px}}
.card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:18px}
.card h2{font-size:13px;font-weight:700;color:#8b949e;text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px}
.svc{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #21262d}
.svc:last-child{border:none}
.dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.dot.running{background:#3fb950;box-shadow:0 0 6px #3fb950}
.dot.stopped{background:#f85149;box-shadow:0 0 6px #f85149}
.dot.unknown{background:#e3b341}
.svc-name{flex:1;font-size:13px}
.svc-btns{display:flex;gap:5px}
.btn{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:6px;border:none;cursor:pointer;font-size:11px;font-weight:600;transition:.15s}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn-green{background:#238636;color:#fff} .btn-green:hover:not(:disabled){background:#2ea043}
.btn-red  {background:#da3633;color:#fff} .btn-red:hover:not(:disabled){background:#f85149}
.btn-blue {background:#1f6feb;color:#fff} .btn-blue:hover:not(:disabled){background:#388bfd}
.btn-gray {background:#21262d;color:#e6edf3;border:1px solid #30363d} .btn-gray:hover:not(:disabled){background:#30363d}
.btn-warn {background:#9e6a03;color:#fff} .btn-warn:hover:not(:disabled){background:#d29922}
.btn-purple{background:#6e40c9;color:#fff} .btn-purple:hover:not(:disabled){background:#8957e5}
.btn-teal {background:#0f7b6c;color:#fff} .btn-teal:hover:not(:disabled){background:#12a589}
.btn-full {width:100%;justify-content:center;padding:8px;font-size:12px;margin-top:6px}
.btn-row  {display:flex;gap:6px;margin-top:6px}
.btn-row .btn{flex:1;justify-content:center}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.info-item{background:#0d1117;border-radius:8px;padding:12px;text-align:center}
.info-val{font-size:22px;font-weight:700;color:#58a6ff}
.info-lbl{font-size:10px;color:#8b949e;margin-top:2px}
.bar{height:4px;background:#21262d;border-radius:2px;margin-top:8px;overflow:hidden}
.bar-fill{height:100%;border-radius:2px;transition:width .5s}
.log-box{background:#0d1117;border-radius:6px;padding:10px;font-family:monospace;font-size:10.5px;line-height:1.55;max-height:280px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;color:#c9d1d9}
.log-tabs{display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap}
.tab{padding:4px 10px;border-radius:5px;background:#21262d;border:none;color:#8b949e;cursor:pointer;font-size:11px}
.tab.active{background:#1f6feb;color:#fff}
.upd-log{background:#0d1117;border-radius:6px;padding:10px;font-family:monospace;font-size:10.5px;max-height:200px;overflow-y:auto;white-space:pre-wrap;color:#c9d1d9;margin-top:10px;display:none}
.spinner{display:inline-block;width:12px;height:12px;border:2px solid #58a6ff;border-top-color:transparent;border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.net-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #21262d;font-size:12px}
.net-row:last-child{border:none}
.net-lbl{color:#8b949e}
.net-val{color:#58a6ff;font-weight:600}
.toast{position:fixed;bottom:20px;right:20px;background:#238636;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;opacity:0;transition:opacity .3s;pointer-events:none;z-index:999}
.toast.show{opacity:1}
.toast.err{background:#da3633}
.status-line{font-size:10px;color:#8b949e;margin-top:8px;text-align:center;font-style:italic}
</style>
</head>
<body>
<div class="hdr">
  <div>
    <h1>🍓 Inventar Pro — Pi Dashboard <span class="ver-tag" id="app-ver">...</span><span class="commit-tag" id="app-commit"></span></h1>
    <div class="sub" id="hostname">Lädt...</div>
  </div>
  <div style="text-align:right">
    <div class="live-badge"><div class="live-dot"></div> LIVE</div>
    <div class="last-upd" id="last-upd">–</div>
  </div>
</div>
<div class="body">

<!-- Services -->
<div class="card">
  <h2>Services</h2>
  <div id="svc-list">Lädt...</div>
</div>

<!-- System-Info -->
<div class="card">
  <h2>System-Info</h2>
  <div class="info-grid" id="sys-grid">Lädt...</div>
</div>

<!-- Netzwerk -->
<div class="card">
  <h2>Netzwerk</h2>
  <div id="net-info">Lädt...</div>
</div>

<!-- Logs -->
<div class="card" style="grid-column:1/-1">
  <h2>Live-Log</h2>
  <div class="log-tabs">
    <button class="tab active" onclick="setLogSvc('inventar-backend',this)">Backend</button>
    <button class="tab" onclick="setLogSvc('inventar-frontend',this)">Frontend</button>
    <button class="tab" onclick="setLogSvc('mongod',this)">MongoDB</button>
    <button class="tab" onclick="setLogSvc('system',this)">System-Warnungen</button>
  </div>
  <div class="log-box" id="log-box">Lädt...</div>
</div>

<!-- Update & Backup -->
<div class="card">
  <h2>Update &amp; Backup</h2>
  <button class="btn btn-blue btn-full" onclick="doUpdate()" id="upd-btn">⬇ Update von GitHub</button>
  <div class="status-line" id="upd-last"></div>
  <button class="btn btn-teal btn-full" onclick="doBackup()" id="bak-btn">💾 Backup erstellen</button>
  <div class="status-line" id="bak-last"></div>
  <div class="upd-log" id="upd-log"></div>
</div>

<!-- Expo QR-Code -->
<div class="card">
  <h2>📱 App öffnen (QR-Code)</h2>
  <div style="text-align:center;padding:10px 0">
    <canvas id="qr-canvas" style="border-radius:8px;background:#fff;padding:12px"></canvas>
    <div style="margin-top:8px;font-size:12px;color:#8b949e" id="qr-url">Lädt...</div>
  </div>
</div>

<!-- Werkzeuge -->
<div class="card">
  <h2>Werkzeuge</h2>
  <button class="btn btn-purple btn-full" onclick="expoCache()">🔄 Frontend-Cache leeren</button>
  <div class="btn-row" style="margin-top:6px">
    <button class="btn btn-gray" onclick="openUrl('http://'+location.hostname+':8002/docs')">📄 API Docs</button>
    <button class="btn btn-gray" onclick="openUrl('http://'+location.hostname+':8081')">🌐 App öffnen</button>
  </div>
</div>

<!-- System -->
<div class="card">
  <h2>System</h2>
  <button class="btn btn-warn btn-full" onclick="if(confirm('Pi wirklich neu starten?'))doPost('/api/reboot','Pi wird neu gestartet...')" style="margin-bottom:8px">↺ Pi neu starten</button>
  <button class="btn btn-red  btn-full" onclick="if(confirm('Pi wirklich herunterfahren?'))doPost('/api/shutdown','Pi wird heruntergefahren...')">⏻ Pi herunterfahren</button>
</div>

</div>
<div class="toast" id="toast"></div>
<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
<script>
let logSvc='inventar-backend';
const SVC_LABELS={'inventar-backend':'Backend','inventar-frontend':'Frontend','mongod':'MongoDB'};

function toast(msg,err=false){
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='toast'+(err?' err':'');
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3000);
}

async function api(url){
  try{const r=await fetch(url);return r.json()}
  catch(e){return null}
}
async function apiPost(url){
  try{const r=await fetch(url,{method:'POST'});return r.json()}
  catch(e){return {ok:false,msg:'Verbindung fehlgeschlagen'}}
}

async function doPost(url,msg){
  const d=await apiPost(url);
  toast(d.ok!==false ? msg : (d.msg||'Fehler'), d.ok===false);
}

function setBusy(busy){
  document.getElementById('upd-btn').disabled=busy;
  document.getElementById('bak-btn').disabled=busy;
}

async function refreshStatus(){
  const d=await api('/api/status');
  if(!d)return;
  const el=document.getElementById('svc-list');
  el.innerHTML=Object.entries(d).map(([s,st])=>`
    <div class="svc">
      <div class="dot ${st}"></div>
      <div class="svc-name">${SVC_LABELS[s]||s}<br><span style="font-size:10px;color:#8b949e">${st}</span></div>
      <div class="svc-btns">
        <button class="btn btn-green" title="Starten"  onclick="svcAct('${s}','start')">▶</button>
        <button class="btn btn-red"   title="Stoppen"  onclick="svcAct('${s}','stop')">■</button>
        <button class="btn btn-blue"  title="Neustart" onclick="svcAct('${s}','restart')">↺</button>
      </div>
    </div>`).join('');
}

async function svcAct(svc,action){
  const r=await apiPost(`/api/service/${svc}/${action}`);
  toast(r.ok ? `${SVC_LABELS[svc]||svc}: ${action}` : r.msg, !r.ok);
  setTimeout(refreshStatus,1500);
}

async function refreshSys(){
  const d=await api('/api/sysinfo');
  if(!d)return;
  document.getElementById('hostname').textContent=`Uptime: ${d.uptime} | ${d.temp}`;
  const dbRow=d.db_size ? `<div class="info-item"><div class="info-val">${d.db_size}</div><div class="info-lbl">MongoDB</div></div>` : '';
  document.getElementById('sys-grid').innerHTML=`
    <div class="info-item"><div class="info-val">${d.cpu}%</div><div class="info-lbl">CPU</div><div class="bar"><div class="bar-fill" style="width:${d.cpu}%;background:${d.cpu>80?'#f85149':'#3fb950'}"></div></div></div>
    <div class="info-item"><div class="info-val">${d.ram_used}GB</div><div class="info-lbl">RAM / ${d.ram_total}GB</div><div class="bar"><div class="bar-fill" style="width:${d.ram_pct}%;background:${d.ram_pct>85?'#f85149':'#58a6ff'}"></div></div></div>
    <div class="info-item"><div class="info-val">${d.disk_used}GB</div><div class="info-lbl">Disk / ${d.disk_total}GB</div><div class="bar"><div class="bar-fill" style="width:${d.disk_pct}%;background:${d.disk_pct>85?'#f85149':'#e3b341'}"></div></div></div>
    <div class="info-item"><div class="info-val">${d.temp||'–'}</div><div class="info-lbl">Temperatur</div></div>
    ${dbRow}`;
}

async function refreshNet(){
  const d=await api('/api/network');
  if(!d)return;
  document.getElementById('net-info').innerHTML=`
    <div class="net-row"><span class="net-lbl">Lokale IP</span><span class="net-val">${d.local_ip}</span></div>
    <div class="net-row"><span class="net-lbl">Tailscale IP</span><span class="net-val">${d.tailscale_ip}</span></div>
    <div class="net-row"><span class="net-lbl">Tailscale</span><span class="net-val">${d.tailscale_status}</span></div>`;
}

async function refreshLog(){
  const d=await api(`/api/logs/${logSvc}?n=60`);
  if(!d)return;
  const box=document.getElementById('log-box');
  const atBottom=box.scrollHeight-box.scrollTop-box.clientHeight<40;
  box.textContent=d.logs||'(leer)';
  if(atBottom)box.scrollTop=box.scrollHeight;
}

function setLogSvc(svc,btn){
  logSvc=svc;
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  refreshLog();
}

function openUrl(url){window.open(url,'_blank')}

async function expoCache(){
  const r=await apiPost('/api/expo-clear');
  toast(r.ok ? r.msg : r.msg, !r.ok);
  setTimeout(refreshStatus,2000);
}

function _startTask(btn,label,logEl){
  btn.disabled=true; btn.innerHTML=`<span class="spinner"></span> ${label}`;
  setBusy(true);
  logEl.style.display='block'; logEl.textContent='';
}

async function doUpdate(){
  const btn=document.getElementById('upd-btn');
  const log=document.getElementById('upd-log');
  _startTask(btn,'Update läuft...',log);
  await apiPost('/api/update');
  const iv=setInterval(async()=>{
    const d=await api('/api/update/log');
    if(!d)return;
    log.textContent=d.lines.join('\\n');
    log.scrollTop=log.scrollHeight;
    if(d.last)document.getElementById('upd-last').textContent='Letztes Update: '+d.last;
    if(!d.running){
      clearInterval(iv);
      btn.disabled=false; btn.innerHTML='⬇ Update von GitHub';
      setBusy(false);
      toast('Update abgeschlossen! Dashboard startet neu...');
      setTimeout(()=>{
        const tryReload=setInterval(()=>{
          fetch('/api/status').then(()=>{clearInterval(tryReload);location.reload()}).catch(()=>{});
        },2000);
      },4000);
    }
  },1500);
}

async function doBackup(){
  const btn=document.getElementById('bak-btn');
  const log=document.getElementById('upd-log');
  _startTask(btn,'Backup läuft...',log);
  await apiPost('/api/backup');
  const iv=setInterval(async()=>{
    const d=await api('/api/backup/log');
    if(!d)return;
    log.textContent=d.lines.join('\\n');
    log.scrollTop=log.scrollHeight;
    if(d.last)document.getElementById('bak-last').textContent='Letztes Backup: '+d.last;
    if(!d.running){
      clearInterval(iv);
      btn.disabled=false; btn.innerHTML='💾 Backup erstellen';
      setBusy(false);
      toast('Backup abgeschlossen!');
    }
  },1500);
}

function updateTimestamp(){
  const now=new Date();
  document.getElementById('last-upd').textContent='Aktualisiert: '+now.toLocaleTimeString('de-DE');
}

async function loadVersion(){
  const d=await api('/api/version');
  if(!d)return;
  document.getElementById('app-ver').textContent='v'+d.version;
  if(d.commit)document.getElementById('app-commit').textContent='('+d.commit+')';
}

async function loadLastTimes(){
  const u=await api('/api/update/log');
  const b=await api('/api/backup/log');
  if(u&&u.last)document.getElementById('upd-last').textContent='Letztes Update: '+u.last;
  if(b&&b.last)document.getElementById('bak-last').textContent='Letztes Backup: '+b.last;
}

async function refreshAll(){
  await Promise.all([refreshStatus(), refreshSys(), refreshNet(), refreshLog()]);
  updateTimestamp();
}

function renderQR(){
  fetch('/api/network').then(r=>r.json()).then(d=>{
    const url='http://'+d.local_ip+':8081';
    const qr=qrcode(0,'M');
    qr.addData(url);
    qr.make();
    const canvas=document.getElementById('qr-canvas');
    const size=180, modules=qr.getModuleCount(), cell=size/modules;
    canvas.width=size; canvas.height=size;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,size,size);
    ctx.fillStyle='#000';
    for(let r=0;r<modules;r++)for(let c=0;c<modules;c++)if(qr.isDark(r,c))ctx.fillRect(c*cell,r*cell,cell+0.5,cell+0.5);
    document.getElementById('qr-url').textContent=url;
  }).catch(()=>{document.getElementById('qr-url').textContent='QR-Code nicht verfügbar';});
}

refreshAll();
loadVersion();
loadLastTimes();
renderQR();
setInterval(refreshStatus, 3000);
setInterval(refreshSys,    3000);
setInterval(refreshNet,   15000);
setInterval(refreshLog,    3000);
setInterval(updateTimestamp, 1000);
</script>
</body>
</html>"""

@app.get("/", response_class=HTMLResponse)
def index():
    return HTML

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="warning")
