#!/usr/bin/env python3
"""
Inventar Pro — Pi Web-Dashboard
Port: 8080  |  http://PI-IP:8080
"""
import subprocess, os, time, threading, secrets, shlex, logging, json, smtplib
from email.mime.text import MIMEText
from fastapi import FastAPI, BackgroundTasks, Body, Request, Cookie
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware

# Direkte bcrypt-Nutzung statt passlib (passlib 1.7.4 ist inkompatibel mit bcrypt 5.0+)
import bcrypt as _bcrypt_module

class _BcryptDirectContext:
    """Drop-in replacement for passlib's CryptContext — robust against bcrypt 5.0+."""

    @staticmethod
    def _to_bytes(s) -> bytes:
        if isinstance(s, bytes):
            return s[:72]
        return s.encode('utf-8')[:72]

    def hash(self, password) -> str:
        return _bcrypt_module.hashpw(
            self._to_bytes(password),
            _bcrypt_module.gensalt(12)
        ).decode('utf-8')

    def verify(self, plain, hashed) -> bool:
        if not plain or not hashed:
            return False
        try:
            hashed_bytes = hashed.encode('utf-8') if isinstance(hashed, str) else hashed
            return _bcrypt_module.checkpw(self._to_bytes(plain), hashed_bytes)
        except (ValueError, TypeError):
            return False

class CryptContext:  # noqa: F811 — Compat-Klasse, ersetzt passlib.CryptContext
    """passlib.CryptContext Drop-in für bcrypt — ignoriert Schemes-Argument."""
    def __init__(self, *_args, **_kwargs):
        self._ctx = _BcryptDirectContext()
    def hash(self, p): return self._ctx.hash(p)
    def verify(self, p, h): return self._ctx.verify(p, h)
import uvicorn, psutil

logger = logging.getLogger("dashboard")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Pi Dashboard")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://127.0.0.1:8080"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# ── Auth ──────────────────────────────────────────────────────
DASH_PASSWORD_FILE = os.path.expanduser("~/.dashboard_password")
DASH_TOTP_FILE = os.path.expanduser("~/.dashboard_totp_secret")
_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
_active_tokens: dict[str, float] = {}
SESSION_TIMEOUT = 3600
MAX_LOGIN_ATTEMPTS = 5
LOGIN_LOCKOUT_SECONDS = 300
_login_attempts: dict[str, list[float]] = {}

try:
    import pyotp
    _TOTP_AVAILABLE = True
except ImportError:
    _TOTP_AVAILABLE = False

ALLOWED_SHELL_COMMANDS = {
    "ls", "cat", "head", "tail", "grep", "find", "wc",
    "df", "du", "free", "top", "htop", "uptime", "uname",
    "ps", "systemctl", "journalctl", "ip", "hostname", "ping",
    "git", "npm", "python3", "pip", "node",
    "mongodump", "mongorestore", "mongo", "mongosh",
    "date", "whoami", "pwd", "env", "echo", "which",
    "docker", "tailscale", "sudo",
}

def _write_password_file(content: str):
    with open(DASH_PASSWORD_FILE, "w") as f:
        f.write(content)
    try:
        os.chmod(DASH_PASSWORD_FILE, 0o600)
    except Exception:
        pass

def _get_stored_hash() -> str:
    if os.path.exists(DASH_PASSWORD_FILE):
        with open(DASH_PASSWORD_FILE) as f:
            stored = f.read().strip()
        if stored.startswith("$2b$") or stored.startswith("$2a$"):
            return stored
        if len(stored) == 64 and all(c in "0123456789abcdef" for c in stored):
            return stored  # SHA-256, migrated on successful login
        new_hash = _pwd_ctx.hash(stored)
        _write_password_file(new_hash)
        return new_hash
    new_hash = _pwd_ctx.hash("admin")
    _write_password_file(new_hash)
    return new_hash

def _verify_password(pw: str) -> bool:
    stored = _get_stored_hash()
    if stored.startswith("$2b$") or stored.startswith("$2a$"):
        try:
            return _pwd_ctx.verify(pw, stored)
        except Exception:
            return False
    import hashlib
    if hashlib.sha256(pw.encode()).hexdigest() == stored:
        _write_password_file(_pwd_ctx.hash(pw))
        logger.info("Passwort von SHA-256 zu bcrypt migriert")
        return True
    return False

def _is_rate_limited(ip: str) -> bool:
    now = time.time()
    attempts = _login_attempts.get(ip, [])
    attempts = [t for t in attempts if now - t < LOGIN_LOCKOUT_SECONDS]
    _login_attempts[ip] = attempts
    return len(attempts) >= MAX_LOGIN_ATTEMPTS

def _record_failed_login(ip: str):
    if ip not in _login_attempts:
        _login_attempts[ip] = []
    _login_attempts[ip].append(time.time())

def _cleanup_tokens():
    now = time.time()
    expired = [t for t, ts in _active_tokens.items() if now - ts > SESSION_TIMEOUT]
    for t in expired:
        del _active_tokens[t]

def _check_auth(request: Request) -> bool:
    if request is None:
        return False
    _cleanup_tokens()
    token = request.cookies.get("dash_token")
    if token and token in _active_tokens:
        _active_tokens[token] = time.time()
        return True
    return False

def _is_command_allowed(cmd: str) -> bool:
    try:
        tokens = shlex.split(cmd.strip())
        if not tokens:
            return False
        base = os.path.basename(tokens[0])
        return base in ALLOWED_SHELL_COMMANDS
    except ValueError:
        return False

def _totp_enabled() -> bool:
    return _TOTP_AVAILABLE and os.path.exists(DASH_TOTP_FILE)

def _get_totp_secret() -> str | None:
    if not _totp_enabled():
        return None
    try:
        with open(DASH_TOTP_FILE) as f:
            return f.read().strip()
    except Exception:
        return None

def _verify_totp(code: str) -> bool:
    if not _TOTP_AVAILABLE:
        return False
    secret = _get_totp_secret()
    if not secret:
        return False
    try:
        return pyotp.TOTP(secret).verify(code, valid_window=1)
    except Exception:
        return False

SERVICES     = ["inventar-backend", "mongod"]
INSTALL      = os.path.expanduser("~/inventar")
VERSION_FILE = os.path.join(INSTALL, "VERSION")
UPDATE_SH    = os.path.join(INSTALL, "pi-setup", "update.sh")
BACKUP_SH    = os.path.join(INSTALL, "pi-setup", "backup.sh")
AUDIT_LOG    = os.path.expanduser("~/.dashboard_audit.jsonl")
MAX_TAGS = 10

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
_temp_history: list[float] = []
_TEMP_HISTORY_MAX = 60

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

def _audit(event: str, **kwargs):
    try:
        entry = {"ts": time.time(), "iso": _timestamp(), "event": event, **kwargs}
        with open(AUDIT_LOG, "a") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception as e:
        logger.warning(f"Audit-Log Fehler: {e}")

def _send_email(subject: str, body: str):
    smtp_host = os.environ.get("SMTP_HOST", "")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pw = os.environ.get("SMTP_PASSWORD", "")
    notify_email = os.environ.get("NOTIFICATION_EMAIL", "")
    if not all([smtp_host, smtp_user, smtp_pw, notify_email]):
        return False
    try:
        msg = MIMEText(body)
        msg["Subject"] = f"[Inventar Pi] {subject}"
        msg["From"] = smtp_user
        msg["To"] = notify_email
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as s:
            s.starttls()
            s.login(smtp_user, smtp_pw)
            s.send_message(msg)
        return True
    except Exception as e:
        logger.error(f"Email-Versand fehlgeschlagen: {e}")
        return False

# ── Auth Endpoints ─────────────────────────────────────────────

