# Phase 4: Android APK & Cloudflare Tunnel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Android APK direkt installierbar (ohne Play Store) + Cloudflare Tunnel auf Raspberry Pi für Internet-Zugang + Setup-Script für Pi.

**Architecture:** Expo EAS Build erstellt die APK in der Cloud (kein lokales Android Studio nötig). Cloudflare Tunnel läuft als systemd-Service auf dem Pi und gibt dem Backend eine stabile HTTPS-URL. Die App-URL wird im Settings-Screen (aus Phase 3) konfiguriert.

**Tech Stack:** Expo EAS Build, Cloudflare Tunnel (`cloudflared`), systemd, bash

---

## Kontext für den Implementierer

- Frontend: `frontend/` — Expo SDK, bereits konfiguriert
- `frontend/app.json` — Expo-Konfiguration, `android.package: "com.equiptrack.inventory"`
- Backend läuft auf Raspberry Pi unter Port 8002
- EAS Build läuft in der Cloud — kein Android Studio lokal nötig
- Cloudflare-Account benötigt (kostenlos unter cloudflare.com)
- Pi muss SSH-Zugang haben für Tunnel-Setup

---

## Task 1: EAS Build konfigurieren

**Files:**
- Create: `frontend/eas.json`

- [ ] **Step 1: Prüfe ob eas.json existiert**

```bash
ls frontend/eas.json 2>/dev/null && echo "EXISTS" || echo "NOT FOUND"
```

Falls nicht vorhanden:

- [ ] **Step 2: Erstelle frontend/eas.json**

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleRelease"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

- [ ] **Step 3: Prüfe app.json Android-Konfiguration**

```bash
cat frontend/app.json | python -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['expo']['android'], indent=2))"
```

Sicherstellen dass folgende Felder vorhanden sind:
- `package`: `"com.equiptrack.inventory"` ✓ (bereits konfiguriert)
- `versionCode`: `1` ✓

Falls `adaptiveIcon.foregroundImage` auf eine nicht-existente Datei zeigt — prüfen:
```bash
ls frontend/assets/images/adaptive-icon.png
```

- [ ] **Step 4: EAS CLI installieren (falls nicht vorhanden)**

```bash
npm install -g eas-cli
eas --version
```

Erwartete Ausgabe: `eas-cli/X.X.X`

- [ ] **Step 5: Commit**

```bash
git add frontend/eas.json
git commit -m "feat: add EAS build configuration for Android APK"
```

---

## Task 2: Android APK bauen

- [ ] **Step 1: EAS Login**

```bash
cd frontend && eas login
```

Falls kein Expo-Account: Account anlegen auf https://expo.dev (kostenlos).

- [ ] **Step 2: EAS Projekt verknüpfen**

```bash
cd frontend && eas init
```

Folge den Anweisungen. Das erstellt/aktualisiert `app.json` mit einer `extra.eas.projectId`.

- [ ] **Step 3: APK Build starten**

```bash
cd frontend && eas build --platform android --profile preview
```

Erwartete Ausgabe:
```
Build started
Build URL: https://expo.dev/accounts/.../builds/...
Waiting for build to complete...
```

Der Build läuft in der Expo-Cloud (5-15 Minuten).

- [ ] **Step 4: APK herunterladen**

Nach dem Build:
```bash
eas build:list --platform android --limit 1
```

Kopiere den Download-Link aus der Ausgabe oder öffne ihn im Browser.

Speichere die APK als `InventarPro-1.0.0.apk`.

- [ ] **Step 5: APK testen**

Installation auf Android-Gerät:
1. Datei auf das Gerät übertragen (USB oder E-Mail)
2. In Einstellungen → Sicherheit → "Unbekannte Quellen" erlauben
3. APK öffnen und installieren
4. App starten → Server-URL eingeben → Login testen

- [ ] **Step 6: Commit**

```bash
git add frontend/app.json  # falls eas init app.json geändert hat
git commit -m "feat: configure EAS project ID for Android APK builds"
```

---

## Task 3: Cloudflare Tunnel Setup-Script für Raspberry Pi

**Files:**
- Create: `setup-cloudflare-tunnel.sh` (im Projekt-Root)

- [ ] **Step 1: Erstelle setup-cloudflare-tunnel.sh**

