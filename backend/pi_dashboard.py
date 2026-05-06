#!/usr/bin/env python3
"""
Inventar Pro — Pi Web-Dashboard
Port: 8080  |  http://PI-IP:8080
"""
import subprocess, os, time
from fastapi import FastAPI, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn, psutil

app = FastAPI(title="Pi Dashboard")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

SERVICES   = ["inventar-backend", "inventar-frontend", "mongod"]
INSTALL    = os.path.expanduser("~/inventar")
UPDATE_SH  = os.path.join(INSTALL, "pi-setup", "update.sh")
_update_log: list[str] = []
_updating   = False

# ── Helpers ────────────────────────────────────────────────────

def _run(cmd: list) -> tuple[int, str]:
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    return r.returncode, (r.stdout + r.stderr).strip()

def _svc_status(svc: str) -> str:
    rc, _ = _run(["systemctl", "is-active", svc])
    return "running" if rc == 0 else "stopped"

# ── API ────────────────────────────────────────────────────────

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
    h, r = divmod(up, 3600); m = r // 60
    return {
        "cpu":        round(cpu, 1),
        "ram_used":   round(mem.used  / 1024**3, 2),
        "ram_total":  round(mem.total / 1024**3, 2),
        "ram_pct":    mem.percent,
        "disk_used":  round(disk.used  / 1024**3, 1),
        "disk_total": round(disk.total / 1024**3, 1),
        "disk_pct":   round(disk.percent, 1),
        "temp":       temp,
        "uptime":     f"{h}h {m}min",
    }

@app.post("/api/update")
def update(bg: BackgroundTasks):
    global _updating, _update_log
    if _updating:
        return {"ok": False, "msg": "Update läuft bereits"}
    _update_log = []
    _updating   = True
    bg.add_task(_do_update)
    return {"ok": True, "msg": "Update gestartet"}

@app.get("/api/update/log")
def update_log():
    return {"running": _updating, "lines": _update_log[-200:]}

@app.post("/api/reboot")
def reboot():
    subprocess.Popen(["sudo", "shutdown", "-r", "+0"])
    return {"ok": True}

@app.post("/api/shutdown")
def shutdown():
    subprocess.Popen(["sudo", "shutdown", "-h", "+0"])
    return {"ok": True}

