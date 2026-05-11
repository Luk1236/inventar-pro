#!/bin/bash
# setup-cloud-backup.sh — Automatisches Cloud-Backup via rclone (Google Drive / S3)
# Läuft auf dem Raspberry Pi.
# Voraussetzung: rclone installieren (wird vom Script erledigt)
#
# Verwendung: chmod +x setup-cloud-backup.sh && ./setup-cloud-backup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backend/backups"
RCLONE_REMOTE="inventarpro-backup"  # Name für das rclone-Remote

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
BOLD='\033[1m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

echo ""
echo -e "${BOLD}=== Inventar Pro — Cloud-Backup Setup ===${NC}"
echo ""

# ── 1. rclone installieren ────────────────────────────────────────────────────
echo "[1/4] rclone installieren..."
if ! command -v rclone &>/dev/null; then
    curl -sSL https://rclone.org/install.sh | bash
    info "rclone installiert: $(rclone --version | head -1)"
else
    info "rclone bereits vorhanden: $(rclone --version | head -1)"
fi

# ── 2. Remote konfigurieren ───────────────────────────────────────────────────
echo ""
echo "[2/4] Cloud-Speicher konfigurieren..."
echo ""
echo "Verfügbare Optionen:"
echo "  1) Google Drive (empfohlen, 15 GB kostenlos)"
echo "  2) Amazon S3"
echo "  3) Andere (Dropbox, OneDrive, ...)"
echo ""
echo "rclone config wird jetzt gestartet. Folge den Anweisungen."
echo "Remote-Name eingeben: ${RCLONE_REMOTE}"
echo ""
read -p "Weiter mit rclone config? [J/n]: " CONFIRM
CONFIRM="${CONFIRM:-J}"
if [[ "$CONFIRM" =~ ^[Jj] ]]; then
    rclone config
fi

# ── 3. Backup-Script erstellen ────────────────────────────────────────────────
echo ""
echo "[3/4] Backup-Script erstellen..."

BACKUP_SCRIPT="/usr/local/bin/inventarpro-cloud-backup.sh"
cat > "$BACKUP_SCRIPT" << BEOF
#!/bin/bash
# Inventar Pro Cloud Backup
set -e

TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_DIR"
REMOTE="$RCLONE_REMOTE:inventarpro-backups"

# MongoDB dump
DUMP_DIR="/tmp/inventarpro-dump-\$TIMESTAMP"
mkdir -p "\$DUMP_DIR"
mongodump --out "\$DUMP_DIR" --quiet 2>/dev/null || true

# Komprimieren
tar -czf "\$BACKUP_DIR/backup-\$TIMESTAMP.tar.gz" -C "\$DUMP_DIR" . 2>/dev/null || true
rm -rf "\$DUMP_DIR"

# Upload zu Cloud
rclone copy "\$BACKUP_DIR/backup-\$TIMESTAMP.tar.gz" "\$REMOTE/" --quiet

# Alte Backups bereinigen (behalte letzten 30 Tage)
find "\$BACKUP_DIR" -name "backup-*.tar.gz" -mtime +30 -delete 2>/dev/null || true

echo "Backup abgeschlossen: backup-\$TIMESTAMP.tar.gz"
BEOF
chmod +x "$BACKUP_SCRIPT"
info "Backup-Script erstellt: $BACKUP_SCRIPT"

# ── 4. Cron-Job einrichten ────────────────────────────────────────────────────
echo ""
echo "[4/4] Cron-Job einrichten (täglich 02:00 Uhr)..."
CRON_LINE="0 2 * * * $BACKUP_SCRIPT >> /var/log/inventarpro-backup.log 2>&1"

# Cron-Job hinzufügen wenn noch nicht vorhanden
(crontab -l 2>/dev/null | grep -qF "$BACKUP_SCRIPT") && {
    info "Cron-Job bereits vorhanden."
} || {
    (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
    info "Cron-Job hinzugefügt: täglich 02:00 Uhr"
}

# ── Abschluss ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║  Cloud-Backup Setup abgeschlossen                            ║${NC}"
echo -e "${BOLD}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}║  Backup-Zeitplan: täglich 02:00 Uhr                          ║${NC}"
echo -e "${BOLD}║  Ziel: $RCLONE_REMOTE:inventarpro-backups                     "
echo -e "${BOLD}║  Aufbewahrung: 30 Tage                                       ║${NC}"
echo -e "${BOLD}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}║  Manuelles Backup starten:                                   ║${NC}"
echo -e "${BOLD}║    sudo $BACKUP_SCRIPT                                       "
echo -e "${BOLD}║  Cloud-Inhalt prüfen:                                        ║${NC}"
echo -e "${BOLD}║    rclone ls $RCLONE_REMOTE:inventarpro-backups               "
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