@app.post("/api/login")
async def login(request: Request, body: dict = Body(...)):
    ip = request.client.host if request.client else "unknown"
    if _is_rate_limited(ip):
        remaining = LOGIN_LOCKOUT_SECONDS - (time.time() - min(_login_attempts.get(ip, [time.time()])))
        logger.warning(f"Login gesperrt für IP {ip}")
        return JSONResponse({"ok": False, "msg": f"Zu viele Versuche. Gesperrt für {int(remaining)}s"}, status_code=429)
    pw = body.get("password", "")
    totp_code = body.get("totp", "").strip()
    if _verify_password(pw):
        if _totp_enabled():
            if not totp_code:
                return JSONResponse({"ok": False, "needs_totp": True, "msg": "2FA-Code erforderlich"}, status_code=200)
            if not _verify_totp(totp_code):
                _record_failed_login(ip)
                _audit("login_failed_totp", ip=ip)
                return JSONResponse({"ok": False, "needs_totp": True, "msg": "Falscher 2FA-Code"}, status_code=401)
        token = secrets.token_hex(32)
        _active_tokens[token] = time.time()
        resp = JSONResponse({"ok": True})
        resp.set_cookie("dash_token", token, httponly=True, samesite="strict", max_age=SESSION_TIMEOUT)
        logger.info(f"Login erfolgreich von IP {ip}")
        _audit("login_success", ip=ip, totp=_totp_enabled())
        _login_attempts.pop(ip, None)
        return resp
    _record_failed_login(ip)
    attempts_left = MAX_LOGIN_ATTEMPTS - len(_login_attempts.get(ip, []))
    logger.warning(f"Fehlgeschlagener Login von IP {ip} ({attempts_left} Versuche übrig)")
    _audit("login_failed", ip=ip, attempts_left=attempts_left)
    if attempts_left <= 0:
        _send_email("Sicherheitswarnung: IP gesperrt",
                    f"5 fehlgeschlagene Login-Versuche von IP {ip}.\nIP für 5 Minuten gesperrt.")
    return JSONResponse({"ok": False, "msg": "Falsches Passwort"}, status_code=401)

@app.post("/api/logout")
async def logout(request: Request):
    token = request.cookies.get("dash_token")
    _active_tokens.pop(token, None)
    resp = JSONResponse({"ok": True})
    resp.delete_cookie("dash_token")
    return resp

@app.get("/api/auth-check")
async def auth_check(request: Request):
    if _check_auth(request):
        return {"ok": True}
    return JSONResponse({"ok": False}, status_code=401)

@app.post("/api/change-password")
async def change_password(request: Request, body: dict = Body(...)):
    if not _check_auth(request):
        return JSONResponse({"ok": False}, status_code=401)
    new_pw = body.get("password", "").strip()
    if len(new_pw) < 4:
        return JSONResponse({"ok": False, "msg": "Mindestens 4 Zeichen"}, status_code=400)
    _write_password_file(_pwd_ctx.hash(new_pw))
    logger.info(f"Dashboard-Passwort geändert von IP {request.client.host if request.client else 'unknown'}")
    return {"ok": True, "msg": "Passwort geändert"}

@app.get("/api/totp-status")
async def totp_status(request: Request):
    if not _check_auth(request):
        return JSONResponse({"ok": False}, status_code=401)
    return {"available": _TOTP_AVAILABLE, "enabled": _totp_enabled()}

@app.post("/api/totp-setup")
async def totp_setup(request: Request):
    if not _check_auth(request):
        return JSONResponse({"ok": False}, status_code=401)
    if not _TOTP_AVAILABLE:
        return JSONResponse({"ok": False, "msg": "pyotp nicht installiert. Installiere: pip install pyotp"}, status_code=400)
    if _totp_enabled():
        return JSONResponse({"ok": False, "msg": "2FA bereits aktiviert. Erst deaktivieren."}, status_code=400)
    secret = pyotp.random_base32()
    uri = pyotp.TOTP(secret).provisioning_uri(name="Pi-Dashboard", issuer_name="Inventar Pro")
    return {"ok": True, "secret": secret, "uri": uri}

@app.post("/api/totp-confirm")
async def totp_confirm(request: Request, body: dict = Body(...)):
    if not _check_auth(request):
        return JSONResponse({"ok": False}, status_code=401)
    if not _TOTP_AVAILABLE:
        return JSONResponse({"ok": False, "msg": "pyotp nicht installiert"}, status_code=400)
    secret = body.get("secret", "").strip()
    code = body.get("code", "").strip()
    if not secret or not code:
        return JSONResponse({"ok": False, "msg": "secret und code erforderlich"}, status_code=400)
    if not pyotp.TOTP(secret).verify(code, valid_window=1):
        return JSONResponse({"ok": False, "msg": "Falscher Code"}, status_code=400)
    with open(DASH_TOTP_FILE, "w") as f:
        f.write(secret)
    try:
        os.chmod(DASH_TOTP_FILE, 0o600)
    except Exception:
        pass
    _audit("totp_enabled", ip=request.client.host if request.client else "unknown")
    return {"ok": True, "msg": "2FA aktiviert"}

@app.post("/api/totp-disable")
async def totp_disable(request: Request, body: dict = Body(...)):
    if not _check_auth(request):
        return JSONResponse({"ok": False}, status_code=401)
    pw = body.get("password", "")
    if not _verify_password(pw):
        return JSONResponse({"ok": False, "msg": "Falsches Passwort"}, status_code=401)
    if os.path.exists(DASH_TOTP_FILE):
        os.remove(DASH_TOTP_FILE)
    _audit("totp_disabled", ip=request.client.host if request.client else "unknown")
    return {"ok": True, "msg": "2FA deaktiviert"}

# ── API ────────────────────────────────────────────────────────

@app.get("/api/version")
def version():
    return {"version": _read_version(), "commit": _git_short_hash()}

@app.get("/api/check-update")
def check_update():
    rc, _ = _run(["git", "-C", INSTALL, "fetch", "--quiet"], timeout=15)
    if rc != 0:
        return {"available": False, "error": "git fetch fehlgeschlagen"}
    rc, local = _run(["git", "-C", INSTALL, "rev-parse", "HEAD"], timeout=5)
    rc2, remote = _run(["git", "-C", INSTALL, "rev-parse", "@{u}"], timeout=5)
    if rc != 0 or rc2 != 0:
        return {"available": False, "error": "git rev-parse fehlgeschlagen"}
    if local.strip() == remote.strip():
        return {"available": False, "current": local.strip()[:7]}
    rc3, count = _run(["git", "-C", INSTALL, "rev-list", "--count", "HEAD..@{u}"], timeout=5)
    rc4, msg = _run(["git", "-C", INSTALL, "log", "-1", "--format=%s", "@{u}"], timeout=5)
    return {
        "available": True,
        "current": local.strip()[:7],
        "remote": remote.strip()[:7],
        "commits_behind": int(count.strip()) if rc3 == 0 and count.strip().isdigit() else 0,
        "latest_msg": msg.strip(),
    }

@app.get("/api/status")
def status():
    result = {s: _svc_status(s) for s in SERVICES}
    dist_dir = os.path.join(INSTALL, "frontend", "dist")
    result["frontend-build"] = "running" if os.path.isdir(dist_dir) else "stopped"
    return result

@app.get("/api/backend-health")
def backend_health():
    import urllib.request, urllib.error
    try:
        with urllib.request.urlopen("http://127.0.0.1:8002/health", timeout=2) as r:
            return {"ok": r.status == 200, "status": r.status}
    except urllib.error.URLError as e:
        return {"ok": False, "error": str(e.reason)}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@app.post("/api/service/{svc}/{action}")