def _do_update():
    global _updating, _update_log
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
        proc.wait()
        _update_log.append(f"=== Fertig (Code {proc.returncode}) ===")
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
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif;min-height:100vh}
.hdr{background:#161b22;border-bottom:1px solid #30363d;padding:14px 24px;display:flex;align-items:center;gap:12px}
.hdr h1{font-size:17px;font-weight:700;color:#58a6ff}
.hdr .sub{font-size:12px;color:#8b949e}
.body{padding:20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}
.card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:18px}
.card h2{font-size:13px;font-weight:700;color:#8b949e;text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px}
/* Status */
.svc{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #21262d}
.svc:last-child{border:none}
.dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.dot.running{background:#3fb950;box-shadow:0 0 6px #3fb950}
.dot.stopped{background:#f85149;box-shadow:0 0 6px #f85149}
.dot.unknown{background:#e3b341}
.svc-name{flex:1;font-size:13px}
.svc-btns{display:flex;gap:5px}
/* Buttons */
btn,.btn{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:6px;border:none;cursor:pointer;font-size:11px;font-weight:600;transition:.15s}
.btn-green{background:#238636;color:#fff} .btn-green:hover{background:#2ea043}
.btn-red  {background:#da3633;color:#fff} .btn-red:hover{background:#f85149}
.btn-blue {background:#1f6feb;color:#fff} .btn-blue:hover{background:#388bfd}
.btn-gray {background:#21262d;color:#e6edf3;border:1px solid #30363d} .btn-gray:hover{background:#30363d}
.btn-warn {background:#9e6a03;color:#fff} .btn-warn:hover{background:#d29922}
.btn-full {width:100%;justify-content:center;padding:8px;font-size:12px;margin-top:6px}
/* Sysinfo */
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.info-item{background:#0d1117;border-radius:8px;padding:12px;text-align:center}
.info-val{font-size:22px;font-weight:700;color:#58a6ff}
.info-lbl{font-size:10px;color:#8b949e;margin-top:2px}
.bar{height:4px;background:#21262d;border-radius:2px;margin-top:8px;overflow:hidden}
.bar-fill{height:100%;border-radius:2px;transition:width .5s}
/* Logs */
.log-box{background:#0d1117;border-radius:6px;padding:10px;font-family:monospace;font-size:10.5px;line-height:1.55;max-height:280px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;color:#c9d1d9}
.log-tabs{display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap}
.tab{padding:4px 10px;border-radius:5px;background:#21262d;border:none;color:#8b949e;cursor:pointer;font-size:11px}
.tab.active{background:#1f6feb;color:#fff}
/* Update log */
.upd-log{background:#0d1117;border-radius:6px;padding:10px;font-family:monospace;font-size:10.5px;max-height:200px;overflow-y:auto;white-space:pre-wrap;color:#c9d1d9;margin-top:10px;display:none}
.spinner{display:inline-block;width:12px;height:12px;border:2px solid #58a6ff;border-top-color:transparent;border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="hdr">
  <div>
    <h1>🍓 Inventar Pro — Pi Dashboard</h1>
    <div class="sub" id="hostname">Lädt...</div>
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

<!-- Logs -->
<div class="card" style="grid-column:1/-1">
  <h2>Live-Log</h2>
  <div class="log-tabs">
    <button class="tab active" onclick="setLogSvc('inventar-backend',this)">Backend</button>
    <button class="tab" onclick="setLogSvc('inventar-frontend',this)">Frontend</button>
    <button class="tab" onclick="setLogSvc('mongod',this)">MongoDB</button>
  </div>
  <div class="log-box" id="log-box">Lädt...</div>
</div>

<!-- Update -->
<div class="card">
  <h2>Update &amp; Wartung</h2>
  <button class="btn btn-blue btn-full" onclick="doUpdate()" id="upd-btn">⬇ Update von GitHub</button>
  <div class="upd-log" id="upd-log"></div>
</div>

<!-- System -->
<div class="card">
  <h2>System</h2>
  <button class="btn btn-warn btn-full" onclick="if(confirm('Pi wirklich neu starten?'))apiPost('/api/reboot')" style="margin-bottom:8px">↺ Pi neu starten</button>
  <button class="btn btn-red  btn-full" onclick="if(confirm('Pi wirklich herunterfahren?'))apiPost('/api/shutdown')">⏻ Pi herunterfahren</button>
</div>

</div>
<script>
let logSvc='inventar-backend';

const SVC_LABELS={'inventar-backend':'Backend','inventar-frontend':'Frontend','mongod':'MongoDB'};

async function api(url){const r=await fetch(url);return r.json()}
async function apiPost(url){const r=await fetch(url,{method:'POST'});return r.json()}

async function refreshStatus(){
  const d=await api('/api/status');
  const el=document.getElementById('svc-list');
  el.innerHTML=Object.entries(d).map(([s,st])=>`
    <div class="svc">
      <div class="dot ${st}"></div>
      <div class="svc-name">${SVC_LABELS[s]||s}<br><span style="font-size:10px;color:#8b949e">${st}</span></div>
      <div class="svc-btns">
        <button class="btn btn-green" onclick="svcAct('${s}','start')">▶</button>
        <button class="btn btn-red"   onclick="svcAct('${s}','stop')">■</button>
        <button class="btn btn-blue"  onclick="svcAct('${s}','restart')">↺</button>
      </div>
    </div>`).join('');
}

async function svcAct(svc,action){
  const r=await apiPost(`/api/service/${svc}/${action}`);
  setTimeout(refreshStatus,1500);
}

async function refreshSys(){
  const d=await api('/api/sysinfo');
  document.getElementById('hostname').textContent=`Uptime: ${d.uptime} | ${d.temp}`;
  document.getElementById('sys-grid').innerHTML=`
    <div class="info-item"><div class="info-val">${d.cpu}%</div><div class="info-lbl">CPU</div><div class="bar"><div class="bar-fill" style="width:${d.cpu}%;background:${d.cpu>80?'#f85149':'#3fb950'}"></div></div></div>
    <div class="info-item"><div class="info-val">${d.ram_used}GB</div><div class="info-lbl">RAM / ${d.ram_total}GB</div><div class="bar"><div class="bar-fill" style="width:${d.ram_pct}%;background:${d.ram_pct>85?'#f85149':'#58a6ff'}"></div></div></div>
    <div class="info-item"><div class="info-val">${d.disk_used}GB</div><div class="info-lbl">Disk / ${d.disk_total}GB</div><div class="bar"><div class="bar-fill" style="width:${d.disk_pct}%;background:${d.disk_pct>85?'#f85149':'#e3b341'}"></div></div></div>
    <div class="info-item"><div class="info-val">${d.temp||'–'}</div><div class="info-lbl">Temperatur</div></div>`;
}

async function refreshLog(){
  const d=await api(`/api/logs/${logSvc}?n=60`);
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

async function doUpdate(){
  const btn=document.getElementById('upd-btn');
  const log=document.getElementById('upd-log');
  btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Update läuft...';
  log.style.display='block'; log.textContent='';
  await apiPost('/api/update');
  const iv=setInterval(async()=>{
    const d=await api('/api/update/log');
    log.textContent=d.lines.join('\n');
    log.scrollTop=log.scrollHeight;
    if(!d.running){
      clearInterval(iv);
      btn.disabled=false; btn.innerHTML='⬇ Update von GitHub';
      setTimeout(refreshStatus,2000);
    }
  },1500);
}

// Init + Polling
refreshStatus(); refreshSys(); refreshLog();
setInterval(refreshStatus,5000);
setInterval(refreshSys,10000);
setInterval(refreshLog,8000);
</script>
</body>
</html>"""

@app.get("/", response_class=HTMLResponse)
def index():
    return HTML

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="warning")
