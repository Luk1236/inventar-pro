#!/usr/bin/env bash
# ============================================================
# Inventar Pro — Komplette Fresh-Installation auf Raspberry Pi
# ============================================================
# Voraussetzung: frisch geflashtes Raspberry Pi OS 64-bit (Bookworm)
# Ausführen mit:
#   curl -fsSL https://raw.githubusercontent.com/<user>/<repo>/main/pi-setup/fresh-install.sh | bash
# ODER nach git clone:
#   chmod +x pi-setup/fresh-install.sh
#   ./pi-setup/fresh-install.sh
# ============================================================
set -euo pipefail

# === Konfiguration ===
REPO_URL="${INVENTAR_REPO:-https://github.com/dbootz111/inventar-pro.git}"
INSTALL_DIR="${HOME}/inventar"
PI_USER="$(whoami)"
NODE_MAJOR=20

echo "============================================================"
echo " Inventar Pro — Fresh Install"
echo " User:        $PI_USER"
echo " Install-Dir: $INSTALL_DIR"
echo " Repo:        $REPO_URL"
echo "============================================================"
echo

# Bestätigung
read -p "Fortfahren? (y/N): " CONFIRM
[[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]] && { echo "Abgebrochen."; exit 0; }

# === 1. System aktualisieren ===
echo "[1/12] System aktualisieren..."
sudo apt-get update -qq
sudo apt-get upgrade -y -qq
sudo apt-get install -y -qq curl wget gnupg lsb-release ca-certificates git build-essential \
    python3 python3-venv python3-pip python3-dev libffi-dev libssl-dev

# === 2. Node.js LTS via NodeSource ===
echo "[2/12] Node.js ${NODE_MAJOR} installieren..."
if ! command -v node >/dev/null 2>&1 || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt $NODE_MAJOR ]]; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | sudo -E bash -
    sudo apt-get install -y -qq nodejs
fi
echo "  Node:  $(node --version)"
echo "  npm:   $(npm --version)"

# === 3. MongoDB installieren ===
echo "[3/12] MongoDB installieren..."
if ! command -v mongod >/dev/null 2>&1; then
    ARCH=$(dpkg --print-architecture)
    if [[ "$ARCH" == "arm64" ]]; then
        # Pi OS 64-bit (empfohlen)
        curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
        echo "deb [arch=arm64,amd64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
        sudo apt-get update -qq
        sudo apt-get install -y -qq mongodb-org
    else
        echo "  ⚠ 32-bit Pi OS erkannt — installiere mongodb-server aus Debian-Repo (älter, eingeschränkt)"
        sudo apt-get install -y -qq mongodb-server || {
            echo "  ✗ MongoDB-Installation fehlgeschlagen. Bitte Pi OS 64-bit verwenden!"
            exit 1
        }
    fi
fi
sudo systemctl enable mongod 2>/dev/null || sudo systemctl enable mongodb 2>/dev/null || true
sudo systemctl start mongod 2>/dev/null || sudo systemctl start mongodb 2>/dev/null || true

# === 4. Repo klonen ===
echo "[4/12] Repo klonen..."
if [[ -d "$INSTALL_DIR" ]]; then
    echo "  Verzeichnis existiert bereits — pull statt clone"
    cd "$INSTALL_DIR" && git pull
else
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# === 5. Backend (Python venv + Dependencies) ===
echo "[5/12] Backend Python-venv..."
cd "$INSTALL_DIR/backend"
if [[ ! -d .venv ]]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install --upgrade --quiet pip wheel
pip install --quiet -r requirements.txt
# Optional-Dependencies für neue Features
pip install --quiet passlib bcrypt pyotp websockets qrcode[pil] reportlab anthropic openai || true
deactivate
echo "  ✓ Backend-Dependencies installiert"

# === 6. Backend .env erstellen ===
echo "[6/12] Backend .env..."
if [[ ! -f "$INSTALL_DIR/backend/.env" ]]; then
    SECRET_KEY=$(python3 -c "import secrets;print(secrets.token_urlsafe(32))")
    cat > "$INSTALL_DIR/backend/.env" <<EOF
# Auto-generiert beim Fresh-Install
SECRET_KEY=${SECRET_KEY}
MONGO_URL=mongodb://localhost:27017
DB_NAME=inventar
ALLOWED_ORIGINS=http://localhost:8002,http://${PI_USER}:8002
ENVIRONMENT=production

# Optional: für AI-Inventur (ChatGPT/Claude Vision)
# ANTHROPIC_API_KEY=
# OPENAI_API_KEY=

# Optional: Email-Notifications
# SMTP_HOST=
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASSWORD=
# NOTIFICATION_EMAIL=

# Optional: Label-Drucker
# LABEL_PRINTER_HOST=
# LABEL_PRINTER_PORT=9100
EOF
    chmod 600 "$INSTALL_DIR/backend/.env"
    echo "  ✓ .env erstellt (SECRET_KEY zufällig generiert)"
else
    echo "  ✓ .env existiert bereits"
