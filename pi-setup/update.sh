#!/usr/bin/env bash
# Inventar Pro — Update-Skript
# Aufruf: ./update.sh
set -euo pipefail

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${INSTALL_DIR}/Final-main/backend"
FRONTEND_DIR="${INSTALL_DIR}/Final-main/frontend"

echo "==> Git Pull..."
cd "${INSTALL_DIR}/Final-main"
git pull

echo "==> Python-Pakete aktualisieren..."
cd "${BACKEND_DIR}"
source .venv/bin/activate
pip install --quiet -r requirements.txt
deactivate

echo "==> npm-Pakete aktualisieren..."
cd "${FRONTEND_DIR}"
npm install --silent

echo "==> Services neu starten..."
sudo systemctl restart inventar-backend inventar-frontend

echo ""
echo "Update abgeschlossen!"
sudo systemctl status inventar-backend --no-pager -l | tail -5
sudo systemctl status inventar-frontend --no-pager -l | tail -5
