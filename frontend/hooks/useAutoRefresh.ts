import { useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';

interface UseAutoRefreshOptions {
  onRefresh: () => void | Promise<void>;
  interval?: number; // Auto-refresh interval in ms (default: 30000 = 30s)
  refreshOnFocus?: boolean; // Refresh when screen is focused (default: true)
  refreshOnAppForeground?: boolean; // Refresh when app comes to foreground (default: true)
}

/**
 * Custom hook for automatic data refresh
 * - Refreshes when screen is focused
 * - Refreshes when app comes to foreground
 * - Optional periodic auto-refresh
 */
export function useAutoRefresh({
  onRefresh,
  interval = 30000,
  refreshOnFocus = true,
  refreshOnAppForeground = true,
}: UseAutoRefreshOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef(AppState.currentState);

  // Refresh when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (refreshOnFocus) {
        onRefresh();
      }
    }, [onRefresh, refreshOnFocus])
  );

  // Refresh when app comes to foreground
  useEffect(() => {
    if (!refreshOnAppForeground) return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        onRefresh();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [onRefresh, refreshOnAppForeground]);

  // Periodic auto-refresh
  useEffect(() => {
    if (interval > 0) {
      intervalRef.current = setInterval(() => {
        onRefresh();
      }, interval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [onRefresh, interval]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
}
