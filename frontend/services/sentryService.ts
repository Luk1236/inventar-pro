/**
 * Sentry Error Tracking
 *
 * Requires: npx expo install @sentry/react-native
 * DSN: set EXPO_PUBLIC_SENTRY_DSN in frontend/.env
 *
 * Gracefully no-ops if:
 *  - Package not installed
 *  - DSN not configured
 *  - Running in Expo Go (native module not available)
 */
import Constants from 'expo-constants';

// In Expo Go läuft kein nativer Sentry-Code → Init würde crashen.
// Wir erkennen Expo Go via Constants.executionEnvironment.
// Werte: 'standalone' (Native Build), 'storeClient' (Expo Go), 'bare' (Bare Workflow)
const isExpoGo = Constants.executionEnvironment === 'storeClient';

let Sentry: any = null;

if (!isExpoGo) {
  try {
    Sentry = require('@sentry/react-native');
  } catch {
    // Package not installed yet — tracking disabled
  }
}

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
let initialized = false;

export function initSentry() {
  if (isExpoGo) {
    console.log('[Sentry] Skipped — running in Expo Go (use native build for crash tracking)');
    return;
  }
  if (!Sentry || !DSN || initialized) return;
  try {
    Sentry.init({
      dsn: DSN,
      tracesSampleRate: 0.2,       // 20% of transactions traced
      debug: false,
      environment: __DEV__ ? 'development' : 'production',
      beforeSend(event: any) {
        // Strip any PII from user objects before sending
        if (event.user) {
          delete event.user.email;
          delete event.user.ip_address;
        }
        return event;
      },
    });
    initialized = true;
  } catch (e) {
    console.warn('[Sentry] init failed:', e);
  }
}

export function captureError(error: unknown, context?: Record<string, any>) {
  if (!Sentry || !initialized) return;
  try {
    if (context) Sentry.setContext('extra', context);
    Sentry.captureException(error);
  } catch {}
}

export function setUserContext(userId: string, username: string) {
  if (!Sentry || !initialized) return;
  try {
    Sentry.setUser({ id: userId, username });
  } catch {}
}

export function clearUserContext() {
  if (!Sentry || !initialized) return;
  try {
    Sentry.setUser(null);
  } catch {}
}

export { Sentry };
