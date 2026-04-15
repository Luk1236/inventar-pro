# Pi-Deployment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Setup-Script für Raspberry Pi 5 (64-bit) aktualisieren und testen — Backend startet automatisch als systemd-Service nach dem Booten.

**Architecture:** Das bestehende `setup-raspi.sh` installiert Python, MongoDB, kopiert das Backend nach `/opt/inventarpro`, legt `.env` an und richtet einen systemd-Service ein. Es muss von "EquipTrack/Port 8000" auf "Inventar Pro/Port 8002" umgestellt werden.

**Tech Stack:** Bash, systemd, MongoDB 7.0 ARM64, Python 3 venv, uvicorn

---

## Datei-Übersicht

| Datei | Aktion | Zweck |
|-------|--------|-------|
| `setup-raspi.sh` | Modify | Umbenennen auf Inventar Pro, Port 8002, Service-Name |
| `docs/RASPI_SETUP.md` | Create | Schritt-für-Schritt Anleitung für den User |

---

## Task 1: setup-raspi.sh aktualisieren

**Files:**
- Modify: `setup-raspi.sh`

- [ ] **Step 1: Lese die aktuelle Version**

```bash
head -15 setup-raspi.sh
```

Notiere: `INSTALL_DIR`, `SERVICE_USER`, `BACKEND_PORT`, Service-Name.

- [ ] **Step 2: Ändere die Konfigurationsvariablen am Anfang des Scripts**

Finde den Block (ca. Zeilen 7-11):
```bash
INSTALL_DIR="/opt/equiptrack"
SERVICE_USER="equiptrack"
BACKEND_PORT=8000
```

Ersetze durch:
```bash
INSTALL_DIR="/opt/inventarpro"
SERVICE_USER="inventarpro"
BACKEND_PORT=8002
```

- [ ] **Step 3: Ersetze alle "EquipTrack" Referenzen durch "Inventar Pro"**

```bash
grep -n "EquipTrack\|equiptrack" setup-raspi.sh
```

Ersetze in der Datei (mit sed oder direkt):
- `"EquipTrack Inventory Backend"` → `"Inventar Pro Backend"`
- `equiptrack.service` → `inventarpro.service`  
- `systemctl enable equiptrack` → `systemctl enable inventarpro`
- `systemctl restart equiptrack` → `systemctl restart inventarpro`
- `systemctl is-active --quiet equiptrack` → `systemctl is-active --quiet inventarpro`
- `journalctl -u equiptrack` → `journalctl -u inventarpro`
- Kommentare und echo-Ausgaben anpassen

Der schnellste Weg (führe diese sed-Befehle aus):
```bash
sed -i 's|/opt/equiptrack|/opt/inventarpro|g' setup-raspi.sh
sed -i 's|SERVICE_USER="equiptrack"|SERVICE_USER="inventarpro"|g' setup-raspi.sh
sed -i 's|BACKEND_PORT=8000|BACKEND_PORT=8002|g' setup-raspi.sh
sed -i 's|equiptrack\.service|inventarpro.service|g' setup-raspi.sh
sed -i 's|Description=EquipTrack|Description=Inventar Pro|g' setup-raspi.sh
sed -i 's|-u equiptrack|-u inventarpro|g' setup-raspi.sh
sed -i 's|systemctl enable equiptrack|systemctl enable inventarpro|g' setup-raspi.sh
sed -i 's|systemctl restart equiptrack|systemctl restart inventarpro|g' setup-raspi.sh
sed -i 's|systemctl is-active --quiet equiptrack|systemctl is-active --quiet inventarpro|g' setup-raspi.sh
sed -i 's|EquipTrack Inventory Backend|Inventar Pro Backend|g' setup-raspi.sh
sed -i 's|EquipTrack-Backend|Inventar Pro Backend|g' setup-raspi.sh
sed -i 's|EquipTrack erfolgreich|Inventar Pro erfolgreich|g' setup-raspi.sh
sed -i 's|u equiptrack|u inventarpro|g' setup-raspi.sh
```

- [ ] **Step 4: Zusammenfassungs-Block am Ende aktualisieren**

Finde den Block mit `EquipTrack erfolgreich eingerichtet!` am Ende und stelle sicher dass er so aussieht:

