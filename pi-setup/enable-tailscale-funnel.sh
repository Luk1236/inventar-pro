#!/usr/bin/env bash
# Aktiviert Tailscale Funnel (HTTPS aus dem Internet) für Inventar Pro
#
# Voraussetzungen:
#   - Tailscale installiert und angemeldet (tailscale up)
#   - HTTPS-Cert vorhanden (tailscale cert <hostname>.<tailnet>.ts.net)
#   - Funnel im Tailscale Admin aktiviert: https://login.tailscale.com/admin/dns
#
# Ergebnis:
#   - App über https://<hostname>.<tailnet>.ts.net erreichbar
#   - Dashboard nicht öffentlich (nur via Tailscale-Netz)

set -euo pipefail

echo "=== Tailscale Funnel Setup ==="

# Status prüfen
if ! command -v tailscale >/dev/null 2>&1; then
    echo "✗ Tailscale ist nicht installiert."
    echo "  Installation: curl -fsSL https://tailscale.com/install.sh | sh"
    exit 1
fi

if ! sudo tailscale status >/dev/null 2>&1; then
    echo "✗ Tailscale läuft nicht. Starte mit: sudo tailscale up"
    exit 1
fi

HOSTNAME=$(sudo tailscale status --json | python3 -c "import sys,json;print(json.load(sys.stdin)['Self']['DNSName'].rstrip('.'))")
echo "Hostname: $HOSTNAME"

# 1. HTTPS-Cert holen (idempotent)
echo "[1/3] HTTPS-Zertifikat prüfen/anfordern..."
if [[ ! -f "/var/lib/tailscale/certs/${HOSTNAME}.crt" ]]; then
    sudo tailscale cert "$HOSTNAME" || {
        echo "✗ Cert-Anforderung fehlgeschlagen."
        echo "  Aktiviere MagicDNS + HTTPS im Tailscale-Admin:"
        echo "  https://login.tailscale.com/admin/dns"
        exit 1
    }
fi
echo "  ✓ Cert vorhanden"

# 2. Tailscale Serve auf das Backend umleiten (Port 8002)
echo "[2/3] Funnel-Routing konfigurieren..."
sudo tailscale serve reset 2>/dev/null || true
sudo tailscale serve --bg --https=443 http://127.0.0.1:8002
echo "  ✓ App auf Port 8002 (Backend) gemappt"

# 3. Funnel öffentlich aktivieren
echo "[3/3] Funnel aktivieren..."
sudo tailscale funnel --bg 443
echo "  ✓ Funnel aktiv"

echo
echo "=== Fertig ==="
echo "App öffentlich erreichbar unter:"
echo "  https://${HOSTNAME}/"
echo
echo "Dashboard (nur intern via Tailscale, nicht öffentlich):"
echo "  http://${HOSTNAME}:8080/  (innerhalb Tailscale)"
echo
echo "Status anzeigen:  sudo tailscale serve status"
echo "Funnel deaktivieren:  sudo tailscale funnel --https=443 off"
