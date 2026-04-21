// frontend/__tests__hooks_/useWebSocket.test.ts

// Mock WebSocket globally
class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  onmessage: ((e: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = jest.fn();
  send = jest.fn();
  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.lastInstance = this;
  }
  static lastInstance: MockWebSocket | null = null;
}

(global as any).WebSocket = MockWebSocket;

// Mock global fetch so getWsToken() fails fast and falls back to getToken()
(global as any).fetch = jest.fn().mockRejectedValue(new Error('Network error'));

// Mock expo-constants
jest.mock("expo-constants", () => ({
  expoConfig: { extra: { EXPO_PUBLIC_BACKEND_URL: "http://localhost:8000" } }
}));

// Mock expo-secure-store
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue("test-token"),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock apiService — provide both named exports that useWebSocket.ts imports directly
jest.mock("../../services/apiService", () => ({
  __esModule: true,
  default: {
    getToken: jest.fn().mockResolvedValue("test-token"),
  },
  getToken: jest.fn().mockResolvedValue("test-token"),
  getBackendUrl: jest.fn().mockReturnValue("http://localhost:8000"),
}));

import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useWebSocket } from "../../hooks/useWebSocket";

describe("useWebSocket", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    MockWebSocket.lastInstance = null;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calls onMessage when a valid JSON message arrives", async () => {
    const onMessage = jest.fn();
    renderHook(() => useWebSocket(onMessage));

    // Wait for async WebSocket creation
    await act(async () => {
      await jest.runAllTimersAsync();
    });

    act(() => {
      const instance = MockWebSocket.lastInstance;
      if (instance && instance.onmessage) {
        instance.onmessage({
          data: JSON.stringify({ type: "article_updated", id: "123" })
        });
      }
    });

    expect(onMessage).toHaveBeenCalledWith({ type: "article_updated", id: "123" });
  });

  it("ignores malformed JSON messages without throwing", async () => {
    const onMessage = jest.fn();
    renderHook(() => useWebSocket(onMessage));

    await act(async () => {
      await jest.runAllTimersAsync();
    });

    act(() => {
      const instance = MockWebSocket.lastInstance;
      if (instance && instance.onmessage) {
        instance.onmessage({ data: "not-json" });
      }
    });

    expect(onMessage).not.toHaveBeenCalled();
  });

  it("closes WebSocket on unmount", async () => {
    const { unmount } = renderHook(() => useWebSocket(jest.fn()));

    await act(async () => {
      await jest.runAllTimersAsync();
    });

    const ws = MockWebSocket.lastInstance;
    unmount();
    expect(ws?.close).toHaveBeenCalled();
  });

  it("connects to ws:// when backend URL is http://", async () => {
    renderHook(() => useWebSocket(jest.fn()));

    await act(async () => {
      await jest.runAllTimersAsync();
    });

    expect(MockWebSocket.lastInstance?.url).toContain("ws://");
    expect(MockWebSocket.lastInstance?.url).toContain("/ws");
  });
});
