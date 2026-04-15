# Client-Builds — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inventar Pro Windows Installer (.exe) und Android APK bauen — beide Clients verbinden sich mit dem Raspberry Pi Backend.

**Architecture:** Electron lädt den Expo Web-Build aus `electron/web-dist/` und verpackt ihn als NSIS-Installer. Die Android APK wird via Expo EAS Build in der Cloud gebaut. Beide Clients lesen die Pi-IP aus den App-Einstellungen.

**Tech Stack:** Electron 28, electron-builder 24, Expo 54, EAS CLI, React Native

---

## Datei-Übersicht

| Datei | Aktion | Zweck |
|-------|--------|-------|
| `frontend/app.json` | Modify | Branding von EquipTrack → Inventar Pro, Android-Paketname |
| `electron/build.bat` | Modify | Node.js-Check hinzufügen, Dateigrößenausgabe |

---

## Task 1: app.json — Branding auf Inventar Pro aktualisieren

**Files:**
- Modify: `frontend/app.json`

- [ ] **Step 1: Lese die aktuelle app.json**

```bash
cat frontend/app.json
```

Notiere: `name`, `slug`, `android.package`, `version`.

- [ ] **Step 2: Aktualisiere Branding und Android-Paketname**

Ersetze den gesamten Inhalt von `frontend/app.json` durch:

```json
{
  "expo": {
    "name": "Inventar Pro",
    "slug": "inventarpro",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "inventarpro",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "package": "com.inventarpro.app",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#007AFF"
      },
      "permissions": [
        "CAMERA",
        "INTERNET",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ],
      "edgeToEdgeEnabled": true,
      "usesCleartextTraffic": true
    },
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#000"
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    },
    "extra": {
      "EXPO_PUBLIC_BACKEND_URL": "http://localhost:8002"
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app.json
git commit -m "fix: rename app to Inventar Pro in app.json (package, slug, name)"
```

---

## Task 2: Electron Windows .exe bauen

**Files:**
- Modify: `electron/build.bat`

Dieser Task wird auf dem Windows-PC ausgeführt. Node.js muss installiert sein.

- [ ] **Step 1: Node.js prüfen**

```bat
node --version
npm --version
```

Erwartete Ausgabe: `v18.x.x` oder höher. Falls nicht installiert: https://nodejs.org herunterladen.

- [ ] **Step 2: build.bat mit Node.js-Check und Größenausgabe verbessern**

Ersetze den Inhalt von `electron/build.bat` durch:

```bat
@echo off
echo === Inventar Pro Windows Build ===
echo.

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo FEHLER: Node.js ist nicht installiert.
    echo Bitte von https://nodejs.org herunterladen und installieren.
    exit /b 1
)

echo [1/3] Expo Web-Build erstellen...
cd ..\frontend
call npx expo export --platform web --output-dir ..\electron\web-dist
if %ERRORLEVEL% NEQ 0 (
    echo FEHLER: Expo-Build fehlgeschlagen
    exit /b 1
)

cd ..\electron
echo [2/3] Dependencies pruefen...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo FEHLER: npm install fehlgeschlagen
    exit /b 1
)

echo [3/3] Installer bauen...
call npx electron-builder --win --x64
if %ERRORLEVEL% NEQ 0 (
    echo FEHLER: electron-builder fehlgeschlagen
    exit /b 1
)

echo.
echo === Build abgeschlossen ===
echo Installer: electron\dist\Inventar Pro Setup 1.0.0.exe
for %%F in ("dist\Inventar Pro Setup 1.0.0.exe") do echo Dateigroesse: %%~zF Bytes
pause
```

- [ ] **Step 3: build.bat ausführen**

Auf dem Windows-PC in einem CMD-Fenster:

```bat
cd C:\Users\lukas\OneDrive\Desktop\Final-main(1)\Final-main\electron
build.bat
```

Dauer: ca. 3-8 Minuten (Expo-Build ~2 Min + electron-builder ~2 Min).

- [ ] **Step 4: Installer verifizieren**

```bat
dir "dist\Inventar Pro Setup 1.0.0.exe"
```

Erwartete Ausgabe: Datei vorhanden, Größe ~80-150 MB.

- [ ] **Step 5: Installer testen (manuell)**

1. Doppelklick auf `electron\dist\Inventar Pro Setup 1.0.0.exe`
2. Installation durchführen (Standard-Verzeichnis OK)
3. App starten über Desktop-Verknüpfung "Inventar Pro"
4. Settings öffnen → Server-URL eingeben: `http://PI-IP:8002`
5. Dashboard laden → Verbindung prüfen

