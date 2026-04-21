# Inventar Pro - Event Equipment & Rental Management System

Inventar Pro ist ein **professionelles Lagerverwaltungssystem** für Mietfirmen, die Event-Equipment verwalten müssen (Bühnenequipment, Beleuchtung, Soundanlagen, u.v.m.).

Das System verwaltet den kompletten Lifecycle von Mietequipment: vom Warehouse über Bookings und Events bis zur Rückgabe und Wartung.

---

## 🎯 Features Übersicht

- ✅ **Article Management** - Inventarverwaltung mit QR/Barcode-Scanning
- ✅ **Bookings & Events** - Buchungsverwaltung mit Overbooking-Schutz
- ✅ **Packing Lists** - Automatische Pick/Return-Slips für Events
- ✅ **Maintenance Tracking** - Wartungsplanung & DGUV-Inspektionen
- ✅ **Warehouse Management** - Lagercracks/Regalverwaltung
- ✅ **Customer & Supplier Management** - Kontaktverwaltung
- ✅ **Invoicing** - Automatische Rechnungsgenerierung
- ✅ **Crew Planning** - Mitarbeiterzuordnung & Tourenplanung
- ✅ **Audit Logs** - Vollständige Nachverfolgung aller Aktionen
- ✅ **Real-time Updates** - WebSocket für Live-Daten
- ✅ **PDF/Excel/CSV Export** - Verschiedene Export-Formate
- ✅ **Offline Support** (Mobile) - Funktioniert auch ohne Internet

**39 APIs, 100% getestet und produktionsbereit** ✅

---

## 🛠️ Tech Stack

### Backend
- **FastAPI** (Python 3.11+) - Modernes asynchrones Framework
- **MongoDB** - NoSQL Datenbank
- **Motor** - Asynchroner MongoDB-Treiber
- **WebSocket** - Real-time Updates
- **APScheduler** - Automatisierte Tasks (z.B. tägliche Backups)
- **JWT + Bcrypt** - Sichere Authentifizierung

### Frontend
- **React Native** mit Expo
- **iOS/Android/Web** Support
- **QR Code Scanner**
- **PDF Generation**
- **Dark Mode**

---

## ⚙️ System Requirements

