#!/usr/bin/env bash
# ============================================================
#  Inventar Pro — Raspberry Pi Vollinstallation
#  Getestet auf: Raspberry Pi OS Bookworm 64-bit (Pi 4 / Pi 5)
#
#  Aufruf:
#    chmod +x pi-install.sh
#    ./pi-install.sh
# ============================================================
set -euo pipefail

# ── Farben ──────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "${GREEN}  ✓${NC} $1"; }
info() { echo -e "${CYAN}  ▸${NC} $1"; }
warn() { echo -e "${YELLOW}  ⚠${NC} $1"; }
err()  { echo -e "${RED}  ✗ FEHLER:${NC} $1"; exit 1; }
step() { echo -e "\n${BOLD}${BLUE}━━ $1${NC}"; }

# ── Banner ───────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║       Inventar Pro — Pi Installer            ║"
echo "  ║  Backend + MongoDB + Frontend + Tailscale    ║"
echo "  ╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Konfiguration ────────────────────────────────────────────
INSTALL_DIR="${HOME}/inventar"
BACKEND_DIR="${INSTALL_DIR}/Final-main/backend"
FRONTEND_DIR="${INSTALL_DIR}/Final-main/frontend"
SERVICE_USER="${USER}"
BACKEND_PORT=8002
FRONTEND_PORT=8081
NODE_VERSION=20
MONGO_VERSION=7.0

# ── Prüfungen ────────────────────────────────────────────────
step "Schritt 0 — Systemprüfung"

[[ "$(uname -m)" == "aarch64" ]] || warn "Kein ARM64 erkannt — MongoDB-Repo ist nur für ARM64."
[[ "${EUID}" -ne 0 ]] || err "Nicht als root ausführen! Als normaler User (pi/ubuntu) starten."

# RAM prüfen
RAM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [[ ${RAM_MB} -lt 2000 ]]; then
  warn "Nur ${RAM_MB} MB RAM erkannt. Mindestens 4 GB empfohlen."
else
  ok "${RAM_MB} MB RAM verfügbar"
fi

# Projekt-Verzeichnis prüfen
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -d "${SCRIPT_DIR}/Final-main" ]]; then
  info "Projekt gefunden (Final-main Layout)"
  INSTALL_DIR="${SCRIPT_DIR}"
  BACKEND_DIR="${INSTALL_DIR}/Final-main/backend"
  FRONTEND_DIR="${INSTALL_DIR}/Final-main/frontend"
  EXISTING_PROJECT=true
elif [[ -d "${SCRIPT_DIR}/backend" ]]; then
  info "Projekt gefunden (Repo-Root Layout) — verwende ${SCRIPT_DIR}"
  INSTALL_DIR="${SCRIPT_DIR}"
  BACKEND_DIR="${INSTALL_DIR}/backend"
  FRONTEND_DIR="${INSTALL_DIR}/frontend"
  EXISTING_PROJECT=true
else
  EXISTING_PROJECT=false
  info "Kein lokales Projekt — wird von GitHub geklont."
fi

# ── Schritt 1: System aktualisieren ──────────────────────────
step "Schritt 1 — System aktualisieren"
sudo apt-get update -qq
sudo apt-get upgrade -y -qq
sudo apt-get install -y -qq \
  git curl wget build-essential \
  libssl-dev libffi-dev python3-dev \
  ca-certificates gnupg lsb-release
ok "System aktualisiert"

# ── Schritt 2: Python ────────────────────────────────────────
step "Schritt 2 — Python prüfen"
PY_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PY_MAJOR=$(echo "${PY_VER}" | cut -d. -f1)
PY_MINOR=$(echo "${PY_VER}" | cut -d. -f2)

if [[ ${PY_MAJOR} -ge 3 && ${PY_MINOR} -ge 11 ]]; then
  ok "Python ${PY_VER} vorhanden"
else
  warn "Python ${PY_VER} — empfohlen ist 3.11+. Installiere..."
  sudo apt-get install -y -qq python3.11 python3.11-venv python3.11-dev
fi

sudo apt-get install -y -qq python3-pip python3-venv
ok "pip + venv verfügbar"

# ── Schritt 3: Node.js ───────────────────────────────────────
step "Schritt 3 — Node.js ${NODE_VERSION} LTS"
if command -v node &>/dev/null; then
  NODE_CUR=$(node --version | sed 's/v//' | cut -d. -f1)
  if [[ ${NODE_CUR} -ge ${NODE_VERSION} ]]; then
    ok "Node.js v$(node --version | sed 's/v//') bereits installiert"
  else
    warn "Node.js ${NODE_CUR} zu alt — aktualisiere auf ${NODE_VERSION}..."
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | sudo -E bash - -qq
    sudo apt-get install -y -qq nodejs
    ok "Node.js $(node --version) installiert"
  fi
