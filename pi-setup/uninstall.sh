#!/usr/bin/env bash
# ============================================================
# Inventar Pro — Komplette Deinstallation
# ============================================================
# Löscht ALLES und stellt einen sauberen Pi-Zustand her.
# Danach: fresh-install.sh ausführen für komplette Neuinstallation.
#
# Verwendung:
#   curl -fsSL https://raw.githubusercontent.com/Luk1236/inventar-pro/master/pi-setup/uninstall.sh | bash
# ODER lokal:
#   bash ~/inventar/pi-setup/uninstall.sh
# ============================================================
set -uo pipefail

echo "============================================================"
echo " Inventar Pro — Komplette Deinstallation"
echo "============================================================"
echo
echo "Dies wird FOLGENDES LÖSCHEN:"
echo "  ✗ Alle inventar-* systemd Services"
echo "  ✗ Sudoers-Einträge (/etc/sudoers.d/inventar)"
echo "  ✗ ~/inventar/ (komplettes Repo)"
echo "  ✗ ~/.dashboard_password + ~/.dashboard_totp_secret + ~/.dashboard_audit.jsonl"
echo "  ✗ ~/inventar-install.log"
echo "  ✗ ~/.cloudflared/ (Cloudflare Tunnel Config)"
echo
echo "MongoDB-DATEN (in /var/lib/mongodb/) werden NICHT gelöscht (sicher)"
echo "Tailscale-Konfiguration bleibt erhalten"
echo
read -p "Wirklich alles löschen? Tippe 'ja' zum Bestätigen: " CONFIRM
if [[ "$CONFIRM" != "ja" ]]; then
    echo "Abgebrochen."
    exit 0
fi

# Optional: MongoDB-Daten löschen?
read -p "Auch MongoDB-Daten löschen (alle Inventar-Daten gehen verloren)? (ja/nein): " MONGO_WIPE
echo

echo "── 1/8: systemd Services stoppen ──"
for svc in inventar-backend inventar-dashboard inventar-frontend inventar-backup.timer inventar-weekly-reboot.timer inventar-backup inventar-weekly-reboot; do
    sudo systemctl stop "$svc" 2>/dev/null || true
    sudo systemctl disable "$svc" 2>/dev/null || true
done
sudo systemctl stop cloudflared 2>/dev/null || true
sudo systemctl disable cloudflared 2>/dev/null || true
echo "  ✓ Services gestoppt"

echo "── 2/8: systemd Service-Files entfernen ──"
sudo rm -f /etc/systemd/system/inventar-*.service
sudo rm -f /etc/systemd/system/inventar-*.timer
sudo rm -f /etc/systemd/system/cloudflared.service
sudo systemctl daemon-reload
echo "  ✓ Service-Files gelöscht"

echo "── 3/8: Sudoers-Eintrag entfernen ──"
sudo rm -f /etc/sudoers.d/inventar
echo "  ✓ Sudoers aufgeräumt"

echo "── 4/8: Repo + venv löschen ──"
rm -rf ~/inventar
echo "  ✓ ~/inventar entfernt"

echo "── 5/8: Dashboard-Dateien löschen ──"
rm -f ~/.dashboard_password ~/.dashboard_totp_secret ~/.dashboard_audit.jsonl
echo "  ✓ Dashboard-Konfiguration entfernt"

echo "── 6/8: Logs + Backups ──"
rm -f ~/inventar-install.log
read -p "  Auch ~/inventar-backup/ löschen? (ja/nein): " BACKUP_WIPE
if [[ "$BACKUP_WIPE" == "ja" ]]; then
    rm -rf ~/inventar-backup
    echo "  ✓ Backup-Ordner gelöscht"
else
    echo "  ⊘ Backup-Ordner behalten"
fi

echo "── 7/8: Cloudflare Tunnel-Config ──"
rm -rf ~/.cloudflared
echo "  ✓ Cloudflare-Config entfernt"

echo "── 8/8: MongoDB-Daten ──"
if [[ "$MONGO_WIPE" == "ja" ]]; then
    sudo systemctl stop mongod 2>/dev/null || sudo systemctl stop mongodb 2>/dev/null || true
    sudo rm -rf /var/lib/mongodb/*
    sudo systemctl start mongod 2>/dev/null || sudo systemctl start mongodb 2>/dev/null || true
    echo "  ✓ MongoDB-Datenbank geleert"
else
    echo "  ⊘ MongoDB-Daten bleiben erhalten"
fi

echo
echo "============================================================"
echo " ✅ Deinstallation abgeschlossen"
echo "============================================================"
echo
echo "Nächster Schritt — Neuinstallation:"
echo
echo "  curl -fsSL https://raw.githubusercontent.com/Luk1236/inventar-pro/master/pi-setup/fresh-install.sh | bash"
echo
