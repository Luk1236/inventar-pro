import { create } from 'zustand';

export interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  createdAt: number;
}

interface NotificationState {
  notifications: AppNotification[];
  enqueue: (notification: Omit<AppNotification, 'id' | 'createdAt'>) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

let _nextId = 0;

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  enqueue: (notification) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        {
          ...notification,
          id: String(++_nextId),
          createdAt: Date.now(),
        },
      ],
    })),

  dismiss: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  clear: () => set({ notifications: [] }),
}));
