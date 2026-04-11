// electron/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const settingsPath = path.join(app.getPath('userData'), 'inventarpro-settings.json');

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

function createWindow() {
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
      webSecurity: false,
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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // On first launch: inject server URL prompt if not configured
    if (!settings.serverUrl) {
      mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.executeJavaScript(`
          (function() {
            var url = prompt('Inventar Pro Server-URL eingeben:\\n\\nBeispiele:\\n• Lokal: http://192.168.1.100:8002\\n• Internet: https://xxx.cfargotunnel.com', 'http://192.168.1.100:8002');
            if (url) {
              window.__pendingServerUrl = url.trim().replace(/\\/$/, '');
            }
          })();
        `).catch(() => {});
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
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
