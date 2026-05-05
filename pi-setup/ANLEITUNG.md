# Inventar Pro — Raspberry Pi Installationsanleitung

## Schnellstart (automatisch)

**1. Projekt auf den Pi kopieren** (vom Windows-PC aus):
```bash
scp -r "C:\Users\lukas\OneDrive\Desktop\Lager" pi@PI-IP-ADRESSE:~/inventar
```

**2. Auf dem Pi per SSH:**
```bash
ssh pi@PI-IP-ADRESSE
cd ~/inventar
chmod +x pi-install.sh
./pi-install.sh
```

Das Skript erledigt alles automatisch (~50 Minuten).

---

## Was wird installiert

| Komponente | Version | Zweck |
|---|---|---|
| Python | 3.11+ | Backend-Runtime |
| FastAPI + Uvicorn | 0.110 / 0.25 | API-Server |
| MongoDB | 7.0 | Datenbank |
| Node.js | 20 LTS | Frontend-Runtime |
| Expo Web | 54 | Web-App |
| Tailscale | aktuell | HTTPS-Zugang von außen |

---

## Ports

| Port | Dienst |
|---|---|
| 8002 | Backend API (intern) |
| 8081 | Frontend Web (intern) |
| 443 | Tailscale HTTPS (extern) |

---

## Nach der Installation

### Zugriff von anderen Geräten

**Im gleichen WLAN:**
```
http://PI-IP-ADRESSE:8081
```

**Von außen (Tailscale):**
```
https://HOSTNAME.ts.net
```
→ Das Gerät muss im Tailscale-Netz eingeloggt sein.

### Logs prüfen
```bash
journalctl -fu inventar-backend    # Backend live
journalctl -fu inventar-frontend   # Frontend live
journalctl -n 50 -u inventar-backend  # Letzte 50 Zeilen
```

### Services verwalten
```bash
sudo systemctl status  inventar-backend inventar-frontend
sudo systemctl restart inventar-backend inventar-frontend
sudo systemctl stop    inventar-backend inventar-frontend
```

### Update einspielen
```bash
cd ~/inventar
chmod +x pi-setup/update.sh
./pi-setup/update.sh
```

### Backup einrichten (automatisch täglich 3 Uhr)
```bash
chmod +x ~/inventar/pi-setup/backup.sh
crontab -e
# Folgende Zeile hinzufügen:
# 0 3 * * * /home/pi/inventar/pi-setup/backup.sh >> /home/pi/inventar-backup/backup.log 2>&1
```

---

## Troubleshooting

### Backend startet nicht
```bash
journalctl -n 50 -u inventar-backend
# Häufig: SECRET_KEY fehlt in .env
nano ~/inventar/Final-main/backend/.env
sudo systemctl restart inventar-backend
```

### MongoDB startet nicht
```bash
sudo systemctl status mongod
sudo journalctl -u mongod -n 30
# Datenbankdatei reparieren:
sudo mongod --repair --dbpath /var/lib/mongodb
sudo systemctl restart mongod
```

### Frontend hängt beim Laden
```bash
journalctl -n 50 -u inventar-frontend
# Expo braucht beim ersten Start manchmal 60s+
# Alternativ: Expo-Cache leeren
cd ~/inventar/Final-main/frontend
npx expo start --clear --web --port 8081
```

### CORS-Fehler im Browser
```bash
nano ~/inventar/Final-main/backend/.env
# ALLOWED_ORIGINS um deine URL ergänzen, z.B.:
# ALLOWED_ORIGINS=http://localhost:8081,https://HOSTNAME.ts.net,http://100.x.y.z:8081
sudo systemctl restart inventar-backend
```

### Tailscale nicht verbunden
```bash
tailscale status
sudo tailscale up --accept-routes
```

---

## Hardware-Empfehlung

| Hardware | Minimum | Empfohlen |
|---|---|---|
| Modell | Raspberry Pi 4 4GB | Pi 5 8GB |
| Speicher | MicroSD 32GB Class 10 | USB-SSD 64GB+ |
| Kühlung | Passiv | Aktiv (Lüfter) |
| Strom | 3A USB-C | Offizielles Pi-Netzteil |
