# Mobile App Build (EAS)

## Setup einmalig

```bash
npm install -g eas-cli
eas login                              # Expo-Account
eas build:configure                    # initialisiert Projekt-ID falls noch nicht da
```

## Build-Profile

| Profil | Output | Zweck |
|--------|--------|-------|
| `development` | APK + dev-client | Lokale Entwicklung mit Hot-Reload |
| `preview` | APK | Internes Testing (Sideload) |
| `production-apk` | APK | Direkter Download / Sideload |
| `production` | AAB (Android) | Play Store Submission |

## Builds starten

```bash
# Android APK für Tests:
eas build --platform android --profile preview

# Android Production für Play Store:
eas build --platform android --profile production

# iOS (braucht Apple Developer Account, $99/Jahr):
eas build --platform ios --profile production
```

## Submission

```bash
# Play Store (interner Track):
eas submit --platform android --latest

# App Store:
eas submit --platform ios --latest
```

## Versions-Verwaltung

`appVersionSource: remote` in eas.json → Expo verwaltet versionCode/buildNumber automatisch via `autoIncrement: true`.

Manuelle Bumps in `app.json`:
- `expo.version` (semantisch: 1.0.59)
- `expo.android.versionCode` (Integer für Play Store)

## Backend-URL für Production

Default in `app.json` ist `localhost:8002` — für Production-Builds env-var setzen:

```bash
EXPO_PUBLIC_BACKEND_URL=https://deine-domain.ts.net eas build --platform android --profile production
```

Oder in `app.json` `extra.EXPO_PUBLIC_BACKEND_URL` direkt vor dem Build ändern.

Alternative: User kann im Login-Screen die Server-URL selbst eingeben (bereits implementiert seit v1.1.1.x).

## Erforderliche Assets

- `assets/images/icon.png` — 1024×1024 (App Store Icon)
- `assets/images/adaptive-icon.png` — 1024×1024 (Android Foreground)
- `assets/images/splash-icon.png` — 200×200 (Splash)
- `assets/images/favicon.png` — 48×48 (Web)

## Häufige Probleme

- **Build fehlgeschlagen wegen native dependencies:** `npx expo install --check` und Versionen abgleichen
- **Cleartext traffic in Production:** App lehnt HTTP ab → HTTPS-Backend nötig (Tailscale Funnel)
- **Camera-Permission fehlt:** Bereits in `android.permissions` deklariert
