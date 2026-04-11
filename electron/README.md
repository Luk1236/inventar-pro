# Inventar Pro — Windows Desktop App

## Build erstellen

```bat
cd electron
build.bat
```

Erstellt `dist/Inventar Pro Setup 1.0.0.exe`

## Entwicklung (ohne Build)

```bash
# Web-Build erstellen
cd frontend && npx expo export --platform web --output-dir ../electron/web-dist

# Electron starten
cd ../electron && npm install && npx electron .
```

## Installation

1. `Inventar Pro Setup 1.0.0.exe` ausführen
2. Installationsverzeichnis wählen
3. App starten
4. Beim ersten Start: Server-URL eingeben

## Server-URL ändern

Settings → Server-URL → neue URL eingeben → Speichern
