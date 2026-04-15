import { Platform, Alert } from 'react-native';

export function printScreen(): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.print();
    }
  } else {
    Alert.alert('Info', 'Drucken ist nur im Browser verfügbar.');
  }
}
