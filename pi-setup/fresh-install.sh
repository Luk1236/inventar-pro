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
REPO_URL="${INVENTAR_REPO:-https://github.com/Luk1236/inventar-pro.git}"
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

# === Optionale Features VORAB abfragen (damit Skript dann durchläuft) ===
echo
echo "── Externer Zugriff (optional, aber empfohlen) ──"
echo "1) Tailscale = privates VPN (sicherer Zugang nur für deine Geräte)"
echo "2) Cloudflare Tunnel = öffentliche HTTPS-URL (Kunden/Externe)"
echo

read -p "Tailscale aktivieren? (Y/n): " ENABLE_TAILSCALE
ENABLE_TAILSCALE="${ENABLE_TAILSCALE:-Y}"

read -p "Cloudflare Tunnel aktivieren? (Y/n): " ENABLE_CLOUDFLARE
ENABLE_CLOUDFLARE="${ENABLE_CLOUDFLARE:-Y}"

if [[ "$ENABLE_CLOUDFLARE" =~ ^[Yy]$ ]]; then
    echo
    echo "ℹ️  Cloudflare braucht einen kostenlosen Account auf https://cloudflare.com"
    echo "    Falls du noch keinen hast: jetzt im Browser anmelden, dauert 1 Minute."
    read -p "    Account vorhanden? (Y/n): " CF_ACCOUNT
    CF_ACCOUNT="${CF_ACCOUNT:-Y}"
    if ! [[ "$CF_ACCOUNT" =~ ^[Yy]$ ]]; then
        echo "    OK — Cloudflare-Schritt wird übersprungen. Später nachholen mit:"
        echo "    sudo ~/inventar/setup-cloudflare-tunnel.sh"
        ENABLE_CLOUDFLARE="n"
    fi
fi
echo

# === 1. System aktualisieren ===
echo "[1/14] System aktualisieren..."
sudo apt-get update -qq
sudo apt-get upgrade -y -qq
sudo apt-get install -y -qq curl wget gnupg lsb-release ca-certificates git build-essential \
    python3 python3-venv python3-pip python3-dev libffi-dev libssl-dev

# === 2. Node.js LTS via NodeSource ===
echo "[2/14] Node.js ${NODE_MAJOR} installieren..."
if ! command -v node >/dev/null 2>&1 || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt $NODE_MAJOR ]]; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | sudo -E bash -
    sudo apt-get install -y -qq nodejs
fi
echo "  Node:  $(node --version)"
echo "  npm:   $(npm --version)"

# === 3. MongoDB 8.0 installieren ===
echo "[3/14] MongoDB 8.0 installieren..."
if ! command -v mongod >/dev/null 2>&1; then
    ARCH=$(dpkg --print-architecture)
    if [[ "$ARCH" == "arm64" ]]; then
        # Pi OS 64-bit (empfohlen) — MongoDB 8.0 für ARM64
        OS_CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")
        sudo apt-get install -y -qq gnupg curl
        curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
        case "$OS_CODENAME" in
            bookworm|trixie)
                echo "deb [ arch=arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/debian bookworm/mongodb-org/8.0 main" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
                ;;
            jammy|focal|noble)
                echo "deb [ arch=arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${OS_CODENAME}/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
                ;;
            *)
                echo "  ⚠ Unbekanntes OS ($OS_CODENAME) — versuche Debian bookworm-Paket"
                echo "deb [ arch=arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/debian bookworm/mongodb-org/8.0 main" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
                ;;
        esac
        sudo apt-get update -qq
        sudo apt-get install -y -qq mongodb-org || {
            echo "  ⚠ MongoDB 8.0 fehlgeschlagen — versuche Distro-Paket"
            sudo apt-get install -y -qq mongodb || {
                echo "  ✗ MongoDB konnte nicht installiert werden!"
                exit 1
            }
        }
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
echo "[4/14] Repo klonen..."
if [[ -d "$INSTALL_DIR" ]]; then
    echo "  Verzeichnis existiert bereits — pull statt clone"
    cd "$INSTALL_DIR" && git pull
else
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# === 5. Backend (Python venv + Dependencies) ===
echo "[5/14] Backend Python-venv..."
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
echo "[6/14] Backend .env..."
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
echo "[7/14] Frontend installieren + bauen..."
cd "$INSTALL_DIR/frontend"

# Backend-URL für den Build ermitteln und in app.json einsetzen
DETECTED_IP=$(hostname -I | awk '{print $1}')
BACKEND_URL_DEFAULT="http://${DETECTED_IP}:8002"
echo "  Aktuelle Pi-IP:  $DETECTED_IP"
echo "  Default Backend: $BACKEND_URL_DEFAULT"
read -p "  Backend-URL für die App (Enter = Default): " BACKEND_URL
BACKEND_URL="${BACKEND_URL:-$BACKEND_URL_DEFAULT}"

