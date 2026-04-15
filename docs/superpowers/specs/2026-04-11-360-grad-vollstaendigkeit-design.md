# 360° Test, Debugging & Vollständigkeit — Design Spec

**Datum:** 2026-04-11  
**Scope:** Inventar Pro — vollständiger Test aller Features, Bug-Fixing, Client-Pakete, Erweiterungen

---

## Ziel

Das System soll produktionsreif sein: alle bestehenden Features getestet und funktionsfähig, bekannte Bugs gefixt, und auf drei Plattformen auslieferbar (Web, Android APK, Windows Electron-App) mit optionalem Internet-Zugang via Cloudflare Tunnel.

---

## Architektur

**Server (Raspberry Pi):** FastAPI 8002 + MongoDB — bleibt unverändert als einzige Datenquelle  
**Clients:** Alle Clients (Web-Browser, Android APK, Windows Electron) verbinden sich zur Pi-IP oder Cloudflare-URL  
**Keine lokale Datenhaltung auf Clients** — Pi ist Single Source of Truth

---

## Phase 1: 360°-Testing

### 1.1 Backend API (automatisiert, Pytest)

Vollständige Pytest-Suite für alle ~170 Endpoints:

| Modul | Endpoints | Test-Typen |
|-------|-----------|------------|
| Auth | login, refresh, register, change-password | happy-path, falsches PW, abgelaufener Token |
| Articles | CRUD, archived, search, QR-Code | valid/invalid data, missing fields, archived routing |
| Bookings | erstellen, stornieren, verlängern | Überbuchen, fehlende Artikel, Datum-Konflikte |
| Invoices | erstellen, bezahlen, PDF | ohne event_id, doppelte Zahlung |
| Events | CRUD, Teilnehmer | vergangene Events, leere Events |
| Users | approve, reject, list pending | doppelte Genehmigung, nicht-existente User |
| Reports | dashboard, low-stock, inventory-value | leere DB, Grenzwerte |
| CSV Import | Stapelimport | fehlende Felder, doppelte codes, invalid CSV |
| Dashboard | Kennzahlen | Konsistenz mit DB-Zustand |

### 1.2 Frontend-Screens (manuelle Checkliste)

Systematische Durchsicht aller ~80 Screens:

- **Auth-Flow:** Login, Registrierung, Passwort-vergessen-Modal
- **Dashboard:** Kennzahlen, Charts, Navigation zu Details
- **Artikel:** Liste, Detail, Erstellen, Bearbeiten, Archivieren, QR-Code-Scan
- **Buchungen:** Liste, Neue Buchung, Detail, Stornieren
- **Rechnungen:** Liste, Erstellen, Detail, Bezahlen
- **Events:** Liste, Erstellen, Detail, Teilnehmer
- **User-Management:** Ausstehend-Tab, Alle-Tab, Genehmigen/Ablehnen
- **Settings:** Server-URL-Einstellung (neu), Profil, Passwort ändern
- **Navigation:** Deep-Links, Back-Button, Tab-Wechsel, Pull-to-Refresh

### 1.3 End-to-End Integration

Kritische Workflows vollständig durchspielen:

1. Artikel anlegen (manuell + CSV) → in Liste sichtbar → buchen → Bestand prüfen
2. User registrieren → Admin genehmigt → Login → Dashboard sehen
3. Event erstellen → Buchung auf Event → Rechnung erstellen → bezahlen
4. Artikel archivieren → nicht mehr buchbar → in Archiv sichtbar

---

## Phase 2: Bug-Fixing

Bekannte offene Issues (vor Testing zu fixen):

| Bug | Ort | Fix |
|-----|-----|-----|
| `/api/v1/articles/archived` Routing-Konflikt | `backend/server.py` | `archived`-Route vor `{article_id}`-Route registrieren |
| Passwort-Änderung fehlt Backend-Endpoint | `backend/server.py` | `POST /auth/change-password` implementieren |

Weitere Bugs werden während Phase 1 dokumentiert und in Phase 2 gefixt.

---

## Phase 3: Erweiterungen

### 3.1 WebSocket (Echtzeit-Updates)

**Backend:**
- `GET /ws` WebSocket-Endpoint in `server.py`
- ConnectionManager-Klasse: verbundene Clients verwalten
- Events broadcasten bei: Artikel-Änderung, neue Buchung, Buchungs-Stornierung
- Event-Format: `{"type": "article_updated", "id": "...", "data": {...}}`

**Frontend:**
- Hook `useWebSocket(url)` in `frontend/hooks/useWebSocket.ts`
- Automatisches Reconnect bei Verbindungsabbruch (exponential backoff)
- Dashboard-Screen: WebSocket-Hook verwenden, bei Events neu laden
- Artikel-Liste: bei `article_updated`/`article_created` automatisch aktualisieren
- Fallback: normales Pull-to-Refresh wenn WebSocket nicht verbunden