```bash
#!/bin/bash
# setup-cloudflare-tunnel.sh
# Führe dieses Script auf dem Raspberry Pi aus, nicht auf dem PC!
# Voraussetzung: Cloudflare-Account und cloudflared installiert
# 
# Ausführen: chmod +x setup-cloudflare-tunnel.sh && sudo ./setup-cloudflare-tunnel.sh

set -e

echo "=== Inventar Pro — Cloudflare Tunnel Setup ==="
echo ""

# 1. cloudflared installieren
echo "[1/5] cloudflared installieren..."
if ! command -v cloudflared &> /dev/null; then
    # Für Raspberry Pi (ARM64)
    ARCH=$(uname -m)
    if [ "$ARCH" = "aarch64" ]; then
        wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -O /usr/local/bin/cloudflared
    elif [ "$ARCH" = "armv7l" ]; then
        wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm -O /usr/local/bin/cloudflared
    else
        wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared
    fi
    chmod +x /usr/local/bin/cloudflared
    echo "    cloudflared installiert: $(cloudflared --version)"
else
    echo "    cloudflared bereits installiert: $(cloudflared --version)"
fi

# 2. Bei Cloudflare einloggen
echo ""
echo "[2/5] Cloudflare Login..."
echo "    Ein Browser-Fenster öffnet sich. Falls kein Browser: besuche den angezeigten Link."
cloudflared tunnel login

# 3. Tunnel erstellen
TUNNEL_NAME="inventarpro"
echo ""
echo "[3/5] Tunnel '$TUNNEL_NAME' erstellen..."
if cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
    echo "    Tunnel '$TUNNEL_NAME' existiert bereits."
    TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
else
    cloudflared tunnel create "$TUNNEL_NAME"
    TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
fi
echo "    Tunnel-ID: $TUNNEL_ID"

# 4. Konfigurationsdatei erstellen
echo ""
echo "[4/5] Konfiguration erstellen..."
CONFIG_DIR="$HOME/.cloudflared"
mkdir -p "$CONFIG_DIR"

cat > "$CONFIG_DIR/config.yml" << EOF
tunnel: $TUNNEL_ID
credentials-file: $CONFIG_DIR/$TUNNEL_ID.json

ingress:
  - service: http://localhost:8002
EOF

echo "    Konfiguration gespeichert: $CONFIG_DIR/config.yml"

# 5. systemd-Service einrichten (automatischer Start)
echo ""
echo "[5/5] systemd-Service einrichten..."
cloudflared service install

echo ""
echo "=== Setup abgeschlossen ==="
echo ""
echo "Starte den Tunnel:"
echo "  sudo systemctl start cloudflared"
echo "  sudo systemctl enable cloudflared  # Autostart beim Booten"
echo ""
echo "Tunnel-Status prüfen:"
echo "  sudo systemctl status cloudflared"
echo "  cloudflared tunnel info $TUNNEL_NAME"
echo ""
echo "Deine öffentliche URL wird in der Ausgabe von 'cloudflared tunnel info' angezeigt."
echo "Format: https://<tunnel-id>.cfargotunnel.com"
echo ""
echo "WICHTIG: Diese URL in der App unter Settings → Server-URL eintragen!"
```

- [ ] **Step 2: Script ausführbar machen**

```bash
chmod +x setup-cloudflare-tunnel.sh
```

- [ ] **Step 3: Dokumentation erstellen**

Erstelle `docs/cloudflare-tunnel-setup.md`:

```markdown
# Cloudflare Tunnel — Setup-Anleitung

## Voraussetzungen

- Raspberry Pi mit laufendem Inventar Pro Backend (Port 8002)
- Internet-Verbindung auf dem Pi
- Kostenloser Cloudflare-Account (https://cloudflare.com)

## Setup (einmalig)

1. Script auf den Pi kopieren:
   ```bash
   scp setup-cloudflare-tunnel.sh pi@192.168.1.x:~/
   ```

2. Auf dem Pi ausführen:
   ```bash
   chmod +x setup-cloudflare-tunnel.sh
   sudo ./setup-cloudflare-tunnel.sh
   ```

3. Browser-Link öffnen wenn aufgefordert (Cloudflare-Login)

4. Nach dem Setup:
   ```bash
   sudo systemctl start cloudflared
   sudo systemctl enable cloudflared
   ```

5. URL herausfinden:
   ```bash
   cloudflared tunnel info inventarpro
   ```
   Format: `https://<hash>.cfargotunnel.com`

## URL in der App eintragen

1. App öffnen → Settings
2. Server-URL: `https://<hash>.cfargotunnel.com`
3. Speichern → App neu starten

## Tunnel-Verwaltung

```bash
# Status prüfen
sudo systemctl status cloudflared

# Logs anzeigen
journalctl -u cloudflared -f

# Tunnel stoppen
sudo systemctl stop cloudflared

# Tunnel neustarten
sudo systemctl restart cloudflared
```

## Kosten

