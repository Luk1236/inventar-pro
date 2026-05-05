#!/bin/bash
# =============================================================
#  Inventar Pro — Tailscale Setup Script
#  Auf dem Raspberry Pi ausführen: bash tailscale-setup.sh
# =============================================================
set -e

LAGER_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$LAGER_DIR/Final-main/backend"
FRONTEND_DIR="$LAGER_DIR/Final-main/frontend"
ENV_FILE="$BACKEND_DIR/.env"
PI_USER="${SUDO_USER:-$(whoami)}"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Inventar Pro — Tailscale Setup             ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── Schritt 1: Tailscale installieren ────────────────────────
if ! command -v tailscale &>/dev/null; then
    echo "▶ Tailscale wird installiert..."
    curl -fsSL https://tailscale.com/install.sh | sh
else
    echo "✔ Tailscale bereits installiert."
fi

# ── Schritt 2: Tailscale verbinden ───────────────────────────
TS_STATUS=$(tailscale status 2>/dev/null || echo "")
if echo "$TS_STATUS" | grep -q "not running\|Logged out\|not logged in"; then
    echo ""
    echo "▶ Tailscale wird verbunden. Browser öffnet sich zur Anmeldung..."
    sudo tailscale up --accept-routes
elif [ -z "$TS_STATUS" ]; then
    echo "▶ Tailscale wird gestartet..."
    sudo systemctl start tailscaled
    sudo tailscale up --accept-routes
else
    echo "✔ Tailscale bereits verbunden."
fi

# ── Schritt 3: Tailscale-IP und Hostname ermitteln ───────────
sleep 2
TS_IP=$(tailscale ip -4 2>/dev/null || echo "")
TS_HOST=$(tailscale status 2>/dev/null | grep "^$(hostname)" | awk '{print $2}' || echo "")

if [ -z "$TS_IP" ]; then
    echo "FEHLER: Tailscale-IP konnte nicht ermittelt werden. Bitte manuell verbinden."
    exit 1
fi

# MagicDNS-Hostname ermitteln
TS_FQDN=$(tailscale status --json 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
self = d.get('Self', {})
dns = self.get('DNSName', '').rstrip('.')
print(dns)
" 2>/dev/null || echo "")

echo ""
echo "  Tailscale IP:   $TS_IP"
echo "  Tailscale Host: ${TS_FQDN:-nicht verfügbar}"
echo ""

# ── Schritt 4: tailscale serve einrichten ────────────────────
echo "▶ tailscale serve wird konfiguriert (HTTPS-Proxy)..."
sudo tailscale serve reset 2>/dev/null || true
sudo tailscale serve --bg https / http://localhost:8081
sudo tailscale serve --bg https /api/ http://localhost:8002
sudo tailscale serve --bg https /ws http://localhost:8002
sudo tailscale serve --bg https /docs http://localhost:8002
echo "✔ tailscale serve aktiv."
sudo tailscale serve status

# ── Schritt 5: ALLOWED_ORIGINS in .env aktualisieren ─────────
echo ""
echo "▶ backend/.env wird aktualisiert..."

ORIGINS_TO_ADD=""
ORIGINS_TO_ADD="$ORIGINS_TO_ADD,http://$TS_IP:8081"
ORIGINS_TO_ADD="$ORIGINS_TO_ADD,http://$TS_IP:8002"
if [ -n "$TS_FQDN" ]; then
    ORIGINS_TO_ADD="$ORIGINS_TO_ADD,https://$TS_FQDN"
fi

# Bestehende Tailscale-Einträge entfernen und neue anfügen
python3 - <<PYEOF
import re

env_file = "$ENV_FILE"
with open(env_file) as f:
    content = f.read()

# Tailscale-Einträge aus vorherigem Run entfernen
content = re.sub(r',http://100\.\d+\.\d+\.\d+:\d+', '', content)
content = re.sub(r',https://[^,\n]+\.ts\.net', '', content)

# Neue Einträge anfügen
new_origins = "$ORIGINS_TO_ADD"
content = re.sub(
    r'(ALLOWED_ORIGINS=[^\n]+)',
    lambda m: m.group(1) + new_origins,
    content
)

with open(env_file, 'w') as f:
    f.write(content)

print("  .env aktualisiert.")
PYEOF

# ── Schritt 6: systemd-Services einrichten ────────────────────
echo ""
echo "▶ systemd-Services werden eingerichtet..."

# Backend
cat > /tmp/inventar-backend.service <<EOF
[Unit]
Description=Inventar Pro Backend (FastAPI)
After=network.target mongod.service
Wants=mongod.service

[Service]
WorkingDirectory=$BACKEND_DIR
ExecStart=/usr/bin/python3 server.py
Restart=always
RestartSec=5
User=$PI_USER
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Frontend
cat > /tmp/inventar-frontend.service <<EOF
[Unit]
Description=Inventar Pro Frontend (Expo Web)
After=network.target

[Service]
WorkingDirectory=$FRONTEND_DIR
ExecStart=/usr/bin/npm start -- --web
Restart=always
RestartSec=10
User=$PI_USER
Environment=EXPO_PUBLIC_BACKEND_URL=
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo cp /tmp/inventar-backend.service  /etc/systemd/system/
sudo cp /tmp/inventar-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable inventar-backend inventar-frontend

# Services starten falls noch nicht laufend
sudo systemctl start inventar-backend  || true
sudo systemctl start inventar-frontend || true

echo "✔ Services eingerichtet und gestartet."

# ── Fertig ────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Setup abgeschlossen!                                ║"
echo "╠══════════════════════════════════════════════════════╣"
printf  "║  Tailscale IP:  %-36s║\n" "$TS_IP"
if [ -n "$TS_FQDN" ]; then
printf  "║  HTTPS URL:     %-36s║\n" "https://$TS_FQDN"
fi
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Nächste Schritte:                                   ║"
echo "║  1. Tailscale-App auf Handy/Laptop installieren      ║"
echo "║  2. Mit gleichem Account anmelden                    ║"
if [ -n "$TS_FQDN" ]; then
echo "║  3. Im Browser öffnen:                               ║"
printf  "║     https://%-40s║\n" "$TS_FQDN"
else
echo "║  3. Im Browser:  http://$TS_IP:8081           ║"
fi
echo "║  4. In App-Einstellungen → Server-URL setzen:        ║"
if [ -n "$TS_FQDN" ]; then
printf  "║     https://%-40s║\n" "$TS_FQDN"
else
printf  "║     http://%-41s║\n" "$TS_IP:8002"
fi
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Service-Status prüfen:"
echo "  sudo systemctl status inventar-backend"
echo "  sudo systemctl status inventar-frontend"
echo "  sudo journalctl -u inventar-backend -f"
echo ""