else
  info "Node.js nicht gefunden — installiere..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | sudo -E bash - -qq
  sudo apt-get install -y -qq nodejs
  ok "Node.js $(node --version) installiert"
fi

# ── Schritt 4: MongoDB ───────────────────────────────────────
step "Schritt 4 — MongoDB ${MONGO_VERSION} (ARM64)"
if systemctl is-active --quiet mongod 2>/dev/null; then
  ok "MongoDB läuft bereits"
else
  if ! command -v mongod &>/dev/null; then
    info "MongoDB wird installiert..."

    # GPG Key (--batch verhindert interaktive Prompts)
    curl -fsSL "https://www.mongodb.org/static/pgp/server-${MONGO_VERSION}.asc" \
      | sudo gpg --batch --yes -o /usr/share/keyrings/mongodb-server-${MONGO_VERSION}.gpg --dearmor

    # Repo — trusted=yes umgeht SHA1-Signaturproblem auf modernem Debian/Pi OS
    echo "deb [ arch=arm64 signed-by=/usr/share/keyrings/mongodb-server-${MONGO_VERSION}.gpg trusted=yes ] \
https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/${MONGO_VERSION} multiverse" \
      | sudo tee /etc/apt/sources.list.d/mongodb-org-${MONGO_VERSION}.list

    sudo apt-get update -qq 2>/dev/null || true
    sudo apt-get install -y mongodb-org
    ok "MongoDB ${MONGO_VERSION} installiert"
  else
    ok "mongod binary bereits vorhanden"
  fi

  sudo systemctl enable mongod
  sudo systemctl start mongod

  # Warten bis MongoDB bereit
  for i in {1..15}; do
    if mongosh --quiet --eval "db.adminCommand('ping')" &>/dev/null 2>&1; then
      ok "MongoDB läuft (ping OK)"
      break
    fi
    sleep 1
    [[ ${i} -eq 15 ]] && err "MongoDB antwortet nicht nach 15s."
  done
fi

# ── Schritt 5: Projekt klonen (nur wenn nicht vorhanden) ─────
step "Schritt 5 — Projekt"
DEFAULT_REPO="https://github.com/Luk1236/inventar-pro.git"

if [[ "${EXISTING_PROJECT}" == "false" ]]; then
  if [[ -z "${REPO_URL:-}" ]]; then
    echo -e "\n${YELLOW}GitHub-Repository-URL [Enter = ${DEFAULT_REPO}]:${NC}"
    read -r REPO_URL
    REPO_URL="${REPO_URL:-${DEFAULT_REPO}}"
  fi

  # Privates Repo: GitHub Personal Access Token abfragen (optional)
  if [[ "${REPO_URL}" == *"github.com"* ]]; then
    echo -e "${YELLOW}GitHub-Token (PAT) für privates Repo eingeben (Enter überspringen):${NC}"
    read -rs GH_TOKEN
    if [[ -n "${GH_TOKEN}" ]]; then
      # Token in URL einbetten: https://TOKEN@github.com/...
      CLONE_URL="${REPO_URL/https:\/\//https://${GH_TOKEN}@}"
    else
      CLONE_URL="${REPO_URL}"
    fi
  else
    CLONE_URL="${REPO_URL}"
  fi

  info "Klone ${REPO_URL} ..."
  git clone "${CLONE_URL}" "${INSTALL_DIR}"
  # Remote-URL ohne Token speichern (kein Token im .git/config)
  git -C "${INSTALL_DIR}" remote set-url origin "${REPO_URL}"
  # Pfade nach Clone setzen (Repo-Root = ehemals Final-main)
  BACKEND_DIR="${INSTALL_DIR}/backend"
  FRONTEND_DIR="${INSTALL_DIR}/frontend"
  ok "Projekt geklont nach ${INSTALL_DIR}"
else
  ok "Projekt bereits vorhanden: ${INSTALL_DIR}"
fi

[[ -d "${BACKEND_DIR}" ]]  || err "Backend-Verzeichnis nicht gefunden: ${BACKEND_DIR}"
[[ -d "${FRONTEND_DIR}" ]] || err "Frontend-Verzeichnis nicht gefunden: ${FRONTEND_DIR}"

# ── Schritt 6: Python Virtual Environment ────────────────────
step "Schritt 6 — Python-Abhängigkeiten"
cd "${BACKEND_DIR}"

if [[ ! -d ".venv" ]]; then
  python3 -m venv .venv
  ok "Virtualenv angelegt"
fi

source .venv/bin/activate
pip install --quiet --upgrade pip
info "Installiere Python-Pakete (kann ~5 Min dauern)..."
pip install --quiet -r requirements.txt
ok "Python-Pakete installiert"
deactivate