```bash
echo "════════════════════════════════════════════"
echo "  Inventar Pro erfolgreich eingerichtet!"
echo "════════════════════════════════════════════"
echo ""
echo "  Backend-URL:  http://${PI_IP}:${BACKEND_PORT}"
echo "  API-Docs:     http://${PI_IP}:${BACKEND_PORT}/docs"
echo ""
echo "  Logs:         journalctl -u inventarpro -f"
echo "  Neustart:     systemctl restart inventarpro"
echo "  Status:       systemctl status inventarpro"
echo ""
echo "  ➜ Diese URL in der App eintragen:"
echo "    http://${PI_IP}:${BACKEND_PORT}"
echo ""
echo "════════════════════════════════════════════"
```

- [ ] **Step 5: Cloudflare-Tunnel-Integration hinzufügen**

Füge VOR dem Zusammenfassungs-Block eine Abfrage für den Cloudflare Tunnel ein:

```bash
# ────────────────────────────────────────────
# Optional: Cloudflare Tunnel
# ────────────────────────────────────────────
echo ""
read -p "Cloudflare Tunnel einrichten für Internet-Zugang? (j/n): " SETUP_TUNNEL
if [[ "$SETUP_TUNNEL" == "j" || "$SETUP_TUNNEL" == "J" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [ -f "$SCRIPT_DIR/setup-cloudflare-tunnel.sh" ]; then
    bash "$SCRIPT_DIR/setup-cloudflare-tunnel.sh"
  else
    warn "setup-cloudflare-tunnel.sh nicht gefunden — Tunnel-Setup übersprungen"
    info "Führe später manuell aus: bash setup-cloudflare-tunnel.sh"
  fi
else
  info "Cloudflare Tunnel übersprungen — kann später mit 'bash setup-cloudflare-tunnel.sh' eingerichtet werden"
fi
```

- [ ] **Step 6: Script validieren (Syntax-Check)**

```bash
bash -n setup-raspi.sh && echo "Syntax OK" || echo "Syntax ERROR"
```

Erwartete Ausgabe: `Syntax OK`

- [ ] **Step 7: Finale Kontrolle — alle EquipTrack-Referenzen entfernt?**

```bash
grep -n "equiptrack\|EquipTrack\|8000" setup-raspi.sh
```

Erwartete Ausgabe: keine Treffer (oder nur Kommentare die du bewusst gelassen hast).

- [ ] **Step 8: Commit**

```bash
git add setup-raspi.sh
git commit -m "fix: update setup-raspi.sh for Inventar Pro (port 8002, new service name)"
```

---

## Task 2: Raspberry Pi Setup-Anleitung

**Files:**
- Create: `docs/RASPI_SETUP.md`

- [ ] **Step 1: Erstelle docs/RASPI_SETUP.md**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/RASPI_SETUP.md
git commit -m "docs: add Raspberry Pi setup guide"
```

---

## Task 3: Script auf dem Pi testen (manueller Test)

Dieser Task wird **auf dem Raspberry Pi** ausgeführt, nicht auf dem PC.

- [ ] **Step 1: Dateien auf den Pi kopieren**

Auf dem Windows-PC:
```powershell
scp -r "C:\Users\lukas\OneDrive\Desktop\Final-main(1)\Final-main" pi@PI-IP:~/inventarpro
```
Ersetze `PI-IP` durch die tatsächliche IP des Pi (z.B. `192.168.1.100`).

- [ ] **Step 2: Script ausführen**

Auf dem Pi per SSH:
```bash
cd ~/inventarpro
chmod +x setup-raspi.sh setup-cloudflare-tunnel.sh
sudo bash setup-raspi.sh
```

Folge den Anweisungen. Bei der Cloudflare-Frage: `n` eingeben wenn noch nicht einrichten.

- [ ] **Step 3: Verifizieren**

```bash
# Service-Status
sudo systemctl status inventarpro

# API testen
curl -s http://localhost:8002/api/ | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK:', d.get('message'))"
```

Erwartete Ausgabe: `OK: Inventory Management System API`

- [ ] **Step 4: Neustart-Test**

```bash
sudo reboot
```

Nach dem Neustart (ca. 30 Sek warten):
```bash
ssh pi@PI-IP
curl http://localhost:8002/api/
```

Erwartete Ausgabe: API antwortet ohne manuellen Start.

- [ ] **Step 5: Von außen testen**

Auf dem PC im Browser:
```
http://PI-IP:8002/docs
```

FastAPI-Dokumentation muss erscheinen.
