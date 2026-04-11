#!/bin/bash
# Inventar Pro – Raspberry Pi Setup
# Läuft auf Raspberry Pi OS (64-bit) oder Ubuntu 22.04 ARM
# Aufruf: bash setup-raspi.sh

set -e
set -o pipefail

INSTALL_DIR="/opt/inventarpro"
SERVICE_USER="inventarpro"
BACKEND_PORT=8002

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Root-Check
[ "$EUID" -ne 0 ] && error "Bitte als root ausführen: sudo bash setup-raspi.sh"

# Architektur prüfen
ARCH=$(uname -m)
info "Architektur: $ARCH"
[[ "$ARCH" != "aarch64" ]] && warn "Nicht ARM64 – MongoDB benötigt 64-bit Raspberry Pi OS!"

# ────────────────────────────────────────────
# 1. System aktualisieren
# ────────────────────────────────────────────
info "System wird aktualisiert..."
apt-get update -qq
apt-get upgrade -y -qq

# ────────────────────────────────────────────
# 2. Python installieren
# ────────────────────────────────────────────
info "Python 3 und pip installieren..."
apt-get install -y -qq python3 python3-pip python3-venv python3-dev build-essential

PYTHON=$(which python3)
$PYTHON --version

# ────────────────────────────────────────────
# 3. MongoDB installieren (ARM64)
# ────────────────────────────────────────────
if ! command -v mongod &>/dev/null; then
  info "MongoDB installieren..."
  if [[ "$ARCH" == "aarch64" ]]; then
    # MongoDB 7.0 für ARM64 / Ubuntu 22.04
    apt-get install -y -qq gnupg curl
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
      gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

    # Raspberry Pi OS (bookworm) basiert auf Debian 12
    OS_CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")
    case "$OS_CODENAME" in
      bookworm|trixie)
        echo "deb [ arch=arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" \
          > /etc/apt/sources.list.d/mongodb-org-7.0.list
        ;;
      jammy|focal|noble)
        echo "deb [ arch=arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${OS_CODENAME}/mongodb-org/7.0 multiverse" \
          > /etc/apt/sources.list.d/mongodb-org-7.0.list
        ;;
      *)
        warn "Unbekanntes OS ($OS_CODENAME) – versuche Debian bookworm-Paket"
        echo "deb [ arch=arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" \
          > /etc/apt/sources.list.d/mongodb-org-7.0.list
        ;;
    esac

    apt-get update -qq
    apt-get install -y -qq mongodb-org || {
      warn "MongoDB 7 fehlgeschlagen – versuche mongod aus Distro-Repo..."
      apt-get install -y -qq mongodb || error "MongoDB konnte nicht installiert werden."
    }
  else
    warn "32-bit ARM – verwende Distro-MongoDB (möglicherweise ältere Version)"
    apt-get install -y -qq mongodb || error "MongoDB konnte nicht installiert werden."
  fi
else
  info "MongoDB bereits installiert: $(mongod --version | head -1)"
fi

# MongoDB aktivieren und starten
systemctl enable mongod 2>/dev/null || systemctl enable mongodb 2>/dev/null || true
systemctl start  mongod 2>/dev/null || systemctl start  mongodb 2>/dev/null || true
info "MongoDB läuft: $(systemctl is-active mongod 2>/dev/null || systemctl is-active mongodb 2>/dev/null)"

# ────────────────────────────────────────────
# 4. Systembenutzer anlegen
# ────────────────────────────────────────────
if ! id "$SERVICE_USER" &>/dev/null; then
  info "Systembenutzer '$SERVICE_USER' anlegen..."
  useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

# ────────────────────────────────────────────
# 5. Backend in /opt/inventarpro installieren
# ────────────────────────────────────────────
info "Backend nach $INSTALL_DIR kopieren..."
mkdir -p "$INSTALL_DIR"

# Skript-Verzeichnis ermitteln (auch bei Aufruf mit 'bash setup-raspi.sh')
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -d "$SCRIPT_DIR/backend" ]; then
  error "backend/-Verzeichnis nicht gefunden in $SCRIPT_DIR"
fi
cp -r "$SCRIPT_DIR/backend/." "$INSTALL_DIR/"

# .env anlegen (falls nicht vorhanden)
if [ ! -f "$INSTALL_DIR/.env" ]; then
  info ".env anlegen..."
  PI_IP=$(hostname -I | awk '{print $1}')
  SECRET=$(openssl rand -hex 32)
  cat > "$INSTALL_DIR/.env" <<EOF