# ── Schritt 7: .env konfigurieren ────────────────────────────
step "Schritt 7 — Konfiguration (.env)"
ENV_FILE="${BACKEND_DIR}/.env"

if [[ -f "${ENV_FILE}" ]]; then
  warn ".env bereits vorhanden — wird nicht überschrieben."
  info "Prüfe ob SECRET_KEY gesetzt ist..."
  if grep -qE "^SECRET_KEY=.{10,}" "${ENV_FILE}"; then
    ok "SECRET_KEY vorhanden"
  else
    warn "SECRET_KEY fehlt oder zu kurz!"
  fi
else
  info "Erstelle .env..."
  SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
  cat > "${ENV_FILE}" <<EOF
# Inventar Pro — Backend Konfiguration
# Generiert von pi-install.sh am $(date)

MONGO_URL=mongodb://localhost:27017
DB_NAME=inventory_db

SECRET_KEY=${SECRET}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

# CORS — wird nach Tailscale-Setup automatisch ergaenzt
ALLOWED_ORIGINS=http://localhost:${FRONTEND_PORT},http://localhost:${BACKEND_PORT}

# E-Mail (optional)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
ADMIN_EMAIL=
NOTIFICATION_EMAIL=
EOF
  ok ".env erstellt (SECRET_KEY automatisch generiert)"
fi

# ── Schritt 8: Datenbank-Indexes ─────────────────────────────
step "Schritt 8 — MongoDB Indexes anlegen"
cd "${BACKEND_DIR}"
source .venv/bin/activate
python3 - <<'PYEOF'
import asyncio, sys
try:
    from app.database_indexes import create_indexes
    asyncio.run(create_indexes())
    print("  Indexes OK")
except Exception as e:
    print(f"  Warnung: {e}", file=sys.stderr)
PYEOF
deactivate
ok "Indexes geprüft"

# ── Schritt 9: npm install ───────────────────────────────────
step "Schritt 9 — Frontend-Abhängigkeiten"
cd "${FRONTEND_DIR}"
if [[ -d "node_modules" ]]; then
  ok "node_modules bereits vorhanden — überspringe"
else
  info "npm install (kann ~8 Min dauern)..."
  npm install --silent
  ok "Frontend-Pakete installiert"
fi

# ── Schritt 10: Tailscale ────────────────────────────────────
step "Schritt 10 — Tailscale"
if command -v tailscale &>/dev/null; then
  ok "Tailscale bereits installiert: $(tailscale version | head -1)"
else
  info "Tailscale wird installiert..."
  curl -fsSL https://tailscale.com/install.sh | sh
  ok "Tailscale installiert"
fi

# Tailscale verbinden (falls noch nicht)
if ! tailscale status &>/dev/null 2>&1; then
  echo -e "\n${YELLOW}Tailscale-Verbindung starten...${NC}"
  echo "Ein Auth-Link wird angezeigt — im Browser öffnen und einloggen."
  sudo tailscale up --accept-routes
fi

TAILSCALE_IP=$(tailscale ip -4 2>/dev/null || echo "")
if [[ -n "${TAILSCALE_IP}" ]]; then
  ok "Tailscale verbunden: ${TAILSCALE_IP}"
else
  warn "Tailscale-IP nicht ermittelbar — evtl. noch nicht verbunden."
fi

# ── Schritt 11: Tailscale Serve ──────────────────────────────
step "Schritt 11 — Tailscale Serve (HTTPS-Proxy)"
if [[ -n "${TAILSCALE_IP}" ]]; then
  # Frontend auf /
  sudo tailscale serve --bg "http://localhost:${FRONTEND_PORT}" 2>/dev/null || true
  # Backend-Pfade
  for path in /api /ws /docs; do
    sudo tailscale serve --bg --set-path "${path}" "http://localhost:${BACKEND_PORT}" 2>/dev/null || true
  done
  ok "Tailscale Serve konfiguriert"
  sudo tailscale serve status || true

  # Tailscale FQDN ermitteln
  TS_FQDN=$(tailscale status --json 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['Self']['DNSName'].rstrip('.'))" \
    2>/dev/null || echo "")

  if [[ -n "${TS_FQDN}" ]]; then
    ok "Tailscale FQDN: ${TS_FQDN}"
    # ALLOWED_ORIGINS erweitern
    ENV_FILE="${BACKEND_DIR}/.env"
    CURRENT_ORIGINS=$(grep "^ALLOWED_ORIGINS=" "${ENV_FILE}" | cut -d= -f2-)
    NEW_ORIGINS="${CURRENT_ORIGINS},https://${TS_FQDN},http://${TAILSCALE_IP}:${FRONTEND_PORT}"
    # Duplikate entfernen
    NEW_ORIGINS=$(echo "${NEW_ORIGINS}" | tr ',' '\n' | sort -u | tr '\n' ',' | sed 's/,$//')
    # .env aktualisieren
    sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=${NEW_ORIGINS}|" "${ENV_FILE}"
    ok "ALLOWED_ORIGINS in .env aktualisiert"
  fi
