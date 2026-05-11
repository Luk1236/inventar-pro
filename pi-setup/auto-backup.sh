#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${HOME}/inventar-backup"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TARGET="${BACKUP_DIR}/${TIMESTAMP}"

# Optional: Verschlüsselungs-Passphrase (env: BACKUP_GPG_PASSPHRASE)
ENCRYPT="${BACKUP_GPG_PASSPHRASE:-}"

# Optional: Cloud-Upload via rclone (env: BACKUP_RCLONE_REMOTE wie "dropbox:Backups/Pi")
RCLONE_REMOTE="${BACKUP_RCLONE_REMOTE:-}"

mkdir -p "$BACKUP_DIR"

echo "=== Auto-Backup ${TIMESTAMP} ==="

# 1. MongoDB dump
echo "[1/4] MongoDB-Dump..."
mongodump --quiet --out "$TARGET" || { echo "FEHLER: mongodump fehlgeschlagen"; exit 1; }

# 2. Komprimieren
echo "[2/4] Komprimieren..."
tar -czf "${TARGET}.tar.gz" -C "$BACKUP_DIR" "$TIMESTAMP"
rm -rf "$TARGET"
FINAL_FILE="${TARGET}.tar.gz"

# 2b. Optional: Verschlüsseln
if [[ -n "$ENCRYPT" ]]; then
    echo "      Verschlüssele mit GPG..."
    gpg --batch --yes --quiet --passphrase "$ENCRYPT" --symmetric --cipher-algo AES256 "$FINAL_FILE"
    rm "$FINAL_FILE"
    FINAL_FILE="${FINAL_FILE}.gpg"
fi
SIZE=$(du -h "$FINAL_FILE" | cut -f1)
echo "  Backup: ${FINAL_FILE} (${SIZE})"

# 3. Cloud-Upload (optional)
echo "[3/4] Cloud-Upload..."
if [[ -n "$RCLONE_REMOTE" ]] && command -v rclone >/dev/null 2>&1; then
    rclone copy "$FINAL_FILE" "$RCLONE_REMOTE" --quiet && echo "  ✓ hochgeladen nach $RCLONE_REMOTE" || echo "  ✗ Upload fehlgeschlagen"
else
    echo "  ⊘ deaktiviert (BACKUP_RCLONE_REMOTE nicht gesetzt oder rclone nicht installiert)"
fi

# 4. Alte Backups löschen
echo "[4/4] Aufräumen (>${RETENTION_DAYS} Tage)..."
DELETED=$(find "$BACKUP_DIR" \( -name "*.tar.gz" -o -name "*.tar.gz.gpg" \) -mtime +${RETENTION_DAYS} -print -delete | wc -l)
echo "  ${DELETED} alte Backups gelöscht"

echo "=== Backup abgeschlossen ==="
