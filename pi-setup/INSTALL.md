# Inventar Pro — Fresh-Install Anleitung

Komplette Neu-Installation auf einem **frisch geflashten Raspberry Pi**.

## Voraussetzungen

- **Raspberry Pi 4 oder 5** (Pi 3 funktioniert auch, aber sehr langsam)
- **Pi OS 64-bit (Bookworm)** — wichtig, MongoDB läuft nicht auf 32-bit
- **mindestens 16 GB SD-Karte** (besser 32 GB+ wegen MongoDB + Node-Modules)
- **stabile Stromversorgung** (mind. 3A bei Pi 4, 5A bei Pi 5)
- **Netzwerk-Verbindung** (LAN oder WLAN konfiguriert)

## Schritt 1: SD-Karte flashen

1. **Raspberry Pi Imager** runterladen: https://www.raspberrypi.com/software/
2. Wähle **Raspberry Pi OS (64-bit)** — Variante: **Lite** (ohne Desktop, schneller) oder **with Desktop**
3. Im Imager auf **Zahnrad/Einstellungen** klicken — VOR dem Schreiben:
   - **Hostname:** z.B. `inventar-pi`
   - **SSH aktivieren** (mit Passwort-Auth)
   - **Benutzername + Passwort** setzen (merken!)
   - **WLAN-Zugangsdaten** eintragen
   - **Spracheinstellungen** (Tastatur DE)
4. SD-Karte schreiben (dauert 5-10 Min)
5. SD-Karte in den Pi stecken, Strom anschließen

## Schritt 2: Erster SSH-Login

Nach ca. 1-2 Minuten ist der Pi erreichbar:

```bash
ssh <username>@inventar-pi.local
# oder mit IP:
ssh <username>@192.168.x.x
```

Hostname/IP findest du im Router oder per:
```bash
ping inventar-pi.local
```

## Schritt 3: Installations-Skript ausführen

**Option A: Direkt aus dem Internet** (wenn das Repo öffentlich ist):
```bash
curl -fsSL https://raw.githubusercontent.com/dbootz111/inventar-pro/main/pi-setup/fresh-install.sh | bash
```

**Option B: Erst klonen, dann ausführen** (empfohlen, kontrollierbar):
```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/dbootz111/inventar-pro.git ~/inventar
chmod +x ~/inventar/pi-setup/fresh-install.sh
~/inventar/pi-setup/fresh-install.sh
```

**Option C: Privates Repo** mit SSH-Key:
```bash
# SSH-Key generieren und in GitHub einfügen
ssh-keygen -t ed25519 -C "inventar-pi"
cat ~/.ssh/id_ed25519.pub  # → in GitHub → Settings → SSH Keys
git clone git@github.com:dbootz111/inventar-pro.git ~/inventar
INVENTAR_REPO="git@github.com:dbootz111/inventar-pro.git" ~/inventar/pi-setup/fresh-install.sh
```

## Was das Skript macht (Dauer: ca. 15-30 Min)

| Schritt | Beschreibung |
|---------|--------------|
| 1 | `apt update && upgrade`, Basis-Pakete (Python, git, curl, build-essential) |
| 2 | **Node.js 20 LTS** aus NodeSource-Repo |
| 3 | **MongoDB 7.0** aus offiziellem Mongo-Repo (nur arm64) |
| 4 | Repo nach `~/inventar` klonen |
| 5 | Python venv unter `backend/.venv/`, alle pip-Dependencies |
| 6 | `backend/.env` mit **zufälligem SECRET_KEY** erstellen |
| 7 | `npm install` + `npx expo export` → statisches Frontend in `frontend/dist/` |
| 8 | systemd Service-Files in `/etc/systemd/system/` kopieren (User wird auf aktuellen User angepasst) |
| 9 | Sudoers `/etc/sudoers.d/inventar` mit NOPASSWD für `systemctl`, `shutdown`, `mongodump` |
| 10 | Dashboard-Passwort **interaktiv abfragen** und mit bcrypt hashen (`~/.dashboard_password`) |
| 11 | Erster Git-Tag (`v1.2.0.1`) für Rollback-System |
| 12 | Services starten + Backup-Timer (täglich 03:00) + Weekly-Reboot (So 04:00) |

## Schritt 4: Verifikation

Nach Skript-Ende sollte angezeigt werden:
```
✓ Backend läuft
✓ Dashboard läuft
✓ MongoDB läuft
```

