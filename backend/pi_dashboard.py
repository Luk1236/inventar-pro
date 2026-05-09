#!/usr/bin/env python3
"""
Inventar Pro — Pi Web-Dashboard (ohne Anmeldung)
Port: 8080  |  http://PI-IP:8080
"""
import subprocess, os, time, threading, shlex, logging, json
from fastapi import FastAPI, BackgroundTasks, Body, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn, psutil

logger = logging.getLogger("dashboard")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Pi Dashboard")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

ALLOWED_SHELL_COMMANDS = {
    "ls", "cat", "head", "tail", "grep", "find", "wc",
    "df", "du", "free", "top", "htop", "uptime", "uname",
    "ps", "systemctl", "journalctl", "ip", "hostname", "ping",
    "git", "npm", "python3", "pip", "node",
    "mongodump", "mongorestore", "mongo", "mongosh",
    "date", "whoami", "pwd", "env", "echo", "which",
    "docker", "tailscale", "sudo",
}

SERVICES     = ["inventar-backend", "mongod"]
INSTALL      = os.path.expanduser("~/inventar")
VERSION_FILE = os.path.join(INSTALL, "VERSION")
UPDATE_SH    = os.path.join(INSTALL, "pi-setup", "update.sh")
BACKUP_SH    = os.path.join(INSTALL, "pi-setup", "backup.sh")

def _timestamp() -> str:
    from datetime import datetime
    return datetime.now().strftime("%d.%m.%Y %H:%M")

def _run(cmd: list, timeout: int = 60):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip(), r.stderr.strip(), r.returncode
    except subprocess.TimeoutExpired:
        return "", "Timeout", 1
    except Exception as e:
        return "", str(e), 1

def _is_command_allowed(cmd: str) -> bool:
    try:
        tokens = shlex.split(cmd.strip())
        if not tokens:
            return False
        base = os.path.basename(tokens[0])
        return base in ALLOWED_SHELL_COMMANDS
    except ValueError:
        return False

# ── API Endpoints ──────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"ok": True}

@app.get("/api/version")
async def version():
    try:
        with open(VERSION_FILE) as f:
            return {"version": f.read().strip()}
    except:
        return {"version": "unknown"}

@app.get("/api/hostname")
async def hostname():
    return {"hostname": os.uname().nodename}

@app.get("/api/services")
async def get_services():
    result = []
    for svc in SERVICES:
        out, err, code = _run(["systemctl", "is-active", svc])
        active = out.strip() == "active"
        result.append({"name": svc, "active": active, "status": out.strip()})
    return result

@app.post("/api/service/{name}/{action}")
async def service_action(name: str, action: str):
    if name not in SERVICES:
        return JSONResponse({"ok": False, "msg": "Unknown service"}, 400)
    if action not in ["start", "stop", "restart"]:
        return JSONResponse({"ok": False, "msg": "Invalid action"}, 400)
    out, err, code = _run(["sudo", "systemctl", action, name])
    if code == 0:
        return {"ok": True, "msg": f"{name} {action} erfolgreich"}
    return JSONResponse({"ok": False, "msg": err or out}, 500)

@app.get("/api/system")
async def system_info():
    cpu = psutil.cpu_percent(interval=0.5)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    temp = "N/A"
    try:
        temp_out, _, _ = _run(["vcgencmd", "measure_temp"])
        if "temp=" in temp_out:
            temp = temp_out.split("=")[1].strip()
    except:
        pass
    return {
        "cpu_percent": cpu,
        "mem_percent": mem.percent,
        "mem_used_gb": round(mem.used / (1024**3), 1),
        "mem_total_gb": round(mem.total / (1024**3), 1),
        "disk_percent": disk.percent,
        "disk_used_gb": round(disk.used / (1024**3), 1),
        "disk_total_gb": round(disk.total / (1024**3), 1),
        "temp": temp,
        "uptime": _run(["uptime", "-p"])[0].replace("up ", ""),
    }

@app.get("/api/logs/{service}")
async def get_logs(service: str, lines: int = 100):
    if service == "system":
        out, err, code = _run(["journalctl", "-n", str(lines), "-p", "warning", "--no-pager"])
    elif service in SERVICES or service == "inventar-frontend":
        out, err, code = _run(["journalctl", "-u", service, "-n", str(lines), "--no-pager"])
    else:
        return JSONResponse({"ok": False, "msg": "Unknown service"}, 400)
    return {"logs": out}

@app.get("/api/network")
async def network():
    ip_out, _, _ = _run(["hostname", "-I"])
    ip = ip_out.split()[0] if ip_out else "N/A"
    ts_out, _, _ = _run(["tailscale", "ip", "-4"])
    ts_ip = ts_out.strip() if ts_out else "N/A"
    return {
        "local_ip": ip,
        "tailscale_ip": ts_ip,
        "tailscale_status": _run(["tailscale", "status"])[0][:100] if ts_ip != "N/A" else "N/A",
    }

