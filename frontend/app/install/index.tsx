import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const APP_URL = 'https://bundle-export-pro.preview.emergentagent.com';

export default function AppInstallationPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [selectedTab, setSelectedTab] = useState<'android' | 'ios' | 'web'>('android');

  const handleOpenURL = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Fehler', 'Link konnte nicht geöffnet werden');
    });
  };

  const renderAndroidSection = () => (
    <View style={styles.section}>
      <View style={[styles.platformHeader, { backgroundColor: '#3DDC84' }]}>
        <Ionicons name="logo-android" size={32} color="white" />
        <Text style={styles.platformTitle}>Android Installation</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Option 1: Expo Go (Empfohlen)</Text>
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
          Schnellste Methode - keine APK nötig
        </Text>

        <View style={styles.stepsContainer}>
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={[styles.stepText, { color: colors.text }]}>
              Expo Go aus Play Store installieren
            </Text>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={[styles.stepText, { color: colors.text }]}>
              QR-Code scannen:
            </Text>
          </View>
        </View>

        <View style={styles.qrContainer}>
          <View style={styles.qrCode}>
            <QRCode
              value={APP_URL}
              size={200}
              backgroundColor="white"
              color="black"
            />
          </View>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#3DDC84' }]}
            onPress={() => handleOpenURL('https://play.google.com/store/apps/details?id=host.exp.exponent')}
          >
            <Ionicons name="logo-google-playstore" size={20} color="white" />
            <Text style={styles.buttonText}>Play Store öffnen</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Option 2: Web-App (PWA)</Text>
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
          Als App auf dem Homescreen installieren
        </Text>

        <View style={styles.stepsContainer}>
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={[styles.stepText, { color: colors.text }]}>
              Chrome Browser öffnen
            </Text>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={[styles.stepText, { color: colors.text }]}>
              URL eingeben: {APP_URL}
            </Text>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={[styles.stepText, { color: colors.text }]}>
              {`Menü (⋮) → "Zum Startbildschirm hinzufügen"`}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => handleOpenURL(APP_URL)}
        >
          <Ionicons name="globe-outline" size={20} color="white" />
          <Text style={styles.buttonText}>Web-App öffnen</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Option 3: APK Download</Text>
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
          Native Installation (in Vorbereitung)
        </Text>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            APK-Build wird über Emergent Platform erstellt. Nach dem Build steht hier ein Download-Link zur Verfügung.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.buttonDisabled]}
          disabled
        >
          <Ionicons name="download-outline" size={20} color="#999" />
          <Text style={[styles.buttonText, { color: '#999' }]}>APK Download (bald verfügbar)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderIOSSection = () => (
    <View style={styles.section}>
      <View style={[styles.platformHeader, { backgroundColor: '#007AFF' }]}>
        <Ionicons name="logo-apple" size={32} color="white" />
        <Text style={styles.platformTitle}>iOS Installation</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Option 1: Expo Go (Empfohlen)</Text>
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
          Schnellste Methode - keine IPA nötig
        </Text>

        <View style={styles.stepsContainer}>
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={[styles.stepText, { color: colors.text }]}>
              Expo Go aus App Store installieren
            </Text>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={[styles.stepText, { color: colors.text }]}>
              QR-Code mit Kamera-App scannen
            </Text>
          </View>
        </View>

        <View style={styles.qrContainer}>
          <View style={styles.qrCode}>
            <QRCode
              value={APP_URL}
              size={200}
              backgroundColor="white"
              color="black"
            />
          </View>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#007AFF' }]}
            onPress={() => handleOpenURL('https://apps.apple.com/app/expo-go/id982107779')}
          >
            <Ionicons name="logo-apple-appstore" size={20} color="white" />
            <Text style={styles.buttonText}>App Store öffnen</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Option 2: Web-App (PWA)</Text>
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
          Als App auf dem Homescreen installieren
        </Text>

        <View style={styles.stepsContainer}>
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={[styles.stepText, { color: colors.text }]}>
              Safari Browser öffnen
            </Text>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={[styles.stepText, { color: colors.text }]}>
              URL eingeben: {APP_URL}
            </Text>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={[styles.stepText, { color: colors.text }]}>
              {`Teilen-Button → "Zum Home-Bildschirm"`}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => handleOpenURL(APP_URL)}
        >
          <Ionicons name="globe-outline" size={20} color="white" />
          <Text style={styles.buttonText}>Web-App öffnen</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Option 3: TestFlight</Text>
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
          Beta-Installation über TestFlight (in Vorbereitung)
        </Text>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            iOS-Build wird über TestFlight bereitgestellt. Link wird hier verfügbar gemacht sobald der Build fertig ist.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.buttonDisabled]}
          disabled
        >
          <Ionicons name="download-outline" size={20} color="#999" />
          <Text style={[styles.buttonText, { color: '#999' }]}>TestFlight (bald verfügbar)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderWebSection = () => (
    <View style={styles.section}>
      <View style={[styles.platformHeader, { backgroundColor: colors.primary }]}>
        <Ionicons name="globe" size={32} color="white" />
        <Text style={styles.platformTitle}>Web-App</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Direkter Browser-Zugriff</Text>
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
          Sofort verfügbar - keine Installation nötig
        </Text>

        <View style={styles.urlBox}>
          <Text style={[styles.urlText, { color: colors.primary }]} selectable>
            {APP_URL}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => handleOpenURL(APP_URL)}
        >
          <Ionicons name="open-outline" size={20} color="white" />
          <Text style={styles.buttonText}>Jetzt öffnen</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Als Desktop-App installieren</Text>

        <View style={styles.stepsContainer}>
          <View style={styles.step}>
            <Text style={[styles.stepText, { color: colors.text }]}>
              <Text style={{ fontWeight: 'bold' }}>Chrome/Edge:</Text> Adressleiste → Install-Symbol (+)
            </Text>
          </View>

          <View style={styles.step}>
            <Text style={[styles.stepText, { color: colors.text }]}>
              <Text style={{ fontWeight: 'bold' }}>Firefox:</Text>{` Menü → "App installieren"`}
            </Text>
          </View>

          <View style={styles.step}>
            <Text style={[styles.stepText, { color: colors.text }]}>
              <Text style={{ fontWeight: 'bold' }}>Safari:</Text>{` Teilen → "Zum Dock hinzufügen"`}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>System-Anforderungen</Text>
        
        <View style={styles.requirementsList}>
          <View style={styles.requirementItem}>
            <Ionicons name="checkmark-circle" size={20} color="#34C759" />
            <Text style={[styles.requirementText, { color: colors.text }]}>
              Moderne Browser (Chrome, Firefox, Safari, Edge)
            </Text>
          </View>

          <View style={styles.requirementItem}>
            <Ionicons name="checkmark-circle" size={20} color="#34C759" />
            <Text style={[styles.requirementText, { color: colors.text }]}>
              Internetverbindung erforderlich
            </Text>
          </View>

          <View style={styles.requirementItem}>
            <Ionicons name="checkmark-circle" size={20} color="#34C759" />
            <Text style={[styles.requirementText, { color: colors.text }]}>
              Responsive Design für alle Bildschirmgrößen
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>App Installation</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'android' && styles.tabActive]}
          onPress={() => setSelectedTab('android')}
        >
          <Ionicons 
            name="logo-android" 
            size={24} 
            color={selectedTab === 'android' ? '#3DDC84' : colors.textSecondary} 
          />
          <Text style={[
            styles.tabText, 
            { color: selectedTab === 'android' ? '#3DDC84' : colors.textSecondary }
          ]}>
            Android
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedTab === 'ios' && styles.tabActive]}
          onPress={() => setSelectedTab('ios')}
        >
          <Ionicons 
            name="logo-apple" 
            size={24} 
            color={selectedTab === 'ios' ? '#007AFF' : colors.textSecondary} 
          />
          <Text style={[
            styles.tabText, 
            { color: selectedTab === 'ios' ? '#007AFF' : colors.textSecondary }
          ]}>
            iOS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedTab === 'web' && styles.tabActive]}
          onPress={() => setSelectedTab('web')}
        >
          <Ionicons 
            name="globe" 
            size={24} 
            color={selectedTab === 'web' ? colors.primary : colors.textSecondary} 
          />
          <Text style={[
            styles.tabText, 
            { color: selectedTab === 'web' ? colors.primary : colors.textSecondary }
          ]}>
            Web
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {selectedTab === 'android' && renderAndroidSection()}
        {selectedTab === 'ios' && renderIOSSection()}
        {selectedTab === 'web' && renderWebSection()}
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
    fontSize: 20,
    fontWeight: 'bold',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: 'currentColor',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  platformHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  platformTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  card: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  stepsContainer: {
    marginBottom: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  qrContainer: {
    alignItems: 'center',
    gap: 16,
  },
  qrCode: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
    width: '100%',
  },
  buttonDisabled: {
    backgroundColor: '#f1f3f4',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  urlBox: {
    backgroundColor: '#f1f3f4',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  urlText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  requirementsList: {
    gap: 12,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  requirementText: {
    flex: 1,
    fontSize: 14,
  },
});
