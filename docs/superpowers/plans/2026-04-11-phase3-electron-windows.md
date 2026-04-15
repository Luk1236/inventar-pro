# Phase 3: Electron Windows-App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inventar Pro als native Windows-Desktop-App (.exe Installer) — Electron-Wrapper um Expo-Web-Build, verbindet sich mit dem Raspberry Pi Backend.

**Architecture:** Expo exportiert einen statischen Web-Build (`frontend/dist/`). Electron lädt diesen lokal. Beim ersten Start fragt ein Dialog nach der Pi-Server-URL, speichert sie in AppData. Der NSIS-Installer bündelt Electron-Runtime + Web-Build zu einer `InventarPro-Setup-1.0.0.exe`.

**Tech Stack:** Electron 28, electron-builder (NSIS), Node.js, Expo Web Export

---

## Kontext für den Implementierer

- Projekt-Root: `C:\Users\lukas\OneDrive\Desktop\Final-main(1)\Final-main\`
- Frontend: `frontend/` (Expo/React Native, Expo Router)
- Backend läuft auf Raspberry Pi, Clients verbinden sich via IP oder Cloudflare-URL
- Electron-Dateien kommen in neues Verzeichnis `electron/` im Projekt-Root
- Build-Output: `electron/dist/InventarPro-Setup-1.0.0.exe`
- Node.js und npm müssen installiert sein (für electron-builder)

---

## Task 1: Electron-Verzeichnis und package.json

**Files:**
- Create: `electron/package.json`
- Create: `electron/.gitignore`

- [ ] **Step 1: Lege electron/ Verzeichnis an**

```bash
mkdir -p electron
```

- [ ] **Step 2: Erstelle electron/package.json**

```json
{
  "name": "inventarpro-desktop",
  "version": "1.0.0",
  "description": "Inventar Pro — Desktop App für Windows",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder --win --x64",
    "build:web": "cd ../frontend && npx expo export --platform web"
  },
  "build": {
    "appId": "com.inventarpro.desktop",
    "productName": "Inventar Pro",
    "directories": {
      "output": "dist"
    },
    "files": [
      "main.js",
      "preload.js",
      "web-dist/**/*"
    ],
    "win": {
      "target": "nsis",
      "icon": "icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "Inventar Pro"
    }
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.0.0"
  },
  "dependencies": {
    "electron-settings": "^4.0.2"
  }
}
```

- [ ] **Step 3: Erstelle electron/.gitignore**

```
node_modules/
dist/
web-dist/
*.ico
```

- [ ] **Step 4: Dependencies installieren**

```bash
cd electron && npm install
```

Erwartete Ausgabe: `node_modules/` angelegt, kein Fehler.

- [ ] **Step 5: Commit**

```bash
git add electron/package.json electron/.gitignore
git commit -m "feat: add electron package.json for Windows desktop app"
```

---

## Task 2: Electron Hauptprozess (main.js)

**Files:**
- Create: `electron/main.js`

- [ ] **Step 1: Erstelle electron/main.js**

```javascript
// electron/main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Settings-Datei im AppData-Verzeichnis
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return {};
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

let mainWindow = null;