@app.post("/api/update")
async def do_update(background_tasks: BackgroundTasks):
    def run_update():
        subprocess.call(["bash", UPDATE_SH])
    background_tasks.add_task(run_update)
    return {"ok": True, "msg": "Update gestartet..."}

@app.post("/api/backup")
async def do_backup():
    if os.path.exists(BACKUP_SH):
        out, err, code = _run(["bash", BACKUP_SH], timeout=300)
        if code == 0:
            return {"ok": True, "msg": "Backup erstellt"}
        return JSONResponse({"ok": False, "msg": err or "Backup fehlgeschlagen"}, 500)
    return JSONResponse({"ok": False, "msg": "Backup-Script nicht gefunden"}, 404)

@app.post("/api/reboot")
async def reboot():
    subprocess.Popen(["sudo", "reboot"])
    return {"ok": True, "msg": "Reboot gestartet..."}

@app.post("/api/shutdown")
async def shutdown():
    subprocess.Popen(["sudo", "shutdown", "-h", "now"])
    return {"ok": True, "msg": "Shutdown gestartet..."}

@app.post("/api/shell")
async def shell(body: dict = Body(...)):
    cmd = body.get("command", "").strip()
    if not cmd:
        return JSONResponse({"ok": False, "msg": "Kein Befehl"}, 400)
    if not _is_command_allowed(cmd):
        return JSONResponse({"ok": False, "msg": "Befehl nicht erlaubt"}, 403)
    out, err, code = _run(cmd, timeout=30)
    return {"ok": code == 0, "stdout": out, "stderr": err, "returncode": code}

