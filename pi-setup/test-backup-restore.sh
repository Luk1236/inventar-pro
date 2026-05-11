#!/usr/bin/env bash
# Verifiziert dass Backup → Restore funktioniert OHNE die echte DB anzufassen.
# Schreibt in eine Test-DB, dumpt, optional verschlüsselt, entschlüsselt, restored,
# vergleicht Document-Counts und löscht dann die Test-DB.
set -euo pipefail

TEST_DB="inventar_backup_test_$$"
WORK=$(mktemp -d)
trap "rm -rf '$WORK'; mongosh --quiet '$TEST_DB' --eval 'db.dropDatabase()' 2>/dev/null || true" EXIT

echo "=== Backup-Restore Self-Test ==="
echo "Test-DB: $TEST_DB"
echo

# 1. Test-Daten erzeugen
echo "[1/6] Test-Daten erzeugen..."
mongosh --quiet "$TEST_DB" --eval '
  for (let i = 0; i < 50; i++) {
    db.articles.insertOne({id: "test-" + i, name: "Test " + i, current_stock: i});
  }
  db.warehouses.insertOne({id: "wh-1", name: "Test-Lager"});
' > /dev/null
ORIG_ARTICLES=$(mongosh --quiet "$TEST_DB" --eval "db.articles.countDocuments()")
ORIG_WHS=$(mongosh --quiet "$TEST_DB" --eval "db.warehouses.countDocuments()")
echo "  ✓ $ORIG_ARTICLES Artikel, $ORIG_WHS Lager"

# 2. Dump
echo "[2/6] mongodump..."
mongodump --quiet --db "$TEST_DB" --out "$WORK/dump" 2>/dev/null
test -d "$WORK/dump/$TEST_DB" || { echo "✗ Dump-Verzeichnis fehlt"; exit 1; }
echo "  ✓ gedumpt"

# 3. tar+gz
echo "[3/6] Komprimieren..."
tar -czf "$WORK/backup.tar.gz" -C "$WORK/dump" "$TEST_DB"
SIZE=$(du -h "$WORK/backup.tar.gz" | cut -f1)
echo "  ✓ $SIZE"

# 4. (optional) GPG-Round-Trip falls Passphrase gesetzt
if [[ -n "${BACKUP_GPG_PASSPHRASE:-}" ]]; then
    echo "[4/6] GPG-Verschlüsselung testen..."
    gpg --batch --yes --quiet --passphrase "$BACKUP_GPG_PASSPHRASE" --symmetric --cipher-algo AES256 "$WORK/backup.tar.gz"
    rm "$WORK/backup.tar.gz"
    gpg --batch --quiet --passphrase "$BACKUP_GPG_PASSPHRASE" --decrypt "$WORK/backup.tar.gz.gpg" > "$WORK/backup.tar.gz"
    echo "  ✓ Encrypt/Decrypt OK"
else
    echo "[4/6] GPG-Test übersprungen (BACKUP_GPG_PASSPHRASE nicht gesetzt)"
fi

# 5. DB löschen + restore
echo "[5/6] DB löschen + restore..."
mongosh --quiet "$TEST_DB" --eval "db.dropDatabase()" > /dev/null
mkdir -p "$WORK/restore"
tar -xzf "$WORK/backup.tar.gz" -C "$WORK/restore"
mongorestore --quiet "$WORK/restore" 2>&1 | tail -n 3
echo "  ✓ restored"

# 6. Verifikation
echo "[6/6] Verifikation..."
RESTORED_ARTICLES=$(mongosh --quiet "$TEST_DB" --eval "db.articles.countDocuments()")
RESTORED_WHS=$(mongosh --quiet "$TEST_DB" --eval "db.warehouses.countDocuments()")

PASS=true
if [[ "$ORIG_ARTICLES" != "$RESTORED_ARTICLES" ]]; then
    echo "  ✗ Article-Count: original=$ORIG_ARTICLES, restored=$RESTORED_ARTICLES"
    PASS=false
fi
if [[ "$ORIG_WHS" != "$RESTORED_WHS" ]]; then
    echo "  ✗ Warehouse-Count: original=$ORIG_WHS, restored=$RESTORED_WHS"
    PASS=false
fi

if $PASS; then
    echo "  ✓ Counts identisch ($RESTORED_ARTICLES Artikel, $RESTORED_WHS Lager)"
    echo
    echo "=== ✅ Backup-Restore funktioniert ==="
    exit 0
else
    echo
    echo "=== ❌ FEHLER: Counts stimmen nicht überein ==="
    exit 1
fi
