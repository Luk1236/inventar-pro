#!/bin/bash
# EquipTrack – Internet-Zugang via Cloudflare Tunnel
# Läuft auf dem Raspberry Pi NACH setup-raspi.sh
# Aufruf: sudo bash setup-internet.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
step()  { echo -e "${CYAN}[====]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

[ "$EUID" -ne 0 ] && error "Bitte als root ausführen: sudo bash setup-internet.sh"

INSTALL_DIR="/opt/equiptrack"
BACKEND_PORT=8000
WEB_ROOT="/var/www/equiptrack"

# ────────────────────────────────────────────
# 1. Nginx installieren
# ────────────────────────────────────────────
step "Nginx installieren..."
apt-get update -qq
apt-get install -y -qq nginx
systemctl enable nginx

# Nginx-Konfiguration für EquipTrack
cat > /etc/nginx/sites-available/equiptrack <<'NGINX'
server {
    listen 80;
    server_name _;

    # Web-App (statische Dateien)
    root /var/www/equiptrack;
    index index.html;

    # React Navigation – alle Routen zur index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass         http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # WebSocket
    location /ws {
        proxy_pass         http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       $host;
        proxy_read_timeout 3600s;
    }

    # Datei-Uploads
    client_max_body_size 50M;
}
NGINX

# Standard-Seite deaktivieren, EquipTrack aktivieren
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/equiptrack /etc/nginx/sites-enabled/equiptrack

# Web-Root anlegen
mkdir -p "$WEB_ROOT"
nginx -t && systemctl reload nginx
info "Nginx konfiguriert (Port 80)"

# ────────────────────────────────────────────
# 2. Node.js für Web-Build auf dem Pi (optional)
# ────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  info "Node.js installieren (für Web-Build auf dem Pi)..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null
  apt-get install -y -qq nodejs
  info "Node.js $(node --version) installiert"
fi

# ────────────────────────────────────────────
# 3. Cloudflare Tunnel (cloudflared) installieren
# ────────────────────────────────────────────
step "Cloudflare Tunnel installieren..."
if ! command -v cloudflared &>/dev/null; then
  ARCH=$(uname -m)
  if [[ "$ARCH" == "aarch64" ]]; then
    CF_PKG="cloudflared-linux-arm64.deb"
  else
    CF_PKG="cloudflared-linux-arm.deb"
  fi
  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/${CF_PKG}" \
    -o /tmp/cloudflared.deb
  dpkg -i /tmp/cloudflared.deb
  rm /tmp/cloudflared.deb
  info "cloudflared installiert: $(cloudflared --version)"
else
  info "cloudflared bereits installiert: $(cloudflared --version)"
fi

# ────────────────────────────────────────────
# 4. Tunnel starten (Schnelltest ohne Konto)
# ────────────────────────────────────────────
step "Cloudflare Tunnel einrichten..."

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Zwei Optionen für den Tunnel:"
echo "════════════════════════════════════════════════════════"
echo ""
echo "  Option A: SCHNELLTEST (temporäre URL, kein Konto nötig)"
echo "  → Gut zum Ausprobieren, URL ändert sich bei Neustart"
echo ""
echo "  Option B: DAUERHAFT (Cloudflare-Konto, eigene URL)"
echo "  → Kostenlos, feste URL, läuft nach Reboot automatisch"
echo ""
read -rp "Welche Option? [A/B]: " OPTION

if [[ "${OPTION,,}" == "a" ]]; then
  # ── Option A: Temporärer Tunnel ──────────────
  info "Temporären Tunnel starten..."
  info "STRG+C zum Beenden. URL wird unten angezeigt."
  echo ""
  cloudflared tunnel --url http://localhost:80

else
  # ── Option B: Dauerhafter Tunnel ─────────────
  echo ""
  echo "Schritte für dauerhaften Tunnel:"
  echo "1. Gehe auf https://cloudflare.com → kostenlos registrieren"
  echo "2. Füge eine Domain hinzu ODER kaufe eine (.com ~10€/Jahr)"
  echo "   ODER nutze eine kostenlose Subdomain auf einer bestehenden Domain"
  echo "3. Führe aus:"
  echo ""
  echo "   cloudflared tunnel login"
  echo "   cloudflared tunnel create equiptrack"
  echo "   cloudflared tunnel route dns equiptrack equiptrack.DEINE-DOMAIN.de"
  echo ""
  echo "4. Konfigurationsdatei anlegen:"
  echo ""

  mkdir -p /etc/cloudflared
  cat > /etc/cloudflared/config.yml <<'CF'
# /etc/cloudflared/config.yml
# 'tunnel' und 'credentials-file' nach 'cloudflared tunnel create' anpassen!
tunnel: TUNNEL-ID-HIER-EINTRAGEN
credentials-file: /root/.cloudflared/TUNNEL-ID-HIER-EINTRAGEN.json

ingress:
  - hostname: equiptrack.DEINE-DOMAIN.de
    service: http://localhost:80
  - service: http_status:404
CF

  echo "   Datei wurde angelegt: /etc/cloudflared/config.yml"
  echo "   → Tunnel-ID und Domain dort eintragen!"
  echo ""
  echo "5. Als Dienst installieren:"
  echo ""
  echo "   cloudflared service install"
  echo "   systemctl enable cloudflared"
  echo "   systemctl start cloudflared"
  echo ""
  echo "   Danach läuft der Tunnel automatisch nach jedem Reboot."
  echo ""
fi

# ────────────────────────────────────────────
# 5. Zusammenfassung
# ────────────────────────────────────────────
PI_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "════════════════════════════════════════════════════════"
echo "  Nächste Schritte nach Tunnel-Einrichtung:"
echo "════════════════════════════════════════════════════════"
echo ""
echo "  1. Tunnel-URL notieren (z.B. https://equiptrack.example.com)"
echo ""
echo "  2. Auf dem Entwicklungs-PC (wo Node.js ist):"
echo ""
echo "     cd frontend"
echo "     echo 'EXPO_PUBLIC_BACKEND_URL=https://equiptrack.example.com' > .env"
echo "     npx expo export --platform web"
echo "     scp -r dist/* pi@${PI_IP}:${WEB_ROOT}/"
echo ""
echo "  3. App ist dann erreichbar unter:"
echo "     https://equiptrack.example.com"
echo ""
echo "  4. APK für Android-Handy bauen (selber PC):"
echo "     cd frontend && npx eas build --platform android --profile preview"
echo "     ODER lokal: npx expo run:android"
echo ""
echo "════════════════════════════════════════════════════════"