def svc_action(svc: str, action: str, request: Request):
    if not _check_auth(request):
        return JSONResponse({"ok": False, "msg": "Nicht angemeldet"}, 401)
    if svc not in SERVICES or action not in ("start", "stop", "restart"):
        return JSONResponse({"ok": False, "msg": "Ungültig"}, 400)
    rc, out = _run(["sudo", "systemctl", action, svc])
    _audit("svc_action", ip=request.client.host if request.client else "?", svc=svc, action=action, ok=rc == 0)
    return {"ok": rc == 0, "msg": out or "OK"}

@app.get("/api/logs/{svc}")
def logs(request: Request, svc: str, n: int = 60):
    if not _check_auth(request):
        return JSONResponse({"error": "Nicht angemeldet"}, 401)
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
        try:
            temp_val = float(t.replace("temp=", "").replace("'C", "").strip())
            _temp_history.append(temp_val)
            if len(_temp_history) > _TEMP_HISTORY_MAX:
                _temp_history.pop(0)
        except ValueError:
            pass
    except Exception:
        pass
    up = int(time.time() - psutil.boot_time())
    d, r = divmod(up, 86400)
    h, r = divmod(r, 3600)
    m = r // 60
    uptime_str = f"{d}d {h}h {m}min" if d > 0 else f"{h}h {m}min"
    db_size = ""
    try:
        db_path = "/var/lib/mongodb"
        if os.path.isdir(db_path):
            total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fns in os.walk(db_path) for f in fns)
            db_size = f"{total / 1024**2:.0f} MB"
    except Exception:
        pass
    build_size = ""
    dist_dir = os.path.join(INSTALL, "frontend", "dist")
    try:
        if os.path.isdir(dist_dir):
            total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fns in os.walk(dist_dir) for f in fns)
            build_size = f"{total / 1024**2:.1f} MB"
    except Exception:
        pass
    return {
        "cpu": round(cpu, 1),
        "ram_used": round(mem.used / 1024**3, 2),
        "ram_total": round(mem.total / 1024**3, 2),
        "ram_pct": mem.percent,
        "disk_used": round(disk.used / 1024**3, 1),
        "disk_total": round(disk.total / 1024**3, 1),
        "disk_pct": round(disk.percent, 1),
        "temp": temp,
        "uptime": uptime_str,
        "db_size": db_size,
        "build_size": build_size,
        "temp_history": _temp_history,
    }

@app.get("/api/disk-usage")
def disk_usage(request: Request):
    if not _check_auth(request):
        return JSONResponse({"error": "Nicht angemeldet"}, 401)
    paths_to_check = [
        ("Home", os.path.expanduser("~")),
        ("Inventar", INSTALL),
        ("Frontend dist", os.path.join(INSTALL, "frontend", "dist")),
        ("node_modules", os.path.join(INSTALL, "frontend", "node_modules")),
        ("Backend venv", os.path.join(INSTALL, "backend", ".venv")),
        ("MongoDB", "/var/lib/mongodb"),
        ("Backups", os.path.expanduser("~/inventar-backup")),
        ("apt cache", "/var/cache/apt"),
        ("logs", "/var/log"),
    ]
    result = []
    for name, path in paths_to_check:
        if not os.path.isdir(path):
            continue
        rc, out = _run(["du", "-sb", path], timeout=30)
        if rc == 0:
            try:
                size_bytes = int(out.split()[0])
                result.append({"name": name, "path": path, "size_mb": round(size_bytes / 1024**2, 1)})
            except (ValueError, IndexError):
                pass
    result.sort(key=lambda x: x["size_mb"], reverse=True)
    return {"items": result}

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

@app.get("/api/tailscale-peers")
def tailscale_peers(request: Request):
    if not _check_auth(request):
        return JSONResponse({"error": "Nicht angemeldet"}, 401)
    rc, out = _run(["tailscale", "status", "--json"], timeout=5)
    if rc != 0:
        return {"peers": [], "error": "Tailscale nicht verfügbar"}
    try:
        data = json.loads(out)
        peers = []
        for p in (data.get("Peer") or {}).values():
            peers.append({
                "name": p.get("HostName", "?"),
                "os": p.get("OS", ""),
                "ip": (p.get("TailscaleIPs") or ["–"])[0],
                "online": p.get("Online", False),
                "last_seen": p.get("LastSeen", ""),
            })
        peers.sort(key=lambda x: (not x["online"], x["name"]))
        return {"peers": peers, "self": data.get("Self", {}).get("HostName", "?")}
    except Exception as e:
        return {"peers": [], "error": str(e)}

@app.get("/api/audit-log")
def audit_log(request: Request, limit: int = 100):
    if not _check_auth(request):
        return JSONResponse({"error": "Nicht angemeldet"}, 401)
    if not os.path.exists(AUDIT_LOG):
        return {"entries": []}
    try:
        with open(AUDIT_LOG) as f:
            lines = f.readlines()
        entries = []
        for line in lines[-limit:]:
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                pass
        entries.reverse()
        return {"entries": entries}
    except Exception as e:
        return JSONResponse({"error": str(e)}, 500)

@app.post("/api/backup")
def backup(request: Request, bg: BackgroundTasks):
    if not _check_auth(request):
        return JSONResponse({"ok": False, "msg": "Nicht angemeldet"}, 401)
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
def expo_clear(request: Request):
    if not _check_auth(request):
        return JSONResponse({"ok": False, "msg": "Nicht angemeldet"}, 401)
    rc, out = _run(["bash", "-c", f"cd {INSTALL}/frontend && npx expo export --platform web"], timeout=120)
    if rc == 0:
        _run(["sudo", "systemctl", "restart", "inventar-backend"])
        return {"ok": True, "msg": "Frontend neu gebaut und Backend neugestartet"}
    return {"ok": False, "msg": out}

@app.post("/api/update")
def update(request: Request, bg: BackgroundTasks):
    if not _check_auth(request):
        return JSONResponse({"ok": False, "msg": "Nicht angemeldet"}, 401)
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

@app.get("/api/versions")
def versions():
    rc, out = _run(["git", "-C", INSTALL, "tag", "-l", "v*", "--sort=-version:refname"], timeout=10)
    if rc != 0:
        return {"versions": [], "current": _read_version()}
    tags = [t.strip() for t in out.splitlines() if t.strip()]
    result = []
    for tag in tags[:MAX_TAGS]:
        _, date_str = _run(["git", "-C", INSTALL, "log", "-1", "--format=%ci", tag], timeout=5)
        _, msg = _run(["git", "-C", INSTALL, "log", "-1", "--format=%s", tag], timeout=5)
        result.append({"tag": tag, "date": date_str.strip()[:16], "msg": msg.strip()})
    return {"versions": result, "current": "v" + _read_version()}

@app.post("/api/rollback")
def rollback(request: Request, bg: BackgroundTasks, body: dict = Body(...)):
    if not _check_auth(request):
        return JSONResponse({"ok": False, "msg": "Nicht angemeldet"}, 401)
    tag = body.get("tag", "").strip()
    if not tag or not tag.startswith("v"):
        return JSONResponse({"ok": False, "msg": "Ungültiger Tag"}, 400)
    global _updating, _update_log
    with _lock:
        if _updating or _backing_up:
            return {"ok": False, "msg": "Update/Backup läuft bereits"}
        _update_log = []
        _updating = True
    bg.add_task(_do_rollback, tag)
    return {"ok": True, "msg": f"Rollback auf {tag} gestartet"}

