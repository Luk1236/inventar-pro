#!/bin/bash
# setup-cloudflare-tunnel.sh — Permanenter Cloudflare Tunnel (Raspberry Pi)
# Voraussetzung: Cloudflare-Account (kostenlos auf cloudflare.com)
# Für sofortigen Test ohne Account → quick-tunnel.sh verwenden
#
# Verwendung: chmod +x setup-cloudflare-tunnel.sh && sudo ./setup-cloudflare-tunnel.sh

set -e

BACKEND_ENV="$(dirname "$0")/backend/.env"
TUNNEL_NAME="inventarpro"
CONFIG_DIR="$HOME/.cloudflared"

echo "=== Inventar Pro — Cloudflare Tunnel Setup (Permanent) ==="
echo ""

# ──────────────────────────────────────────────────────────────────
# 1. cloudflared installieren
# ──────────────────────────────────────────────────────────────────
echo "[1/5] cloudflared installieren..."
if ! command -v cloudflared &>/dev/null; then
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
    echo "    Installiert: $(cloudflared --version)"
else
    echo "    Bereits installiert: $(cloudflared --version)"
fi

# ──────────────────────────────────────────────────────────────────
# 2. Cloudflare Login
# ──────────────────────────────────────────────────────────────────
echo ""
echo "[2/5] Cloudflare Login..."
echo "    Browser öffnet sich automatisch. Ohne Browser: URL aus Terminal kopieren."
cloudflared tunnel login

# ──────────────────────────────────────────────────────────────────
# 3. Tunnel erstellen
# ──────────────────────────────────────────────────────────────────
echo ""
echo "[3/5] Tunnel erstellen..."
if cloudflared tunnel list 2>/dev/null | grep -q "$TUNNEL_NAME"; then
    echo "    Tunnel '$TUNNEL_NAME' existiert bereits."
else
    cloudflared tunnel create "$TUNNEL_NAME"
fi

TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "$TUNNEL_NAME" | awk '{print $1}')
if [ -z "$TUNNEL_ID" ]; then
    echo "Fehler: Tunnel-ID konnte nicht ermittelt werden."
    exit 1
fi
echo "    Tunnel-ID: $TUNNEL_ID"

# Öffentliche URL bestimmen
# Named Tunnels ohne eigene Domain nutzen: <id>.cfargotunnel.com
PUBLIC_URL="https://${TUNNEL_ID}.cfargotunnel.com"
echo "    Öffentliche URL: $PUBLIC_URL"

# ──────────────────────────────────────────────────────────────────
# 4. Konfigurationsdatei schreiben
# ──────────────────────────────────────────────────────────────────
echo ""
echo "[4/5] Konfiguration schreiben..."
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_DIR/config.yml" << EOF
tunnel: $TUNNEL_ID
credentials-file: $CONFIG_DIR/$TUNNEL_ID.json

ingress:
  - hostname: ${TUNNEL_ID}.cfargotunnel.com
    service: http://localhost:8002
  - service: http_status:404
EOF
echo "    Gespeichert: $CONFIG_DIR/config.yml"

# DNS-Route für cfargotunnel.com setzen
cloudflared tunnel route dns "$TUNNEL_NAME" "${TUNNEL_ID}.cfargotunnel.com" 2>/dev/null \
    && echo "    DNS-Route gesetzt." \
    || echo "    Hinweis: DNS-Route konnte nicht gesetzt werden (ggf. eigene Domain nötig)."

# ──────────────────────────────────────────────────────────────────
# 5. CORS in backend/.env eintragen & Service-Setup
# ──────────────────────────────────────────────────────────────────
echo ""
echo "[5/5] CORS und Systemd..."

if [ -f "$BACKEND_ENV" ]; then
    if grep -q "$PUBLIC_URL" "$BACKEND_ENV"; then
        echo "    CORS: URL bereits eingetragen."
    else
        sed -i "s|^ALLOWED_ORIGINS=\(.*\)|ALLOWED_ORIGINS=\1,$PUBLIC_URL|" "$BACKEND_ENV"
        echo "    CORS: $PUBLIC_URL zu ALLOWED_ORIGINS hinzugefügt."
    fi
else
    echo "    Hinweis: backend/.env nicht gefunden — CORS manuell eintragen."
fi

# Systemd-Service installieren
cloudflared service install 2>/dev/null \
    && echo "    Systemd-Service installiert." \
    || echo "    Hinweis: sudo erforderlich für Service-Installation."

# Backend neu starten
for SVC in inventarpro-backend inventar-backend inventarpro; do
    if systemctl is-active --quiet "$SVC" 2>/dev/null; then
        systemctl restart "$SVC"
        echo "    Backend-Service '$SVC' neu gestartet."
        break
    fi
done

# ──────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Setup abgeschlossen                                         ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Öffentliche URL:                                            ║"
echo "║  $PUBLIC_URL"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Tunnel starten:                                             ║"
echo "║    sudo systemctl start cloudflared                          ║"
echo "║    sudo systemctl enable cloudflared                         ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  In der App:                                                 ║"
echo "║    Einstellungen → Server-URL → obige URL eintragen          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
