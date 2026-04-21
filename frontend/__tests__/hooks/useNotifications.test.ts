// expo-notifications mock — inline jest.fn() to avoid hoisting TDZ issues
jest.mock('expo-notifications', () => ({
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Mock notificationService
jest.mock('../../services/notificationService', () => ({
  registerForPushNotificationsAsync: jest.fn(),
}));

// Mock expo-router
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { renderHook } from '@testing-library/react-native';
import { useNotifications } from '../../hooks/useNotifications';
import { registerForPushNotificationsAsync } from '../../services/notificationService';

const mockAddNotificationReceivedListener = jest.mocked(
  Notifications.addNotificationReceivedListener
);
const mockAddNotificationResponseReceivedListener = jest.mocked(
  Notifications.addNotificationResponseReceivedListener
);
const mockPush = jest.mocked(router.push);

describe('useNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore default return value after clearAllMocks
    mockAddNotificationReceivedListener.mockReturnValue({ remove: jest.fn() } as any);
    mockAddNotificationResponseReceivedListener.mockReturnValue({ remove: jest.fn() } as any);
  });

  it('registers for push notifications on mount', () => {
    renderHook(() => useNotifications());
    expect(registerForPushNotificationsAsync).toHaveBeenCalledTimes(1);
  });

  it('subscribes to notification received and response listeners', () => {
    renderHook(() => useNotifications());
    expect(mockAddNotificationReceivedListener).toHaveBeenCalledTimes(1);
    expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
  });

  it('removes listeners on unmount', () => {
    const removeMock = jest.fn();
    mockAddNotificationReceivedListener.mockReturnValue({ remove: removeMock } as any);
    mockAddNotificationResponseReceivedListener.mockReturnValue({ remove: removeMock } as any);

    const { unmount } = renderHook(() => useNotifications());
    unmount();

    expect(removeMock).toHaveBeenCalledTimes(2);
  });

  it('navigates to /maintenance for maintenance notifications', () => {
    renderHook(() => useNotifications());

    // Simulate a notification tap with type 'maintenance'
    const responseHandler = mockAddNotificationResponseReceivedListener.mock.calls[0][0] as any;
    responseHandler({
      notification: { request: { content: { data: { type: 'maintenance' } } } },
    });

    expect(mockPush).toHaveBeenCalledWith('/maintenance');
  });

  it('navigates to /messages for message notifications', () => {
    renderHook(() => useNotifications());

    const responseHandler = mockAddNotificationResponseReceivedListener.mock.calls[0][0] as any;
    responseHandler({
      notification: { request: { content: { data: { type: 'message' } } } },
    });

    expect(mockPush).toHaveBeenCalledWith('/messages');
  });
});
