#!/usr/bin/env python3
"""
Inventar Pro — Admin Dashboard  (v4)
Abhaengigkeiten:  pip install customtkinter psutil
"""

# ==============================================================
#  KONFIGURATION
# ==============================================================
import os, sys, platform

_HERE = os.path.dirname(os.path.abspath(__file__))

BACKEND_DIR   = os.path.join(_HERE, "Final-main", "backend")
BACKEND_CMD   = [sys.executable, "server.py"]
BACKEND_LABEL = "Backend (FastAPI)"
BACKEND_PORT  = 8002
BACKEND_URL   = f"http://localhost:{BACKEND_PORT}/docs"

FRONTEND_DIR   = os.path.join(_HERE, "Final-main", "frontend")
FRONTEND_CMD   = ["npm", "start"]
FRONTEND_LABEL = "Frontend (Expo)"
FRONTEND_PORT  = 8081
FRONTEND_URL   = f"http://localhost:{FRONTEND_PORT}"

GIT_DIR = os.path.join(_HERE, "Final-main")

AUTOSTART_DEFAULT = False

# Farben
COLOR_RUNNING = "#2ecc71"   # Prozess läuft
COLOR_IDLE    = "#e67e22"   # Prozess gestoppt / offline (kein Fehler)
COLOR_STOPPED = "#e74c3c"   # Fehler / ERROR-Log-Level
COLOR_CRASH   = "#ff6b6b"   # Unerwarteter Absturz
COLOR_WARN    = "#f39c12"
COLOR_BG      = "#1a1a2e"
COLOR_PANEL   = "#16213e"
COLOR_ACCENT  = "#0f3460"
COLOR_TEXT    = "#e0e0e0"
LOG_MAX_LINES = 3000

_ERR_KEYWORDS  = {"error", "exception", "traceback", "critical", "fatal", "fehler"}
_WARN_KEYWORDS = {"warning", "warn", "deprecated", "warnung"}
# ==============================================================

import threading
import queue
import subprocess
import signal
import time
import webbrowser
from datetime import datetime
from typing import Optional

import customtkinter as ctk
import psutil

IS_WINDOWS = platform.system() == "Windows"


# ──────────────────────────────────────────────
#  Hilfsfunktionen
# ──────────────────────────────────────────────

def _resolve_cmd(cmd: list) -> list:
    """npm/npx/node auf Windows als .cmd aufrufen."""
    if not IS_WINDOWS:
        return cmd
    tools = {"npm", "npx", "node", "yarn", "expo"}
    return [cmd[0] + ".cmd" if cmd[0].lower() in tools else cmd[0]] + cmd[1:]


def _kill_tree(pid: int):
    """Beendet Prozess + alle Kindprozesse."""
    try:
        parent = psutil.Process(pid)
        for child in parent.children(recursive=True):
            try: child.kill()
            except psutil.NoSuchProcess: pass
        parent.kill()
    except psutil.NoSuchProcess:
        pass


def _disk_path() -> str:
    return "C:\\" if IS_WINDOWS else "/"


def _classify_line(msg: str) -> str:
    """ERROR/WARN-Keywords im Output automatisch erkennen."""
    low = msg.lower()
    if any(k in low for k in _ERR_KEYWORDS):
        return "ERROR"
    if any(k in low for k in _WARN_KEYWORDS):
        return "WARN"
    return "OUT"