def _do_rollback(tag: str):
    global _updating, _update_log, _last_update
    proc = None
    try:
        _update_log.append(f"=== Rollback auf {tag} ===")
        cmd = ["bash", "-c",
               f"cd {INSTALL} && git fetch --tags && git checkout {tag} && "
               f"source backend/.venv/bin/activate && "
               f"pip install --quiet --prefer-binary -r backend/requirements.txt && "
               f"cd frontend && npm install --silent && "
               f"npx expo export --platform web && "
               f"sudo systemctl restart inventar-backend"]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=INSTALL)
        for line in proc.stdout:
            _update_log.append(line.rstrip())
        proc.wait(timeout=600)
        _update_log.append(f"=== Fertig (Code {proc.returncode}) ===")
        _last_update = _timestamp()
        if proc.returncode == 0:
            _update_log.append("Dashboard wird in 3s neu gestartet...")
            subprocess.Popen(["bash", "-c", "sleep 3 && sudo systemctl restart inventar-dashboard"], start_new_session=True)
    except subprocess.TimeoutExpired:
        _update_log.append("FEHLER: Timeout nach 10 Minuten")
        if proc:
            proc.kill()
    except Exception as e:
        _update_log.append(f"FEHLER: {e}")
    finally:
        _updating = False

@app.post("/api/shell")
async def shell(request: Request, body: dict = Body(...)):
    if not _check_auth(request):
        return JSONResponse({"ok": False, "output": "Nicht angemeldet"}, 401)
    cmd = body.get("cmd", "").strip()
    if not cmd:
        return {"ok": False, "output": "Kein Befehl angegeben"}
    ip = request.client.host if request.client else "unknown"
    if not _is_command_allowed(cmd):
        logger.warning(f"Nicht erlaubter Shell-Befehl von IP {ip}: {cmd}")
        _audit("shell_blocked", ip=ip, cmd=cmd[:200])
        return {"ok": False, "output": f"⛔ Befehl nicht erlaubt. Erlaubt: {', '.join(sorted(ALLOWED_SHELL_COMMANDS))}", "code": -1}
    _audit("shell_exec", ip=ip, cmd=cmd[:200])
    try:
        proc = subprocess.run(["bash", "-c", cmd], capture_output=True, text=True, timeout=30, cwd=INSTALL)
        output = (proc.stdout + proc.stderr).strip()
        return {"ok": proc.returncode == 0, "output": output or "(keine Ausgabe)", "code": proc.returncode}
    except subprocess.TimeoutExpired:
        return {"ok": False, "output": "Timeout nach 30 Sekunden", "code": -1}
    except Exception as e:
        return {"ok": False, "output": str(e), "code": -1}

@app.post("/api/reboot")
def reboot(request: Request):
    if not _check_auth(request):
        return JSONResponse({"ok": False, "msg": "Nicht angemeldet"}, 401)
    _audit("reboot", ip=request.client.host if request.client else "?")
    subprocess.Popen(["sudo", "shutdown", "-r", "+0"])
    return {"ok": True}

@app.post("/api/shutdown")
def shutdown(request: Request):
    if not _check_auth(request):
        return JSONResponse({"ok": False, "msg": "Nicht angemeldet"}, 401)
    _audit("shutdown", ip=request.client.host if request.client else "?")
    subprocess.Popen(["sudo", "shutdown", "-h", "+0"])
    return {"ok": True}

def _do_backup():
    global _backing_up, _backup_log, _last_backup
    proc = None
    try:
        _backup_log.append("=== Backup gestartet ===")
        if os.path.exists(BACKUP_SH):
            cmd = ["bash", BACKUP_SH]
        else:
            cmd = ["bash", "-c", f"cd {INSTALL} && mongodump --out ~/inventar-backup/$(date +%Y%m%d_%H%M%S)"]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=INSTALL)
        for line in proc.stdout:
            _backup_log.append(line.rstrip())
        proc.wait(timeout=300)
        _backup_log.append(f"=== Fertig (Code {proc.returncode}) ===")
        _last_backup = _timestamp()
    except subprocess.TimeoutExpired:
        _backup_log.append("FEHLER: Timeout nach 5 Minuten")
        if proc:
            proc.kill()
    except Exception as e:
        _backup_log.append(f"FEHLER: {e}")
    finally:
        _backing_up = False