else
  warn "Tailscale Serve übersprungen — kein Netzwerk."
fi

# ── Schritt 12: Systemd Services ─────────────────────────────
step "Schritt 12 — Systemd Services"
VENV_PYTHON="${BACKEND_DIR}/.venv/bin/python3"
NPX_BIN=$(which npx)

# Backend Service
cat > /tmp/inventar-backend.service <<EOF
[Unit]
Description=Inventar Pro Backend (FastAPI)
After=network.target mongod.service
Requires=mongod.service

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${BACKEND_DIR}
Environment=PATH=${BACKEND_DIR}/.venv/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=${VENV_PYTHON} server.py
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=inventar-backend

[Install]
WantedBy=multi-user.target
EOF

# Frontend Service
cat > /tmp/inventar-frontend.service <<EOF
[Unit]
Description=Inventar Pro Frontend (Expo Web)
After=network.target inventar-backend.service

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${FRONTEND_DIR}
ExecStart=${NPX_BIN} expo start --web --port ${FRONTEND_PORT} --no-dev
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=CI=1
StandardOutput=journal
StandardError=journal
SyslogIdentifier=inventar-frontend

[Install]
WantedBy=multi-user.target
EOF

sudo cp /tmp/inventar-backend.service  /etc/systemd/system/
sudo cp /tmp/inventar-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable inventar-backend inventar-frontend
sudo systemctl restart inventar-backend inventar-frontend
ok "Systemd Services aktiv"

# ── Schritt 13: Verifikation ─────────────────────────────────
step "Schritt 13 — Verifikation"
info "Warte 8s auf Start..."
sleep 8

BACKEND_OK=false
FRONTEND_OK=false

# Backend prüfen
if curl -sf "http://localhost:${BACKEND_PORT}/health" &>/dev/null; then
  ok "Backend /health → OK"
  BACKEND_OK=true
elif curl -sf "http://localhost:${BACKEND_PORT}/docs" &>/dev/null; then
  ok "Backend /docs → OK"
  BACKEND_OK=true
else
  warn "Backend antwortet noch nicht. Prüfe: journalctl -u inventar-backend -n 30"
fi

# Frontend prüfen
if curl -sf "http://localhost:${FRONTEND_PORT}" &>/dev/null; then
  ok "Frontend → OK"
  FRONTEND_OK=true
else
  warn "Frontend antwortet noch nicht (Expo braucht manchmal 30s+). Prüfe: journalctl -u inventar-frontend -n 30"
fi

# ── Ergebnis ─────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  Installation abgeschlossen!${NC}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# LAN-IP ermitteln
LAN_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "unbekannt")

echo -e "${BOLD}  Zugriffs-URLs:${NC}"
echo -e "  ${CYAN}Lokal (LAN)${NC}     http://${LAN_IP}:${FRONTEND_PORT}"
echo -e "  ${CYAN}API (LAN)${NC}       http://${LAN_IP}:${BACKEND_PORT}/docs"
[[ -n "${TAILSCALE_IP:-}"   ]] && echo -e "  ${CYAN}Tailscale IP${NC}    http://${TAILSCALE_IP}:${FRONTEND_PORT}"
[[ -n "${TS_FQDN:-}"        ]] && echo -e "  ${CYAN}Tailscale HTTPS${NC} https://${TS_FQDN}"
echo ""
echo -e "${BOLD}  Nützliche Befehle:${NC}"
echo -e "  ${YELLOW}sudo systemctl status inventar-backend${NC}    # Status"
echo -e "  ${YELLOW}journalctl -fu inventar-backend${NC}           # Live-Log Backend"
echo -e "  ${YELLOW}journalctl -fu inventar-frontend${NC}          # Live-Log Frontend"
echo -e "  ${YELLOW}sudo systemctl restart inventar-backend${NC}   # Neustart"
echo ""
echo -e "${BOLD}  Update-Befehl:${NC}"
echo -e "  ${YELLOW}cd ${INSTALL_DIR}/Final-main && git pull && sudo systemctl restart inventar-backend inventar-frontend${NC}"
echo ""
[[ "${BACKEND_OK}" == "false" || "${FRONTEND_OK}" == "false" ]] && \
  echo -e "${YELLOW}  Ein Service antwortet noch nicht — warte 30s und prüfe die Logs.${NC}\n"
