# Deployment — Inventar Pro

**Stand:** 2026-04-21

Diese Anleitung deckt die drei aktuellen Deployment-Pfade ab:

1. **Android-APK** für Mitarbeitergeräte (über EAS Build)
2. **Windows-Desktop** als portable `.exe` (Electron)
3. **Server (Backend + MongoDB)** auf Raspberry Pi

---

## 1️⃣ Android-APK (EAS Build)

Die App ist als Expo-Projekt mit EAS-Build-Config eingerichtet — siehe [`frontend/eas.json`](frontend/eas.json).

**Voraussetzungen:**
- Expo-Account ([expo.dev](https://expo.dev) — kostenlos)
- EAS CLI: `npm install -g eas-cli`
- Einmalig: `eas login`

**APK bauen (Preview-Profil, für internes Testing empfohlen):**
```bash
cd frontend
eas build --platform android --profile preview
```

**Produktions-APK:**
```bash
eas build --platform android --profile production
```

**Build-Dauer:** ca. 10–15 Minuten (läuft auf Expos Cloud-Buildern).

Nach Fertigstellung erscheint der Download-Link in der Konsole und unter [expo.dev](https://expo.dev) → dein Projekt → „Builds".

**Auf Android installieren:**
1. APK herunterladen, aufs Gerät übertragen (USB/Cloud/Email).
2. „Installation aus unbekannten Quellen" für den genutzten Browser/Datei-Manager aktivieren.
3. APK antippen → installieren.

**App-Details (aus [`frontend/app.json`](frontend/app.json)):**
- Name: `Inventar Pro`
- Package: `com.inventarpro.app`
- Slug: `inventarpro`

**Version hochzählen:** Geschieht automatisch bei jedem Commit per Git-Hook ([`frontend/scripts/bump-version.js`](frontend/scripts/bump-version.js)).

---

## 2️⃣ Windows-Desktop (Electron, portable .exe)

Der Electron-Wrapper lädt den statischen Expo-Web-Build und spricht das Backend über eine konfigurierbare URL an.

**Build-Schritte:**
```bash
# 1. Web-Build aus dem Frontend erzeugen
cd frontend
npx expo export --platform web --output-dir ../electron/web-dist

# 2. Electron-Build starten
cd ../electron
npm install                # einmalig
npm run build              # erzeugt dist/InventarPro.exe (portable, x64)
```

Ergebnis: `electron/dist/InventarPro.exe` — einzelne, portable Datei (keine Installation nötig). Beim ersten Start wird die Backend-URL per Dialog abgefragt und in `%APPDATA%\inventarpro-desktop\inventarpro-settings.json` gespeichert.

Alternative für Debug/Entwicklung ohne Packaging:
```bash
cd electron
npm start
```

---

## 3️⃣ Server auf Raspberry Pi

Ein Setup-Skript richtet MongoDB, Python-Backend und systemd-Service ein.

**Voraussetzungen:**
- Raspberry Pi 4 (4 GB RAM empfohlen), Raspberry Pi OS 64-bit
- Pi per SSH erreichbar

**Setup:**
```bash
# Auf dem Pi:
git clone <dein-repo> inventarpro
cd inventarpro
sudo ./setup-raspi.sh
```

Das Skript installiert u. a.:
- MongoDB + Autostart
- Python 3 + Abhängigkeiten
- Avahi (mDNS) — der Pi ist danach als `inventarpro.local` im LAN erreichbar
- systemd-Service für das FastAPI-Backend (Port `8002`)

Details + Troubleshooting: siehe [`setup-raspi.sh`](setup-raspi.sh) und den Design-Spec-Abschnitt in [`docs/`](docs/).

**Port im Netzwerk freigeben (Cloudflare-Tunnel — optional):**
```bash
./setup-cloudflare-tunnel.sh
```

---

## ✅ Nach Installation

Die Android-App funktioniert nach Erstverbindung weitgehend **offline**:
- Daten werden lokal gecached
- Synchronisation sobald Netzwerk verfügbar

**Erster Login:** Admin-Account mit dem in `backend/.env` gesetzten `ADMIN_PASSWORD`.

---

## 🔄 Updates

- **Android:** Neue APK bauen (s. o.), über alte Version installieren.
- **Desktop:** Neue `InventarPro.exe` erzeugen und die alte ersetzen.
- **Server (Pi):** `git pull && systemctl restart inventarpro-backend` (Service-Name ggf. anpassen).

---

## 🆘 Troubleshooting

**EAS-Build schlägt fehl:**
- Logs in der Build-Detail-Seite auf [expo.dev](https://expo.dev) prüfen.
- Build ggf. erneut starten — manchmal transiente Infrastruktur-Fehler.

**Electron-App zeigt „Bitte zuerst Web-Build erstellen":**
- `electron/web-dist/index.html` fehlt. Schritt 1 oben (Web-Build) ausführen.

**Android-Installation blockiert:**
- Einstellungen → Sicherheit → „Unbekannte Quellen" für die installierende App aktivieren.