### 3.2 Seriennummern-Tracking

**Frontend (Backend-Felder existieren bereits):**
- Neuer Screen `frontend/app/admin/serial-numbers.tsx`
  - Liste aller Seriennummern mit Status (verfügbar/verliehen/defekt/verloren)
  - Filter nach Status und Artikel
- Artikel-Detail-Screen: neuer "Seriennummern"-Tab
  - Zeigt alle Seriennummern des Artikels
  - Status ändern (Admin)

### 3.3 Dashboard-Erweiterungen

- **Top 10 meist-gebuchte Artikel** — neues Widget
- **Offene Rechnungen-Summe** — Kennzahl-Karte
- **Inventarwert-Anzeige** — bereits im Backend gefixt, Frontend soll Wert anzeigen

### 3.4 Passwort-Änderung (Backend-Endpoint)

- `POST /auth/change-password` — Body: `{current_password, new_password}`
- Validierung: aktuelles Passwort korrekt, neues PW min. 8 Zeichen
- Frontend-Modal existiert bereits (`frontend/app/index.tsx`), nur Endpoint-Anbindung fehlt

---

## Phase 4: Client-Pakete

### 4.1 Windows Electron-App

**Technologie:** Electron + Expo Web Build

**Ablauf:**
1. Expo Web-Build: `npx expo export --platform web` → `dist/` Ordner
2. Electron-Wrapper: lädt `dist/index.html` lokal
3. Settings-Dialog beim ersten Start: Pi-IP oder Cloudflare-URL eingeben
4. URL wird in `electron-settings.json` gespeichert (AppData)
5. NSIS-Installer: `InventarPro-Setup-1.0.0.exe`

**Neue Dateien:**
- `electron/main.js` — Electron-Hauptprozess
- `electron/preload.js` — Settings-Persistenz
- `electron/package.json` — Electron-Dependencies
- `electron/installer.nsh` — NSIS-Konfiguration
- `electron/build.sh` — Build-Script

**Installer-Inhalt:** ~80-120MB (Electron-Runtime + Web-Bundle)

### 4.2 Android APK

**Technologie:** Expo EAS Build

**Ablauf:**
1. `eas.json` konfigurieren (preview profile für direkte APK)
2. `eas build --platform android --profile preview`
3. APK herunterladen, direkt installierbar (kein Play Store)

**Server-URL-Einstellung:**
- Gleicher Settings-Screen wie Electron
- URL persistent in AsyncStorage

**Neue/geänderte Dateien:**
- `frontend/eas.json` — EAS Build-Konfiguration
- `frontend/app/settings.tsx` — Server-URL-Setting (erweitert)

### 4.3 Internet-Zugang (Cloudflare Tunnel)

**Setup auf Raspberry Pi:**
1. `cloudflared` installieren
2. `cloudflared tunnel create inventarpro`
3. Tunnel konfigurieren: Port 8002 → öffentliche URL
4. Als systemd-Service einrichten (startet automatisch)

**Resultat:** Stabile HTTPS-URL (z.B. `https://inventarpro-xxx.cfargotunnel.com`)  
**Kosten:** Kostenlos (Cloudflare Free Tier)  
**Kein Port-Forwarding** am Router nötig

**Dokumentation:** `docs/cloudflare-tunnel-setup.md` — Schritt-für-Schritt für Pi

---

## Settings-Screen Erweiterung

Neues Feld "Server-URL" in `frontend/app/settings.tsx`:
- Eingabefeld für Pi-IP (`http://192.168.1.x:8002`) oder Cloudflare-URL
- Speichern-Button → URL in AsyncStorage
- Verbindungstest-Button → zeigt ob Server erreichbar
- `apiService.ts` liest URL dynamisch aus AsyncStorage statt aus `.env`

---

## Nicht im Scope

- Play Store / Apple App Store Veröffentlichung
- Multi-Tenant (mehrere Organisationen)
- Eigene Cloud-Infrastruktur
- iOS-App

---

## Erfolgskriterien

- [ ] Alle Pytest-Tests grün
- [ ] Alle ~80 Frontend-Screens manuell geprüft, keine Abstürze
- [ ] End-to-End-Workflows funktionieren
- [ ] `InventarPro-Setup-1.0.0.exe` installiert und verbindet sich mit Pi
- [ ] Android APK installiert und verbindet sich mit Pi
- [ ] Cloudflare Tunnel läuft, App von extern erreichbar
- [ ] WebSocket: Dashboard aktualisiert sich ohne manuellen Refresh
- [ ] Seriennummern-Screen vorhanden und funktionsfähig