@app.post("/api/expo-cache")
async def expo_cache():
    frontend = os.path.join(INSTALL, "frontend")
    if not os.path.exists(frontend):
        return JSONResponse({"ok": False, "msg": "Frontend nicht gefunden"}, 404)
    subprocess.Popen(["bash", "-c", f"cd {frontend} && npx expo start --clear --web --port 8081"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return {"ok": True, "msg": "Expo Cache cleared, restarting..."}

# ── HTML Dashboard ──────────────────────────────────────────────

HTML = """<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Inventar Pro — Pi Dashboard</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍓</text></svg>">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0d1117;color:#e6edf3;min-height:100vh}
.hdr{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:#161b22;border-bottom:1px solid #30363d}
.hdr h1{font-size:18px;color:#e6edf3;font-weight:600}
.hdr h1 span{font-size:11px;color:#8b949e;margin-left:8px}
.sub{color:#8b949e;font-size:11px;margin-top:2px}
.body{padding:16px;display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:14px}
.card h2{font-size:13px;color:#e6edf3;margin-bottom:10px;font-weight:600}
.btn{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:6px;border:1px solid #30363d;background:#21262d;color:#e6edf3;cursor:pointer;font-size:12px}
.btn:hover:not(:disabled){background:#30363d}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn-blue{background:#1f6feb;color:#fff;border-color:#1f6feb}
.btn-blue:hover:not(:disabled){background:#388bfd}
.btn-green{background:#238636;color:#fff;border-color:#238636}
.btn-green:hover:not(:disabled){background:#2ea043}
.btn-red{background:#da3633;color:#fff;border-color:#da3633}
.btn-red:hover:not(:disabled){background:#f85149}
.btn-warn{background:#9e6a03;color:#fff;border-color:#9e6a03}
.btn-full{width:100%;justify-content:center;padding:8px;margin-top:6px}
.btn-gray{background:#21262d;color:#8b949e}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.info-row{display:flex;justify-content:space-between;padding:4px 0;font-size:11px}
.info-lbl{color:#8b949e}
.info-val{color:#58a6ff;font-weight:500}
.log-box{background:#0d1117;border-radius:6px;padding:10px;font-family:monospace;font-size:11px;max-height:250px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;color:#c9d1d9}
.log-tabs{display:flex;gap:6px;margin-bottom:8px}
.tab{padding:4px 10px;border-radius:5px;background:#21262d;border:none;color:#8b949e;cursor:pointer;font-size:11px}
.tab.active{background:#1f6feb;color:#fff}
.spinner{display:inline-block;width:12px;height:12px;border:2px solid #58a6ff;border-top-color:transparent;border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.svc-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #30363d}
.svc-row:last-child{border:none}
.svc-name{font-weight:600;color:#e6edf3;font-size:13px}
.svc-status{font-size:11px;padding:3px 8px;border-radius:12px}
.svc-status.running{background:#238636;color:#fff}
.svc-status.stopped{background:#da3633;color:#fff}
.svc-actions{display:flex;gap:4px}
.ver-tag{background:#238636;color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;margin-left:6px}
</style>
</head>
<body>
<div class="hdr">
  <div>
    <h1>🍓 Inventar Pro — Pi Dashboard <span id="ver"></span></h1>
    <div class="sub" id="hostname">Lädt...</div>
  </div>
  <div style="font-size:11px;color:#8b949e" id="uptime"></div>
</div>
<div class="body">

<!-- Services -->
<div class="card">
  <h2>Services</h2>
  <div id="services">Lädt...</div>
</div>

<!-- System -->
<div class="card">
  <h2>System</h2>
  <div class="info-grid" id="sys-grid">Lädt...</div>
</div>

<!-- Network -->
<div class="card">
  <h2>Netzwerk</h2>
  <div class="info-grid" id="net-grid">Lädt...</div>
</div>

<!-- Logs -->
<div class="card" style="grid-column:1/-1">
  <h2>Logs</h2>
  <div class="log-tabs">
    <button class="tab active" onclick="loadLogs('inventar-backend',this)">Backend</button>
    <button class="tab" onclick="loadLogs('mongod',this)">MongoDB</button>
    <button class="tab" onclick="loadLogs('system',this)">System</button>
  </div>
  <div class="log-box" id="log-box">Lädt...</div>
</div>

<!-- Actions -->
<div class="card">
  <h2>Aktionen</h2>
  <button class="btn btn-blue btn-full" onclick="doAction('/api/update','Update gestartet...')">⬇ Update von GitHub</button>
  <button class="btn btn-green btn-full" onclick="doAction('/api/backup','Backup gestartet...')">💾 Backup erstellen</button>
  <button class="btn btn-gray btn-full" onclick="loadAll()">↻ Aktualisieren</button>
</div>

<!-- System Actions -->
<div class="card">
  <h2>System</h2>
  <button class="btn btn-warn btn-full" onclick="if(confirm('Pi neu starten?'))doAction('/api/reboot','Reboot...')">↺ Pi neu starten</button>
  <button class="btn btn-red btn-full" onclick="if(confirm('Pi herunterfahren?'))doAction('/api/shutdown','Shutdown...')">⏻ Herunterfahren</button>
</div>

</div>

<script>
let currentLog='inventar-backend';

async function loadAll(){
  loadServices();
  loadSystem();
  loadNetwork();
  loadLogs(currentLog);
  loadVersion();
  loadHostname();
}

async function loadServices(){
  const r=await fetch('/api/services');
  const d=await r.json();
  const el=document.getElementById('services');
  el.innerHTML=d.map(s=>`
    <div class="svc-row">
      <div>
        <div class="svc-name">${s.name}</div>
        <span class="svc-status ${s.active?'running':'stopped'}">${s.status}</span>
      </div>
      <div class="svc-actions">
        <button class="btn btn-gray" onclick="svcAct('${s.name}','restart')">↺</button>
        <button class="btn btn-gray" onclick="svcAct('${s.name}','stop')">⏹</button>
      </div>
    </div>
  `).join('');
}

async function loadSystem(){
  const r=await fetch('/api/system');
  const d=await r.json();
  document.getElementById('sys-grid').innerHTML=`
    <div class="info-row"><span class="info-lbl">CPU</span><span class="info-val">${d.cpu_percent}%</span></div>
    <div class="info-row"><span class="info-lbl">RAM</span><span class="info-val">${d.mem_percent}% (${d.mem_used_gb}/${d.mem_total_gb} GB)</span></div>
    <div class="info-row"><span class="info-lbl">Disk</span><span class="info-val">${d.disk_percent}% (${d.disk_used_gb}/${d.disk_total_gb} GB)</span></div>
    <div class="info-row"><span class="info-lbl">Temp</span><span class="info-val">${d.temp}</span></div>
  `;
  document.getElementById('uptime').textContent='Uptime: '+d.uptime;
}

async function loadNetwork(){
  const r=await fetch('/api/network');
  const d=await r.json();
  document.getElementById('net-grid').innerHTML=`
    <div class="info-row"><span class="info-lbl">IP</span><span class="info-val">${d.local_ip}</span></div>
    <div class="info-row"><span class="info-lbl">Tailscale</span><span class="info-val">${d.tailscale_ip}</span></div>
  `;
}

async function loadLogs(svc,btn){
  currentLog=svc;
  if(btn){document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));btn.classList.add('active')}
  const r=await fetch(`/api/logs/${svc}?lines=100`);
  const d=await r.json();
  document.getElementById('log-box').textContent=d.logs||'Keine Logs';
}

async function loadVersion(){
  const r=await fetch('/api/version');
  const d=await r.json();
  document.getElementById('ver').textContent=d.version||'';
}

async function loadHostname(){
  const r=await fetch('/api/hostname');
  const d=await r.json();
  document.getElementById('hostname').textContent=d.hostname;
}

async function svcAct(name,action){
  const btn=event.target;
  btn.disabled=true;
  await fetch(`/api/service/${name}/${action}`,{method:'POST'});
  setTimeout(loadServices,1000);
  btn.disabled=false;
}

async function doAction(url,msg){
  const btn=event.target;
  btn.disabled=true;
  btn.innerHTML='<span class="spinner"></span> '+msg;
  await fetch(url,{method:'POST'});
  setTimeout(()=>{btn.disabled=false;btn.innerHTML=btn.innerHTML.replace('<span class="spinner"></span> ','')},2000);
}

loadAll();
setInterval(loadAll,5000);
</script>
</body>
</html>"""

@app.get("/", response_class=HTMLResponse)
def index():
    return HTML

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")