# In app.json einsetzen (vor dem Build, sonst wird localhost einkompiliert)
if grep -q "EXPO_PUBLIC_BACKEND_URL" app.json; then
    # Backup vor Änderung
    cp app.json app.json.bak
    # Python verwenden (sed mit URLs ist heikel)
    python3 -c "
import json
with open('app.json') as f: cfg = json.load(f)
cfg['expo']['extra']['EXPO_PUBLIC_BACKEND_URL'] = '$BACKEND_URL'
with open('app.json','w') as f: json.dump(cfg, f, indent=2)
"
    echo "  ✓ app.json → EXPO_PUBLIC_BACKEND_URL=$BACKEND_URL"
fi

echo "  → npm install läuft (kann 5-10 Min dauern)..."
npm install --silent

# Speicher-Limit für Pi 4/4GB
echo "  → Frontend-Build (Speicher-begrenzt für Pi)..."
NODE_OPTIONS="--max-old-space-size=2048" EXPO_PUBLIC_BACKEND_URL="$BACKEND_URL" \
    ./node_modules/.bin/expo export --platform web || {
    echo "  ⚠ Build fehlgeschlagen mit 2 GB Heap — versuche unbeschränkt"
    EXPO_PUBLIC_BACKEND_URL="$BACKEND_URL" ./node_modules/.bin/expo export --platform web || {
        echo "  ✗ Frontend-Build fehlgeschlagen. Tipp: Build auf dem PC machen + rsync nach dist/"
        exit 1
    }
}
echo "  ✓ Frontend gebaut nach frontend/dist/"

# === 8. systemd Service-Files installieren ===
echo "[8/14] systemd Services installieren..."
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
echo "[9/14] Sudoers konfigurieren..."
echo "$PI_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /sbin/shutdown, /usr/bin/mongodump, /usr/bin/apt-get" | sudo tee /etc/sudoers.d/inventar > /dev/null
sudo chmod 440 /etc/sudoers.d/inventar
sudo visudo -c -q -f /etc/sudoers.d/inventar && echo "  ✓ Sudoers OK" || { echo "  ✗ Sudoers ungültig — rolle zurück"; sudo rm /etc/sudoers.d/inventar; exit 1; }

# === 10. Dashboard-Passwort setzen ===
echo "[10/14] Dashboard-Passwort..."
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
echo "[11/14] Initialer Git-Tag..."
cd "$INSTALL_DIR"
VERSION=$(cat VERSION | tr -d '[:space:]')
TAG="v$VERSION"
if ! git rev-parse "$TAG" >/dev/null 2>&1; then
    git tag "$TAG" 2>/dev/null || true
fi
echo "  ✓ Tag: $TAG"

# === 12. Services starten ===
echo "[12/14] Services starten..."
sudo systemctl enable --now inventar-backend
sleep 2
sudo systemctl enable --now inventar-dashboard
sudo systemctl enable --now inventar-backup.timer 2>/dev/null || true
sudo systemctl enable --now inventar-weekly-reboot.timer 2>/dev/null || true

chmod +x "$SETUP_DIR/"*.sh 2>/dev/null || true

# === 13. Tailscale (optional) ===
TAILSCALE_IP=""
if [[ "$ENABLE_TAILSCALE" =~ ^[Yy]$ ]]; then
    echo "[13/14] Tailscale installieren..."
    if ! command -v tailscale >/dev/null 2>&1; then
        curl -fsSL https://tailscale.com/install.sh | sh || {
            echo "  ⚠ Tailscale-Install fehlgeschlagen — überspringe"
            ENABLE_TAILSCALE="n"
        }
    fi
    if [[ "$ENABLE_TAILSCALE" =~ ^[Yy]$ ]]; then
        echo "  → Tailscale verbinden — folge der Browser-URL die gleich erscheint:"
        echo "    (im Browser mit Google/GitHub anmelden, dann zurück zum Terminal)"
        echo
        sudo tailscale up || {
            echo "  ⚠ Tailscale-Login abgebrochen — überspringe"
            ENABLE_TAILSCALE="n"
        }
        if [[ "$ENABLE_TAILSCALE" =~ ^[Yy]$ ]]; then
            sleep 2
            TAILSCALE_IP=$(tailscale ip -4 2>/dev/null | head -n1 || echo "")
            echo "  ✓ Tailscale läuft — IP: ${TAILSCALE_IP:-?}"
        fi
    fi
else
    echo "[13/14] Tailscale übersprungen"
fi