def _port_pids(port: int) -> list[int]:
    """Gibt alle PIDs zurueck, die den angegebenen Port belegen.
    Nutzt netstat auf Windows (kein Admin noetig) und psutil als Fallback."""
    if IS_WINDOWS:
        pids = []
        try:
            out = subprocess.check_output(
                ["netstat", "-ano"],
                stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW
            ).decode(errors="ignore")
            for line in out.splitlines():
                parts = line.split()
                # Format: Proto  Local  Foreign  State  PID
                if len(parts) >= 4:
                    local = parts[1] if len(parts) >= 2 else ""
                    pid_str = parts[-1]
                    if local.endswith(f":{port}") and pid_str.isdigit():
                        pid = int(pid_str)
                        if pid > 0:
                            pids.append(pid)
        except Exception:
            pass
        return list(set(pids))
    # Linux / macOS: psutil funktioniert ohne Admin
    pids = []
    try:
        for conn in psutil.net_connections(kind="inet"):
            if conn.laddr and conn.laddr.port == port and conn.pid:
                pids.append(conn.pid)
    except (psutil.AccessDenied, PermissionError):
        pass
    return list(set(pids))


def _free_port(port: int, log_fn) -> bool:
    """Beendet alle Prozesse auf dem Port. Gibt True zurueck wenn Port frei."""
    pids = _port_pids(port)
    if not pids:
        log_fn("SYSTEM", "OK", f"Port {port} ist frei.")
        return True
    for pid in pids:
        try:
            name = psutil.Process(pid).name()
        except psutil.NoSuchProcess:
            name = "?"
        log_fn("SYSTEM", "WARN", f"Beende Prozess auf Port {port}: {name} (PID {pid})")
        if IS_WINDOWS:
            try:
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(pid)],
                    capture_output=True,
                    creationflags=subprocess.CREATE_NO_WINDOW
                )
            except Exception:
                pass
        else:
            _kill_tree(pid)
    time.sleep(0.8)
    if _port_pids(port):
        log_fn("SYSTEM", "ERROR", f"Port {port} konnte nicht freigegeben werden.")
        return False
    log_fn("SYSTEM", "OK", f"Port {port} freigegeben.")
    return True


def _is_port_free(port: int) -> bool:
    return len(_port_pids(port)) == 0


# ──────────────────────────────────────────────
#  Prozess-Manager
# ──────────────────────────────────────────────

class ManagedProcess:

    def __init__(self, name: str, cmd: list, cwd: str,
                 log_q: queue.Queue, port: Optional[int] = None):
        self.name  = name
        self.cmd   = cmd
        self.cwd   = cwd
        self.log_q = log_q
        self.port  = port
        self._proc: Optional[subprocess.Popen] = None
        self._intentional_stop = False   # unterscheidet echten Crash von gezieltem Stop

    @property
    def running(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    @property
    def pid(self) -> Optional[int]:
        return self._proc.pid if self._proc else None

    def ram_mb(self) -> Optional[float]:
        try:
            if self._proc:
                return psutil.Process(self._proc.pid).memory_info().rss / 1024 / 1024
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
        return None

    # ── Start ────────────────────────────────

    def start(self):
        if self.running:
            self._log("Laeuft bereits.", "WARN")
            return

        # Port-Check: ist der Port noch belegt?
        if self.port and not _is_port_free(self.port):
            self._log(
                f"Port {self.port} ist belegt! Bitte zuerst 'Port freigeben' druecken "
                f"oder den alten Prozess manuell beenden.", "ERROR"
            )
            return

        self._intentional_stop = False
        resolved = _resolve_cmd(self.cmd)
        self._log(f"Starte: {' '.join(resolved)}", "INFO")

        kw: dict = dict(
            args=resolved, cwd=self.cwd,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            bufsize=1, text=True, encoding="utf-8", errors="replace",
        )
        if IS_WINDOWS:
            kw["creationflags"] = (
                subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP
            )
        else:
            kw["start_new_session"] = True

        try:
            self._proc = subprocess.Popen(**kw)
        except FileNotFoundError:
            self._log(
                f"Befehl nicht gefunden: '{resolved[0]}'\n"
                f"  Ist Node.js/npm installiert und im PATH?", "ERROR"
            )
            return
        except Exception as e:
            self._log(f"Startfehler: {e}", "ERROR")
            return

        threading.Thread(target=self._reader, daemon=True).start()
        self._log("Prozess gestartet.", "OK")

    # ── Stop ─────────────────────────────────

    def stop(self):
        if not self._proc:
            return
        self._intentional_stop = True
        self._log("Beende ...", "INFO")
        pid = self._proc.pid

        if IS_WINDOWS:
            try:
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)],
                               capture_output=True)
            except Exception:
                pass
        else:
            try:
                os.killpg(os.getpgid(pid), signal.SIGTERM)
            except (ProcessLookupError, PermissionError):
                pass

        try:
            self._proc.wait(timeout=6)
        except subprocess.TimeoutExpired:
            self._log("Zwangsbeenden ...", "WARN")
            _kill_tree(pid)

        self._proc = None
        self._log("Beendet.", "OK")

    def restart(self):
        self.stop()
        time.sleep(0.8)
        self.start()

    # ── Reader-Thread ─────────────────────────

    def _reader(self):
        proc = self._proc
        if not proc or not proc.stdout:
            return
        for raw in proc.stdout:
            line = raw.rstrip("\n\r")
            if not line:
                continue
            # Windows asyncio ProactorBasePipeTransport-Spam unterdrücken
            if "_ProactorBasePipeTransport" in line or "_call_connection_lost" in line:
                continue
            self._log(line, _classify_line(line))
        rc = proc.wait()
        if self._intentional_stop:
            self._log(f"Beendet (Code {rc}).", "OK" if rc == 0 else "WARN")
        else:
            self._log(f"Prozess unerwartet beendet (Exit-Code {rc}).", "ERROR")

    def _log(self, msg: str, level: str = "OUT"):
        self.log_q.put((self.name, level, msg))


