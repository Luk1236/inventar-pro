import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import apiService from './apiService';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class PushNotificationService {
  private expoPushToken: string | null = null;

  async registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    try {
      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission not granted');
        return null;
      }

      // ProjectId dynamisch aus app.json/app.config.js lesen.
      // In Expo Go: optional (Expo Go nutzt eigenen Token).
      // Im Native Build: aus eas.projectId.
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants as any).easConfig?.projectId ??
        undefined;

      const isExpoGo = Constants.executionEnvironment === 'storeClient';
      if (!projectId && !isExpoGo) {
        console.warn(
          '[Push] Keine EAS projectId gefunden. Führe `eas init` aus, ' +
          'damit Push-Notifications im Native Build funktionieren.'
        );
      }

      // Get Expo push token (projectId nur übergeben wenn vorhanden)
      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );

      this.expoPushToken = tokenData.data;
      
      // Store token locally
      await AsyncStorage.setItem('push_token', this.expoPushToken);
      
      // Register token with backend
      await this.registerTokenWithBackend(this.expoPushToken);

      // Configure Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('maintenance', {
          name: 'Wartung & DGUV',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF9500',
        });
        
        await Notifications.setNotificationChannelAsync('alerts', {
          name: 'System-Benachrichtigungen',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      return this.expoPushToken;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  private async registerTokenWithBackend(token: string): Promise<void> {
    try {
      await apiService.post('/api/push-tokens', { token, platform: Platform.OS });
    } catch (error) {
      console.error('Error registering push token with backend:', error);
    }
  }

  // Schedule a local notification for DGUV reminder
  async scheduleDGUVReminder(articleName: string, testDate: Date, articleId: string): Promise<string | null> {
    try {
      // Schedule reminder 7 days before
      const reminderDate = new Date(testDate);
      reminderDate.setDate(reminderDate.getDate() - 7);
      
      // Only schedule if in the future
      if (reminderDate <= new Date()) {
        return null;
      }

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚡ DGUV V3 Prüfung fällig',
          body: `${articleName} muss bis ${testDate.toLocaleDateString('de-DE')} geprüft werden`,
          data: { type: 'dguv', articleId },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderDate,
        },
      });

      return identifier;
    } catch (error) {
      console.error('Error scheduling DGUV reminder:', error);
      return null;
    }
  }

  // Schedule maintenance reminder
  async scheduleMaintenanceReminder(articleName: string, maintenanceDate: Date, taskId: string): Promise<string | null> {
    try {
      const reminderDate = new Date(maintenanceDate);
      reminderDate.setDate(reminderDate.getDate() - 3);
      
      if (reminderDate <= new Date()) {
        return null;
      }

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔧 Wartung fällig',
          body: `${articleName} - Wartung am ${maintenanceDate.toLocaleDateString('de-DE')}`,
          data: { type: 'maintenance', taskId },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderDate,
        },
      });

      return identifier;
    } catch (error) {
      console.error('Error scheduling maintenance reminder:', error);
      return null;
    }
  }

  // Send immediate local notification
  async sendLocalNotification(title: string, body: string, data?: any): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
        },
        trigger: null, // Immediate
      });
    } catch (error) {
      console.error('Error sending local notification:', error);
    }
  }

  // Get all scheduled notifications
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  // Cancel a specific notification
  async cancelNotification(identifier: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  }

  // Cancel all notifications
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  // Add notification listeners
  addNotificationReceivedListener(callback: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(callback);
  }

  addNotificationResponseListener(callback: (response: Notifications.NotificationResponse) => void) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }
}

export default new PushNotificationService();
