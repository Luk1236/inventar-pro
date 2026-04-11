# Inventar Pro — Raspberry Pi Setup

## Voraussetzungen

- Raspberry Pi 5 (oder Pi 4), 64-bit Raspberry Pi OS
- Internet-Verbindung auf dem Pi
- SSH-Zugang vom PC zum Pi

## Schritt 1: Pi-IP herausfinden

Auf dem Pi ausführen:
```bash
hostname -I
```
Notiere die IP-Adresse (z.B. `192.168.1.100`).

## Schritt 2: Projekt-Dateien auf den Pi kopieren

**Option A — SCP (empfohlen):**

Auf dem Windows-PC in einer PowerShell/CMD ausführen:
```powershell
scp -r "C:\Users\lukas\OneDrive\Desktop\Final-main(1)\Final-main" pi@192.168.1.100:~/inventarpro
```
Passwort eingeben wenn gefragt.

**Option B — USB-Stick:**
1. Projekt-Ordner auf USB-Stick kopieren
2. USB in Pi stecken
3. Auf dem Pi:
```bash
mkdir ~/inventarpro
cp -r /media/pi/USB-STICK/Final-main/* ~/inventarpro/
```

## Schritt 3: Setup-Script ausführen

Auf dem Pi:
```bash
cd ~/inventarpro
chmod +x setup-raspi.sh
sudo bash setup-raspi.sh
```

Das Script installiert automatisch:
- Python 3 + virtuelle Umgebung
- MongoDB 7.0
- Alle Python-Dependencies
- systemd-Service (Auto-Start beim Booten)
- Optional: Cloudflare Tunnel

**Dauer:** ca. 5-15 Minuten (je nach Internet-Geschwindigkeit)

## Schritt 4: Backend testen

```bash
curl http://localhost:8002/api/
```

Erwartete Ausgabe:
```json
{"message": "Inventory Management System API", "version": "1.0.0"}
```

## Schritt 5: Von einem anderen Gerät testen

Auf dem PC im Browser öffnen:
```
http://192.168.1.100:8002/docs
```

Du siehst die FastAPI-Dokumentation → Backend läuft korrekt.

## Schritt 6: Server-URL in der App eintragen

In der Inventar Pro App (Web, Electron oder Android):
- Settings → Server-URL
- Eingeben: `http://192.168.1.100:8002`
- Speichern

## Service-Verwaltung

```bash
# Status prüfen
sudo systemctl status inventarpro

# Logs ansehen
journalctl -u inventarpro -f

# Neustart
sudo systemctl restart inventarpro

# Nach Pi-Neustart (automatisch): prüfen ob läuft
sudo systemctl is-active inventarpro
```

## Pi neu starten — was passiert?

1. Pi startet
2. MongoDB startet automatisch
3. `inventarpro.service` wartet auf MongoDB, dann startet Backend
4. Nach ~30 Sekunden ist die App wieder erreichbar

## Troubleshooting

**Backend startet nicht:**
```bash
journalctl -u inventarpro -n 50 --no-pager
```

**MongoDB läuft nicht:**
```bash
sudo systemctl start mongod
sudo systemctl status mongod
```

**Port 8002 nicht erreichbar vom PC:**
```bash
# Firewall-Regel prüfen
sudo ufw status
# Falls nicht aktiv: kein Problem, Port ist offen
```

**Falsche Python-Version:**
```bash
python3 --version
# Muss 3.10+ sein
```
