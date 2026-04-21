// Mock expo-router's useFocusEffect — runs callback immediately on mount
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => { cb(); },
}));

// AppState mock — lets tests trigger state changes manually
const appStateListeners: ((s: string) => void)[] = [];
jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn((_event: string, cb: (s: string) => void) => {
      appStateListeners.push(cb);
      return { remove: jest.fn() };
    }),
  },
}));

import { renderHook, act } from '@testing-library/react-native';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

describe('useAutoRefresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    appStateListeners.length = 0;
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('calls onRefresh immediately on focus', () => {
    const onRefresh = jest.fn();
    renderHook(() => useAutoRefresh({ onRefresh, interval: 0 }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not call onRefresh on focus when refreshOnFocus is false', () => {
    const onRefresh = jest.fn();
    renderHook(() =>
      useAutoRefresh({ onRefresh, refreshOnFocus: false, interval: 0 })
    );
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('calls onRefresh when app comes to foreground from background', () => {
    const onRefresh = jest.fn();
    renderHook(() => useAutoRefresh({ onRefresh, interval: 0 }));
    onRefresh.mockClear();

    act(() => {
      // Simulate background → active transition
      appStateListeners.forEach((cb) => cb('background'));
      appStateListeners.forEach((cb) => cb('active'));
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('calls onRefresh on interval', () => {
    const onRefresh = jest.fn();
    renderHook(() => useAutoRefresh({ onRefresh, interval: 5000 }));
    onRefresh.mockClear();

    act(() => { jest.advanceTimersByTime(5000); });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    act(() => { jest.advanceTimersByTime(5000); });
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it('clears interval on unmount', () => {
    const onRefresh = jest.fn();
    const { unmount } = renderHook(() =>
      useAutoRefresh({ onRefresh, interval: 5000 })
    );
    onRefresh.mockClear();
    unmount();

    act(() => { jest.advanceTimersByTime(10000); });
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