async function createWindow() {
  const settings = loadSettings();

  // Beim ersten Start: Server-URL abfragen
  if (!settings.serverUrl) {
    const { response, checkboxChecked } = await dialog.showMessageBox({
      type: 'question',
      title: 'Server-URL einrichten',
      message: 'Bitte gib die URL deines Inventar Pro Servers ein.\n\nBeispiele:\n• Lokales Netzwerk: http://192.168.1.100:8002\n• Internet: https://dein-tunnel.cfargotunnel.com',
      buttons: ['Eingabe öffnen'],
      noLink: true,
    });

    // Einfaches Input-Fenster via prompt-ähnlichem Fenster
    settings.serverUrl = await showUrlInputWindow();
    if (!settings.serverUrl) {
      settings.serverUrl = 'http://localhost:8002';
    }
    saveSettings(settings);
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Inventar Pro',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  // Web-Build laden
  const indexPath = path.join(__dirname, 'web-dist', 'index.html');
  mainWindow.loadFile(indexPath);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Kleines Fenster für URL-Eingabe
function showUrlInputWindow() {
  return new Promise((resolve) => {
    const inputWin = new BrowserWindow({
      width: 500,
      height: 220,
      resizable: false,
      modal: true,
      parent: mainWindow,
      title: 'Server-URL eingeben',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           padding: 20px; background: #1a1a1a; color: #fff; margin: 0; }
    h3 { margin: 0 0 12px; font-size: 15px; }
    input { width: 100%; box-sizing: border-box; padding: 8px 12px;
            border-radius: 6px; border: 1px solid #444; background: #2a2a2a;
            color: #fff; font-size: 14px; margin-bottom: 12px; }
    button { padding: 8px 20px; border-radius: 6px; border: none;
             background: #007AFF; color: #fff; font-size: 14px; cursor: pointer; }
    p { font-size: 12px; color: #888; margin: 0 0 8px; }
  </style>
</head>
<body>
  <h3>Server-URL</h3>
  <p>Lokales Netzwerk: http://192.168.1.x:8002 &nbsp;|&nbsp; Internet: https://xxx.cfargotunnel.com</p>
  <input type="text" id="url" placeholder="http://192.168.1.100:8002" value="http://192.168.1.100:8002" />
  <button onclick="save()">Speichern</button>
  <script>
    function save() {
      const url = document.getElementById('url').value.trim();
      window.__electronBridge.saveUrl(url);
    }
    document.getElementById('url').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
    });
  </script>
</body>
</html>`;

    const tmpHtmlPath = path.join(app.getPath('temp'), 'url-input.html');
    fs.writeFileSync(tmpHtmlPath, html);
    inputWin.loadFile(tmpHtmlPath);

    ipcMain.once('save-url', (event, url) => {
      inputWin.close();
      resolve(url || 'http://localhost:8002');
    });

    inputWin.on('closed', () => {
      resolve(null);
    });
  });
}

// IPC Handlers
ipcMain.handle('get-settings', () => loadSettings());
ipcMain.handle('save-settings', (event, newSettings) => {
  const settings = { ...loadSettings(), ...newSettings };
  saveSettings(settings);
  return settings;
});
ipcMain.on('save-url', (event, url) => {
  // wird von showUrlInputWindow behandelt
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

- [ ] **Step 2: Commit**

```bash
git add electron/main.js
git commit -m "feat: add Electron main process with URL setup dialog"
```

---

## Task 3: Preload-Script (preload.js)

**Files:**
- Create: `electron/preload.js`

- [ ] **Step 1: Erstelle electron/preload.js**

```javascript
// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Exponiert sichere API an den Renderer (Web-App)
contextBridge.exposeInMainWorld('__electronBridge', {
  // Settings abrufen
  getSettings: () => ipcRenderer.invoke('get-settings'),

  // Settings speichern
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // URL-Eingabe senden (für URL-Input-Fenster)
  saveUrl: (url) => ipcRenderer.send('save-url', url),

  // Ist Electron-Umgebung?
  isElectron: true,
});
```

- [ ] **Step 2: Commit**

```bash
git add electron/preload.js
git commit -m "feat: add Electron preload script with settings bridge"
```

---

## Task 4: Frontend anpassen — Server-URL aus Electron-Bridge lesen

**Ziel:** Wenn die App in Electron läuft, liest `apiService.ts` die Server-URL aus `window.__electronBridge.getSettings()` statt aus `.env`.

**Files:**
- Modify: `frontend/services/apiService.ts`

- [ ] **Step 1: Lese den URL-Initialisierungs-Teil von apiService.ts**

```bash
head -25 frontend/services/apiService.ts
```

Der aktuelle Code (Zeile ~8–11):
```typescript
const BACKEND_URL: string =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ??
  process.env.EXPO_PUBLIC_BACKEND_URL ??
  'http://localhost:8000';
```

- [ ] **Step 2: Mache BACKEND_URL dynamisch**

Ersetze den statischen `BACKEND_URL`-Block durch eine Funktion:

```typescript
// Dynamic backend URL — reads from Electron settings if running in desktop app
let _backendUrlOverride: string | null = null;

function getBackendUrl(): string {
  // Electron override (set via settings)
  if (_backendUrlOverride) return _backendUrlOverride;
  // Environment variable (web/native)
  return (
    Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ??
    process.env.EXPO_PUBLIC_BACKEND_URL ??
    'http://localhost:8002'
  );
}

export function setBackendUrl(url: string): void {
  _backendUrlOverride = url.replace(/\/$/, ''); // strip trailing slash
}

// On web in Electron: load server URL from Electron bridge
if (typeof window !== 'undefined' && (window as any).__electronBridge) {
  (window as any).__electronBridge.getSettings().then((settings: any) => {
    if (settings?.serverUrl) {
      setBackendUrl(settings.serverUrl);
    }
  });
}
```

- [ ] **Step 3: Ersetze alle `BACKEND_URL` Verwendungen durch `getBackendUrl()`**

```bash
grep -n "BACKEND_URL" frontend/services/apiService.ts | grep -v "const _backendUrl\|getBackendUrl\|setBackendUrl"
```

Für jede gefundene Zeile, ersetze `BACKEND_URL` durch `getBackendUrl()`.

**Beispiel:**
```typescript
// Vorher:
const response = await fetch(`${BACKEND_URL}${API_PREFIX}/refresh-token`, ...

// Nachher:
const response = await fetch(`${getBackendUrl()}${API_PREFIX}/refresh-token`, ...
```

- [ ] **Step 4: Commit**

```bash
git add frontend/services/apiService.ts
git commit -m "feat: make backend URL dynamic for Electron desktop app"
```

---

## Task 5: Expo Web-Build + Electron-Build-Script

**Files:**
- Create: `electron/build.bat` (Windows Build-Script)
- Create: `electron/README.md`

- [ ] **Step 1: Prüfe ob Expo-Web-Export funktioniert**

```bash
cd frontend && npx expo export --platform web --output-dir ../electron/web-dist
```

Erwartete Ausgabe: `electron/web-dist/index.html` existiert.

Falls Fehler auftreten:
- `npx expo install` zuerst ausführen
- Fehlermeldung lesen und beheben

- [ ] **Step 2: Erstelle electron/build.bat**

```bat
@echo off
echo === Inventar Pro Windows Build ===
echo.

echo [1/3] Expo Web-Build erstellen...
cd ..\frontend
call npx expo export --platform web --output-dir ..\electron\web-dist
if %ERRORLEVEL% NEQ 0 (
  echo FEHLER: Expo-Build fehlgeschlagen
  exit /b 1
)
cd ..\electron

echo [2/3] npm dependencies prüfen...
call npm install
if %ERRORLEVEL% NEQ 0 (
  echo FEHLER: npm install fehlgeschlagen
  exit /b 1
)

echo [3/3] Electron-Installer bauen...
call npx electron-builder --win --x64
if %ERRORLEVEL% NEQ 0 (
  echo FEHLER: electron-builder fehlgeschlagen
  exit /b 1
)

echo.
echo === Build abgeschlossen ===
echo Installer: electron\dist\InventarPro Setup 1.0.0.exe
pause
```

- [ ] **Step 3: Erstelle electron/README.md**

```markdown
# Inventar Pro — Windows Desktop App

## Voraussetzungen
- Node.js 18+ installiert
- npm installiert

## Build erstellen

```bat
cd electron
build.bat
```

Erstellt `dist/InventarPro Setup 1.0.0.exe`

## Entwicklung (ohne Build)

```bash
# Erst Web-Build erstellen
cd frontend && npx expo export --platform web --output-dir ../electron/web-dist

# Dann Electron starten
cd ../electron && npm install && npx electron .
```

## Installation

1. `InventarPro Setup 1.0.0.exe` ausführen
2. Installationsverzeichnis wählen
3. App starten
4. Beim ersten Start: Server-URL eingeben (z.B. `http://192.168.1.100:8002`)

## Server-URL ändern

Settings → Server-URL → neue URL eingeben → Speichern → App neu starten
```

- [ ] **Step 4: Icon erstellen (Placeholder)**

Falls keine `icon.ico` vorhanden:
```bash
# Placeholder-Icon — später durch echtes Icon ersetzen
# electron-builder kann auch ohne Icon bauen, gibt aber eine Warnung
# Entweder eine .ico-Datei in electron/ ablegen oder in package.json entfernen:
# Entferne "icon": "icon.ico" aus dem build.win-Abschnitt falls kein Icon vorhanden
```

Wenn kein Icon vorhanden: lösche `"icon": "icon.ico"` aus `electron/package.json`.

- [ ] **Step 5: Test-Build ausführen**

```bash
cd electron && npx electron .
```

Erwartete Ausgabe: Electron-Fenster öffnet sich, URL-Eingabe-Dialog erscheint.

Falls Fehler: Fehlermeldung in der Konsole lesen und fixen.

- [ ] **Step 6: Commit**

```bash
git add electron/build.bat electron/README.md
git commit -m "feat: add Windows build script and Electron README"
```

---

## Task 6: Settings-Screen — Server-URL-Einstellung

**Ziel:** Im Settings-Screen der App kann die Server-URL geändert und gespeichert werden (funktioniert auf Web, Native und Electron).

**Files:**
- Modify: `frontend/app/settings/index.tsx`
- Modify: `frontend/services/apiService.ts` (export setBackendUrl bereits in Task 4 hinzugefügt)

- [ ] **Step 1: Prüfe ob Server-URL-Setting bereits vorhanden ist**

```bash
grep -n "serverUrl\|Server.URL\|server_url\|BackendUrl" frontend/app/settings/index.tsx | head -10
```

Falls vorhanden: überspringen.

Falls nicht vorhanden:

- [ ] **Step 2: State und Load-Funktion hinzufügen**

Füge in der Settings-Komponente hinzu:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setBackendUrl } from '../../services/apiService';

// State
const [serverUrl, setServerUrl] = useState('');
const [serverUrlSaving, setServerUrlSaving] = useState(false);
const [serverUrlStatus, setServerUrlStatus] = useState<'idle' | 'ok' | 'error'>('idle');

// In useEffect laden
useEffect(() => {
  AsyncStorage.getItem('server_url').then((url) => {
    if (url) setServerUrl(url);
  });
}, []);
```

- [ ] **Step 3: Save-Funktion hinzufügen**

```typescript
const saveServerUrl = async () => {
  if (!serverUrl.trim()) return;
  setServerUrlSaving(true);
  try {
    // Verbindungstest
    const testUrl = serverUrl.replace(/\/$/, '');
    const resp = await fetch(`${testUrl}/api/`, { method: 'GET' });
    if (!resp.ok && resp.status !== 404) throw new Error(`Status: ${resp.status}`);
    
    await AsyncStorage.setItem('server_url', testUrl);
    setBackendUrl(testUrl);
    
    // Electron: auch in Bridge speichern
    if (typeof window !== 'undefined' && (window as any).__electronBridge) {
      await (window as any).__electronBridge.saveSettings({ serverUrl: testUrl });
    }
    
    setServerUrlStatus('ok');
    Alert.alert('Gespeichert', 'Server-URL wurde gespeichert. Starte die App neu für volle Wirkung.');
  } catch (e) {
    setServerUrlStatus('error');
    Alert.alert('Verbindungsfehler', `Server nicht erreichbar: ${serverUrl}\n\nBitte URL prüfen.`);
  } finally {
    setServerUrlSaving(false);
    setTimeout(() => setServerUrlStatus('idle'), 3000);
  }
};
```

- [ ] **Step 4: UI hinzufügen**

Füge in der JSX-Ausgabe des Settings-Screens hinzu (z.B. nach dem Passwort-Sektion):

```tsx
{/* Server-URL */}
<View style={[styles.section, { backgroundColor: colors.card }]}>
  <Text style={[styles.sectionTitle, { color: colors.text }]}>Server-Verbindung</Text>
  <Text style={[styles.label, { color: colors.subText }]}>
    Server-URL (Raspberry Pi IP oder Cloudflare-URL)
  </Text>
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <TextInput
      style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
      value={serverUrl}
      onChangeText={setServerUrl}
      placeholder="http://192.168.1.100:8002"
      placeholderTextColor={colors.subText}
      autoCapitalize="none"
      keyboardType="url"
    />
    <TouchableOpacity
      onPress={saveServerUrl}
      disabled={serverUrlSaving}
      style={[styles.saveBtn, { backgroundColor: serverUrlStatus === 'ok' ? '#34C759' : serverUrlStatus === 'error' ? '#FF3B30' : '#007AFF' }]}
    >
      {serverUrlSaving
        ? <ActivityIndicator size="small" color="#fff" />
        : <Ionicons name={serverUrlStatus === 'ok' ? 'checkmark' : 'save-outline'} size={18} color="#fff" />
      }
    </TouchableOpacity>
  </View>
</View>
```

Füge fehlende Styles hinzu:

```typescript
saveBtn: {
  padding: 10,
  borderRadius: 8,
  justifyContent: 'center',
  alignItems: 'center',
  width: 40,
},
label: {
  fontSize: 13,
  marginBottom: 6,
},
input: {
  padding: 10,
  borderRadius: 8,
  borderWidth: 1,
  fontSize: 14,
},
```

- [ ] **Step 5: apiService beim App-Start aus AsyncStorage laden**

In `frontend/services/apiService.ts`, füge hinzu (nach dem `setBackendUrl` Export):

```typescript
// On app start: load server URL from AsyncStorage (set by settings screen)
if (typeof window !== 'undefined') {
  AsyncStorage.getItem('server_url').then((url) => {
    if (url) setBackendUrl(url);
  });
}
```

Füge den Import hinzu:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
```

- [ ] **Step 6: Commit**

```bash
git add frontend/app/settings/index.tsx frontend/services/apiService.ts
git commit -m "feat: add server URL configuration in settings screen"
```
