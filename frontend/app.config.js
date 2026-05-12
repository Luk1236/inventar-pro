// app.config.js – dynamische Expo-Konfig
//
// Steuert sich über zwei Environment-Variablen:
//
// 1. EXPO_PUBLIC_BACKEND_URL = Backend-URL (kommt in extra)
//    Lokal (Expo Go):    EXPO_PUBLIC_BACKEND_URL=http://192.168.1.xxx:8002
//    Cloudflare-Tunnel:  EXPO_PUBLIC_BACKEND_URL=https://xxx.cfargotunnel.com
//    Web via Nginx:      EXPO_PUBLIC_BACKEND_URL=   (leer → relative URLs)
//
// 2. EXPO_GO_MODE=1 = Expo Go Kompatibilitäts-Modus
//    → Sentry-Plugin wird entfernt (nicht in Expo Go ladbar)
//    → newArchEnabled=false (Expo Go nutzt eigene Architektur)
//
// Verwendung:
//   Native Build:  npx expo start         (alle Features)
//   Expo Go:       npm run start:expogo   (kompatibler Modus mit Tunnel)

const appJson = require('./app.json');

const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
const isExpoGoMode = process.env.EXPO_GO_MODE === '1';

module.exports = () => {
  // Basis-Config aus app.json
  const expo = { ...appJson.expo };

  // === Backend-URL injizieren ===
  expo.extra = {
    ...(expo.extra || {}),
    // undefined → Fallback im Code greift; '' → relative URLs (Nginx-Betrieb)
    EXPO_PUBLIC_BACKEND_URL:
      backendUrl !== undefined ? backendUrl : 'http://localhost:8002',
  };

  // === Sentry-Plugin nur einbinden wenn Modul installiert ist ===
  // Verhindert: "Failed to resolve plugin for module '@sentry/react-native/expo'"
  // wenn @sentry/react-native nicht in node_modules ist.
  let sentryAvailable = false;
  if (!isExpoGoMode) {
    try {
      require.resolve('@sentry/react-native/expo');
      sentryAvailable = true;
    } catch {
      sentryAvailable = false;
    }
  }

  // === Plugins-Filter ===
  expo.plugins = (expo.plugins || []).filter((p) => {
    const name = typeof p === 'string' ? p : Array.isArray(p) ? p[0] : null;
    // Sentry-Plugin nur wenn verfügbar UND nicht im Expo-Go-Mode
    if (name === '@sentry/react-native/expo') {
      return sentryAvailable;
    }
    return true;
  });

  // === Expo-Go-Kompatibilität ===
  if (isExpoGoMode) {
    console.log('🟢 EXPO GO MODE: Sentry deaktiviert, New Architecture aus');
    // New Architecture deaktivieren — Expo Go nutzt eigene Architektur
    expo.newArchEnabled = false;
  } else if (sentryAvailable) {
    console.log('🔵 NATIVE BUILD MODE: Volle Features inkl. Sentry');
  } else {
    console.log('🟡 NATIVE BUILD MODE: Sentry-Modul nicht installiert — Plugin übersprungen');
  }

  return { expo };
};
