#!/usr/bin/env bash
set -euo pipefail

INSTALL="${HOME}/inventar"

echo "=== Inventar Pro Post-Update Setup ==="
echo

# 1. Sudoers für Dashboard
echo "[1/8] Sudoers konfigurieren..."
if [[ ! -f /etc/sudoers.d/inventar ]]; then
    echo 'admin ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /sbin/shutdown, /usr/bin/mongodump, /usr/bin/apt-get' | sudo tee /etc/sudoers.d/inventar > /dev/null
    sudo chmod 440 /etc/sudoers.d/inventar
    echo "  ✓ Sudoers eingerichtet"
else
    echo "  ✓ Bereits vorhanden"
fi

# 2. Dashboard-Passwort initialisieren (falls nicht gesetzt)
echo "[2/8] Dashboard-Passwort..."
if [[ ! -f ~/.dashboard_password ]]; then
    read -srp "  Neues Dashboard-Passwort eingeben: " DASH_PW
    echo
    if [[ ${#DASH_PW} -lt 4 ]]; then
        echo "  ✗ Passwort zu kurz (min. 4 Zeichen)"
        exit 1
    fi
    python3 -c "from passlib.context import CryptContext; import sys; print(CryptContext(schemes=['bcrypt']).hash(sys.argv[1]))" "$DASH_PW" > ~/.dashboard_password
    chmod 600 ~/.dashboard_password
    echo "  ✓ Passwort gesetzt"
else
    echo "  ✓ Bereits gesetzt"
fi

# 3. websockets Paket
echo "[3/8] Python-Dependencies..."
if [[ -f "$INSTALL/backend/.venv/bin/activate" ]]; then
    source "$INSTALL/backend/.venv/bin/activate"
    pip install --quiet websockets passlib bcrypt pyotp
    echo "  ✓ websockets, passlib, bcrypt, pyotp installiert"
else
    echo "  ⚠ venv nicht gefunden unter $INSTALL/backend/.venv"
fi

# 4. Erster Git-Tag (für Rollback-System)
echo "[4/8] Git-Tag..."
cd "$INSTALL"
VERSION=$(cat VERSION | tr -d '[:space:]')
TAG="v$VERSION"
if ! git rev-parse "$TAG" >/dev/null 2>&1; then
    git tag "$TAG"
    echo "  ✓ Tag $TAG erstellt"
else
    echo "  ✓ Tag $TAG existiert bereits"
fi

# 5. Frontend-Build (falls dist/ fehlt)
echo "[5/8] Frontend-Build prüfen..."
if [[ ! -d "$INSTALL/frontend/dist" ]]; then
    cd "$INSTALL/frontend"
    echo "  → npm install läuft..."
    npm install --silent
    echo "  → expo export läuft..."
    npx expo export --platform web
    echo "  ✓ Frontend gebaut"
else
    echo "  ✓ Build vorhanden ($(du -sh "$INSTALL/frontend/dist" | cut -f1))"
fi

# 6. systemd Service-Files installieren
echo "[6/8] systemd Service-Files installieren..."
SETUP_DIR="$INSTALL/pi-setup"
for unit in inventar-backend.service inventar-dashboard.service inventar-backup.service inventar-backup.timer inventar-weekly-reboot.service inventar-weekly-reboot.timer; do
    if [[ -f "$SETUP_DIR/$unit" ]]; then
        sudo cp "$SETUP_DIR/$unit" "/etc/systemd/system/$unit"
    fi
done
echo "  ✓ Service-Files kopiert"

# 7. systemd reload + restart
echo "[7/8] Services neustarten..."
sudo systemctl daemon-reload
sudo systemctl restart inventar-backend inventar-dashboard
sudo systemctl stop inventar-frontend 2>/dev/null || true
sudo systemctl disable inventar-frontend 2>/dev/null || true
echo "  ✓ Services gestartet"

# 8. Backup-Timer und Auto-Reboot-Timer aktivieren
echo "[8/8] Timer aktivieren..."
chmod +x "$SETUP_DIR/auto-backup.sh" "$SETUP_DIR/restore-backup.sh" "$SETUP_DIR/test-backup-restore.sh" "$SETUP_DIR/cleanup.sh" "$SETUP_DIR/enable-tailscale-funnel.sh" 2>/dev/null || true
sudo systemctl enable --now inventar-backup.timer 2>/dev/null && echo "  ✓ Backup-Timer aktiv (täglich 03:00)" || echo "  ⚠ Backup-Timer nicht installiert"
sudo systemctl enable --now inventar-weekly-reboot.timer 2>/dev/null && echo "  ✓ Reboot-Timer aktiv (Sonntag 04:00)" || echo "  ⚠ Reboot-Timer nicht installiert"

echo
echo "=== Setup abgeschlossen ==="
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo "Dashboard: http://${LOCAL_IP}:8080"
echo "App:       http://${LOCAL_IP}:8002"
echo
echo "Status-Check:"
systemctl is-active inventar-backend && echo "  ✓ Backend läuft" || echo "  ✗ Backend nicht aktiv"
systemctl is-active inventar-dashboard && echo "  ✓ Dashboard läuft" || echo "  ✗ Dashboard nicht aktiv"
systemctl is-active mongod && echo "  ✓ MongoDB läuft" || echo "  ✗ MongoDB nicht aktiv"
