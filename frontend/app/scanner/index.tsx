import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Modal,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface ScannedResult {
  type: 'article' | 'location' | 'unknown';
  data: any;
}

// This is the web fallback version without native barcode scanner
// Native platforms will use index.native.tsx
export default function ScannerPageWeb() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [showResult, setShowResult] = useState(false);
  const [scanResult, setScanResult] = useState<ScannedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [_scanned, setScanned] = useState(false);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 16,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    content: {
      padding: 24,
      flex: 1,
    },
    infoBox: {
      backgroundColor: '#fff3cd',
      padding: 16,
      borderRadius: 8,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: '#ffc107',
    },
    infoTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#856404',
      marginBottom: 8,
    },
    infoText: {
      fontSize: 13,
      color: '#856404',
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 16,
    },
    input: {
      backgroundColor: colors.card,
      borderRadius: 8,
      padding: 16,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
      color: colors.text,
    },
    searchButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
    },
    searchButtonText: {
      color: colors.card,
      fontSize: 16,
      fontWeight: '600',
    },
    tipsContainer: {
      marginTop: 32,
    },
    tipsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 12,
    },
    tipText: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    resultModal: {
      backgroundColor: colors.card,
      borderRadius: 16,
      margin: 24,
      width: '90%',
      maxWidth: 400,
    },
    resultHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    resultTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    resultContent: {
      padding: 16,
    },
    resultLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 8,
    },
    resultValue: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '500',
    },
    resultButton: {
      backgroundColor: colors.primary,
      margin: 16,
      padding: 14,
      borderRadius: 8,
      alignItems: 'center',
    },
    resultButtonText: {
      color: colors.card,
      fontSize: 16,
      fontWeight: '600',
    },
  });

  const processScannedData = async (scannedData: string) => {
    setLoading(true);

    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        router.replace('/');
        return;
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      let result: ScannedResult = { type: 'unknown', data: null };

      // Search for article by QR code
      const articlesResponse = await fetch(`${BACKEND_URL}/api/articles`, { headers });
      if (articlesResponse.ok) {
        const articles = await articlesResponse.json();

        let foundArticle = articles.find((article: any) =>
          article.qr_code === scannedData
        );

        if (!foundArticle) {
          foundArticle = articles.find((article: any) =>
            article.inventory_code === scannedData
          );
        }

        if (!foundArticle) {
          foundArticle = articles.find((article: any) =>
            article.name.toLowerCase().includes(scannedData.toLowerCase()) ||
            article.inventory_code.toLowerCase().includes(scannedData.toLowerCase())
          );
        }

        if (foundArticle) {
          result = { type: 'article', data: foundArticle };
        }
      }

      // If no article found, check storage locations
      if (result.type === 'unknown') {
        const locationsResponse = await fetch(`${BACKEND_URL}/api/storage-locations`, { headers });
        if (locationsResponse.ok) {
          const locations = await locationsResponse.json();
          const foundLocation = locations.find((location: any) =>
            location.qr_code === scannedData
          );

          if (foundLocation) {
            result = { type: 'location', data: foundLocation };
          }
        }
      }

      // If still nothing found, check storage zones
      if (result.type === 'unknown') {
        const zonesResponse = await fetch(`${BACKEND_URL}/api/storage-zones`, { headers });
        if (zonesResponse.ok) {
          const zones = await zonesResponse.json();
          const foundZone = zones.find((zone: any) =>
            zone.qr_code === scannedData
          );

          if (foundZone) {
            result = { type: 'location', data: foundZone };
          }
        }
      }

      setScanResult(result);
      setShowResult(true);
      setScanned(true);

    } catch (error) {
      console.error('Error processing scanned data:', error);
      Alert.alert('Fehler', 'Fehler beim Verarbeiten des gescannten Codes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QR/Barcode Scanner</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>
            📱 Kamera-Scanner nur auf Mobilgeräten verfügbar
          </Text>
          <Text style={styles.infoText}>
            Im Web-Browser nutzen Sie bitte die manuelle Eingabe unten. Auf Ihrem Smartphone oder Tablet mit Expo Go funktioniert der Kamera-Scanner.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>
          Manuelle Eingabe
        </Text>

        <TextInput
          style={styles.input}
          value={manualInput}
          onChangeText={setManualInput}
          placeholder="QR-Code, Barcode oder Inventarcode eingeben..."
          placeholderTextColor={colors.textSecondary}
          autoFocus
          onSubmitEditing={() => {
            if (manualInput.trim()) {
              processScannedData(manualInput.trim());
              setManualInput('');
            }
          }}
        />

        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => {
            if (manualInput.trim()) {
              processScannedData(manualInput.trim());
              setManualInput('');
            } else {
              Alert.alert('Fehler', 'Bitte geben Sie einen Code ein');
            }
          }}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.searchButtonText}>
              Code suchen
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>
            💡 Tipps:
          </Text>
          <Text style={styles.tipText}>
            • Geben Sie den Inventarcode eines Artikels ein
          </Text>
          <Text style={styles.tipText}>
            • Nutzen Sie den QR-Code Generator um Codes zu erstellen
          </Text>
          <Text style={styles.tipText}>
            • Auf dem Smartphone: Kamera-Scanner verwenden
          </Text>
        </View>
      </View>

      {/* Result Modal */}
      {showResult && scanResult && (
        <Modal
          visible={showResult}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowResult(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.resultModal}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultTitle}>
                  {scanResult.type === 'article' ? '📦 Artikel gefunden' :
                   scanResult.type === 'location' ? '📍 Lagerort gefunden' :
                   '❓ Unbekannt'}
                </Text>
                <TouchableOpacity onPress={() => { setShowResult(false); setScanned(false); }}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              {scanResult.type === 'article' && scanResult.data && (
                <View style={styles.resultContent}>
                  <Text style={styles.resultLabel}>Name:</Text>
                  <Text style={styles.resultValue}>{scanResult.data.name}</Text>

                  <Text style={styles.resultLabel}>Inventarcode:</Text>
                  <Text style={styles.resultValue}>{scanResult.data.inventory_code}</Text>

                  <Text style={styles.resultLabel}>Bestand:</Text>
                  <Text style={styles.resultValue}>
                    {scanResult.data.current_stock} {scanResult.data.base_unit}
                  </Text>

                  {scanResult.data.location && (
                    <>
                      <Text style={styles.resultLabel}>Lagerort:</Text>
                      <Text style={styles.resultValue}>{scanResult.data.location}</Text>
                    </>
                  )}
                </View>
              )}

              {scanResult.type === 'location' && scanResult.data && (
                <View style={styles.resultContent}>
                  <Text style={styles.resultLabel}>Lagerort:</Text>
                  <Text style={styles.resultValue}>{scanResult.data.name}</Text>

                  <Text style={styles.resultLabel}>Typ:</Text>
                  <Text style={styles.resultValue}>{scanResult.data.type}</Text>
                </View>
              )}

              {scanResult.type === 'unknown' && (
                <View style={styles.resultContent}>
                  <Text style={styles.resultValue}>
                    Kein Artikel oder Lagerort mit diesem Code gefunden.
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.resultButton}
                onPress={() => {
                  setShowResult(false);
                  setScanned(false);
                  setManualInput('');
                }}
              >
                <Text style={styles.resultButtonText}>Neuer Scan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}
