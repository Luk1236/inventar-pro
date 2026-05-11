// electron/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { URL: NodeURL } = require('url');

let settingsPath;
app.whenReady().then(() => {
  settingsPath = path.join(app.getPath('userData'), 'inventarpro-settings.json');
}).catch(() => {});
// Fallback for synchronous access before ready (rare)
try { settingsPath = path.join(app.getPath('userData'), 'inventarpro-settings.json'); } catch { settingsPath = path.join(__dirname, 'settings.json'); }

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch (e) {
    console.error('Settings load error:', e);
  }
  return {};
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  } catch (e) {
    console.error('Settings save error:', e);
  }
}

let mainWindow = null;

async function createWindow() {
  const settings = loadSettings();

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
      webSecurity: false, // file:// → LAN-Backend (CORS-Bypass für lokale Desktop-App)
    },
    show: false,
  });

  // Load the Expo web build
  const indexPath = path.join(__dirname, 'web-dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath);
  } else {
    // Fallback: show setup page if web-dist not built yet
    mainWindow.loadURL('data:text/html,<h2 style="font-family:sans-serif;padding:40px">Inventar Pro<br><br><small>Bitte zuerst den Web-Build erstellen:<br><code>cd frontend && npx expo export --platform web --output-dir ../electron/web-dist</code></small></h2>');
  }

  mainWindow.once('ready-to-show', async () => {
    mainWindow.show();
    if (!settings.serverUrl) {
      const url = await showUrlInputWindow();
      settings.serverUrl = url || 'http://localhost:8002';
      saveSettings(settings);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function showUrlInputWindow() {
  return new Promise((resolve) => {
    let resolved = false;

    const inputWin = new BrowserWindow({
      width: 500,
      height: 280,
      modal: true,
      parent: mainWindow,
      resizable: false,
      title: 'Server-URL einrichten',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body{font-family:sans-serif;padding:24px;margin:0;background:#fff}
  h3{margin-top:0;font-size:16px}
  p{font-size:13px;color:#555;margin:4px 0 12px}
  input{width:100%;box-sizing:border-box;padding:8px;font-size:14px;border:1px solid #ccc;border-radius:4px}
  button{margin-top:12px;padding:8px 20px;cursor:pointer;background:#0066cc;color:#fff;border:none;border-radius:4px;font-size:14px}
  button:hover{background:#0052a3}
  #error{color:red;font-size:12px;min-height:18px;margin-top:6px}
</style>
</head><body>
<h3>Server-URL einrichten</h3>
<p>Gib die URL deines Inventar Pro Backends ein:</p>
<input id="url" type="text" placeholder="http://192.168.1.x:8002" />
<div id="error"></div>
<button onclick="submit()">Speichern</button>
<script>
  document.getElementById('url').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') submit();
  });
  function submit() {
    const url = document.getElementById('url').value.trim();
    document.getElementById('error').textContent = '';
    window.electronAPI.saveUrl(url);
  }
  window.electronAPI.onUrlError(function(msg) {
    document.getElementById('error').textContent = msg;
  });
</script>
</body></html>`;

    inputWin.loadURL(
      'data:text/html;charset=utf-8,' + encodeURIComponent(html)
    );
    inputWin.setMenuBarVisibility(false);

    const saveUrlListener = (event, rawUrl) => {
      try {
        const parsed = new NodeURL(rawUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error('Nur http:// oder https:// erlaubt');
        }
        resolved = true;
        inputWin.close();
        resolve(rawUrl);
      } catch (e) {
        event.sender.send('url-error', e.message || 'Ungültige URL');
      }
    };
    ipcMain.once('save-url', saveUrlListener);

    inputWin.on('closed', () => {
      ipcMain.removeListener('save-url', saveUrlListener);
      if (!resolved) resolve(null);
    });
  });
}

// IPC: get settings
ipcMain.handle('get-settings', () => loadSettings());

// IPC: save settings
ipcMain.handle('save-settings', (event, newSettings) => {
  const settings = { ...loadSettings(), ...newSettings };
  saveSettings(settings);
  return settings;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
