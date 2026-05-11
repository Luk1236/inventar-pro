// frontend/hooks/useWebSocket.ts
import { useEffect, useRef, useCallback } from 'react';
import { getBackendUrl, getToken } from '../services/apiService';

/**
 * Get a one-time WebSocket token from the server.
 * This is more secure than passing the JWT access token in the URL.
 */
async function getWsToken(): Promise<string | null> {
  try {
    const accessToken = await getToken();
    if (!accessToken) return null;
    const response = await fetch(`${getBackendUrl()}/api/ws-token`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.ok) {
      const data = await response.json();
      return data.ws_token ?? accessToken;
    }
    // Fallback: use access token directly (backward compatible)
    return accessToken;
  } catch {
    // Last resort fallback
    return await getToken();
  }
}

async function getWsUrl(): Promise<string> {
  // Try to get a one-time ws_token first (more secure)
  // Falls back to JWT access token if ws-token endpoint fails
  const token = await getWsToken();
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';

  const backendUrl = getBackendUrl();

  // Leere URL = Nginx-Betrieb: WebSocket-URL aus aktuellem Seitenprotokoll ableiten
  if (!backendUrl && typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${window.location.host}/ws${tokenParam}`;
  }
  return backendUrl.replace(/^https:\/\//, 'wss://')
                   .replace(/^http:\/\//, 'ws://') + '/ws' + tokenParam;
}

export interface WsMessage {
  type: string;
  id: string;
}

export function useWebSocket(onMessage: (msg: WsMessage) => void, enabled = true): void {
  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    // Don't reconnect if component has unmounted
    if (!mountedRef.current) return;

    getWsUrl().then((url) => {
      if (!mountedRef.current) return;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      _setupHandlers(ws);
    });
  }, []);

  const _setupHandlers = useCallback((ws: WebSocket) => {

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsMessage;
        // Ignore server keep-alive pings
        if ((data as any).type === 'ping') return;
        onMessageRef.current(data);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onopen = () => {
      attemptsRef.current = 0;
    };

    ws.onclose = () => {
      if (mountedRef.current) {
        // Exponential backoff, capped at 30s — reconnects indefinitely
        const delay = Math.min(Math.pow(2, attemptsRef.current) * 1000, 30000);
        attemptsRef.current += 1;
        reconnectTimerRef.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [connect]);

  useEffect(() => {
    if (!enabled) return;
    mountedRef.current = true;
    connect();
    return () => {
      // Mark as unmounted to stop reconnection attempts
      mountedRef.current = false;
      // Clear any pending reconnect timer
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      wsRef.current?.close();
    };
  }, [connect, enabled]);
}