- [ ] **Step 6: Commit**

```bash
git add electron/build.bat
git commit -m "feat: add Node.js check and file size output to build.bat"
```

---

## Task 3: Android APK via Expo EAS Build

Dieser Task erfordert einen kostenlosen Expo-Account (https://expo.dev).

- [ ] **Step 1: EAS CLI global installieren**

```bash
npm install -g eas-cli
eas --version
```

Erwartete Ausgabe: `eas-cli/x.x.x ...`

- [ ] **Step 2: Expo-Account anlegen (einmalig)**

Falls noch kein Account vorhanden:
1. Öffne https://expo.dev im Browser
2. Klicke "Sign Up"
3. Account mit E-Mail erstellen (kostenlos)

- [ ] **Step 3: EAS Login**

```bash
cd frontend
eas login
```

E-Mail und Passwort des Expo-Accounts eingeben.

Erwartete Ausgabe:
```
Logged in as <dein-username>
```

- [ ] **Step 4: EAS-Projekt initialisieren**

```bash
eas init
```

Wenn gefragt: "Link to existing project?" → `No` (neues Projekt)
App-Name: `Inventar Pro`

Das aktualisiert `app.json` mit einer `projectId`. Prüfe danach:

```bash
grep projectId app.json
```

Es muss eine UUID stehen, z.B. `"projectId": "abc123..."`.

- [ ] **Step 5: eas.json prüfen**

```bash
cat eas.json
```

Der `preview`-Build muss `"buildType": "apk"` enthalten (bereits konfiguriert):

```json
"preview": {
  "distribution": "internal",
  "android": {
    "buildType": "apk"
  }
}
```

Falls nicht vorhanden, `eas.json` entsprechend anpassen.

- [ ] **Step 6: APK bauen**

```bash
eas build --platform android --profile preview
```

Wenn gefragt:
- "Generate new Android Keystore?" → `Yes` (automatisch generieren)
- Weitere Fragen → Enter (Standardwerte)

Dauer: ca. 10-20 Minuten in der Expo-Cloud.

Fortschritt im Browser verfolgen: https://expo.dev/accounts/<username>/projects/inventarpro/builds

- [ ] **Step 7: APK herunterladen**

Nach dem Build erscheint in der Terminal-Ausgabe:
```
✅ Build finished
Download: https://expo.dev/artifacts/eas/...
```

APK herunterladen und auf Android-Gerät übertragen:
- Via USB: APK auf Gerät kopieren
- Via Browser: URL direkt auf dem Gerät öffnen

- [ ] **Step 8: APK auf Android installieren**

Auf dem Android-Gerät:
1. Einstellungen → Sicherheit → "Unbekannte Quellen" aktivieren (oder "Apps aus unbekannten Quellen")
2. APK-Datei öffnen und installieren
3. App starten
4. Settings → Server-URL: `http://PI-IP:8002`
5. Dashboard laden → Verbindung prüfen

- [ ] **Step 9: Commit (app.json mit projectId)**

```bash
cd ..
git add frontend/app.json
git commit -m "feat: link Expo project for EAS build (projectId added)"
```

---

## Task 4: Cloudflare-URL in beiden Clients eintragen (optional)

Wenn der Cloudflare-Tunnel läuft (aus `setup-cloudflare-tunnel.sh`), können beide Clients auch über das Internet auf den Pi zugreifen.

- [ ] **Step 1: Cloudflare-URL ermitteln**

Auf dem Pi:
```bash
sudo systemctl status cloudflared
# oder
cat /etc/cloudflared/config.yml | grep hostname
```

Die URL hat das Format: `https://inventarpro-xxxxx.trycloudflare.com`

- [ ] **Step 2: URL in Electron-App eintragen**

App starten → Settings → Server-URL:
```
https://inventarpro-xxxxx.trycloudflare.com
```
Speichern.

- [ ] **Step 3: URL in Android-App eintragen**

App öffnen → Settings → Server-URL:
```
https://inventarpro-xxxxx.trycloudflare.com
```
Speichern.

- [ ] **Step 4: Verbindung von außen testen**

Auf einem Gerät das NICHT im gleichen WLAN ist (z.B. Mobilfunk):
- Browser: `https://inventarpro-xxxxx.trycloudflare.com/api/`
- Erwartete Ausgabe: `{"message": "Inventory Management System API", ...}`
