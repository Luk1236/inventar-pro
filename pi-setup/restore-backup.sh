#!/usr/bin/env bash
# Restore eines Backups (verschlüsselt oder unverschlüsselt)
# Verwendung:
#   ./restore-backup.sh <backup-file>
#   ./restore-backup.sh ~/inventar-backup/20251015_030000.tar.gz
#   ./restore-backup.sh ~/inventar-backup/20251015_030000.tar.gz.gpg
set -euo pipefail

if [[ $# -lt 1 ]]; then
    echo "Verwendung: $0 <backup-datei>"
    echo
    echo "Verfügbare Backups:"
    ls -lh ~/inventar-backup/*.tar.gz* 2>/dev/null | tail -n +1 || echo "  (keine gefunden)"
    exit 1
fi

BACKUP_FILE="$1"
RESTORE_DIR=$(mktemp -d -t inventar-restore-XXXXXX)
DB_NAME="${MONGO_DB_NAME:-inventar}"

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "✗ Datei nicht gefunden: $BACKUP_FILE"
    exit 1
fi

echo "=== Restore: $BACKUP_FILE ==="
echo "Temp-Verzeichnis: $RESTORE_DIR"
echo "Datenbank: $DB_NAME"
echo

# Sicherheits-Bestätigung
echo "⚠ Dies ÜBERSCHREIBT die aktuelle Datenbank '$DB_NAME'."
read -p "Fortfahren? (yes/nein): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
    echo "Abgebrochen."
    rm -rf "$RESTORE_DIR"
    exit 0
fi

# 1. Pre-Restore Backup (Sicherheitsnetz)
echo "[1/5] Sicherheits-Snapshot der aktuellen DB..."
SAFETY_DIR="$HOME/inventar-backup/pre-restore-$(date +%Y%m%d_%H%M%S)"
mongodump --quiet --db "$DB_NAME" --out "$SAFETY_DIR" 2>/dev/null || {
    echo "  ⚠ Konnte aktuelle DB nicht sichern (existiert sie?)"
}
echo "  ✓ Aktueller Stand gesichert: $SAFETY_DIR"

# 2. Entschlüsseln (falls .gpg)
echo "[2/5] Entschlüsseln/Vorbereiten..."
WORK_FILE="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.gpg ]]; then
    if [[ -z "${BACKUP_GPG_PASSPHRASE:-}" ]]; then
        read -srp "  GPG-Passphrase: " BACKUP_GPG_PASSPHRASE
        echo
    fi
    DECRYPTED="$RESTORE_DIR/$(basename "${BACKUP_FILE%.gpg}")"
    gpg --batch --quiet --passphrase "$BACKUP_GPG_PASSPHRASE" --decrypt "$BACKUP_FILE" > "$DECRYPTED"
    WORK_FILE="$DECRYPTED"
    echo "  ✓ Entschlüsselt"
else
    echo "  ✓ Klartext-Backup"
fi

# 3. Entpacken
echo "[3/5] Entpacken..."
tar -xzf "$WORK_FILE" -C "$RESTORE_DIR"
DUMP_DIR=$(find "$RESTORE_DIR" -maxdepth 2 -type d -name "$DB_NAME" | head -n 1)
if [[ -z "$DUMP_DIR" ]]; then
    DUMP_DIR=$(find "$RESTORE_DIR" -maxdepth 2 -type d -not -path "$RESTORE_DIR" | head -n 1)
fi
if [[ -z "$DUMP_DIR" ]]; then
    echo "✗ Kein DB-Dump im Archiv gefunden"
    rm -rf "$RESTORE_DIR"
    exit 1
fi
echo "  ✓ Dump-Verzeichnis: $DUMP_DIR"

# 4. Restore
echo "[4/5] mongorestore läuft..."
mongorestore --quiet --drop --nsInclude="$DB_NAME.*" \
    --nsFrom="$(basename "$DUMP_DIR").*" --nsTo="$DB_NAME.*" \
    "$DUMP_DIR" 2>&1 | tail -n 5
echo "  ✓ Restore abgeschlossen"

# 5. Verifikation
echo "[5/5] Verifikation..."
ARTICLE_COUNT=$(mongosh --quiet "$DB_NAME" --eval "db.articles.countDocuments()" 2>/dev/null || echo "?")
USER_COUNT=$(mongosh --quiet "$DB_NAME" --eval "db.users.countDocuments()" 2>/dev/null || echo "?")
echo "  Articles: $ARTICLE_COUNT"
echo "  Users:    $USER_COUNT"

# Cleanup
rm -rf "$RESTORE_DIR"

echo
echo "=== Restore erfolgreich ==="
echo "Pre-Restore Snapshot bei Bedarf: $SAFETY_DIR"
echo "Backend ggf. neu starten:  sudo systemctl restart inventar-backend"