# ──────────────────────────────────────────────
#  Dashboard-GUI
# ──────────────────────────────────────────────

class AdminDashboard(ctk.CTk):

    def __init__(self):
        super().__init__()
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")

        self.title("Inventar Pro — Admin Dashboard")
        self.geometry("1060x740")
        self.minsize(860, 600)
        self.configure(fg_color=COLOR_BG)

        self._log_q: queue.Queue = queue.Queue()
        self._backend  = ManagedProcess(
            BACKEND_LABEL,  BACKEND_CMD,  BACKEND_DIR,  self._log_q, BACKEND_PORT)
        self._frontend = ManagedProcess(
            FRONTEND_LABEL, FRONTEND_CMD, FRONTEND_DIR, self._log_q, FRONTEND_PORT)

        self._was_running   = {BACKEND_LABEL: False, FRONTEND_LABEL: False}
        self._autoscroll    = True

        self._build_ui()
        self._poll_status()
        self._poll_logs()
        self.protocol("WM_DELETE_WINDOW", self._on_close)

        if AUTOSTART_DEFAULT:
            self._autostart_var.set(1)
            self.after(800, self._start_all)

    # ═══════════════════════════════════════════
    #  UI aufbauen
    # ═══════════════════════════════════════════

    def _build_ui(self):
        # Titelleiste
        hdr = ctk.CTkFrame(self, fg_color=COLOR_ACCENT, corner_radius=0)
        hdr.pack(fill="x")
        ctk.CTkLabel(hdr, text="  Inventar Pro — Admin Dashboard",
                     font=ctk.CTkFont(size=18, weight="bold"),
                     text_color="#fff").pack(side="left", padx=20, pady=12)
        self._clock_lbl = ctk.CTkLabel(hdr, text="",
                                        font=ctk.CTkFont(size=13), text_color="#aaa")
        self._clock_lbl.pack(side="right", padx=20)
        self._tick_clock()

        # Hauptbereich
        body = ctk.CTkFrame(self, fg_color=COLOR_BG)
        body.pack(fill="both", expand=True, padx=12, pady=8)

        # Linke Spalte
        left = ctk.CTkFrame(body, fg_color=COLOR_BG, width=355)
        left.pack(side="left", fill="y", padx=(0, 10))
        left.pack_propagate(False)

        (self._be_dot, self._be_lbl,
         self._be_ram, self._be_pid) = self._build_service_panel(
             left, self._backend, BACKEND_URL, BACKEND_PORT)
        (self._fe_dot, self._fe_lbl,
         self._fe_ram, self._fe_pid) = self._build_service_panel(
             left, self._frontend, FRONTEND_URL, FRONTEND_PORT)

        self._build_global_panel(left)
        self._build_tools_panel(left)

        # Rechte Spalte: Log
        right = ctk.CTkFrame(body, fg_color=COLOR_PANEL, corner_radius=10)
        right.pack(side="left", fill="both", expand=True)

        lhdr = ctk.CTkFrame(right, fg_color=COLOR_ACCENT, corner_radius=0, height=38)
        lhdr.pack(fill="x")
        lhdr.pack_propagate(False)
        ctk.CTkLabel(lhdr, text="  Live-Log",
                     font=ctk.CTkFont(size=13, weight="bold"),
                     text_color="#fff").pack(side="left", padx=12, pady=8)
        self._scroll_var = ctk.IntVar(value=1)
        ctk.CTkCheckBox(lhdr, text="Auto-Scroll", variable=self._scroll_var,
                         font=ctk.CTkFont(size=11), text_color="#aaa",
                         command=lambda: setattr(self, "_autoscroll",
                                                  bool(self._scroll_var.get())),
                         checkbox_width=16, checkbox_height=16
                        ).pack(side="right", padx=12)

        self._log_box = ctk.CTkTextbox(
            right,
            font=ctk.CTkFont(family="Courier New", size=11),
            fg_color="#090914", text_color=COLOR_TEXT,
            wrap="word", state="disabled",
        )
        self._log_box.pack(fill="both", expand=True, padx=6, pady=(4, 6))

        for tag, color in [
            ("BACKEND",  "#74b9ff"), ("FRONTEND", "#a29bfe"),
            ("SYSTEM",   "#fd79a8"), ("GIT",      "#55efc4"),
            ("OK",       COLOR_RUNNING), ("WARN",  COLOR_WARN),
            ("ERROR",    COLOR_STOPPED), ("CRASH", COLOR_CRASH),
            ("INFO",     "#b2bec3"), ("OUT",       COLOR_TEXT),
            ("TIME",     "#636e72"),
        ]:
            self._log_box.tag_config(tag, foreground=color)

    # ──────────────────────────────────────────
    #  Service-Panel
    # ──────────────────────────────────────────

    def _build_service_panel(self, parent, proc: ManagedProcess,
                              url_base: str, port: int):
        panel = ctk.CTkFrame(parent, fg_color=COLOR_PANEL, corner_radius=10)
        panel.pack(fill="x", pady=(0, 8))

        # Aktueller Port und URL als veraenderliche Referenz
        state = {"port": port, "url": url_base}

        # ── Kopfzeile ──
        top = ctk.CTkFrame(panel, fg_color="transparent")
        top.pack(fill="x", padx=12, pady=(10, 2))

        dot = ctk.CTkLabel(top, text="●", font=ctk.CTkFont(size=22),
                            text_color=COLOR_IDLE)
        dot.pack(side="left")
        ctk.CTkLabel(top, text=proc.name,
                     font=ctk.CTkFont(size=13, weight="bold"),
                     text_color=COLOR_TEXT).pack(side="left", padx=8)

        browser_btn = ctk.CTkButton(top, text="Im Browser", width=90, height=24,
                                     fg_color="#2d3436", hover_color="#1a1a2e",
                                     font=ctk.CTkFont(size=10),
                                     command=lambda: webbrowser.open(state["url"]))
        browser_btn.pack(side="right")

        # ── Status-Zeile ──
        info = ctk.CTkFrame(panel, fg_color="transparent")
        info.pack(fill="x", padx=50, pady=(0, 4))
        status_lbl = ctk.CTkLabel(info, text="Offline",
                                   font=ctk.CTkFont(size=11), text_color=COLOR_IDLE)
        status_lbl.pack(side="left")
        pid_lbl = ctk.CTkLabel(info, text="",
                                font=ctk.CTkFont(size=10), text_color="#636e72")
        pid_lbl.pack(side="left", padx=10)
        ram_lbl = ctk.CTkLabel(info, text="",
                                font=ctk.CTkFont(size=10), text_color="#636e72")
        ram_lbl.pack(side="left")

        # ── Port-Eingabe ──
        port_row = ctk.CTkFrame(panel, fg_color="transparent")
        port_row.pack(fill="x", padx=12, pady=(2, 4))

        ctk.CTkLabel(port_row, text="Port:",
                     font=ctk.CTkFont(size=11), text_color="#aaa",
                     width=36).pack(side="left")

        port_var = ctk.StringVar(value=str(port))
        port_entry = ctk.CTkEntry(port_row, textvariable=port_var,
                                   width=68, height=26,
                                   font=ctk.CTkFont(size=12),
                                   justify="center")
        port_entry.pack(side="left", padx=(4, 6))

        # Platzhalter fuer den Port-freigeben-Button (wird gleich erstellt)
        free_btn_ref = [None]

        def _apply_port(event=None):
            raw = port_var.get().strip()
            if not raw.isdigit() or not (1 <= int(raw) <= 65535):
                port_var.set(str(state["port"]))   # ungueltig → zuruecksetzen
                self._append_log("SYSTEM", "ERROR",
                                  f"Ungueltige Portnummer: '{raw}' (1–65535)")
                return
            new_port = int(raw)
            old_port = state["port"]
            if new_port == old_port:
                return
            state["port"]  = new_port
            proc.port      = new_port
            # URL des Browser-Buttons aktualisieren
            state["url"]   = url_base.replace(str(old_port), str(new_port))
            # Port-freigeben-Button-Label aktualisieren
            if free_btn_ref[0]:
                free_btn_ref[0].configure(text=f"Port {new_port} freig.")
            self._append_log("SYSTEM", "INFO",
                              f"[{proc.name}] Port geaendert: {old_port} → {new_port}")

        port_entry.bind("<Return>",     _apply_port)
        port_entry.bind("<FocusOut>",   _apply_port)

        ctk.CTkButton(port_row, text="Setzen", width=58, height=26,
                       fg_color="#44475a", hover_color="#2d2f3e",
                       font=ctk.CTkFont(size=11),
                       command=_apply_port).pack(side="left")

        # ── Steuer-Buttons ──
        btn = ctk.CTkFrame(panel, fg_color="transparent")
        btn.pack(fill="x", padx=12, pady=(2, 10))

        ctk.CTkButton(btn, text="Start", width=74, height=30,
                       fg_color="#27ae60", hover_color="#1e8449",
                       command=lambda p=proc: threading.Thread(
                           target=p.start, daemon=True).start()
                      ).pack(side="left", padx=(0, 4))
        ctk.CTkButton(btn, text="Stop", width=74, height=30,
                       fg_color="#c0392b", hover_color="#922b21",
                       command=lambda p=proc: threading.Thread(
                           target=p.stop, daemon=True).start()
                      ).pack(side="left", padx=(0, 4))
        ctk.CTkButton(btn, text="Neustart", width=84, height=30,
                       fg_color="#2980b9", hover_color="#1a6fa8",
                       command=lambda p=proc: threading.Thread(
                           target=p.restart, daemon=True).start()
                      ).pack(side="left", padx=(0, 4))

        free_btn = ctk.CTkButton(btn, text=f"Port {port} freig.", width=100, height=30,
                                  fg_color="transparent", hover_color="#4e342e",
                                  border_width=1, border_color="#6d4c41",
                                  font=ctk.CTkFont(size=11),
                                  command=lambda: threading.Thread(
                                      target=self._do_free_port,
                                      args=(state["port"],), daemon=True).start())
        free_btn.pack(side="left")
        free_btn_ref[0] = free_btn

        return dot, status_lbl, ram_lbl, pid_lbl

    # ──────────────────────────────────────────
    #  Globale Steuerung
    # ──────────────────────────────────────────

    def _build_global_panel(self, parent):
        panel = ctk.CTkFrame(parent, fg_color=COLOR_PANEL, corner_radius=10)
        panel.pack(fill="x", pady=(0, 8))

        ctk.CTkLabel(panel, text="Globale Steuerung",
                     font=ctk.CTkFont(size=12, weight="bold"),
                     text_color="#aaa").pack(anchor="w", padx=14, pady=(10, 6))

        row = ctk.CTkFrame(panel, fg_color="transparent")
        row.pack(fill="x", padx=14, pady=(0, 6))

        ctk.CTkButton(row, text="Alle starten", width=105, height=36,
                       fg_color="#27ae60", hover_color="#1e8449",
                       font=ctk.CTkFont(size=12, weight="bold"),
                       command=self._start_all).pack(side="left", padx=(0, 5))
        ctk.CTkButton(row, text="Alle neu", width=90, height=36,
                       fg_color="#2980b9", hover_color="#1a6fa8",
                       font=ctk.CTkFont(size=12, weight="bold"),
                       command=self._restart_all).pack(side="left", padx=(0, 5))
        ctk.CTkButton(row, text="Alle stopp", width=90, height=36,
                       fg_color="#c0392b", hover_color="#922b21",
                       font=ctk.CTkFont(size=12, weight="bold"),
                       command=self._stop_all).pack(side="left")

        self._autostart_var = ctk.IntVar(value=1 if AUTOSTART_DEFAULT else 0)
        ctk.CTkCheckBox(panel, text="Beim Oeffnen automatisch starten",
                         variable=self._autostart_var,
                         font=ctk.CTkFont(size=11), text_color="#aaa",
                         checkbox_width=16, checkbox_height=16
                        ).pack(anchor="w", padx=14, pady=(0, 10))

    # ──────────────────────────────────────────
    #  Tools
    # ──────────────────────────────────────────

    def _build_tools_panel(self, parent):
        panel = ctk.CTkFrame(parent, fg_color=COLOR_PANEL, corner_radius=10)
        panel.pack(fill="x", pady=(0, 8))

        ctk.CTkLabel(panel, text="Tools",
                     font=ctk.CTkFont(size=12, weight="bold"),
                     text_color="#aaa").pack(anchor="w", padx=14, pady=(10, 6))

        row = ctk.CTkFrame(panel, fg_color="transparent")
        row.pack(fill="x", padx=14, pady=(0, 12))

        for label, fn, fg, hv in [
            ("Log leeren",    self._clear_log,    "#2d3436", "#3d3d50"),
            ("Log speichern", self._save_log,     "#2d3436", "#3d3d50"),
            ("System-Info",   self._show_sysinfo, "#2d3436", "#3d3d50"),
            ("Git Pull",      self._git_pull,     "#00b894", "#007a64"),
        ]:
            ctk.CTkButton(row, text=label, width=96, height=30,
                           fg_color=fg, hover_color=hv,
                           command=fn).pack(side="left", padx=(0, 5))

    # ═══════════════════════════════════════════
    #  Aktionen
    # ═══════════════════════════════════════════

    def _start_all(self):
        threading.Thread(target=self._backend.start,  daemon=True).start()
        threading.Thread(target=self._frontend.start, daemon=True).start()

    def _stop_all(self):
        threading.Thread(target=self._backend.stop,  daemon=True).start()
        threading.Thread(target=self._frontend.stop, daemon=True).start()

    def _restart_all(self):
        def _do():
            # Parallel stoppen
            t1 = threading.Thread(target=self._backend.stop,  daemon=True)
            t2 = threading.Thread(target=self._frontend.stop, daemon=True)
            t1.start(); t2.start()
            t1.join();  t2.join()
            time.sleep(0.5)
            # Parallel starten
            threading.Thread(target=self._backend.start,  daemon=True).start()
            threading.Thread(target=self._frontend.start, daemon=True).start()
        threading.Thread(target=_do, daemon=True).start()

    def _do_free_port(self, port: int):
        _free_port(port, self._append_log)

    def _clear_log(self):
        self._log_box.configure(state="normal")
        self._log_box.delete("1.0", "end")
        self._log_box.configure(state="disabled")

    def _save_log(self):
        from tkinter import filedialog
        path = filedialog.asksaveasfilename(
            defaultextension=".txt",
            filetypes=[("Textdatei", "*.txt"), ("Alle Dateien", "*.*")],
            initialfile=f"dashboard_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt",
            title="Log speichern"
        )
        if not path:
            return
        self._log_box.configure(state="normal")
        content = self._log_box.get("1.0", "end")
        self._log_box.configure(state="disabled")
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            self._append_log("SYSTEM", "OK", f"Log gespeichert: {path}")
        except OSError as e:
            self._append_log("SYSTEM", "ERROR", f"Log speichern fehlgeschlagen: {e}")

    def _show_sysinfo(self):
        cpu  = psutil.cpu_percent(interval=0.5)
        mem  = psutil.virtual_memory()
        disk = psutil.disk_usage(_disk_path())
        up   = int(time.time() - psutil.boot_time())
        h, r = divmod(up, 3600); m = r // 60
        be_port_free = "frei" if _is_port_free(BACKEND_PORT) else f"BELEGT"
        fe_port_free = "frei" if _is_port_free(FRONTEND_PORT) else f"BELEGT"
        lines = [
            "── System-Info " + "─" * 31,
            f"  OS     : {platform.system()} {platform.release()} ({platform.machine()})",
            f"  CPU    : {cpu:.1f}%  |  {psutil.cpu_count(logical=False)} Kerne physisch",
            f"  RAM    : {mem.used/1024**3:.1f} / {mem.total/1024**3:.1f} GB  ({mem.percent:.0f}%)",
            f"  Disk   : {disk.used/1024**3:.1f} / {disk.total/1024**3:.1f} GB  ({disk.percent:.0f}%)",
            f"  Uptime : {h}h {m}min",
            f"  Python : {sys.version.split()[0]}",
            f"  Port {BACKEND_PORT} (Backend)  : {be_port_free}",
            f"  Port {FRONTEND_PORT} (Frontend) : {fe_port_free}",
            "─" * 46,
        ]
        self._append_log("SYSTEM", "INFO", "\n".join(lines))

    def _git_pull(self):
        def _do():
            self._append_log("GIT", "INFO", f"git pull in {GIT_DIR} ...")
            try:
                # Aktuellen Branch-Namen ermitteln
                br = subprocess.run(
                    ["git", "symbolic-ref", "--short", "HEAD"],
                    cwd=GIT_DIR, capture_output=True, text=True,
                    encoding="utf-8", errors="replace")
                branch = br.stdout.strip() or "master"
                # Remote ermitteln (Fallback: origin)
                rem = subprocess.run(
                    ["git", "remote"],
                    cwd=GIT_DIR, capture_output=True, text=True,
                    encoding="utf-8", errors="replace")
                remote = rem.stdout.strip().splitlines()[0] if rem.stdout.strip() else "origin"
                self._append_log("GIT", "INFO", f"git pull {remote} {branch}")
                r = subprocess.run(
                    ["git", "pull", remote, branch],
                    cwd=GIT_DIR, capture_output=True, text=True,
                    encoding="utf-8", errors="replace")
                out = (r.stdout + r.stderr).strip() or "(keine Ausgabe)"
                self._append_log("GIT", "OK" if r.returncode == 0 else "ERROR", out)
            except FileNotFoundError:
                self._append_log("GIT", "ERROR", "git nicht gefunden.")
        threading.Thread(target=_do, daemon=True).start()

    # ═══════════════════════════════════════════
    #  Polling
    # ═══════════════════════════════════════════

    def _poll_status(self):
        pairs = [
            (self._backend,  self._be_dot, self._be_lbl, self._be_ram, self._be_pid),
            (self._frontend, self._fe_dot, self._fe_lbl, self._fe_ram, self._fe_pid),
        ]
        for proc, dot, lbl, ram_lbl, pid_lbl in pairs:
            currently = proc.running
            was       = self._was_running.get(proc.name, False)

            if currently:
                dot.configure(text_color=COLOR_RUNNING)
                lbl.configure(text="Online", text_color=COLOR_RUNNING)
                mb = proc.ram_mb()
                ram_lbl.configure(text=f"{mb:.0f} MB" if mb else "")
                pid_lbl.configure(text=f"PID {proc.pid}" if proc.pid else "")
            else:
                dot.configure(text_color=COLOR_IDLE)
                lbl.configure(text="Offline", text_color=COLOR_IDLE)
                ram_lbl.configure(text="")
                pid_lbl.configure(text="")

                # Crash-Erkennung: nur wenn NICHT absichtlich gestoppt
                if was and not currently and not proc._intentional_stop:
                    self._log_q.put((
                        proc.name, "CRASH",
                        f"Prozess '{proc.name}' ist unerwartet gestoppt! "
                        f"Pruefen ob Port {proc.port} noch belegt ist."
                    ))

            self._was_running[proc.name] = currently

        self.after(1000, self._poll_status)

    def _poll_logs(self):
        try:
            while True:
                name, level, msg = self._log_q.get_nowait()
                self._append_log(name, level, msg)
        except queue.Empty:
            pass
        self.after(80, self._poll_logs)

    def _append_log(self, name: str, level: str, msg: str):
        ts = datetime.now().strftime("%H:%M:%S")
        if BACKEND_LABEL in name:    src = "BACKEND"
        elif FRONTEND_LABEL in name: src = "FRONTEND"
        elif name == "GIT":          src = "GIT"
        elif name == "SYSTEM":       src = "SYSTEM"
        else:                        src = "INFO"

        self._log_box.configure(state="normal")
        n = int(self._log_box.index("end-1c").split(".")[0])
        if n > LOG_MAX_LINES:
            self._log_box.delete("1.0", f"{n - LOG_MAX_LINES}.0")

        self._log_box.insert("end", f"[{ts}] ", "TIME")
        self._log_box.insert("end", f"[{name}] ", src)
        self._log_box.insert("end", f"{msg}\n", level)
        if self._autoscroll:
            self._log_box.see("end")
        self._log_box.configure(state="disabled")

    # ═══════════════════════════════════════════
    #  Uhr + Schliessen
    # ═══════════════════════════════════════════

    def _tick_clock(self):
        self._clock_lbl.configure(text=datetime.now().strftime("%d.%m.%Y  %H:%M:%S"))
        self.after(1000, self._tick_clock)

    def _on_close(self):
        from tkinter import messagebox
        if self._backend.running or self._frontend.running:
            running = [p.name for p in (self._backend, self._frontend) if p.running]
            names = " & ".join(running)
            if not messagebox.askyesno(
                "Beenden?",
                f"{names} laufen noch.\nJetzt beenden und Services stoppen?"
            ):
                return
        self._stop_all()
        self.after(2500, self.destroy)


# ──────────────────────────────────────────────
if __name__ == "__main__":
    AdminDashboard().mainloop()
