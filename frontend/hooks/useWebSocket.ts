// frontend/hooks/useWebSocket.ts
import { useEffect, useRef, useCallback } from 'react';
import apiService, { getBackendUrl } from '../services/apiService';

async function getWsUrl(): Promise<string> {
  // F8: Append JWT access token as ?token= so server can authenticate the connection
  const token = await apiService.getToken();
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

export function useWebSocket(onMessage: (msg: WsMessage) => void): void {
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
      if (mountedRef.current && attemptsRef.current < 5) {
        const delay = Math.pow(2, attemptsRef.current) * 1000;
        attemptsRef.current += 1;
        // Store timer ref so it can be cleared on unmount
        reconnectTimerRef.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [connect]);

  useEffect(() => {
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
  }, [connect]);
}