Cloudflare Tunnel ist im Free-Tier kostenlos. Kein Port-Forwarding am Router nötig.
```

- [ ] **Step 4: Commit**

```bash
git add setup-cloudflare-tunnel.sh docs/cloudflare-tunnel-setup.md
git commit -m "feat: add Cloudflare Tunnel setup script and documentation for Raspberry Pi"
```

---

## Task 4: App-Icon für Android

**Ziel:** Die APK hat ein eigenes App-Icon (nicht den Standard-Expo-Hintergrund).

**Files:**
- Check: `frontend/assets/images/adaptive-icon.png`
- Check: `frontend/assets/images/icon.png`

- [ ] **Step 1: Prüfe ob Icons vorhanden sind**

```bash
ls -la frontend/assets/images/
```

Benötigte Dateien:
- `icon.png` — 1024×1024px (App-Icon)
- `adaptive-icon.png` — 1024×1024px (Android Adaptive Icon, nur das Vordergrundbild)

- [ ] **Step 2: Falls Icons fehlen oder Placeholder sind**

Falls `adaptive-icon.png` ein Expo-Standard-Icon ist, erstelle ein einfaches Icon:

```bash
# Prüfe Bildgröße
python -c "from PIL import Image; img = Image.open('frontend/assets/images/adaptive-icon.png'); print(img.size)"
```

Falls PIL nicht installiert: `pip install Pillow`

Falls Icons in Ordnung: überspringen.

Falls neue Icons erstellt werden müssen: Platziere 1024×1024px PNG-Dateien in `frontend/assets/images/`. Das Design ist dem Entwickler überlassen — ein schlichtes blaues Icon mit einem "I" reicht.

- [ ] **Step 3: app.json Icon-Pfade prüfen**

```bash
grep -A5 '"icon"\|"adaptiveIcon"' frontend/app.json
```

Stelle sicher dass die Pfade auf existierende Dateien zeigen.

- [ ] **Step 4: Commit falls Änderungen**

```bash
git add frontend/assets/images/ frontend/app.json
git commit -m "fix: ensure app icons are correctly configured for Android APK"
```

---

## Task 5: APK Build verifizieren & Release-Vorbereitung

- [ ] **Step 1: Versionsnummer in app.json prüfen**

```bash
python -c "import json; d=json.load(open('frontend/app.json')); print('Version:', d['expo']['version'], 'Code:', d['expo']['android']['versionCode'])"
```

Für Release: version `1.0.0`, versionCode `1` ✓

- [ ] **Step 2: Build-Ausgabe dokumentieren**

Erstelle `docs/releases/android-v1.0.0.md`:

```markdown
# Android Release v1.0.0

**Datum:** 2026-04-11  
**Build:** EAS Preview  
**APK:** InventarPro-1.0.0.apk

## Installation

1. APK-Datei auf Android-Gerät übertragen
2. Einstellungen → Sicherheit → "Apps aus unbekannten Quellen" aktivieren
3. APK öffnen → Installieren
4. App starten → Server-URL eingeben

## Server-URL-Formate

- Lokales Netzwerk: `http://192.168.1.x:8002`
- Internet (Cloudflare): `https://<hash>.cfargotunnel.com`

## Bekannte Einschränkungen

- HTTP (nicht HTTPS) nur im lokalen Netzwerk funktioniert auf modernen Android-Versionen (API 28+) standardmäßig nicht — Cloudflare Tunnel (HTTPS) für Internet-Zugang empfohlen
- Für lokales HTTP: `android:usesCleartextTraffic="true"` in app.json nötig (bereits konfiguriert via expo-permissions)
```

- [ ] **Step 3: Cleartext Traffic für lokales HTTP erlauben (falls nötig)**

Android 9+ blockiert HTTP (nicht HTTPS) standardmäßig. Für LAN-Zugang (http://192.168.x.x) muss das erlaubt werden.

Prüfe `frontend/app.json`:

```bash
grep -A20 '"android"' frontend/app.json | grep -i "cleartext\|usesCleartext"
```

Falls nicht vorhanden, füge in `app.json` unter `android` hinzu:

```json
"android": {
  "package": "com.equiptrack.inventory",
  "versionCode": 1,
  "usesCleartextTraffic": true,
  ...
}
```

- [ ] **Step 4: Finaler APK-Build**

```bash
cd frontend && eas build --platform android --profile preview
```

- [ ] **Step 5: Commit**

```bash
git add frontend/app.json docs/releases/
git commit -m "feat: configure Android cleartext traffic for local network access"
```

---

## Task 6: Gesamt-Test aller Clients

- [ ] **Step 1: Web-Browser Test**

```bash
cd frontend && npx expo start --port 8081
```

Öffne `http://localhost:8081` im Browser. Login → Dashboard → Artikel anlegen → Buchung erstellen → Rechnung erstellen.

- [ ] **Step 2: Electron-App Test**

```bash
cd electron && npx electron .
```

Gib `http://localhost:8002` als Server-URL ein. Login → Dashboard → alle Kern-Funktionen testen.

- [ ] **Step 3: Android APK Test**

APK installieren und testen:
- Lokales Netzwerk: `http://192.168.1.x:8002` eingeben
- Internet: Cloudflare-URL eingeben

- [ ] **Step 4: Cloudflare Tunnel Test**

```bash
# Auf dem Pi: Tunnel starten
sudo systemctl start cloudflared

# URL prüfen
cloudflared tunnel info inventarpro

# Von externem Netzwerk testen
curl https://<hash>.cfargotunnel.com/api/
```

Erwartete Ausgabe: `{"message": "Inventory Management System API", "version": "1.0.0"}`

- [ ] **Step 5: Final Commit**

```bash
git add .
git commit -m "feat: complete Phase 4 — Android APK and Cloudflare Tunnel ready"
```
