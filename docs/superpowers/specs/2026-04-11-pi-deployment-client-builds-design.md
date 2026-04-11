# Pi-Deployment & Client-Builds — Design Spec

**Datum:** 2026-04-11  
**Scope:** Raspberry Pi 5 vollständig einrichten + Electron .exe + Android APK bauen

---

## Ziel

Das Inventar Pro System soll produktionsreif auf einem Raspberry Pi 5 (8GB, 64-bit) laufen. Der Pi startet automatisch nach einem Neustart. Windows-Nutzer können eine .exe installieren, Android-Nutzer eine APK. Alle Clients verbinden sich zum Pi.

---

## Voraussetzungen

- Raspberry Pi 5, 8GB RAM, 64-bit Raspberry Pi OS
- Pi hat Internet-Zugang während des Setups
- Projekt-Dateien werden **vor** dem Script via SCP oder USB auf den Pi kopiert nach `~/inventarpro/`
- PC hat Node.js installiert (bereits der Fall)
- Kostenloser Expo-Account für APK-Build (expo.dev)

---

## Phase 1: Raspberry Pi Setup-Script

### Script: `setup-raspi.sh`

Einmaliges Script das alles installiert und konfiguriert. Ausführen nach dem Kopieren der Projekt-Dateien auf den Pi.

**Schritt 1 — System aktualisieren:**
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential
```

**Schritt 2 — Python 3.12 installieren:**
```bash
sudo apt install -y python3.12 python3.12-pip python3.12-venv
```
Falls Python 3.12 nicht via apt verfügbar: via deadsnakes PPA oder pyenv installieren.

**Schritt 3 — MongoDB 7.0 für ARM64 installieren:**
```bash
# MongoDB 7.0 ARM64 Repository hinzufügen
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/mongodb-server-7.0.gpg
echo "deb [ arch=arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

**Schritt 4 — Python-Dependencies installieren:**
```bash
cd ~/inventarpro/backend
python3.12 -m pip install -r requirements.txt
```

**Schritt 5 — `.env` Datei anlegen:**
```bash
# Generiert sicheren SECRET_KEY automatisch
SECRET_KEY=$(python3.12 -c "import secrets; print(secrets.token_hex(32))")
cat > ~/inventarpro/backend/.env << EOF
SECRET_KEY=$SECRET_KEY
MONGO_URL=mongodb://localhost:27017
DATABASE_NAME=inventory_db
PORT=8002
EOF
```

**Schritt 6 — systemd-Service `inventarpro.service`:**
```ini
[Unit]
Description=Inventar Pro Backend
After=network.target mongod.service
Requires=mongod.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/inventarpro/backend
ExecStart=/usr/bin/python3.12 server.py
Restart=on-failure
RestartSec=5
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```
```bash
sudo cp inventarpro.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable inventarpro
sudo systemctl start inventarpro
```

**Schritt 7 — Firewall (Port 8002):**
```bash
sudo ufw allow 8002/tcp
sudo ufw --force enable
```

**Schritt 8 — Cloudflare Tunnel (optional, interaktiv):**
Script fragt: "Cloudflare Tunnel einrichten? (j/n)"
- Bei `j`: ruft `setup-cloudflare-tunnel.sh` auf (bereits vorhanden)
- Bei `n`: überspringen, kann später manuell eingerichtet werden

**Schritt 9 — Verifikation:**
```bash
# Warte bis Service gestartet ist
sleep 3
curl -s http://localhost:8002/api/ | python3.12 -c "import sys,json; d=json.load(sys.stdin); print('OK:', d.get('message','?'))"
```
Erwartete Ausgabe: `OK: Inventory Management System API`

### SCP-Transfer Anleitung

Vor dem Script: Dateien vom PC auf den Pi kopieren:
```bash
# Auf dem PC ausführen (bash/PowerShell):
scp -r "C:/Users/lukas/OneDrive/Desktop/Final-main(1)/Final-main" pi@PI-IP:~/inventarpro
```

Oder via USB:
1. Projekt-Ordner auf USB-Stick kopieren
2. USB in Pi stecken, mounten, nach `~/inventarpro/` kopieren

### Datei-Struktur auf dem Pi nach Setup

```
~/inventarpro/
├── backend/
│   ├── server.py
│   ├── requirements.txt
│   ├── .env              ← vom Script generiert
│   └── websocket_handler.py
├── frontend/             ← optional (für Web-Build)
├── setup-raspi.sh
└── setup-cloudflare-tunnel.sh
```

---

## Phase 2: Electron Windows .exe

### Voraussetzungen
- Node.js auf dem PC (bereits installiert)
- `electron/web-dist/` — Expo Web-Build (bereits vorhanden aus letztem Build)

### Build-Prozess
```bat
cd electron
build.bat
```

Falls `web-dist/` veraltet ist, baut `build.bat` automatisch neu.

**Output:** `electron/dist/Inventar Pro Setup 1.0.0.exe`

### Verbesserungen am build.bat
- Prüft ob Node.js installiert ist, gibt klare Fehlermeldung wenn nicht
- Prüft ob `web-dist/index.html` bereits aktuell ist (Skip wenn frisch)
- Zeigt Datei-Größe des fertigen Installers

---

## Phase 3: Android APK via EAS

### Expo-Account Setup (einmalig)
1. Account anlegen: https://expo.dev (kostenlos)
2. EAS CLI einloggen: `cd frontend && eas login`
3. Projekt verknüpfen: `eas init` (aktualisiert `app.json` mit projectId)

### APK Build
```bash
cd frontend
eas build --platform android --profile preview
```
- Läuft in Expo-Cloud (~10-15 Min)
- Download-Link erscheint nach dem Build
- APK direkt auf Android-Gerät installierbar

### Erste-Schritte nach APK-Installation
1. APK installieren (Einstellungen → Unbekannte Quellen erlauben)
2. App öffnen → Settings → Server-URL eingeben:
   - LAN: `http://192.168.x.x:8002`
   - Internet: Cloudflare-URL

---

## Deliverables

| Artefakt | Wo | Wer baut es |
|---|---|---|
| `setup-raspi.sh` | Projekt-Root | Script (automatisch) |
| `RASPI_SETUP.md` | `docs/` | Dokumentation |
| `electron/dist/Inventar Pro Setup 1.0.0.exe` | lokal auf PC | `electron/build.bat` |
| `InventarPro-1.0.0.apk` | Expo-Cloud Download | `eas build` |

---

## Erfolgskriterien

- [ ] Pi startet neu → `sudo systemctl status inventarpro` zeigt `active (running)`
- [ ] Von PC: `curl http://PI-IP:8002/api/` antwortet
- [ ] Electron .exe installiert sich, verbindet sich mit Pi
- [ ] APK installiert sich auf Android, verbindet sich mit Pi
- [ ] Cloudflare-URL funktioniert von externem Netz (optional)
