#!/usr/bin/env bash
# Inventar Pro — MongoDB Backup
# Aufruf: ./backup.sh
# Cron (taeglich 3 Uhr): 0 3 * * * /home/pi/inventar/pi-setup/backup.sh
set -euo pipefail

BACKUP_ROOT="${HOME}/inventar-backup"
DATE=$(date +%Y%m%d_%H%M%S)
DEST="${BACKUP_ROOT}/${DATE}"

# DB-Name aus .env lesen (Fallback: inventar)
ENV_FILE="${HOME}/inventar/backend/.env"
DB_NAME="inventar"
if [[ -f "$ENV_FILE" ]]; then
  _db=$(grep -E '^DB_NAME=' "$ENV_FILE" | cut -d= -f2 | tr -d '[:space:]')
  [[ -n "$_db" ]] && DB_NAME="$_db"
fi

mkdir -p "${DEST}"
mongodump --db "${DB_NAME}" --out "${DEST}" --quiet

# Komprimieren
tar -czf "${DEST}.tar.gz" -C "${BACKUP_ROOT}" "${DATE}"
rm -rf "${DEST}"

echo "Backup gespeichert: ${DEST}.tar.gz"

# Alte Backups loeschen (behalte letzte 14)
ls -t "${BACKUP_ROOT}"/*.tar.gz 2>/dev/null | tail -n +15 | xargs rm -f --
echo "Verbleibende Backups: $(ls "${BACKUP_ROOT}"/*.tar.gz 2>/dev/null | wc -l)"
