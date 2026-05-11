# Inventar Pro — Native Mobile App (Android + iOS)

Komplette Schritt-für-Schritt Anleitung zum Bauen und Veröffentlichen der App.

---

## 🚀 SCHNELLSTART: Expo Go (kein Build, 2 Min Setup)

**Schnellster Weg zum Testen — keine Apple/Google-Accounts, kein Build, keine Wartezeit.**

### Auf dem Handy
1. **Expo Go App** installieren (Play Store / App Store)

### Am Windows-PC
```powershell
cd "C:\Users\lukas\OneDrive\Desktop\Lager\Final-main\frontend"
npm install      # einmalig
npm run start:expogo
```

Was passiert:
- `EXPO_GO_MODE=1` wird gesetzt → `app.config.js` deaktiviert Sentry + New Architecture
- Expo startet Dev-Server mit Tunnel (funktioniert auch über Mobilfunk)
- Im Terminal erscheint ein **QR-Code**

### QR-Code scannen
- **Android:** Expo Go App → "Scan QR code" → QR im Terminal scannen
- **iOS:** Native Kamera-App → auf QR halten → "In Expo Go öffnen"

App lädt 30-60s, dann ist der Login-Screen da.

### Backend-URL setzen
Im Login-Screen → "Server konfigurieren" → URL eintragen:
- Cloudflare: `https://<dein-tunnel>.cfargotunnel.com`
- Tailscale: `http://<tailscale-ip>:8002`
- Lokales WLAN: `http://<pi-ip>:8002`

→ Login → fertig!

### Alternative ohne Tunnel (schneller, aber nur im gleichen WLAN)
```powershell
npm run start:expogo:lan
```

### Was funktioniert in Expo Go?

| Feature | Expo Go | Native Build | Hinweis |
|---------|:-------:|:-----------:|---------|
| Kamera, Barcode-Scanner | ✅ | ✅ | |
| Foto-Auswahl | ✅ | ✅ | |
| Face-ID / Fingerabdruck | ✅ | ✅ | |
| PDF drucken | ✅ | ✅ | |
| 3D-Lager-Visualisierung | ✅ | ✅ | |
| WebView | ✅ | ✅ | |
| Lokale Notifications | ✅ | ✅ | DGUV-Erinnerungen, Wartung |
| Remote Push-Notifications | ✅ Expo-Token | ✅ FCM/APNS-Token | Beide via `/api/push-tokens` registriert |
| Sentry Crash-Reports | ❌ skip | ✅ aktiv | Code skipt Init in Expo Go automatisch |
| Background-Tasks | ⚠️ limitiert | ✅ | |
| Deep-Linking | ⚠️ via `exp://` | ✅ native Scheme | |

**Code-Anpassungen** (alle automatisch — du musst nichts tun):
- `sentryService.ts` erkennt Expo Go via `Constants.executionEnvironment` und überspringt `Sentry.init`
- `pushNotificationService.ts` liest `projectId` dynamisch aus `Constants.expoConfig.extra.eas.projectId`
- Backend-Endpoint `POST /api/push-tokens` speichert Token unabhängig vom Typ

**Wenn die App in Expo Go crasht:** siehe Phase 2 unten (Development Build).

---

## Was du schon hast (im Repo)

✅ Android-Package konfiguriert (`com.inventarpro.app`)
✅ iOS Bundle-ID konfiguriert (`com.inventarpro.app`)
✅ iOS Privacy-Strings (Kamera, Foto-Bibliothek, Face-ID)
✅ Alle Native Module installiert (Camera, Notifications, Print, Local-Auth)
✅ EAS-Profile (development, preview, production, production-apk)
✅ App-Icons (`assets/images/icon.png`, `adaptive-icon.png`)

## Was du brauchst

- **Windows-PC** mit Node.js 18+ installiert (für EAS CLI)
- **Expo-Account** (gratis): https://expo.dev/signup
- **Android-Handy** zum Testen (für APK-Sideload)
- **iOS:** Apple Developer Account (99 USD/Jahr) — nur wenn iOS gewünscht
- **Stores:** Google Play 25 USD einmalig + Apple 99 USD/Jahr

---

## Phase 1: Einmaliges Setup (10 Min)

### 1.1 Expo-Account erstellen
1. https://expo.dev/signup → Account anlegen
2. E-Mail bestätigen