### Für Development
- **Python 3.11+** ([Download](https://python.org))
- **Node.js 18+** ([Download](https://nodejs.org))
- **MongoDB 6.0+** ([Download](https://www.mongodb.com/try/download/community) oder [Atlas Cloud](https://www.mongodb.com/cloud/atlas))
- **Git**
- Windows/Mac/Linux

### Für Production (Raspberry Pi)
- Raspberry Pi 4 (4GB RAM empfohlen)
- Raspberry Pi OS (64-bit)
- siehe [DEPLOYMENT_ANLEITUNG.md](DEPLOYMENT_ANLEITUNG.md)

---

## 🚀 Quick Start

### 1️⃣ Backend Setup

```bash
# Abhängigkeiten installieren
cd backend
pip install -r requirements.txt

# MongoDB muss laufen (lokal oder Cloud)
# Lokal: mongod
# oder Cloud: MongoDB Atlas Cluster

# Backend starten
python server.py
# Server läuft auf http://localhost:8002
```

**⚠️ Wichtig:** Wenn Sie Fehler wie `Microsoft Visual C++ 14.0 required` bekommen:
- **Windows**: Installieren Sie [Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- **Linux/Mac**: Development Headers: `sudo apt-get install python3-dev` (Ubuntu)

### 2️⃣ Frontend Setup

```bash
# Abhängigkeiten installieren
cd frontend
npm install
# oder: yarn install

# Build erstellen
npm run build
# oder für Mobile: eas build --platform ios  (benötigt EAS Account)

# Development Server starten (Expo)
npm start
# oder: expo start
```

### 3️⃣ Login & Test

**Admin-Account:**
- Username: `Admin`
- Password: wird beim ersten Serverstart aus `ADMIN_PASSWORD` in [`backend/.env`](backend/.env) gelesen (mindestens 12 Zeichen, keine Trivial-Defaults).
- Beispiel in `backend/.env` setzen:
  ```
  ADMIN_PASSWORD=<dein-sicheres-passwort>
  ```
- Fehlt die Variable oder ist sie zu schwach, startet der Server nicht.

---

## 📱 Benutzung

### Web/Desktop (Browser)
```bash
cd frontend
npm start
# Scannen Sie den QR-Code oder öffnen Sie http://localhost:8081
```

### Mobile (iOS/Android)
1. Installieren Sie die Expo Go App ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
2. Scannen Sie den QR-Code vom `npm start` oder `expo start`

### APK für Android
```bash
cd frontend
eas build --platform android --type apk
# APK wird generiert und kann direkt installiert werden
```

---

## 🐛 Troubleshooting

### ❌ „Backend nicht erreichbar. Läuft der Server auf Port 8002?"
**Lösung:**
1. Überprüfen Sie, ob der Backend läuft: `python backend/server.py`
2. Überprüfen Sie `frontend/app.json` - die `EXPO_PUBLIC_BACKEND_URL` muss gesetzt sein:
```json
"extra": {
  "EXPO_PUBLIC_BACKEND_URL": "http://localhost:8002"
}
```

### ❌ MongoDB Connection Error
**Lösung:**
1. Stellen Sie sicher, dass MongoDB läuft
2. Lokal: `mongod` starten
3. Cloud: MongoDB Atlas Cluster in `backend/.env` konfigurieren:
```
MONGODB_URL=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/
```

### ❌ Python-Module nicht gefunden
**Lösung:**
```bash
# Virtual Environment erstellen
python -m venv venv

# Aktivieren
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Dependencies installieren
pip install -r backend/requirements.txt
```

### ❌ npm install fehlgeschlagen
**Lösung:**
```bash
# Cache clearen
npm cache clean --force

# Neu installieren
npm install
```

---

## 📚 API Dokumentation

Wenn der Backend läuft (`http://localhost:8002`):
- **Swagger UI**: http://localhost:8002/docs
- **ReDoc**: http://localhost:8002/redoc

Die API ist vollständig dokumentiert mit allen 39 Endpoints.

---

## 🧪 Tests

### Backend Tests
```bash
cd backend
pytest
# oder spezifische Tests:
pytest tests/test_auth.py -v
pytest tests/test_bookings.py -v
```

### Frontend Tests
```bash
cd frontend
npm test
# oder:
jest --watch
```

---

## 📦 Deployment

Siehe [DEPLOYMENT_ANLEITUNG.md](DEPLOYMENT_ANLEITUNG.md) für:
- Raspberry Pi OS Setup
- Docker Deployment
- APK Build & Android Installation
- Produktionsumgebung

Siehe auch [FEATURE_CHECK.md](FEATURE_CHECK.md) für Feature-Übersicht und [FUNKTIONSLISTE.md](FUNKTIONSLISTE.md) für detaillierte Implementationsstatus.

---

## 📋 Projekt-Status

| Component | Status | Details |
|-----------|--------|---------|
| Backend APIs | ✅ 100% | 39/39 Endpoints getestet |
| Database | ✅ 100% | MongoDB Schema vollständig |
| Authentication | ✅ 100% | JWT + Session Management |
| Frontend | ⚠️ 95% | Auth Fix: BACKEND_URL Konfiguration hinzugefügt |
| QR Scanner | ✅ 100% | Funktioniert auf iOS/Android |
| Maintenance | ✅ 100% | Mit DGUV-Tracking |
| Invoicing | ✅ 100% | AutomaticGenerierung |
| Deployment | ✅ 95% | Raspi & APK Build-ready |

---

## 👨‍💼 Support & Weitere Infos

- **Dokumentation**: Siehe `/docs` Folder
- **Maintenance Guide**: [MAINTENANCE.md](docs/) (if available)
- **Release Notes**: Siehe Git Commits

---

## 📄 Lizenz

[Lizenztyp einfügen]
