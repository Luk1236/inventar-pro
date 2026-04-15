import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import pushNotificationService from '../../services/pushNotificationService';

interface Session {
  id: string;
  device: string;
  ip_address: string;
  created_at: string;
  last_activity: string;
  is_current: boolean;
}

export default function SecurityPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  
  // Password change
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Notifications
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load sessions
      const sessionsData = await apiService.get<Session[]>('/api/users/sessions', { showErrorAlert: false });
      setSessions(sessionsData || []);
      
      // Check notification status
      const token = await AsyncStorage.getItem('push_token');
      if (token) {
        setPushToken(token);
        setNotificationsEnabled(true);
      }
    } catch (error) {
      console.error('Error loading security data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Fehler', 'Bitte alle Felder ausfüllen');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      Alert.alert('Fehler', 'Neue Passwörter stimmen nicht überein');
      return;
    }
    
    if (newPassword.length < 8) {
      Alert.alert('Fehler', 'Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }
    
    setChangingPassword(true);
    try {
      await apiService.post('/api/users/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      
      Alert.alert('Erfolg', 'Passwort erfolgreich geändert');
      setShowPasswordChange(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Passwortänderung fehlgeschlagen');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleEnableNotifications = async () => {
    if (notificationsEnabled) {
      // Disable
      await AsyncStorage.removeItem('push_token');
      setPushToken(null);
      setNotificationsEnabled(false);
    } else {
      // Enable
      const token = await pushNotificationService.registerForPushNotifications();
      if (token) {
        setPushToken(token);
        setNotificationsEnabled(true);
        Alert.alert('Erfolg', 'Push-Benachrichtigungen aktiviert');
      } else {
        Alert.alert('Fehler', 'Konnte Push-Benachrichtigungen nicht aktivieren');
      }
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    Alert.alert(
      'Session beenden',
      'Diese Session wirklich beenden?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Beenden',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.delete(`/api/users/sessions/${sessionId}`);
              setSessions(sessions.filter(s => s.id !== sessionId));
            } catch (error: any) {
              Alert.alert('Fehler', error.message);
            }
          }
        }
      ]
    );
  };

  const handleLogoutAll = async () => {
    Alert.alert(
      'Von allen Geräten abmelden',
      'Sie werden von allen Geräten abgemeldet. Fortfahren?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Abmelden',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.post('/api/users/logout-all', {});
              await AsyncStorage.clear();
              router.replace('/');
            } catch (error: any) {
              Alert.alert('Fehler', error.message);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>🔒 Sicherheit</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        
        {/* Password Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>🔑 Passwort</Text>
          
          {!showPasswordChange ? (
            <TouchableOpacity
              style={[styles.optionCard, { backgroundColor: colors.card }]}
              onPress={() => setShowPasswordChange(true)}
            >
              <View style={[styles.iconBox, { backgroundColor: '#007AFF20' }]}>
                <Ionicons name="key-outline" size={24} color="#007AFF" />
              </View>
              <View style={styles.optionContent}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>Passwort ändern</Text>
                <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                  Aktualisieren Sie Ihr Passwort regelmäßig
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.passwordForm, { backgroundColor: colors.card }]}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="Aktuelles Passwort"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="Neues Passwort (min. 8 Zeichen)"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="Neues Passwort bestätigen"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              
              <View style={styles.passwordButtons}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={() => {
                    setShowPasswordChange(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.text }]}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                  onPress={handlePasswordChange}
                  disabled={changingPassword}
                >
                  {changingPassword ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Speichern</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>🔔 Benachrichtigungen</Text>
          
          <View style={[styles.optionCard, { backgroundColor: colors.card }]}>
            <View style={[styles.iconBox, { backgroundColor: '#FF950020' }]}>
              <Ionicons name="notifications-outline" size={24} color="#FF9500" />
            </View>
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>Push-Benachrichtigungen</Text>
              <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                Wartung & DGUV Erinnerungen
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleEnableNotifications}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={notificationsEnabled ? '#007AFF' : '#f4f3f4'}
            />
          </View>
          
          {pushToken && (
            <Text style={[styles.tokenInfo, { color: colors.textSecondary }]}>
              Token registriert ✓
            </Text>
          )}
        </View>

        {/* Sessions Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>📱 Aktive Sessions</Text>
            <TouchableOpacity onPress={handleLogoutAll}>
              <Text style={styles.logoutAllText}>Alle abmelden</Text>
            </TouchableOpacity>
          </View>
          
          {sessions.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
              <Ionicons name="phone-portrait-outline" size={32} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Keine aktiven Sessions
              </Text>
            </View>
          ) : (
            sessions.map(session => (
              <View key={session.id} style={[styles.sessionCard, { backgroundColor: colors.card }]}>
                <View style={styles.sessionIcon}>
                  <Ionicons 
                    name={session.device?.includes('Mobile') ? 'phone-portrait-outline' : 'laptop-outline'} 
                    size={24} 
                    color={session.is_current ? '#34C759' : colors.textSecondary} 
                  />
                </View>
                <View style={styles.sessionContent}>
                  <Text style={[styles.sessionDevice, { color: colors.text }]}>
                    {session.device || 'Unbekanntes Gerät'}
                    {session.is_current && <Text style={styles.currentBadge}> (Aktuell)</Text>}
                  </Text>
                  <Text style={[styles.sessionInfo, { color: colors.textSecondary }]}>
                    {session.ip_address || 'IP unbekannt'}
                  </Text>
                </View>
                {!session.is_current && (
                  <TouchableOpacity onPress={() => handleRevokeSession(session.id)}>
                    <Ionicons name="close-circle-outline" size={24} color="#FF3B30" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>

        {/* Security Tips */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>💡 Sicherheitstipps</Text>
          
          <View style={[styles.tipCard, { backgroundColor: colors.card }]}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#34C759" />
            <Text style={[styles.tipText, { color: colors.textSecondary }]}>
              Verwenden Sie ein starkes Passwort mit mind. 8 Zeichen
            </Text>
          </View>
          <View style={[styles.tipCard, { backgroundColor: colors.card }]}>
            <Ionicons name="refresh-outline" size={20} color="#007AFF" />
            <Text style={[styles.tipText, { color: colors.textSecondary }]}>
              Ändern Sie Ihr Passwort regelmäßig
            </Text>
          </View>
          <View style={[styles.tipCard, { backgroundColor: colors.card }]}>
            <Ionicons name="eye-off-outline" size={20} color="#FF9500" />
            <Text style={[styles.tipText, { color: colors.textSecondary }]}>
              Teilen Sie Ihre Zugangsdaten niemals
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  optionCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 10 },
  iconBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  optionContent: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '600' },
  optionDesc: { fontSize: 12, marginTop: 2 },
  passwordForm: { padding: 16, borderRadius: 12 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12, fontSize: 15 },
  passwordButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: 'white', fontSize: 15, fontWeight: '600' },
  tokenInfo: { fontSize: 12, marginTop: 8, marginLeft: 4 },
  logoutAllText: { color: '#FF3B30', fontSize: 14, fontWeight: '600' },
  emptyState: { padding: 24, borderRadius: 12, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14 },
  sessionCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 10 },
  sessionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  sessionContent: { flex: 1 },
  sessionDevice: { fontSize: 14, fontWeight: '600' },
  sessionInfo: { fontSize: 12, marginTop: 2 },
  currentBadge: { color: '#34C759', fontWeight: '500' },
  tipCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, marginBottom: 8, gap: 12 },
  tipText: { flex: 1, fontSize: 13 },
});