### 1.2 EAS CLI installieren (in PowerShell)
```powershell
npm install -g eas-cli
eas --version          # sollte 7.x oder höher anzeigen
eas login              # Browser öffnet, mit Account einloggen
```

### 1.3 EAS-Projekt initialisieren
```powershell
cd "C:\Users\lukas\OneDrive\Desktop\Lager\Final-main\frontend"
eas init
```

- EAS fragt: "Should we create the project?" → **Yes**
- Generiert `expo.extra.eas.projectId` in `app.json` (UUID)
- Diese Änderung committen!

```powershell
git add app.json && git commit -m "feat: EAS project-id" && git push
```

---

## Phase 2: Erster Android-APK Build (~30 Min)

### 2.1 Build starten
```powershell
cd frontend
npm run build:android:apk
```

Was passiert:
- EAS lädt Repo nach Expo-Cloud
- Build auf Linux-Container (~20-30 Min)
- Du kriegst Email + Download-Link für `.apk`

### 2.2 APK auf Handy installieren
1. APK auf Handy schicken (Telegram an dich selbst, Email, Google Drive)
2. Auf dem Handy: **Einstellungen → Sicherheit → "Apps aus unbekannten Quellen"** für deinen Browser/Filemanager erlauben
3. APK öffnen → **Installieren**
4. App startet — Login-Screen erscheint

### 2.3 Backend-URL eingeben
Im Login-Screen unter "Server-URL" eingeben:
- Lokal (gleiches WLAN): `http://<pi-ip>:8002`
- Tailscale: `http://<tailscale-ip>:8002`
- Cloudflare: `https://<dein-tunnel>.cfargotunnel.com`

→ Login mit deinem Inventar-Pro-Account → fertig!

---

## Phase 3: iOS Build (~30 Min Build + Apple-Account)

### 3.1 Apple Developer Account anlegen
- https://developer.apple.com/programs/ → 99 USD/Jahr
- Apple-ID + Zahlungsdaten + Vertrag bestätigen
- **Wartezeit:** typisch 24-48 Stunden bis Account aktiv

### 3.2 iOS-Build starten
```powershell
cd frontend
npm run build:ios
```

EAS fragt nacheinander:
- **Apple-ID:** deine Apple-ID-Email
- **App-Specific-Password:** unter https://appleid.apple.com → Anmelde-Sicherheit → "App-spezifisches Passwort" erstellen
- **Provisioning:** EAS kümmert sich automatisch (lass es)

Build läuft auf macOS-Server (~20-30 Min).

### 3.3 App auf iPhone installieren (3 Wege)

**Weg A: TestFlight (einfachster)**
```powershell
npm run submit:ios
```
- Build wird zu Apple hochgeladen
- TestFlight-App auf iPhone öffnen → Einladung annehmen
- App installieren — bis zu 100 Tester einladen möglich

