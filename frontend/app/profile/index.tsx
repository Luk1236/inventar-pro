import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

interface UserProfile {
  id: string;
  email: string;
  username: string;
  role: string;
  is_active: boolean;
  profile_image?: string;
  created_at: string;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // Password change states
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      console.log('[Profile] Loading profile from /api/me...');
      const userData = await apiService.get<UserProfile>('/api/me');
      console.log('[Profile] Loaded user data:', JSON.stringify(userData, null, 2));
      setUser(userData);
      setUsername(userData.username);
      setEmail(userData.email);
      setProfileImage(userData.profile_image || null);
    } catch (error: any) {
      console.error('[Profile] Error loading profile:', error);
      Alert.alert('Fehler', 'Profil konnte nicht geladen werden');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Berechtigung', 'Bitte erlauben Sie den Zugriff auf die Galerie');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      console.log('[Profile] Image picker result:', { canceled: result.canceled, hasAssets: result.assets?.length > 0 });

      if (!result.canceled && result.assets[0].base64) {
        const base64 = result.assets[0].base64;
        const mimeType = result.assets[0].mimeType || 'image/jpeg';
        const imageData = `data:${mimeType};base64,${base64}`;
        console.log('[Profile] Image selected, length:', imageData.length);
        setProfileImage(imageData);
      }
    } catch (error: any) {
      console.error('[Profile] Image picker error:', error);
      Alert.alert('Fehler', 'Bild konnte nicht geladen werden');
    }
  };

  const removeImage = () => {
    setProfileImage(null);
  };

  const handleSave = async () => {
    if (!user) {
      if (Platform.OS === 'web') window.alert('Fehler: Kein Benutzer geladen');
      else Alert.alert('Fehler', 'Kein Benutzer geladen');
      return;
    }

    // Validation
    if (username.trim().length < 2) {
      if (Platform.OS === 'web') window.alert('Benutzername muss mindestens 2 Zeichen haben');
      else Alert.alert('Fehler', 'Benutzername muss mindestens 2 Zeichen haben');
      return;
    }

    // Build update data
    const updateData: any = {};

    const usernameChanged = username.trim() !== user.username;
    const emailChanged = email.trim() !== user.email;
    const imageChanged = profileImage !== (user.profile_image || null);

    if (usernameChanged) updateData.username = username.trim();
    if (emailChanged) updateData.email = email.trim();
    if (imageChanged) updateData.profile_image = profileImage;

    if (Object.keys(updateData).length === 0) {
      if (Platform.OS === 'web') {
        window.alert('Keine Änderungen erkannt');
      } else {
        Alert.alert('Info', 'Keine Änderungen erkannt');
      }
      return;
    }

    // Sensitive changes require confirmation
    const sensitiveChanged = usernameChanged || emailChanged;

    if (sensitiveChanged) {
      const message = 'Wollen Sie die Daten wirklich ändern?\n\nSie werden danach ausgeloggt und müssen sich neu anmelden.';

      if (Platform.OS === 'web') {
        const confirmed = window.confirm(message + '\n\nOK = Ja, ändern\nAbbrechen = Nein');
        if (!confirmed) {
          router.replace('/');
          return;
        }
      } else {
        // Mobile: use Alert.alert
        Alert.alert('Bestätigung', 'Wollen Sie die Daten wirklich ändern? Sie werden danach ausgeloggt.', [
          { text: 'Nein', style: 'cancel', onPress: () => router.replace('/') },
          { text: 'Ja', onPress: () => {} }
        ]);
        return; // Mobile needs to wait for user response
      }
    }

    // Save changes
    if (sensitiveChanged) {
      await saveAndLogout(updateData);
    } else {
      await saveChanges(updateData);
    }
  };

  const saveAndLogout = async (updateData: any) => {
    setSaving(true);
    try {
      await apiService.put<UserProfile>('/api/me', updateData);
      setSaving(false);

      if (Platform.OS === 'web') {
        window.alert('Daten erfolgreich geändert. Sie werden jetzt ausgeloggt.');
      } else {
        Alert.alert('Erfolg', 'Daten erfolgreich geändert. Sie werden jetzt ausgeloggt.');
      }

      await apiService.clearAuth();
      router.replace('/');
    } catch (error: any) {
      setSaving(false);
      const message = error.message || 'Fehler beim Speichern';
      if (Platform.OS === 'web') {
        window.alert('Fehler: ' + message);
      } else {
        Alert.alert('Fehler', message);
      }
    }
  };

  const saveChanges = async (updateData: any) => {
    setSaving(true);
    try {
      const updatedUser = await apiService.put<UserProfile>('/api/me', updateData);

      setUser(updatedUser);
      setUsername(updatedUser.username);
      setEmail(updatedUser.email);
      setProfileImage(updatedUser.profile_image || null);

      // Update stored user info
      const storedUserStr = await AsyncStorage.getItem('user');
      if (storedUserStr) {
        const storedUser = JSON.parse(storedUserStr);
        storedUser.username = updatedUser.username;
        storedUser.email = updatedUser.email;
        storedUser.profile_image = updatedUser.profile_image;
        await AsyncStorage.setItem('user', JSON.stringify(storedUser));
      }

      setSaving(false);

      if (Platform.OS === 'web') {
        window.alert('Profil erfolgreich aktualisiert');
      } else {
        Alert.alert('Erfolg', 'Profil erfolgreich aktualisiert');
      }
    } catch (error: any) {
      setSaving(false);
      const message = error.message || 'Fehler beim Speichern';
      if (Platform.OS === 'web') {
        window.alert('Fehler: ' + message);
      } else {
        Alert.alert('Fehler', message);
      }
    }
  };

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      admin: 'Administrator',
      lager: 'Lagermitarbeiter',
      buero: 'Büromitarbeiter',
    };
    return roles[role] || role;
  };

  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword.trim()) {
      if (Platform.OS === 'web') window.alert('Bitte aktuelles Passwort eingeben');
      else Alert.alert('Fehler', 'Bitte aktuelles Passwort eingeben');
      return;
    }

    if (!newPassword.trim() || newPassword.length < 6) {
      if (Platform.OS === 'web') window.alert('Neues Passwort muss mindestens 6 Zeichen haben');
      else Alert.alert('Fehler', 'Neues Passwort muss mindestens 6 Zeichen haben');
      return;
    }

    if (newPassword !== confirmPassword) {
      if (Platform.OS === 'web') window.alert('Passwörter stimmen nicht überein');
      else Alert.alert('Fehler', 'Passwörter stimmen nicht überein');
      return;
    }

    setChangingPassword(true);
    try {
      await apiService.post('/api/users/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });

      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);

      if (Platform.OS === 'web') {
        window.alert('Passwort erfolgreich geändert');
      } else {
        Alert.alert('Erfolg', 'Passwort erfolgreich geändert');
      }
    } catch (error: any) {
      const message = error.message || 'Fehler beim Ändern des Passworts';
      if (Platform.OS === 'web') {
        window.alert('Fehler: ' + message);
      } else {
        Alert.alert('Fehler', message);
      }
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Mein Profil</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Image */}
        <View style={styles.imageSection}>
          <TouchableOpacity style={styles.imageContainer} onPress={pickImage}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileImage} />
            ) : (
              <View style={[styles.placeholderImage, { backgroundColor: colors.primary }]}>
                <Ionicons name="person" size={50} color="#fff" />
              </View>
            )}
            <View style={[styles.editBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          {profileImage && (
            <TouchableOpacity onPress={removeImage}>
              <Text style={[styles.removeImageText, { color: colors.danger }]}>Bild entfernen</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* User Info */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Benutzerinformationen</Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Benutzername</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={username}
              onChangeText={setUsername}
              placeholder="Benutzername"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>E-Mail</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={email}
              onChangeText={setEmail}
              placeholder="E-Mail"
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Rolle</Text>
            <Text style={[styles.value, { color: colors.text }]}>
              {user ? getRoleLabel(user.role) : '-'}
            </Text>
          </View>
        </View>

        {/* Password Change Section */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={styles.passwordHeader}
            onPress={() => setShowPasswordSection(!showPasswordSection)}
          >
            <View style={styles.passwordHeaderLeft}>
              <Ionicons name="lock-closed" size={20} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Passwort ändern</Text>
            </View>
            <Ionicons
              name={showPasswordSection ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {showPasswordSection && (
            <View style={styles.passwordForm}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Aktuelles Passwort</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Aktuelles Passwort"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Neues Passwort</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Neues Passwort (min. 6 Zeichen)"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Passwort bestätigen</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Passwort wiederholen"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                style={[styles.passwordButton, { backgroundColor: colors.primary }, changingPassword && styles.saveButtonDisabled]}
                onPress={handleChangePassword}
                disabled={changingPassword}
              >
                {changingPassword ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="key" size={18} color="#fff" />
                    <Text style={styles.saveButtonText}>Passwort ändern</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Speichern</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  imageContainer: {
    position: 'relative',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  placeholderImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  removeImageText: {
    marginTop: 12,
    fontSize: 14,
  },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  passwordHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  passwordForm: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  passwordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
});