# === 14. Cloudflare Tunnel (optional) ===
CLOUDFLARE_URL=""
if [[ "$ENABLE_CLOUDFLARE" =~ ^[Yy]$ ]]; then
    echo "[14/14] Cloudflare Tunnel einrichten..."
    if [[ -x "$INSTALL_DIR/setup-cloudflare-tunnel.sh" ]]; then
        # Skript läuft interaktiv (Cloudflare-Login im Browser)
        sudo "$INSTALL_DIR/setup-cloudflare-tunnel.sh" || {
            echo "  ⚠ Cloudflare-Setup abgebrochen oder fehlgeschlagen"
            ENABLE_CLOUDFLARE="n"
        }
        if [[ "$ENABLE_CLOUDFLARE" =~ ^[Yy]$ ]]; then
            # URL aus config.yml extrahieren
            if [[ -f "$HOME/.cloudflared/config.yml" ]]; then
                CLOUDFLARE_URL=$(grep -oP 'https://[a-z0-9-]+\.cfargotunnel\.com' "$HOME/.cloudflared/config.yml" | head -n1 || true)
                if [[ -z "$CLOUDFLARE_URL" ]]; then
                    TID=$(grep -oP 'hostname: \K[a-z0-9-]+\.cfargotunnel\.com' "$HOME/.cloudflared/config.yml" | head -n1 || true)
                    [[ -n "$TID" ]] && CLOUDFLARE_URL="https://$TID"
                fi
            fi
            echo "  ✓ Cloudflare Tunnel läuft"
        fi
    else
        echo "  ⚠ setup-cloudflare-tunnel.sh nicht gefunden — überspringe"
        ENABLE_CLOUDFLARE="n"
    fi
else
    echo "[14/14] Cloudflare Tunnel übersprungen"
fi

# === Fertig ===
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo
echo "============================================================"
echo " ✅ Fresh-Install abgeschlossen"
echo "============================================================"
echo
echo "🏠 LOKAL (im WLAN):"
echo "   App:        http://${LOCAL_IP}:8002"
echo "   Dashboard:  http://${LOCAL_IP}:8080"
echo "   API-Docs:   http://${LOCAL_IP}:8002/docs"
echo
if [[ -n "$TAILSCALE_IP" ]]; then
    echo "🔒 TAILSCALE (privates VPN, nur deine Geräte):"
    echo "   App:        http://${TAILSCALE_IP}:8002"
    echo "   Dashboard:  http://${TAILSCALE_IP}:8080"
    echo "   → Tailscale-App auf Handy/PC installieren mit gleichem Account"
    echo
fi
if [[ -n "$CLOUDFLARE_URL" ]]; then
    echo "🌐 ÖFFENTLICH (Cloudflare Tunnel, weltweit erreichbar):"
    echo "   App:        ${CLOUDFLARE_URL}"
    echo "   → Diese URL kannst du an Kunden/Externe weitergeben"
    echo
fi
echo "============================================================"
echo
echo "Service-Status:"
systemctl is-active inventar-backend && echo "  ✓ Backend läuft"  || echo "  ✗ Backend nicht aktiv"
systemctl is-active inventar-dashboard && echo "  ✓ Dashboard läuft" || echo "  ✗ Dashboard nicht aktiv"
systemctl is-active mongod 2>/dev/null && echo "  ✓ MongoDB läuft"  || systemctl is-active mongodb && echo "  ✓ MongoDB läuft (legacy)" || echo "  ✗ MongoDB nicht aktiv"
[[ -n "$TAILSCALE_IP" ]] && (systemctl is-active tailscaled >/dev/null && echo "  ✓ Tailscale läuft" || echo "  ⚠ Tailscale nicht aktiv")
[[ -n "$CLOUDFLARE_URL" ]] && (systemctl is-active cloudflared >/dev/null && echo "  ✓ Cloudflare Tunnel läuft" || echo "  ⚠ Cloudflare Tunnel nicht als Service aktiv")
echo
echo "Logs anschauen:"
echo "  sudo journalctl -u inventar-backend -f"
echo "  sudo journalctl -u inventar-dashboard -f"
[[ -n "$CLOUDFLARE_URL" ]] && echo "  sudo journalctl -u cloudflared -f"
echo
echo "Optional als nächstes:"
echo "  • fail2ban:    sudo apt install fail2ban && sudo cp pi-setup/fail2ban-*.conf /etc/fail2ban/filter.d/ && sudo systemctl restart fail2ban"
echo "  • Backup-Test: ~/inventar/pi-setup/test-backup-restore.sh"
echo "  • AI-Inventur: Backend-.env editieren, ANTHROPIC_API_KEY oder OPENAI_API_KEY setzen"