**Weg B: Ad-hoc** (nur eigene Geräte)
1. UDIDs deiner Test-Geräte holen (https://udid.io)
2. `eas device:create` → Geräte registrieren
3. Build mit `internal` distribution → `.ipa` zum Sideload (via Apple Configurator)

**Weg C: iOS-Simulator** (am Mac)
- In `eas.json` ist `simulator: true` für `preview` schon gesetzt
- `npm run build:ios` → `.app`-Datei
- In Xcode Simulator ziehen → läuft

---

## Phase 4: Store-Release (optional, später)

### Google Play Store

1. https://play.google.com/console → 25 USD einmalig
2. **App-Listing erstellen:**
   - Titel, Kurz-/Lang-Beschreibung
   - Screenshots: 2-8 Stück, mind. 320px, max. 3840px
   - Feature-Grafik: 1024×500
   - App-Icon: existiert (`icon.png`, wird automatisch genutzt)
   - **Datenschutzerklärung URL** (PFLICHT)
3. **App-Privacy-Labels** ausfüllen (welche Daten werden gesammelt)
4. **Production-Build hochladen:**
   ```powershell
   npm run build:android:aab    # erzeugt .aab (Play Store Format)
   npm run submit:android       # lädt direkt nach Play Store
   ```
5. **Google Review:** 1-7 Tage

### Apple App Store

1. Apple Developer Account aktiv
2. **App in App Store Connect erstellen:** https://appstoreconnect.apple.com
3. **App-Listing:** Titel, Beschreibung, Keywords, Screenshots (iPhone + iPad), Datenschutz
4. **Production-Build:**
   ```powershell
   npm run build:ios:store      # erzeugt .ipa
   npm run submit:ios           # lädt nach App Store Connect
   ```
5. In App Store Connect: Build auswählen → "Zur Überprüfung einreichen"
6. **Apple Review:** 1-7 Tage (strenger als Google)

---

## Datenschutzerklärung (PFLICHT für Stores)

Beide Stores verlangen eine öffentlich erreichbare Datenschutzerklärung-URL.

**Optionen:**
- **Generator nutzen:** https://www.iubenda.com (kostenpflichtig) oder https://app-privacy-policy-generator.firebaseapp.com (gratis)
- **Selbst hosten:** als HTML auf eigener Website oder via GitHub Pages
- **Über die Inventar-Pro-App selbst:** unter `https://<deine-cloudflare-url>/datenschutz` (extra Route im Backend einbauen)

**Inhalt der Datenschutzerklärung muss erwähnen:**
- Welche Daten werden gesammelt (z.B. Inventar-Daten, Login-Daten, optional: Standort)
- Wo werden sie gespeichert (z.B. "auf eurem eigenen Raspberry Pi, nicht auf unserem Server")
- Wer hat Zugriff (nur eingeloggte Nutzer)
- Drittanbieter (Sentry für Crash-Reporting!)
- Kontakt für Datenschutz-Anfragen

---

## Update-Strategie

### Variante A: OTA-Updates (EAS Update)
- JavaScript/Assets ohne Store-Review aktualisieren
- ```powershell
  eas update --branch production --message "Bugfix XYZ"
  ```
- Nutzer bekommen Update beim nächsten App-Start
- **Geht nur für JS-Änderungen** — native Module brauchen neuen Build

### Variante B: Neuer Build
- Bei nativen Änderungen (neue Module, App-Icon, etc.)
- `npm run build:android:aab` + `submit:android`
- `npm run build:ios:store` + `submit:ios`
- versionCode/buildNumber wird automatisch hochgezählt (`autoIncrement: true`)

---

## Häufige Probleme

### Build schlägt fehl: "ProjectId not found"
→ `eas init` ausführen (Phase 1.3)

### Build schlägt fehl: "Sentry plugin couldn't find SENTRY_AUTH_TOKEN"
→ Nicht kritisch — Build läuft trotzdem durch, nur Source-Maps werden nicht hochgeladen
→ Optional fixen: https://docs.expo.dev/guides/using-sentry/

### iOS-Build: "No Apple Team configured"
→ EAS fragt beim Build interaktiv nach Apple-ID. Falls Account neu: 24-48h warten

### APK installiert, aber App stürzt sofort ab
→ Backend-URL falsch / nicht erreichbar
→ Im Login-Screen "Server konfigurieren" → richtige URL eintragen
→ Server-Logs anschauen: `sudo journalctl -u inventar-backend -n 50`

### "Backend nicht erreichbar" im Handy-WLAN
→ Backend-URL muss von außen erreichbar sein
→ Lösung: Cloudflare-Tunnel-URL nutzen (siehe `pi-setup/setup-cloudflare-tunnel.sh`)

### Play Store lehnt App ab: "Target API Level zu niedrig"
→ Expo SDK upgraden: `npx expo install expo@latest && npx expo install --fix`

---

## Wichtige Befehle Übersicht

```powershell
# Setup (einmalig)
npm install -g eas-cli
eas login
cd frontend && eas init

# Android
npm run build:android:apk       # APK für Sideload
npm run build:android:aab       # AAB für Play Store
npm run submit:android          # → Play Store

# iOS
npm run build:ios               # APK-Äquivalent für TestFlight
npm run build:ios:store         # für App Store
npm run submit:ios              # → App Store

# Übersicht
eas build:list                  # alle Builds
eas project:info                # Projekt-Status
eas update                      # OTA-Update ohne Store
```

---

## Wo bekomme ich Hilfe?

- **EAS Docs:** https://docs.expo.dev/build/introduction/
- **Expo Discord:** https://chat.expo.dev (sehr aktiv, schnelle Antworten)
- **Dieses Repo:** Issue bei Problemen aufmachen
