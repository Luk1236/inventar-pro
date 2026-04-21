import { create } from 'zustand';

export type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface RealtimeState {
  status: WsStatus;
  reconnectCount: number;
  lastEventType: string | null;
  setStatus: (status: WsStatus) => void;
  incrementReconnect: () => void;
  resetReconnect: () => void;
  setLastEvent: (type: string) => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  status: 'disconnected',
  reconnectCount: 0,
  lastEventType: null,

  setStatus: (status) => set({ status }),

  incrementReconnect: () =>
    set((state) => ({ reconnectCount: state.reconnectCount + 1 })),

  resetReconnect: () => set({ reconnectCount: 0 }),

  setLastEvent: (type) => set({ lastEventType: type }),
}));
