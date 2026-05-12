import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Alert } from 'react-native';

// Default URL from env/config
const DEFAULT_BACKEND_URL: string =
  process.env.EXPO_PUBLIC_BACKEND_URL ??
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ??
  'http://localhost:8002';

// Runtime override (set by settings screen or Electron bridge)
// Always start with the configured default so stale mocks or cached values are ignored
let _runtimeBackendUrl: string | null = null;

export function setBackendUrl(url: string): void {
  _runtimeBackendUrl = url.replace(/\/$/, '');
}

export function getBackendUrl(): string {
  return _runtimeBackendUrl ?? DEFAULT_BACKEND_URL;
}

// On startup: load saved server URL (if user set one in settings)
AsyncStorage.getItem('server_url').then((saved) => {
  if (saved) _runtimeBackendUrl = saved.replace(/\/$/, '');
}).catch(() => {});

// Electron bridge: load from Electron settings if running in desktop
if (typeof window !== 'undefined' && (window as any).__electronBridge) {
  (window as any).__electronBridge.getSettings().then((settings: any) => {
    if (settings?.serverUrl) _runtimeBackendUrl = settings.serverUrl.replace(/\/$/, '');
  }).catch(() => {});
}

// API versioning handled server-side; clients use /api/ directly

// L4 — Warn early if backend URL is misconfigured (web builds use '' intentionally)
if (!DEFAULT_BACKEND_URL && typeof window === 'undefined') {
  console.warn(
    '[ApiService] EXPO_PUBLIC_BACKEND_URL is not set. ' +
    'Requests will use relative paths — this only works when served behind Nginx.'
  );
}

// ===========================================
// Secure token helpers with Web fallback
// SecureStore works on iOS/Android, AsyncStorage fallback for Web
// ===========================================
const isWeb = Platform.OS === 'web';

