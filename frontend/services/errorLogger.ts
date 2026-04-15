import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ErrorLog {
  id: string;
  timestamp: string;
  type: 'network' | 'api' | 'app' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  endpoint?: string;
  statusCode?: number;
  stackTrace?: string;
  userAction?: string;
  deviceInfo?: {
    platform: string;
    appVersion: string;
  };
}

const ERROR_LOG_KEY = '@error_logs';
const MAX_LOGS = 100; // Maximal 100 Fehler speichern

class ErrorLogger {
  async logError(error: Partial<ErrorLog>): Promise<void> {
    try {
      const errorLog: ErrorLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        type: error.type || 'unknown',
        severity: error.severity || 'medium',
        message: error.message || 'Unknown error',
        endpoint: error.endpoint,
        statusCode: error.statusCode,
        stackTrace: error.stackTrace,
        userAction: error.userAction,
        deviceInfo: error.deviceInfo,
      };

      // Hole existierende Logs
      const existingLogs = await this.getLogs();
      
      // Füge neuen Log hinzu
      const updatedLogs = [errorLog, ...existingLogs];
      
      // Behalte nur die letzten MAX_LOGS Einträge
      const trimmedLogs = updatedLogs.slice(0, MAX_LOGS);
      
      // Speichere zurück
      await AsyncStorage.setItem(ERROR_LOG_KEY, JSON.stringify(trimmedLogs));
      
      console.error('📝 Fehler protokolliert:', errorLog);
    } catch (e) {
      console.error('❌ Fehler beim Speichern des Fehlerlogs:', e);
    }
  }

  async getLogs(): Promise<ErrorLog[]> {
    try {
      const logsJson = await AsyncStorage.getItem(ERROR_LOG_KEY);
      if (!logsJson) return [];
      return JSON.parse(logsJson);
    } catch (e) {
      console.error('❌ Fehler beim Laden der Fehlerprotokolle:', e);
      return [];
    }
  }

  async clearLogs(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ERROR_LOG_KEY);
      console.log('🗑️ Fehlerprotokolle gelöscht');
    } catch (e) {
      console.error('❌ Fehler beim Löschen der Fehlerprotokolle:', e);
    }
  }

  async getLogsByType(type: ErrorLog['type']): Promise<ErrorLog[]> {
    const logs = await this.getLogs();
    return logs.filter(log => log.type === type);
  }

  async getLogsBySeverity(severity: ErrorLog['severity']): Promise<ErrorLog[]> {
    const logs = await this.getLogs();
    return logs.filter(log => log.severity === severity);
  }

  async getLogsCount(): Promise<number> {
    const logs = await this.getLogs();
    return logs.length;
  }

  async getCriticalLogsCount(): Promise<number> {
    const logs = await this.getLogsBySeverity('critical');
    return logs.length;
  }

  // Helper: Log aus fetch error erstellen
  logFetchError(error: any, endpoint: string, userAction?: string): void {
    this.logError({
      type: 'network',
      severity: 'high',
      message: error.message || 'Network request failed',
      endpoint,
      stackTrace: error.stack,
      userAction,
    });
  }

  // Helper: API Error loggen
  logApiError(statusCode: number, endpoint: string, message: string, userAction?: string): void {
    const severity = statusCode >= 500 ? 'critical' : statusCode >= 400 ? 'high' : 'medium';
    this.logError({
      type: 'api',
      severity,
      message,
      endpoint,
      statusCode,
      userAction,
    });
  }

  // Helper: App Error loggen
  logAppError(error: Error, userAction?: string): void {
    this.logError({
      type: 'app',
      severity: 'high',
      message: error.message,
      stackTrace: error.stack,
      userAction,
    });
  }
}

export const errorLogger = new ErrorLogger();
export default errorLogger;
