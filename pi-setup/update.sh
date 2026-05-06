#!/usr/bin/env bash
# Inventar Pro — Update-Skript
# Aufruf: ./update.sh
# Mit Token (einmalig): GH_TOKEN=ghp_xxx ./update.sh
set -euo pipefail

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✓${NC} $1"; }
info() { echo -e "${CYAN}  ▸${NC} $1"; }

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${INSTALL_DIR}/backend"
FRONTEND_DIR="${INSTALL_DIR}/frontend"
GIT_DIR="${INSTALL_DIR}"

echo -e "\n${CYAN}━━ Inventar Pro — Update von GitHub${NC}"

# ── Git Pull ──────────────────────────────────────────────────
info "git pull ..."
cd "${GIT_DIR}"

# Optionales Token (privates Repo): als Env-Variable oder interaktiv
if [[ -n "${GH_TOKEN:-}" ]]; then
  ORIGIN=$(git remote get-url origin)
  ORIGIN_WITH_TOKEN="${ORIGIN/https:\/\//https://${GH_TOKEN}@}"
  git pull "${ORIGIN_WITH_TOKEN}" HEAD
  git remote set-url origin "${ORIGIN}"   # Token nicht in .git/config speichern
else
  git pull
fi
ok "Code aktuell"

# ── Python-Pakete ─────────────────────────────────────────────
info "pip install -r requirements.txt ..."
cd "${BACKEND_DIR}"
source .venv/bin/activate
pip install --quiet --prefer-binary -r requirements.txt
deactivate
ok "Python-Pakete aktuell"

# ── npm-Pakete ────────────────────────────────────────────────
info "npm install ..."
cd "${FRONTEND_DIR}"
npm install --silent
ok "npm-Pakete aktuell"

# ── Services neu starten ──────────────────────────────────────
info "Services neu starten ..."
sudo systemctl restart inventar-backend inventar-frontend
ok "Services gestartet"

echo ""
sudo systemctl status inventar-backend --no-pager -l | tail -3
sudo systemctl status inventar-frontend --no-pager -l | tail -3
echo -e "\n${GREEN}  ✓ Update abgeschlossen!${NC}"