Test im Browser:
- **Pi-Dashboard:** `http://<pi-ip>:8080` → Login mit dem eben gesetzten Passwort
- **App (Frontend):** `http://<pi-ip>:8002` → Inventar-Pro-App
- **API-Docs:** `http://<pi-ip>:8002/docs` (nur in development, in production gesperrt)

## Schritt 5: Erste Konfiguration

1. **Dashboard öffnen** → einloggen
2. Im Pi-Dashboard ggf. **2FA aktivieren** (Card "🔐 2-Faktor-Authentifizierung")
3. In der App auf **Settings** → ersten Admin-Account anlegen
4. **Erstes Lager** anlegen unter `/warehouses`
5. **Test-Artikel** anlegen, AI-Scan testen (braucht API-Key, siehe unten)

## Optional: Zusatz-Features

### Tailscale (Remote-Zugriff weltweit)
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# URL aus Output im Browser öffnen + Account verknüpfen
```

### HTTPS via Tailscale Funnel (öffentlich erreichbar)
```bash
~/inventar/pi-setup/enable-tailscale-funnel.sh
```

### AI-Inventur (Foto → Artikel)
In `~/inventar/backend/.env`:
```bash
ANTHROPIC_API_KEY=sk-ant-...
# oder:
OPENAI_API_KEY=sk-...
```
Dann Backend neu starten: `sudo systemctl restart inventar-backend`

### fail2ban (IP-Sperren bei Brute-Force)
```bash
sudo apt install -y fail2ban
sudo cp ~/inventar/pi-setup/fail2ban-inventar.conf /etc/fail2ban/filter.d/inventar.conf
sudo cp ~/inventar/pi-setup/fail2ban-jail.local /etc/fail2ban/jail.d/inventar.local
sudo systemctl restart fail2ban
sudo fail2ban-client status inventar
```

### Backup-Verschlüsselung
Im Service-Override aktivieren:
```bash
sudo systemctl edit inventar-backup.service
# Im Editor einfügen:
# [Service]
# Environment="BACKUP_GPG_PASSPHRASE=dein-pw"
# Environment="BACKUP_RCLONE_REMOTE=dropbox:Pi-Backups"  # optional
```

### Label-Drucker (Zebra ZPL, Brother TSC)
In `~/inventar/backend/.env`:
```bash
LABEL_PRINTER_HOST=192.168.x.x
LABEL_PRINTER_PORT=9100
```

## Troubleshooting

### MongoDB startet nicht
```bash
sudo systemctl status mongod
sudo journalctl -u mongod -n 50
# häufige Ursache: zu wenig RAM (Pi mit 1 GB → tmpfs erweitern)
```

### Backend startet nicht
```bash
sudo journalctl -u inventar-backend -n 100
# meist: pip-Dependencies fehlen oder .env-Fehler
cd ~/inventar/backend && source .venv/bin/activate && python server.py
# direkter Start zeigt Fehler im Klartext
```

### Frontend lädt nicht
```bash
# Build neu erzeugen:
cd ~/inventar/frontend
rm -rf dist node_modules
npm install
npx expo export --platform web
sudo systemctl restart inventar-backend
```

### Update vom Pi-Dashboard funktioniert nicht
```bash
# Sudoers prüfen:
sudo cat /etc/sudoers.d/inventar
# Falls leer:
echo "$USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /sbin/shutdown, /usr/bin/mongodump" | sudo tee /etc/sudoers.d/inventar
```

### Passwort vergessen
```bash
rm ~/.dashboard_password
sudo systemctl restart inventar-dashboard
# Neues Default-Passwort: admin
# Sofort über Dashboard ändern!
```

## Komplette Deinstallation

Falls du nochmal ganz neu anfangen willst:
```bash
sudo systemctl stop inventar-backend inventar-dashboard inventar-backup.timer inventar-weekly-reboot.timer 2>/dev/null
sudo systemctl disable inventar-backend inventar-dashboard inventar-backup.timer inventar-weekly-reboot.timer 2>/dev/null
sudo rm /etc/systemd/system/inventar-*.{service,timer}
sudo rm /etc/sudoers.d/inventar
sudo systemctl daemon-reload
rm -rf ~/inventar ~/.dashboard_password ~/.dashboard_totp_secret ~/.dashboard_audit.jsonl ~/inventar-backup
# MongoDB-Daten optional:
sudo apt purge -y mongodb-org* && sudo rm -rf /var/lib/mongodb /var/log/mongodb
```

Dann von Schritt 3 neu starten.
