#!/bin/bash
# quick-tunnel.sh — Sofortiger externer Zugang ohne Domain oder Cloudflare-Account
# Läuft auf dem Raspberry Pi. Gibt eine sofort nutzbare HTTPS-URL aus.
# URL ändert sich bei jedem Neustart (für permanente URL → setup-cloudflare-tunnel.sh).
#
# Verwendung: chmod +x quick-tunnel.sh && ./quick-tunnel.sh

set -e

BACKEND_ENV="$(dirname "$0")/backend/.env"
LOG_FILE="/tmp/cloudflared-quick.log"

echo "=== Inventar Pro — Quick Tunnel ==="
echo ""

# 1. cloudflared installieren wenn nötig
if ! command -v cloudflared &>/dev/null; then
    echo "[1/2] cloudflared installieren..."
    ARCH=$(uname -m)
    if [ "$ARCH" = "aarch64" ]; then
        DL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"
    elif [ "$ARCH" = "armv7l" ]; then
        DL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm"
    else
        DL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
    fi
    curl -sSL "$DL" -o /usr/local/bin/cloudflared
    chmod +x /usr/local/bin/cloudflared
    echo "    OK: $(cloudflared --version)"
else
    echo "[1/2] cloudflared vorhanden: $(cloudflared --version)"
fi

echo ""
echo "[2/2] Tunnel starten (kein Login nötig)..."
echo "      Warte auf öffentliche URL..."

# Starte Quick Tunnel im Hintergrund und fange URL ab
rm -f "$LOG_FILE"
cloudflared tunnel --url http://localhost:8002 --no-autoupdate 2>&1 | tee "$LOG_FILE" &
CF_PID=$!

# Warte bis URL erscheint (max 30s)
PUBLIC_URL=""
for i in $(seq 1 60); do
    sleep 0.5
    PUBLIC_URL=$(grep -oP 'https://[a-z0-9\-]+\.trycloudflare\.com' "$LOG_FILE" 2>/dev/null | head -1 || true)
    if [ -n "$PUBLIC_URL" ]; then
        break
    fi
done

if [ -z "$PUBLIC_URL" ]; then
    echo "Fehler: Konnte URL nicht ermitteln. Ausgabe:"
    cat "$LOG_FILE"
    kill $CF_PID 2>/dev/null || true
    exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Öffentliche URL:                                            ║"
echo "║  $PUBLIC_URL"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# CORS in backend/.env automatisch eintragen
if [ -f "$BACKEND_ENV" ]; then
    # Prüfen ob URL schon drin ist
    if grep -q "$PUBLIC_URL" "$BACKEND_ENV"; then
        echo "CORS: URL bereits eingetragen."
    else
        # URL zu ALLOWED_ORIGINS hinzufügen
        sed -i "s|^ALLOWED_ORIGINS=\(.*\)|ALLOWED_ORIGINS=\1,$PUBLIC_URL|" "$BACKEND_ENV"
        echo "CORS: URL zu backend/.env hinzugefügt."

        # Backend-Service neu starten
        if systemctl is-active --quiet inventarpro-backend 2>/dev/null; then
            systemctl restart inventarpro-backend
            echo "Backend-Service neu gestartet."
        elif systemctl is-active --quiet inventar-backend 2>/dev/null; then
            systemctl restart inventar-backend
            echo "Backend-Service neu gestartet."
        else
            echo "Hinweis: Backend manuell neu starten für CORS-Änderung."
        fi
    fi
else
    echo "Hinweis: backend/.env nicht gefunden — CORS manuell eintragen."
fi

echo ""
echo "In der App: Einstellungen → Server-URL → $PUBLIC_URL"
echo ""
echo "Tunnel läuft (PID $CF_PID). Zum Beenden: kill $CF_PID"
echo "Oder: Strg+C"
echo ""

# Warte bis Tunnel beendet wird
wait $CF_PID
