#!/bin/bash
# setup-cloudflare-tunnel.sh
# Run this script ON THE RASPBERRY PI, not on the PC.
# Prerequisites: Cloudflare account (free at cloudflare.com)
#
# Usage: chmod +x setup-cloudflare-tunnel.sh && ./setup-cloudflare-tunnel.sh

set -e

echo "=== Inventar Pro — Cloudflare Tunnel Setup ==="
echo ""

# 1. Install cloudflared
echo "[1/4] cloudflared installieren..."
if ! command -v cloudflared &> /dev/null; then
    ARCH=$(uname -m)
    if [ "$ARCH" = "aarch64" ]; then
        DL_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"
    elif [ "$ARCH" = "armv7l" ]; then
        DL_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm"
    else
        DL_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
    fi
    curl -L "$DL_URL" -o /usr/local/bin/cloudflared
    chmod +x /usr/local/bin/cloudflared
    echo "    Installiert: $(cloudflared --version)"
else
    echo "    Bereits installiert: $(cloudflared --version)"
fi

# 2. Login
echo ""
echo "[2/4] Cloudflare Login..."
echo "    Ein Browser-Fenster öffnet sich. URL aus Terminal kopieren falls kein Browser."
cloudflared tunnel login

# 3. Create tunnel
TUNNEL_NAME="inventarpro"
echo ""
echo "[3/4] Tunnel erstellen..."
if cloudflared tunnel list 2>/dev/null | grep -q "$TUNNEL_NAME"; then
    echo "    Tunnel '$TUNNEL_NAME' existiert bereits."
else
    cloudflared tunnel create "$TUNNEL_NAME"
fi
TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
echo "    Tunnel-ID: $TUNNEL_ID"

# 4. Config file
CONFIG_DIR="$HOME/.cloudflared"
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_DIR/config.yml" << EOF
tunnel: $TUNNEL_ID
credentials-file: $CONFIG_DIR/$TUNNEL_ID.json

ingress:
  - service: http://localhost:8002
EOF
echo ""
echo "[4/4] Konfiguration gespeichert: $CONFIG_DIR/config.yml"

# 5. Install as systemd service
cloudflared service install 2>/dev/null || echo "    (systemd service installation requires root — run with sudo)"

echo ""
echo "=== Setup abgeschlossen ==="
echo ""
echo "Starte den Tunnel:"
echo "  sudo systemctl start cloudflared"
echo "  sudo systemctl enable cloudflared"
echo ""
echo "Deine öffentliche URL:"
echo "  cloudflared tunnel info $TUNNEL_NAME"
echo ""
echo "Diese URL in der App unter Einstellungen → Server-URL eintragen!"