def _do_update():
    global _updating, _update_log, _last_update
    proc = None
    try:
        _update_log.append("=== Update gestartet ===")
        cmd = ["bash", "-c",
               f"cd {INSTALL} && git pull && "
               f"source backend/.venv/bin/activate && "
               f"pip install --quiet --prefer-binary -r backend/requirements.txt && "
               f"cd frontend && npm install --silent && "
               f"npx expo export --platform web && "
               f"sudo systemctl stop inventar-frontend 2>/dev/null; "
               f"sudo systemctl disable inventar-frontend 2>/dev/null; "
               f"sudo systemctl restart inventar-backend"]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=INSTALL)
        for line in proc.stdout:
            _update_log.append(line.rstrip())
        proc.wait(timeout=600)
        _update_log.append(f"=== Fertig (Code {proc.returncode}) ===")
        _last_update = _timestamp()
        if proc.returncode == 0:
            ver = _read_version()
            tag_name = f"v{ver}"
            rc_tag, _ = _run(["git", "-C", INSTALL, "tag", tag_name], timeout=5)
            if rc_tag == 0:
                _update_log.append(f"Git-Tag erstellt: {tag_name}")
                _run(["bash", "-c", f"cd {INSTALL} && git tag -l 'v*' --sort=-version:refname | tail -n +{MAX_TAGS + 1} | xargs -r git tag -d"], timeout=10)
            else:
                _update_log.append(f"Tag {tag_name} existiert bereits")
            _update_log.append("Dashboard wird in 3s neu gestartet...")
            subprocess.Popen(["bash", "-c", "sleep 3 && sudo systemctl restart inventar-dashboard"], start_new_session=True)
    except subprocess.TimeoutExpired:
        _update_log.append("FEHLER: Timeout nach 10 Minuten")
        if proc:
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
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E🍓%3C/text%3E%3C/svg%3E">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0d1117;--bg2:#161b22;--border:#30363d;--text:#e6edf3;--muted:#8b949e;--accent:#58a6ff;--accent2:#3fb950;--card-bg:#0d1117}
body.light{--bg:#f6f8fa;--bg2:#ffffff;--border:#d0d7de;--text:#1f2328;--muted:#656d76;--accent:#0969da;--accent2:#1f883d;--card-bg:#f6f8fa}
body{background:var(--bg);color:var(--text);font-family:system-ui,sans-serif;min-height:100vh}
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
.shell-wrap{display:flex;gap:6px;margin-bottom:10px}
.shell-input{flex:1;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:8px 10px;color:#e6edf3;font-family:monospace;font-size:12px;outline:none}
.shell-input:focus{border-color:#58a6ff}
.shell-output{background:#0d1117;border-radius:6px;padding:10px;font-family:monospace;font-size:11px;line-height:1.5;max-height:300px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;color:#c9d1d9}
.shell-output .cmd-line{color:#58a6ff;font-weight:600}
.shell-output .cmd-err{color:#f85149}
.shell-output .cmd-ok{color:#3fb950}
.shell-history{display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap}
.shell-history button{padding:3px 8px;border-radius:4px;background:#21262d;border:1px solid #30363d;color:#8b949e;cursor:pointer;font-size:10px;font-family:monospace}
.shell-history button:hover{background:#30363d;color:#e6edf3}
.ver-list{max-height:260px;overflow-y:auto}
.ver-row{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #21262d;font-size:12px}
.ver-row:last-child{border:none}
.ver-row .ver-name{font-weight:700;color:#58a6ff;min-width:80px}
.ver-row .ver-date{color:#8b949e;flex:1;font-size:11px}
.ver-row .ver-msg{color:#c9d1d9;flex:2;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ver-row.active .ver-name{color:#3fb950}
.ver-row.active{background:#0d1117;border-radius:6px;padding:8px;margin:-2px 0}
</style>
</head>
<body>
<div id="login-screen" style="display:flex;align-items:center;justify-content:center;min-height:100vh">
  <div class="card" style="max-width:340px;width:100%;text-align:center">
    <h2 style="color:#58a6ff;font-size:16px;text-transform:none;letter-spacing:0;margin-bottom:18px">🍓 Pi Dashboard Login</h2>
    <input type="password" id="login-pw" class="shell-input" placeholder="Passwort" style="margin-bottom:10px;width:100%;text-align:center">
    <input type="text" id="login-totp" class="shell-input" placeholder="2FA-Code (falls aktiv)" style="margin-bottom:10px;width:100%;text-align:center;display:none" inputmode="numeric" maxlength="6">
    <button class="btn btn-blue btn-full" onclick="doLogin()" id="login-btn">Anmelden</button>
    <div id="login-err" style="color:#f85149;font-size:12px;margin-top:8px"></div>
  </div>
</div>
<div id="dashboard-content" style="display:none">
<div class="hdr">
  <div>
    <h1>🍓 Inventar Pro — Pi Dashboard <span class="ver-tag" id="app-ver">...</span><span class="commit-tag" id="app-commit"></span></h1>
    <div class="sub" id="hostname">Lädt...</div>
  </div>
  <div style="text-align:right">
    <div class="live-badge"><div class="live-dot"></div> LIVE <span id="be-health" style="margin-left:6px;color:#8b949e">·</span></div>
    <div class="last-upd" id="last-upd">–</div>
    <div style="display:flex;gap:4px;margin-top:4px">
      <button class="btn btn-gray" style="font-size:10px" onclick="toggleTheme()" id="theme-btn">🌙</button>
      <button class="btn btn-gray" style="font-size:10px" onclick="doLogout()">🔒 Abmelden</button>
    </div>
  </div>
</div>
<div class="body">

<div class="card"><h2>Services</h2><div id="svc-list">Lädt...</div></div>
<div class="card"><h2>System-Info</h2><div class="info-grid" id="sys-grid">Lädt...</div></div>
<div class="card"><h2>Netzwerk</h2><div id="net-info">Lädt...</div></div>

<div class="card" style="grid-column:1/-1">
  <h2>Live-Log</h2>
  <div class="log-tabs">
    <button class="tab active" onclick="setLogSvc('inventar-backend',this)">Backend</button>
    <button class="tab" onclick="setLogSvc('mongod',this)">MongoDB</button>
    <button class="tab" onclick="setLogSvc('system',this)">System-Warnungen</button>
  </div>
  <input id="log-filter" class="shell-input" placeholder="Filter (Volltext, leer = alle Zeilen)" style="margin-bottom:8px" oninput="refreshLog()">
  <div class="log-box" id="log-box">Lädt...</div>
</div>

<div class="card">
  <h2>Update &amp; Backup</h2>
  <div id="upd-banner" style="display:none;background:#0d2818;border:1px solid #238636;border-radius:6px;padding:8px;margin-bottom:8px;font-size:11px"></div>
  <button class="btn btn-blue btn-full" onclick="doUpdate()" id="upd-btn">⬇ Update von GitHub</button>
  <div class="status-line" id="upd-last"></div>
  <button class="btn btn-teal btn-full" onclick="doBackup()" id="bak-btn">💾 Backup erstellen</button>
  <div class="status-line" id="bak-last"></div>
  <div class="upd-log" id="upd-log"></div>
</div>

<div class="card">
  <h2>💾 Speicherplatz-Details</h2>
  <div id="disk-list" style="font-size:12px"><div style="color:#8b949e">Lädt...</div></div>
  <button class="btn btn-gray btn-full" onclick="loadDiskUsage()" style="margin-top:8px">↻ Aktualisieren</button>
</div>

<div class="card">
  <h2>🔗 Tailscale-Verbindungen</h2>
  <div id="ts-peers" style="font-size:12px"><div style="color:#8b949e">Lädt...</div></div>
</div>

<div class="card" style="grid-column:1/-1">
  <h2>📋 Audit-Log</h2>
  <div id="audit-list" class="log-box" style="max-height:240px"><div style="color:#8b949e">Lädt...</div></div>
  <button class="btn btn-gray btn-full" onclick="loadAuditLog()" style="margin-top:8px">↻ Aktualisieren</button>
</div>

<div class="card">
  <h2>📦 Versionen</h2>
  <div class="ver-list" id="ver-list"><div style="color:#8b949e;font-size:12px">Lädt...</div></div>
  <button class="btn btn-gray btn-full" onclick="loadVersions()" style="margin-top:8px">↻ Aktualisieren</button>
</div>

<div class="card">
  <h2>📱 App öffnen (Handy QR)</h2>
  <div style="text-align:center;padding:10px 0">
    <canvas id="qr-canvas" style="border-radius:8px;background:#fff;padding:12px"></canvas>
    <div style="margin-top:8px;font-size:12px;color:#8b949e" id="qr-url">Lädt...</div>
  </div>
</div>

<div class="card">
  <h2>Werkzeuge</h2>
  <button class="btn btn-purple btn-full" onclick="expoCache()">🔄 Frontend neu bauen</button>
  <div class="btn-row" style="margin-top:6px">
    <button class="btn btn-gray" onclick="openUrl('http://'+location.hostname+':8002/docs')">📄 API Docs</button>
    <button class="btn btn-gray" onclick="openUrl('http://'+location.hostname+':8002')">🌐 App öffnen</button>
  </div>
</div>

<div class="card" style="grid-column:1/-1">
  <h2>🖥 Remote Shell</h2>
  <div class="shell-history" id="shell-shortcuts">
    <button onclick="shellRun('htop -n1 | head -20')">htop</button>
    <button onclick="shellRun('df -h')">Disk</button>
    <button onclick="shellRun('free -h')">RAM</button>
    <button onclick="shellRun('uptime')">Uptime</button>
    <button onclick="shellRun('ls -la ~/inventar/')">ls inventar</button>
    <button onclick="shellRun('git -C ~/inventar log --oneline -10')">Git Log</button>
    <button onclick="shellRun('cat ~/inventar/VERSION')">Version</button>
    <button onclick="shellRun('systemctl list-units --type=service --state=running --no-pager')">Services</button>
  </div>
  <div class="shell-wrap">
    <input class="shell-input" id="shell-cmd" placeholder="Befehl eingeben... (Enter zum Ausführen)" autocomplete="off" spellcheck="false">
    <button class="btn btn-green" onclick="shellExec()" id="shell-run-btn">▶ Run</button>
    <button class="btn btn-gray" onclick="shellClear()">✕</button>
  </div>
  <div class="shell-output" id="shell-out">admin@raspberrypi:~/inventar$ <span class="cmd-ok">Bereit.</span></div>
</div>

<div class="card">
  <h2>🔐 2-Faktor-Authentifizierung</h2>
  <div id="totp-status" style="font-size:12px;color:#8b949e;margin-bottom:10px">Lädt...</div>
  <div id="totp-actions"></div>
  <div id="totp-setup-area" style="display:none;margin-top:10px">
    <div style="text-align:center;margin-bottom:8px">
      <canvas id="totp-qr" style="background:#fff;padding:8px;border-radius:6px"></canvas>
    </div>
    <div style="font-family:monospace;font-size:10px;color:#8b949e;text-align:center;word-break:break-all;margin-bottom:8px" id="totp-secret-display"></div>
    <input class="shell-input" id="totp-confirm-code" placeholder="6-stelliger Code aus App" inputmode="numeric" maxlength="6" style="margin-bottom:6px">
    <button class="btn btn-green btn-full" onclick="totpConfirm()">2FA aktivieren</button>
    <button class="btn btn-gray btn-full" onclick="totpCancel()" style="margin-top:6px">Abbrechen</button>
  </div>
</div>

<div class="card">
  <h2>System</h2>
  <button class="btn btn-warn btn-full" onclick="if(confirm('Pi wirklich neu starten?'))doPost('/api/reboot','Pi wird neu gestartet...')" style="margin-bottom:8px">↺ Pi neu starten</button>
  <button class="btn btn-red  btn-full" onclick="if(confirm('Pi wirklich herunterfahren?'))doPost('/api/shutdown','Pi wird heruntergefahren...')">⏻ Pi herunterfahren</button>
</div>

</div>
</div><!-- end dashboard-content -->
<div class="toast" id="toast"></div>
<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
<script>
let logSvc='inventar-backend';
const SVC_LABELS={'inventar-backend':'Backend','frontend-build':'Frontend (Build)','mongod':'MongoDB'};
let _pollPaused=false;
let _pendingTotpSecret=null;

async function doLogin(){
  const pw=document.getElementById('login-pw').value;
  const totp=document.getElementById('login-totp').value.trim();
  const btn=document.getElementById('login-btn');
  btn.disabled=true;
  try{
    const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw,totp})});
    const d=await r.json();
    if(d.ok){showDashboard()}
    else if(d.needs_totp){
      const totpEl=document.getElementById('login-totp');
      totpEl.style.display='block';totpEl.focus();
      document.getElementById('login-err').textContent=d.msg||'2FA-Code eingeben';
    }
    else{document.getElementById('login-err').textContent=d.msg||'Falsches Passwort'}
  }catch(e){document.getElementById('login-err').textContent='Verbindungsfehler'}
  btn.disabled=false;
}

async function doLogout(){
  await fetch('/api/logout',{method:'POST'});
  document.getElementById('dashboard-content').style.display='none';
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('login-pw').value='';
}

function showDashboard(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('dashboard-content').style.display='block';
  initDashboard();
}

document.getElementById('login-pw').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});
document.getElementById('login-totp').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});

document.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA'].includes(e.target.tagName))return;
  if(e.key==='r'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();refreshAll();toast('Aktualisiert')}
  else if(e.key==='t'){e.preventDefault();toggleTheme()}
  else if(e.key==='/'){e.preventDefault();const s=document.getElementById('shell-cmd');if(s)s.focus()}
  else if(e.key==='?'){e.preventDefault();alert('Shortcuts:\\n  r — Aktualisieren\\n  t — Theme wechseln\\n  / — Shell-Fokus\\n  ? — Diese Hilfe')}
});

document.addEventListener('visibilitychange',()=>{
  _pollPaused=document.hidden;
  if(!document.hidden){refreshAll();loadTailscalePeers()}
});

fetch('/api/auth-check').then(r=>{if(r.ok)return r.json();throw 0}).then(d=>{if(d.ok)showDashboard()}).catch(()=>{});

function toast(msg,err=false){
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='toast'+(err?' err':'');
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3000);
}

async function api(url){try{const r=await fetch(url);return r.json()}catch(e){return null}}
async function apiPost(url){try{const r=await fetch(url,{method:'POST'});return r.json()}catch(e){return {ok:false,msg:'Verbindung fehlgeschlagen'}}}
async function doPost(url,msg){const d=await apiPost(url);toast(d.ok!==false?msg:(d.msg||'Fehler'),d.ok===false)}

function setBusy(busy){
  document.getElementById('upd-btn').disabled=busy;
  document.getElementById('bak-btn').disabled=busy;
}

function toggleTheme(){
  const isLight=document.body.classList.toggle('light');
  localStorage.setItem('theme',isLight?'light':'dark');
  document.getElementById('theme-btn').textContent=isLight?'☀':'🌙';
}
function applyTheme(){
  if(localStorage.getItem('theme')==='light'){
    document.body.classList.add('light');
    const btn=document.getElementById('theme-btn');
    if(btn)btn.textContent='☀';
  }
}

function renderSparkline(data,width=120,height=24){
  if(!data||data.length<2)return '';
  const min=Math.min(...data),max=Math.max(...data);
  const range=max-min||1;
  const step=width/(data.length-1);
  const points=data.map((v,i)=>`${(i*step).toFixed(1)},${(height-((v-min)/range)*height).toFixed(1)}`).join(' ');
  return `<svg width="${width}" height="${height}" style="display:block;margin:4px auto 0"><polyline points="${points}" fill="none" stroke="#58a6ff" stroke-width="1.5"/></svg>`;
}

async function refreshStatus(){
  const d=await api('/api/status');if(!d)return;
  const el=document.getElementById('svc-list');
  el.innerHTML=Object.entries(d).map(([s,st])=>`
    <div class="svc">
      <div class="dot ${st}"></div>
      <div class="svc-name">${SVC_LABELS[s]||s}<br><span style="font-size:10px;color:#8b949e">${s==='frontend-build'?(st==='running'?'vorhanden':'fehlt'):st}</span></div>
      ${s!=='frontend-build'?`<div class="svc-btns">
        <button class="btn btn-green" title="Starten" onclick="svcAct('${s}','start')">▶</button>
        <button class="btn btn-red" title="Stoppen" onclick="svcAct('${s}','stop')">■</button>
        <button class="btn btn-blue" title="Neustart" onclick="svcAct('${s}','restart')">↺</button>
      </div>`:''}
    </div>`).join('');
}

async function svcAct(svc,action){
  const r=await apiPost(`/api/service/${svc}/${action}`);
  toast(r.ok?`${SVC_LABELS[svc]||svc}: ${action}`:r.msg,!r.ok);
  setTimeout(refreshStatus,1500);
}

async function refreshSys(){
  const d=await api('/api/sysinfo');if(!d)return;
  document.getElementById('hostname').textContent=`Uptime: ${d.uptime} | ${d.temp}`;
  const dbRow=d.db_size?`<div class="info-item"><div class="info-val">${d.db_size}</div><div class="info-lbl">MongoDB</div></div>`:'';
  const buildRow=d.build_size?`<div class="info-item"><div class="info-val">${d.build_size}</div><div class="info-lbl">Frontend Build</div></div>`:'';
  const sparkline=renderSparkline(d.temp_history||[]);
  document.getElementById('sys-grid').innerHTML=`
    <div class="info-item"><div class="info-val">${d.cpu}%</div><div class="info-lbl">CPU</div><div class="bar"><div class="bar-fill" style="width:${d.cpu}%;background:${d.cpu>80?'#f85149':'#3fb950'}"></div></div></div>
    <div class="info-item"><div class="info-val">${d.ram_used}GB</div><div class="info-lbl">RAM / ${d.ram_total}GB</div><div class="bar"><div class="bar-fill" style="width:${d.ram_pct}%;background:${d.ram_pct>85?'#f85149':'#58a6ff'}"></div></div></div>
    <div class="info-item"><div class="info-val">${d.disk_used}GB</div><div class="info-lbl">Disk / ${d.disk_total}GB</div><div class="bar"><div class="bar-fill" style="width:${d.disk_pct}%;background:${d.disk_pct>85?'#f85149':'#e3b341'}"></div></div></div>
    <div class="info-item"><div class="info-val">${d.temp||'–'}</div><div class="info-lbl">Temperatur</div>${sparkline}</div>
    ${dbRow}${buildRow}`;
}

async function refreshNet(){
  const d=await api('/api/network');if(!d)return;
  document.getElementById('net-info').innerHTML=`
    <div class="net-row"><span class="net-lbl">Lokale IP</span><span class="net-val">${d.local_ip}</span></div>
    <div class="net-row"><span class="net-lbl">Tailscale IP</span><span class="net-val">${d.tailscale_ip}</span></div>
    <div class="net-row"><span class="net-lbl">Tailscale</span><span class="net-val">${d.tailscale_status}</span></div>`;
}

async function refreshLog(){
  const d=await api(`/api/logs/${logSvc}?n=200`);if(!d)return;
  const box=document.getElementById('log-box');
  const atBottom=box.scrollHeight-box.scrollTop-box.clientHeight<40;
  const filterEl=document.getElementById('log-filter');
  const filter=filterEl?filterEl.value.trim().toLowerCase():'';
  let text=d.logs||'(leer)';
  if(filter){text=text.split('\\n').filter(l=>l.toLowerCase().includes(filter)).join('\\n')||'(keine Treffer)'}
  box.textContent=text;
  if(atBottom)box.scrollTop=box.scrollHeight;
}

function setLogSvc(svc,btn){
  logSvc=svc;
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');refreshLog();
}

function openUrl(url){window.open(url,'_blank')}

async function expoCache(){
  const r=await apiPost('/api/expo-clear');
  toast(r.ok?r.msg:r.msg,!r.ok);
  setTimeout(refreshStatus,2000);
}

function _startTask(btn,label,logEl){
  btn.disabled=true;btn.innerHTML=`<span class="spinner"></span> ${label}`;
  setBusy(true);logEl.style.display='block';logEl.textContent='';
}

async function doUpdate(){
  const btn=document.getElementById('upd-btn');
  const log=document.getElementById('upd-log');
  _startTask(btn,'Update läuft...',log);
  await apiPost('/api/update');
  const iv=setInterval(async()=>{
    const d=await api('/api/update/log');if(!d)return;
    log.textContent=d.lines.join('\\n');log.scrollTop=log.scrollHeight;
    if(d.last)document.getElementById('upd-last').textContent='Letztes Update: '+d.last;
    if(!d.running){
      clearInterval(iv);
      btn.disabled=false;btn.innerHTML='⬇ Update von GitHub';setBusy(false);
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
    const d=await api('/api/backup/log');if(!d)return;
    log.textContent=d.lines.join('\\n');log.scrollTop=log.scrollHeight;
    if(d.last)document.getElementById('bak-last').textContent='Letztes Backup: '+d.last;
    if(!d.running){
      clearInterval(iv);
      btn.disabled=false;btn.innerHTML='💾 Backup erstellen';setBusy(false);
      toast('Backup abgeschlossen!');
    }
  },1500);
}

function updateTimestamp(){
  const now=new Date();
  document.getElementById('last-upd').textContent='Aktualisiert: '+now.toLocaleTimeString('de-DE');
}

async function loadVersion(){
  const d=await api('/api/version');if(!d)return;
  document.getElementById('app-ver').textContent='v'+d.version;
  if(d.commit)document.getElementById('app-commit').textContent='('+d.commit+')';
}

async function loadLastTimes(){
  const u=await api('/api/update/log');
  const b=await api('/api/backup/log');
  if(u&&u.last)document.getElementById('upd-last').textContent='Letztes Update: '+u.last;
  if(b&&b.last)document.getElementById('bak-last').textContent='Letztes Backup: '+b.last;
}

async function loadVersions(){
  const d=await api('/api/versions');if(!d||!d.versions)return;
  const el=document.getElementById('ver-list');
  if(!d.versions.length){el.innerHTML='<div style="color:#8b949e;font-size:12px">Keine Versionen gefunden. Nach dem ersten Update werden Versionen angezeigt.</div>';return}
  el.innerHTML=d.versions.map(v=>{
    const isCurrent=v.tag===d.current;
    return `<div class="ver-row${isCurrent?' active':''}">
      <span class="ver-name">${v.tag}${isCurrent?' ✓':''}</span>
      <span class="ver-date">${v.date}</span>
      <span class="ver-msg">${escHtml(v.msg)}</span>
      ${isCurrent?'<span style="color:#3fb950;font-size:11px;font-weight:600">Aktiv</span>':'<button class="btn btn-warn" style="padding:3px 8px;font-size:10px" onclick="doRollback(\\''+v.tag+'\\')">Aktivieren</button>'}
    </div>`}).join('');
}

async function doRollback(tag){
  if(!confirm('Version '+tag+' aktivieren?\\n\\nDas Frontend wird neu gebaut und alle Services neu gestartet.'))return;
  const btn=document.getElementById('upd-btn');
  const log=document.getElementById('upd-log');
  _startTask(btn,'Rollback auf '+tag+'...',log);
  await fetch('/api/rollback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tag})});
  const iv=setInterval(async()=>{
    const d=await api('/api/update/log');if(!d)return;
    log.textContent=d.lines.join('\\n');log.scrollTop=log.scrollHeight;
    if(!d.running){
      clearInterval(iv);btn.disabled=false;btn.innerHTML='⬇ Update von GitHub';setBusy(false);
      toast('Rollback abgeschlossen! Dashboard startet neu...');loadVersions();
      setTimeout(()=>{
        const tryReload=setInterval(()=>{fetch('/api/status').then(()=>{clearInterval(tryReload);location.reload()}).catch(()=>{})},2000);
      },4000);
    }
  },1500);
}

async function loadAuditLog(){
  const d=await api('/api/audit-log?limit=50');
  const el=document.getElementById('audit-list');
  if(!d||!d.entries){el.innerHTML='<div style="color:#8b949e">Keine Daten</div>';return}
  if(!d.entries.length){el.innerHTML='<div style="color:#8b949e">Keine Einträge</div>';return}
  el.innerHTML=d.entries.map(e=>{
    const colors={login_success:'#3fb950',login_failed:'#f85149',shell_blocked:'#f85149',shell_exec:'#58a6ff'};
    const c=colors[e.event]||'#8b949e';
    const extras=Object.keys(e).filter(k=>!['ts','iso','event'].includes(k)).map(k=>`${k}=${e[k]}`).join(' ');
    return `<div style="padding:3px 0;border-bottom:1px solid #21262d"><span style="color:#8b949e">${e.iso}</span> <span style="color:${c};font-weight:600">${e.event}</span> <span style="color:#c9d1d9">${escHtml(extras)}</span></div>`;
  }).join('');
}

async function loadTailscalePeers(){
  const d=await api('/api/tailscale-peers');
  const el=document.getElementById('ts-peers');
  if(!d){el.innerHTML='<div style="color:#8b949e">Fehler</div>';return}
  if(d.error){el.innerHTML=`<div style="color:#8b949e">${d.error}</div>`;return}
  if(!d.peers||!d.peers.length){el.innerHTML='<div style="color:#8b949e">Keine Peers</div>';return}
  el.innerHTML=d.peers.map(p=>`
    <div class="net-row">
      <span class="net-lbl">${p.online?'🟢':'⚫'} ${escHtml(p.name)} <span style="color:#666;font-size:10px">${p.os}</span></span>
      <span class="net-val">${p.ip}</span>
    </div>`).join('');
}

async function loadDiskUsage(){
  const d=await api('/api/disk-usage');
  const el=document.getElementById('disk-list');
  if(!d||!d.items){el.innerHTML='<div style="color:#8b949e">Fehler</div>';return}
  if(!d.items.length){el.innerHTML='<div style="color:#8b949e">Keine Daten</div>';return}
  const max=Math.max(...d.items.map(i=>i.size_mb));
  el.innerHTML=d.items.map(i=>{
    const pct=(i.size_mb/max*100).toFixed(0);
    const sizeStr=i.size_mb>1024?(i.size_mb/1024).toFixed(1)+' GB':i.size_mb+' MB';
    return `<div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px">
        <span>${i.name}</span><span style="color:#58a6ff;font-weight:600">${sizeStr}</span>
      </div>
      <div class="bar"><div class="bar-fill" style="width:${pct}%;background:#58a6ff"></div></div>
    </div>`;
  }).join('');
}

async function refreshBackendHealth(){
  const d=await api('/api/backend-health');
  const el=document.getElementById('be-health');if(!el)return;
  if(d&&d.ok){el.textContent='✓ API';el.style.color='#3fb950'}
  else{el.textContent='✗ API';el.style.color='#f85149'}
}

async function checkForUpdate(){
  const d=await api('/api/check-update');
  const banner=document.getElementById('upd-banner');if(!banner)return;
  if(d&&d.available){
    banner.style.display='block';
    banner.innerHTML=`<span style="color:#3fb950;font-weight:600">⬇ Update verfügbar</span> · ${d.commits_behind} neue Commit${d.commits_behind===1?'':'s'} · <span style="color:#8b949e">${escHtml(d.latest_msg||'')}</span>`;
  }else{banner.style.display='none'}
}

async function loadTotpStatus(){
  const d=await api('/api/totp-status');
  const status=document.getElementById('totp-status');
  const actions=document.getElementById('totp-actions');
  if(!d){status.textContent='Fehler';return}
  if(!d.available){
    status.innerHTML='⚠ <code>pyotp</code> nicht installiert.<br>Auf dem Pi: <code>pip install pyotp</code>';
    actions.innerHTML='';return;
  }
  if(d.enabled){
    status.innerHTML='<span style="color:#3fb950">✓ 2FA aktiviert</span>';
    actions.innerHTML='<button class="btn btn-warn btn-full" onclick="totpDisable()">2FA deaktivieren</button>';
  }else{
    status.innerHTML='<span style="color:#8b949e">2FA nicht aktiviert</span>';
    actions.innerHTML='<button class="btn btn-green btn-full" onclick="totpStart()">2FA einrichten</button>';
  }
}

async function totpStart(){
  const r=await fetch('/api/totp-setup',{method:'POST'});
  const d=await r.json();
  if(!d.ok){toast(d.msg||'Fehler',true);return}
  _pendingTotpSecret=d.secret;
  document.getElementById('totp-actions').style.display='none';
  document.getElementById('totp-setup-area').style.display='block';
  document.getElementById('totp-secret-display').textContent=d.secret;
  const qr=qrcode(0,'M');qr.addData(d.uri);qr.make();
  const canvas=document.getElementById('totp-qr');
  const size=160,modules=qr.getModuleCount(),cell=size/modules;
  canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size);ctx.fillStyle='#000';
  for(let r=0;r<modules;r++)for(let c=0;c<modules;c++)if(qr.isDark(r,c))ctx.fillRect(c*cell,r*cell,cell+0.5,cell+0.5);
  document.getElementById('totp-confirm-code').focus();
}

async function totpConfirm(){
  const code=document.getElementById('totp-confirm-code').value.trim();
  if(!code||!_pendingTotpSecret){toast('Code fehlt',true);return}
  const r=await fetch('/api/totp-confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:_pendingTotpSecret,code})});
  const d=await r.json();
  if(d.ok){toast(d.msg);totpCancel();loadTotpStatus()}
  else toast(d.msg||'Fehler',true);
}

function totpCancel(){
  _pendingTotpSecret=null;
  document.getElementById('totp-setup-area').style.display='none';
  document.getElementById('totp-actions').style.display='block';
  document.getElementById('totp-confirm-code').value='';
}

async function totpDisable(){
  const pw=prompt('Passwort zum Deaktivieren von 2FA eingeben:');
  if(!pw)return;
  const r=await fetch('/api/totp-disable',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});
  const d=await r.json();
  if(d.ok){toast(d.msg);loadTotpStatus()}else toast(d.msg||'Fehler',true);
}

async function refreshAll(){
  await Promise.all([refreshStatus(),refreshSys(),refreshNet(),refreshLog()]);
  updateTimestamp();
}

function renderQR(){
  fetch('/api/network').then(r=>r.json()).then(d=>{
    const url='http://'+d.local_ip+':8002';
    const qr=qrcode(0,'M');qr.addData(url);qr.make();
    const canvas=document.getElementById('qr-canvas');
    const size=180,modules=qr.getModuleCount(),cell=size/modules;
    canvas.width=size;canvas.height=size;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size);ctx.fillStyle='#000';
    for(let r=0;r<modules;r++)for(let c=0;c<modules;c++)if(qr.isDark(r,c))ctx.fillRect(c*cell,r*cell,cell+0.5,cell+0.5);
    document.getElementById('qr-url').textContent=url;
  }).catch(()=>{document.getElementById('qr-url').textContent='QR-Code nicht verfügbar'});
}

// ── Remote Shell ──
const shellOut=document.getElementById('shell-out');
const shellCmd=document.getElementById('shell-cmd');
let shellHistory=[],shellHistIdx=-1;

async function shellExec(){
  const cmd=shellCmd.value.trim();
  if(!cmd)return;
  shellHistory.unshift(cmd);shellHistIdx=-1;shellCmd.value='';
  shellOut.innerHTML+=`\\n<span class="cmd-line">$ ${cmd}</span>\\n<span style="color:#8b949e">Ausführen...</span>`;
  shellOut.scrollTop=shellOut.scrollHeight;
  const btn=document.getElementById('shell-run-btn');btn.disabled=true;
  try{
    const r=await fetch('/api/shell',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cmd})});
    const d=await r.json();
    const last=shellOut.querySelector('span:last-child');
    if(last&&last.textContent==='Ausführen...')last.remove();
    shellOut.innerHTML+=`<span class="${d.ok?'cmd-ok':'cmd-err'}">${escHtml(d.output)}</span>`;
  }catch(e){shellOut.innerHTML+=`<span class="cmd-err">Verbindungsfehler: ${e.message}</span>`}
  btn.disabled=false;shellOut.scrollTop=shellOut.scrollHeight;
}