# MongoDB
MONGO_URL=mongodb://localhost:27017
DB_NAME=inventory_db

# Sicherheit – NIEMALS ändern nach erstem Start (alle Tokens werden ungültig)!
SECRET_KEY=${SECRET}

# Token-Laufzeiten
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# E-Mail (optional)
ADMIN_EMAIL=
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
NOTIFICATION_EMAIL=
EOF
  info ".env erstellt (IP des Pi: $PI_IP)"
else
  info ".env bereits vorhanden – wird nicht überschrieben"
fi

# ────────────────────────────────────────────
# 6. Python Virtual Environment + Pakete
# ────────────────────────────────────────────
info "Virtuelle Python-Umgebung erstellen..."
$PYTHON -m venv "$INSTALL_DIR/venv"
"$INSTALL_DIR/venv/bin/pip" install --upgrade pip -q
"$INSTALL_DIR/venv/bin/pip" install -r "$INSTALL_DIR/requirements.txt" -q
info "Python-Pakete installiert"

# ────────────────────────────────────────────
# 7. Berechtigungen setzen
# ────────────────────────────────────────────
chown -R "$SERVICE_USER":"$SERVICE_USER" "$INSTALL_DIR"

# ────────────────────────────────────────────
# 8. systemd-Service installieren
# ────────────────────────────────────────────
info "systemd-Service installieren..."
cat > /etc/systemd/system/inventarpro.service <<EOF
[Unit]
Description=Inventar Pro Backend
After=network.target mongod.service mongodb.service
Wants=mongod.service mongodb.service

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=${INSTALL_DIR}/venv/bin/uvicorn server:app --host 0.0.0.0 --port ${BACKEND_PORT} --workers 1
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable inventarpro
systemctl restart inventarpro

sleep 2

if systemctl is-active --quiet inventarpro; then
  info "✅ Inventar Pro Backend läuft auf Port ${BACKEND_PORT}"
else
  warn "Backend-Start fehlgeschlagen – Logs prüfen:"
  journalctl -u inventarpro -n 30 --no-pager
fi

# ────────────────────────────────────────────
# 9. Firewall (falls ufw aktiv)
# ────────────────────────────────────────────
if command -v ufw &>/dev/null && ufw status | grep -q "active"; then
  ufw allow "${BACKEND_PORT}/tcp" comment "Inventar Pro Backend" 2>/dev/null || true
  info "Firewall-Regel für Port ${BACKEND_PORT} hinzugefügt"
fi

# ────────────────────────────────────────────
# Optional: Cloudflare Tunnel
# ────────────────────────────────────────────
echo ""
if [ -t 0 ]; then
  read -p "Cloudflare Tunnel einrichten für Internet-Zugang? (j/n): " SETUP_TUNNEL
else
  SETUP_TUNNEL="n"
  info "Nicht-interaktiver Modus — Cloudflare Tunnel übersprungen"
fi
if [[ "$SETUP_TUNNEL" == "j" || "$SETUP_TUNNEL" == "J" ]]; then
  if [ -f "$SCRIPT_DIR/setup-cloudflare-tunnel.sh" ]; then
    bash "$SCRIPT_DIR/setup-cloudflare-tunnel.sh"
  else
    warn "setup-cloudflare-tunnel.sh nicht gefunden — Tunnel-Setup übersprungen"
    info "Führe später manuell aus: bash setup-cloudflare-tunnel.sh"
  fi
else
  info "Cloudflare Tunnel übersprungen — kann später mit 'bash setup-cloudflare-tunnel.sh' eingerichtet werden"
fi

# ────────────────────────────────────────────
# 10. Zusammenfassung
# ────────────────────────────────────────────
PI_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "════════════════════════════════════════════"
echo "  Inventar Pro erfolgreich eingerichtet!"
echo "════════════════════════════════════════════"
echo ""
echo "  Backend-URL:  http://${PI_IP}:${BACKEND_PORT}"
echo "  API-Docs:     http://${PI_IP}:${BACKEND_PORT}/docs"
echo ""
echo "  Logs:         journalctl -u inventarpro -f"
echo "  Neustart:     systemctl restart inventarpro"
echo "  Status:       systemctl status inventarpro"
echo ""
echo "  ➜ Diese URL in der App eintragen:"
echo "    http://${PI_IP}:${BACKEND_PORT}"
echo ""
echo "════════════════════════════════════════════"
