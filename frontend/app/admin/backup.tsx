import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { writeAsStringAsync, documentDirectory, EncodingType } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BackupInfo {
  exists: boolean;
  file: string;
  size_mb: number;
  created_at: string;
  last_modified: string;
  collections: { [key: string]: number };
  total_documents: number;
}

export default function AdminBackupPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  useEffect(() => {
    loadBackupInfo();
  }, []);

  const loadBackupInfo = async () => {
    try {
      const info = await apiService.get<BackupInfo>('/api/backup/list', { showErrorAlert: false });
      setBackupInfo(info);
    } catch (error) {
      console.error('Error loading backup info:', error);
    } finally {
      setLoadingInfo(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadBackupInfo();
  };

  const createBackup = async () => {
    setLoading(true);
    try {
      const result = await apiService.post<any>('/api/admin/backup/create', null);
      Alert.alert(
        '✅ Backup erstellt!',
        `Backup wurde erfolgreich erstellt!\n\nDateien: ${result.files_backed_up}\nSpeicherort: ${result.backup_path}`,
        [{ text: 'OK', onPress: () => loadBackupInfo() }]
      );
    } catch (error) {
      Alert.alert('Fehler', 'Backup konnte nicht erstellt werden');
    } finally {
      setLoading(false);
    }
  };

  const downloadBackup = async () => {
    setLoading(true);
    try {
      Alert.alert('📥 Backup herunterladen', 'Backup wird erstellt und heruntergeladen...');

      // First create a fresh backup
      await apiService.post('/api/admin/backup/create', null);

      // Download the backup - we need to use fetch directly for blob
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL || ''}/api/admin/backup/download`, {
        headers: {
          'Authorization': `Bearer ${await apiService.getToken()}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const reader = new FileReader();
        
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const fileUri = documentDirectory + `backup_${new Date().getTime()}.zip`;

          await writeAsStringAsync(
            fileUri,
            base64data.split(',')[1],
            { encoding: EncodingType.Base64 }
          );
          
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'application/zip',
              dialogTitle: 'Backup speichern',
            });
            Alert.alert('✅ Erfolg!', 'Backup wurde heruntergeladen!');
          } else {
            Alert.alert('✅ Erfolg', 'Backup wurde erstellt!');
          }
        };
        
        reader.readAsDataURL(blob);
      } else {
        Alert.alert('Fehler', 'Download fehlgeschlagen');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Fehler', 'Netzwerkfehler beim Download');
    } finally {
      setLoading(false);
    }
  };

  const restoreBackup = async () => {
    if (!backupInfo?.exists) {
      Alert.alert('Fehler', 'Kein Backup vorhanden zum Wiederherstellen');
      return;
    }

    Alert.alert(
      '⚠️ Backup wiederherstellen',
      `Möchten Sie das Backup vom ${formatDate(backupInfo.last_modified)} wiederherstellen?\n\n${backupInfo.total_documents} Dokumente werden wiederhergestellt.\n\nAlle aktuellen Daten werden überschrieben!`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Wiederherstellen',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const result = await apiService.post<any>('/api/admin/backup/restore', null);
              Alert.alert(
                '✅ Wiederhergestellt!',
                `Backup wurde erfolgreich wiederhergestellt!\n\nDateien: ${result.files_restored}`,
                [{ text: 'OK', onPress: () => router.replace('/') }]
              );
            } catch (error) {
              Alert.alert('Fehler', 'Wiederherstellung fehlgeschlagen');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Backup & Wiederherstellung</Text>
        <TouchableOpacity onPress={handleRefresh}>
          <Ionicons name="refresh" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={[styles.infoCard, { backgroundColor: isDark ? '#1a3a5c' : '#E3F2FD' }]}>
          <Ionicons name="information-circle" size={24} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.primary }]}>
            Sichern Sie regelmäßig Ihre Daten! Laden Sie Backups herunter und speichern Sie diese auf Google Drive, Dropbox oder Ihrem Computer.
          </Text>
        </View>

        {/* Current Backup Info */}
        {loadingInfo ? (
          <View style={[styles.backupCard, { backgroundColor: colors.card }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Lade Backup-Informationen...</Text>
          </View>
        ) : backupInfo?.exists ? (
          <View style={[styles.backupCard, { backgroundColor: colors.card }]}>
            <View style={styles.backupHeader}>
              <View style={[styles.backupIcon, { backgroundColor: isDark ? '#1a3a5c' : '#E8F5E9' }]}>
                <Ionicons name="cloud-done" size={32} color="#34C759" />
              </View>
              <View style={styles.backupDetails}>
                <Text style={[styles.backupTitle, { color: colors.text }]}>Letztes Backup</Text>
                <Text style={[styles.backupDate, { color: colors.primary }]}>
                  {formatDate(backupInfo.last_modified)}
                </Text>
                <Text style={[styles.backupSize, { color: colors.textSecondary }]}>
                  {backupInfo.size_mb.toFixed(2)} MB • {backupInfo.total_documents} Dokumente
                </Text>
              </View>
            </View>

            <View style={[styles.collectionsList, { borderTopColor: colors.border }]}>
              <Text style={[styles.collectionsTitle, { color: colors.text }]}>📊 Gespeicherte Daten:</Text>
              <View style={styles.collectionsGrid}>
                {Object.entries(backupInfo.collections).map(([name, count]) => (
                  <View key={name} style={[styles.collectionItem, { backgroundColor: colors.background }]}>
                    <Text style={[styles.collectionName, { color: colors.textSecondary }]}>
                      {name.replace('_', ' ')}
                    </Text>
                    <Text style={[styles.collectionCount, { color: colors.text }]}>{count}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.backupCard, styles.noBackupCard, { backgroundColor: colors.card }]}>
            <Ionicons name="cloud-offline" size={48} color={colors.textSecondary} />
            <Text style={[styles.noBackupText, { color: colors.textSecondary }]}>Kein Backup vorhanden</Text>
            <Text style={[styles.noBackupHint, { color: colors.textSecondary }]}>
              Erstellen Sie jetzt Ihr erstes Backup
            </Text>
          </View>
        )}

        {/* Download Backup */}
        <TouchableOpacity
          style={[styles.actionCard, styles.primaryCard, { backgroundColor: colors.card }]}
          onPress={downloadBackup}
          disabled={loading}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#34C759' }]}>
            <Ionicons name="cloud-download" size={32} color="white" />
          </View>
          <View style={styles.actionInfo}>
            <Text style={[styles.actionTitle, { color: colors.text }]}>Backup herunterladen</Text>
            <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
              Erstellt ein neues Backup und lädt es als ZIP-Datei herunter
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Create Backup */}
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.card }]}
          onPress={createBackup}
          disabled={loading}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.primary }]}>
            <Ionicons name="save" size={32} color="white" />
          </View>
          <View style={styles.actionInfo}>
            <Text style={[styles.actionTitle, { color: colors.text }]}>Backup erstellen</Text>
            <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
              Erstellt ein Backup auf dem Server (täglich automatisch um 2:00 Uhr)
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Restore Backup */}
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.card }]}
          onPress={restoreBackup}
          disabled={loading || !backupInfo?.exists}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#FF9500' }]}>
            <Ionicons name="refresh" size={32} color="white" />
          </View>
          <View style={styles.actionInfo}>
            <Text style={[styles.actionTitle, { color: colors.text }]}>Backup wiederherstellen</Text>
            <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
              Stellt das letzte Server-Backup wieder her (überschreibt aktuelle Daten!)
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Verarbeite...</Text>
          </View>
        )}

        <View style={[styles.tipsCard, { backgroundColor: isDark ? '#3d2e00' : '#FFF3E0' }]}>
          <Text style={[styles.tipsTitle, { color: isDark ? '#FFB300' : '#E65100' }]}>💡 Tipps für Datensicherheit:</Text>
          <Text style={[styles.tipText, { color: isDark ? '#FFB300' : '#E65100' }]}>• Laden Sie wöchentlich ein Backup herunter</Text>
          <Text style={[styles.tipText, { color: isDark ? '#FFB300' : '#E65100' }]}>• Speichern Sie Backups auf Google Drive oder Dropbox</Text>
          <Text style={[styles.tipText, { color: isDark ? '#FFB300' : '#E65100' }]}>• Behalten Sie mehrere Backup-Versionen</Text>
          <Text style={[styles.tipText, { color: isDark ? '#FFB300' : '#E65100' }]}>• Automatisches Backup läuft täglich um 2:00 Uhr</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  backupCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  backupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backupIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  backupDetails: {
    flex: 1,
  },
  backupTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  backupDate: {
    fontSize: 14,
    fontWeight: '500',
  },
  backupSize: {
    fontSize: 13,
    marginTop: 4,
  },
  collectionsList: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  collectionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  collectionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  collectionItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  collectionName: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  collectionCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  noBackupCard: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noBackupText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  noBackupHint: {
    fontSize: 14,
    marginTop: 4,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  primaryCard: {
    borderWidth: 2,
    borderColor: '#34C759',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  loadingOverlay: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  tipsCard: {
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginBottom: 32,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 24,
  },
});