async function secureGet(key: string): Promise<string | null> {
  try {
    if (isWeb) {
      // Web fallback: use AsyncStorage (localStorage in browser)
      return await AsyncStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  } catch (e) {
    if (__DEV__) console.warn('[Storage] getItem failed, trying AsyncStorage fallback:', e);
    // Last resort fallback
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  try {
    if (isWeb) {
      // Web fallback: use AsyncStorage
      await AsyncStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch (e) {
    if (__DEV__) console.warn('[Storage] setItem failed, trying AsyncStorage fallback:', e);
    // Last resort fallback
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      if (__DEV__) console.error('[Storage] Failed to store token');
    }
  }
}

async function secureDelete(key: string): Promise<void> {
  try {
    if (isWeb) {
      await AsyncStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch (e) {
    if (__DEV__) console.warn('[Storage] deleteItem failed, trying AsyncStorage fallback:', e);
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

interface RequestConfig {
  timeout?: number;
  showErrorAlert?: boolean;
  skipAuth?: boolean;
}

const DEFAULT_CONFIG: RequestConfig = {
  timeout: 30000,
  showErrorAlert: true,
  skipAuth: false,
};

class ApiService {
  private isRefreshing = false;
  // Queues callers that arrive while a token refresh is already in flight.
  // When the refresh resolves, every queued caller is unblocked with the new token.
  // An empty-string token signals refresh failure so callers can reject cleanly.
  private refreshSubscribers: ((token: string) => void)[] = [];
  // H3 — Deduplication: prevent double-tap from sending identical concurrent requests
  private pendingRequests = new Map<string, Promise<any>>();

  // Subscribe to token refresh
  private onTokenRefreshed(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback);
  }

  // Notify all subscribers with new token (empty string = refresh failed)
  private notifySubscribers(token: string) {
    this.refreshSubscribers.forEach(callback => callback(token));
    this.refreshSubscribers = [];
  }

  // Get auth token (for session management only)
  async getToken(): Promise<string | null> {
    return secureGet('auth_token');
  }

  // Refresh the access token using refresh token
  private async refreshAccessToken(): Promise<string | null> {
    try {
      const refreshToken = await secureGet('refresh_token');
      if (!refreshToken) {
        // M3 — No refresh token: unblock all waiting requests immediately
        this.notifySubscribers('');
        return null;
      }

      const response = await fetch(`${getBackendUrl()}/api/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        await this.clearAuth();
        // M3 — Refresh failed: notify subscribers so waiting requests fail cleanly
        this.notifySubscribers('');
        return null;
      }

      const data = await response.json();
      await secureSet('auth_token', data.access_token);
      // M4/V6: persist the rotated refresh token returned by the server
      if (data.refresh_token) {
        await secureSet('refresh_token', data.refresh_token);
      }
      this.notifySubscribers(data.access_token);
      if (__DEV__) console.log('Token erfolgreich erneuert');
      return data.access_token;

    } catch (error) {
      if (__DEV__) console.warn('Token-Refresh fehlgeschlagen:', error);
      await this.clearAuth();
      // M3 — Exception during refresh: unblock waiting requests
      this.notifySubscribers('');
      return null;
    }
  }

  // Clear auth data (logout)
  async clearAuth(): Promise<void> {
    await Promise.all([
      secureDelete('auth_token'),
      secureDelete('refresh_token'),
      AsyncStorage.removeItem('user'),
    ]);
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = await secureGet('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  }

  // ===========================================
  // PURE FETCH - No offline caching!
  // ===========================================
  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    config: RequestConfig = {}
  ): Promise<T> {
    const { timeout, showErrorAlert, skipAuth } = { ...DEFAULT_CONFIG, ...config };

    // H3 — Deduplicate identical concurrent requests (e.g. rapid double-tap)
    const dedupKey = `${options.method ?? 'GET'}:${endpoint}`;
    const existing = this.pendingRequests.get(dedupKey);
    if (existing) return existing as Promise<T>;

    const promise = this._doRequest<T>(endpoint, options, { timeout: timeout!, showErrorAlert: showErrorAlert!, skipAuth: skipAuth! });
    this.pendingRequests.set(dedupKey, promise);
    promise.finally(() => {
      this.pendingRequests.delete(dedupKey);
    });
    return promise;
  }

  private async _doRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    config: Required<RequestConfig>
  ): Promise<T> {
    const { timeout, showErrorAlert, skipAuth } = config;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const headers = skipAuth
        ? { 'Content-Type': 'application/json' }
        : await this.getAuthHeaders();

      const resolvedEndpoint = endpoint;
      const response = await fetch(`${getBackendUrl()}${resolvedEndpoint}`, {
        ...options,
        headers: { ...headers, ...options.headers },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 401 with isRefreshing=false: this request kicks off the refresh.
      // 401 with isRefreshing=true: a refresh is already happening — queue this
      // request as a subscriber so it retries automatically when the new token arrives.
      if (response.status === 401 && !skipAuth) {
        if (!this.isRefreshing) {
          this.isRefreshing = true;
          let newToken: string | null = null;
          try {
            newToken = await this.refreshAccessToken();
          } finally {
            this.isRefreshing = false;
          }

          if (newToken) {
            return this._doRequest<T>(endpoint, options, config);
          } else {
            throw new Error('SESSION_EXPIRED');
          }
        } else {
          return new Promise((resolve, reject) => {
            this.onTokenRefreshed(async (token) => {
              if (!token) {
                reject(new Error('SESSION_EXPIRED'));
                return;
              }
              try {
                const result = await this._doRequest<T>(endpoint, options, config);
                resolve(result);
              } catch (err) {
                reject(err);
              }
            });
          });
        }
      }

      // Handle other errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server-Fehler (${response.status})`);
      }

      // Parse response
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }
      return response as any;

    } catch (error: any) {
      if (error.name === 'AbortError') {
        if (showErrorAlert) {
          Alert.alert('Zeitüberschreitung', 'Der Server antwortet nicht. Bitte versuchen Sie es später erneut.');
        }
        throw new Error('TIMEOUT');
      }

      if (error.message === 'SESSION_EXPIRED') {
        if (showErrorAlert) {
          Alert.alert('Sitzung abgelaufen', 'Bitte melden Sie sich erneut an.');
        }
        throw error;
      }

      if (error.message?.includes('Network') || error.message?.includes('fetch') || error.name === 'TypeError') {
        if (showErrorAlert) {
          Alert.alert(
            'Kein Internet',
            'Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.'
          );
        }
        throw new Error('NO_INTERNET');
      }

      if (showErrorAlert) {
        Alert.alert('Fehler', error.message || 'Ein unbekannter Fehler ist aufgetreten.');
      }
      throw error;
    }
  }

  // ===========================================
  // HTTP Methods - Direct server calls only!
  // ===========================================

  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, config);
  }

  async post<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>(
      endpoint,
      { method: 'POST', body: data ? JSON.stringify(data) : undefined },
      config
    );
  }

  async put<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>(
      endpoint,
      { method: 'PUT', body: data ? JSON.stringify(data) : undefined },
      config
    );
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' }, config);
  }

  async patch<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>(
      endpoint,
      { method: 'PATCH', body: data ? JSON.stringify(data) : undefined },
      config
    );
  }

  // ===========================================
  // Auth Methods
  // ===========================================

  async login(username: string, password: string, totp_code?: string): Promise<any> {
    const body: any = { username, password };
    if (totp_code) body.totp_code = totp_code;
    const response = await this.post<any>(
      '/api/login',
      body,
      { skipAuth: true, showErrorAlert: false }
    );

    // H2 — Store tokens in secure storage (iOS Keychain / Android Keystore)
    await secureSet('auth_token', response.access_token);
    await secureSet('refresh_token', response.refresh_token);
    // User profile is not sensitive — AsyncStorage is fine
    await AsyncStorage.setItem('user', JSON.stringify(response.user));

    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.post('/api/logout', {}, { showErrorAlert: false });
    } catch {
      if (__DEV__) console.log('Logout API call failed (might be offline)');
    } finally {
      await this.clearAuth();
    }
  }

  // Get stored user (for UI display only)
  async getStoredUser(): Promise<any | null> {
    const userStr = await AsyncStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const token = await secureGet('auth_token');
    return !!token;
  }
}

const apiService = new ApiService();
export default apiService;

// Export getToken for use in components that need direct token access
// Always use this instead of AsyncStorage.getItem('auth_token') for secure storage
export const getToken = async (): Promise<string | null> => {
  return secureGet('auth_token');
};
