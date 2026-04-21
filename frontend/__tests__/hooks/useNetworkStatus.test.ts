// NetInfo mock — factory uses inline jest.fn(); implementations set per-test via mockImplementation
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn(),
}));

import NetInfo from '@react-native-community/netinfo';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

const mockAddEventListener = jest.mocked(NetInfo.addEventListener);
const mockFetch = jest.mocked(NetInfo.fetch);

describe('useNetworkStatus', () => {
  let _netInfoListener: ((state: any) => void) | null = null;

  beforeEach(() => {
    _netInfoListener = null;
    mockAddEventListener.mockImplementation((cb: any) => {
      _netInfoListener = cb;
      return jest.fn(); // unsubscribe fn
    });
    mockFetch.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns isOnline: true when connected and internet reachable', async () => {
    const { result } = renderHook(() => useNetworkStatus());
    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(result.current.isOnline).toBe(true);
  });

  it('returns isOnline: false when not connected', async () => {
    mockFetch.mockResolvedValue({ isConnected: false, isInternetReachable: false } as any);
    const { result } = renderHook(() => useNetworkStatus());

    await waitFor(() => expect(result.current.isConnected).toBe(false));
    expect(result.current.isOnline).toBe(false);
  });

  it('updates state when network listener fires', async () => {
    const { result } = renderHook(() => useNetworkStatus());
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      _netInfoListener?.({ isConnected: false, isInternetReachable: false });
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isOnline).toBe(false);
  });

  it('isOnline is false when connected but internet not reachable', async () => {
    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      _netInfoListener?.({ isConnected: true, isInternetReachable: false });
    });

    expect(result.current.isOnline).toBe(false);
  });
});
