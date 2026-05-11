#!/usr/bin/env bash
# Räumt Pi auf: alte Logs, npm-Cache, pip-Cache, alte Backups, alte Git-Tags
set -euo pipefail

INSTALL="${HOME}/inventar"

echo "=== Cleanup ==="

# 1. Disk-Usage VORHER
DISK_BEFORE=$(df -h / | awk 'NR==2{print $4}')
echo "Freier Speicher vorher: $DISK_BEFORE"

# 2. apt cache
echo "[1/6] apt cache..."
sudo apt-get clean
sudo apt-get autoremove -y --purge

# 3. Journal-Logs auf 100MB begrenzen
echo "[2/6] systemd journal..."
sudo journalctl --vacuum-size=100M

# 4. npm + node_modules Cache
echo "[3/6] npm Cache..."
if [[ -d "$INSTALL/frontend" ]]; then
    cd "$INSTALL/frontend"
    npm cache clean --force 2>/dev/null || true
fi

# 5. pip Cache
echo "[4/6] pip Cache..."
if [[ -f "$INSTALL/backend/.venv/bin/activate" ]]; then
    source "$INSTALL/backend/.venv/bin/activate"
    pip cache purge 2>/dev/null || true
fi

# 6. Alte Backups (>30 Tage)
echo "[5/6] Alte Backups..."
DELETED=$(find ~/inventar-backup -type f \( -name "*.tar.gz" -o -name "*.tar.gz.gpg" \) -mtime +30 -print -delete 2>/dev/null | wc -l)
echo "  ${DELETED} alte Backups gelöscht"

# 7. Alte Git-Tags (mehr als 10)
echo "[6/6] Alte Git-Tags..."
cd "$INSTALL"
git tag -l 'v*' --sort=-version:refname | tail -n +11 | xargs -r git tag -d || true

# 8. Disk-Usage NACHHER
DISK_AFTER=$(df -h / | awk 'NR==2{print $4}')
echo
echo "=== Fertig ==="
echo "Vorher:  $DISK_BEFORE frei"
echo "Nachher: $DISK_AFTER frei"