fi

# === 7. Frontend (npm install + static build) ===
echo "[7/12] Frontend installieren + bauen..."
cd "$INSTALL_DIR/frontend"
npm install --silent
echo "  → npm install fertig"
npx expo export --platform web
echo "  ✓ Frontend gebaut nach frontend/dist/"

# === 8. systemd Service-Files installieren ===
echo "[8/12] systemd Services installieren..."
SETUP_DIR="$INSTALL_DIR/pi-setup"
# Falls Service-Files den User 'admin' hart-codiert haben, durch aktuellen User ersetzen
for unit in inventar-backend.service inventar-dashboard.service inventar-backup.service inventar-backup.timer inventar-weekly-reboot.service inventar-weekly-reboot.timer; do
    SRC="$SETUP_DIR/$unit"
    if [[ -f "$SRC" ]]; then
        sed "s|/home/admin|/home/$PI_USER|g; s|^User=admin|User=$PI_USER|" "$SRC" | sudo tee "/etc/systemd/system/$unit" > /dev/null
    fi
done
sudo systemctl daemon-reload
echo "  ✓ Service-Files installiert"

# === 9. Sudoers (NOPASSWD für systemctl, shutdown, mongodump) ===
echo "[9/12] Sudoers konfigurieren..."
echo "$PI_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /sbin/shutdown, /usr/bin/mongodump, /usr/bin/apt-get" | sudo tee /etc/sudoers.d/inventar > /dev/null
sudo chmod 440 /etc/sudoers.d/inventar
sudo visudo -c -q -f /etc/sudoers.d/inventar && echo "  ✓ Sudoers OK" || { echo "  ✗ Sudoers ungültig — rolle zurück"; sudo rm /etc/sudoers.d/inventar; exit 1; }

# === 10. Dashboard-Passwort setzen ===
echo "[10/12] Dashboard-Passwort..."
if [[ ! -f ~/.dashboard_password ]]; then
    while true; do
        read -srp "  Neues Dashboard-Passwort (min. 4 Zeichen): " DASH_PW
        echo
        if [[ ${#DASH_PW} -ge 4 ]]; then break; fi
        echo "  → zu kurz, nochmal"
    done
    source "$INSTALL_DIR/backend/.venv/bin/activate"
    python3 -c "from passlib.context import CryptContext;import sys;print(CryptContext(schemes=['bcrypt']).hash(sys.argv[1]))" "$DASH_PW" > ~/.dashboard_password
    deactivate
    chmod 600 ~/.dashboard_password
    echo "  ✓ Passwort gesetzt (bcrypt)"
else
    echo "  ✓ Passwort existiert bereits"
fi

# === 11. Initialer Git-Tag (für Rollback-System) ===
echo "[11/12] Initialer Git-Tag..."
cd "$INSTALL_DIR"
VERSION=$(cat VERSION | tr -d '[:space:]')
TAG="v$VERSION"
if ! git rev-parse "$TAG" >/dev/null 2>&1; then
    git tag "$TAG" 2>/dev/null || true
fi
echo "  ✓ Tag: $TAG"

# === 12. Services starten ===
echo "[12/12] Services starten..."
sudo systemctl enable --now inventar-backend
sleep 2
sudo systemctl enable --now inventar-dashboard
sudo systemctl enable --now inventar-backup.timer 2>/dev/null || true
sudo systemctl enable --now inventar-weekly-reboot.timer 2>/dev/null || true

chmod +x "$SETUP_DIR/"*.sh 2>/dev/null || true

# === Fertig ===
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo
echo "============================================================"
echo " ✅ Fresh-Install abgeschlossen"
echo "============================================================"
echo " Dashboard:  http://${LOCAL_IP}:8080"
echo " App:        http://${LOCAL_IP}:8002"
echo " API-Docs:   http://${LOCAL_IP}:8002/docs"
echo "============================================================"
echo
echo "Service-Status:"
systemctl is-active inventar-backend && echo "  ✓ Backend läuft"  || echo "  ✗ Backend nicht aktiv"
systemctl is-active inventar-dashboard && echo "  ✓ Dashboard läuft" || echo "  ✗ Dashboard nicht aktiv"
systemctl is-active mongod 2>/dev/null && echo "  ✓ MongoDB läuft"  || systemctl is-active mongodb && echo "  ✓ MongoDB läuft (legacy)" || echo "  ✗ MongoDB nicht aktiv"
echo
echo "Logs anschauen:"
echo "  sudo journalctl -u inventar-backend -f"
echo "  sudo journalctl -u inventar-dashboard -f"
echo
echo "Optional als nächstes:"
echo "  • Tailscale: curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up"
echo "  • HTTPS:      ./pi-setup/enable-tailscale-funnel.sh"
echo "  • fail2ban:   sudo apt install fail2ban && sudo cp pi-setup/fail2ban-*.conf /etc/fail2ban/filter.d/ && sudo systemctl restart fail2ban"
echo "  • Backup-Test: ./pi-setup/test-backup-restore.sh"