function shellRun(cmd){shellCmd.value=cmd;shellExec()}
function shellClear(){shellOut.innerHTML='<span class="cmd-ok">Terminal geleert.</span>'}
function escHtml(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}

shellCmd.addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();shellExec()}
  if(e.key==='ArrowUp'&&shellHistory.length){e.preventDefault();shellHistIdx=Math.min(shellHistIdx+1,shellHistory.length-1);shellCmd.value=shellHistory[shellHistIdx]}
  if(e.key==='ArrowDown'){e.preventDefault();shellHistIdx=Math.max(shellHistIdx-1,-1);shellCmd.value=shellHistIdx>=0?shellHistory[shellHistIdx]:''}
});

let _dashInited=false;
function initDashboard(){
  if(_dashInited)return;
  _dashInited=true;
  applyTheme();
  refreshAll();
  loadVersion();loadLastTimes();loadVersions();
  loadDiskUsage();loadAuditLog();loadTailscalePeers();
  refreshBackendHealth();loadTotpStatus();
  checkForUpdate();renderQR();
  setInterval(()=>{if(!_pollPaused)refreshStatus()},3000);
  setInterval(()=>{if(!_pollPaused)refreshSys()},3000);
  setInterval(()=>{if(!_pollPaused)refreshNet()},15000);
  setInterval(()=>{if(!_pollPaused)refreshLog()},3000);
  setInterval(()=>{if(!_pollPaused)refreshBackendHealth()},5000);
  setInterval(()=>{if(!_pollPaused)loadTailscalePeers()},30000);
  setInterval(()=>{if(!_pollPaused)checkForUpdate()},600000);
  setInterval(updateTimestamp,1000);
}
</script>
</body>
</html>"""

@app.get("/", response_class=HTMLResponse)
def index():
    return HTML

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="warning")
