import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getToken } from './apiService';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    
    try {
      token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('Push token:', token);

      // Save token to backend
      const authToken = await getToken();
      if (authToken) {
        await fetch(`${BACKEND_URL}/api/notifications/register`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });
      }
    } catch (e) {
      console.log('Error getting push token:', e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

export async function scheduleMaintenanceReminder(taskId: string, taskName: string, dueDate: Date) {
  const enabled = await AsyncStorage.getItem('notifications_enabled');
  if (enabled === 'false') return;

  const triggerDate = new Date(dueDate);
  triggerDate.setHours(triggerDate.getHours() - 24); // 24 hours before

  if (triggerDate > new Date()) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔧 Wartungserinnerung',
        body: `${taskName} ist morgen fällig!`,
        data: { taskId, type: 'maintenance' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
  }
}

export async function sendMessageNotification(from: string, message: string) {
  const enabled = await AsyncStorage.getItem('notifications_enabled');
  if (enabled === 'false') return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '💬 Neue Nachricht',
      body: `${from}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
      data: { type: 'message', from },
    },
    trigger: null, // Immediate
  });
}

export async function sendLowStockNotification(articleName: string, currentStock: number) {
  const enabled = await AsyncStorage.getItem('notifications_enabled');
  if (enabled === 'false') return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚠️ Niedriger Bestand',
      body: `${articleName} hat nur noch ${currentStock} Stück auf Lager!`,
      data: { type: 'low_stock', articleName },
    },
    trigger: null,
  });
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
