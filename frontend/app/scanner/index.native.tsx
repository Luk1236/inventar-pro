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
  Dimensions,
  TextInput,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScannedResult {
  type: 'article' | 'location' | 'unknown';
  data: any;
}

export default function ScannerPageNative() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [flashMode, setFlashMode] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [scanResult, setScanResult] = useState<ScannedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const handleBarcodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);
    // Kurzes haptisches Feedback beim Scan-Erkennen
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log(`Scanned ${type} with data: ${data}`);
    await processScannedData(data);
  };

  const processScannedData = async (scannedData: string) => {
    setLoading(true);
    
    try {
      let result: ScannedResult = { type: 'unknown', data: null };

      // Search in articles
      const articles = await apiService.get<any[]>('/api/articles', { showErrorAlert: false });
      
      if (articles) {
        let foundArticle = articles.find((article: any) => 
          article.qr_code === scannedData ||
          article.inventory_code === scannedData ||
          article.serial_number === scannedData
        );

      // Found article
      if (foundArticle) {
        result = { type: 'article', data: foundArticle };
        setScanResult(result);
        setShowResult(true);
        setLoading(false);
        // Erfolgs-Feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }
    }

      // Search in storage locations
      const locations = await apiService.get<any[]>('/api/storage-locations', { showErrorAlert: false });
      
      if (locations) {
        let foundLocation = locations.find((location: any) => 
          location.qr_code === scannedData ||
          location.location_code === scannedData
        );

        if (foundLocation) {
          result = { type: 'location', data: foundLocation };
          setScanResult(result);
          setShowResult(true);
          setLoading(false);
          // Erfolgs-Feedback
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return;
        }
      }

      // Not found — Fehler-Feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      result = { type: 'unknown', data: { scannedCode: scannedData } };
      setScanResult(result);
      setShowResult(true);
      
    } catch (error) {
      console.error('Error processing scan:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Fehler', 'Fehler bei der Verarbeitung des Scans');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = async () => {
    if (!manualInput.trim()) {
      Alert.alert('Fehler', 'Bitte geben Sie einen Code ein');
      return;
    }
    
    setShowManualInput(false);
    await processScannedData(manualInput.trim());
  };

  const resetScanner = () => {
    setScanned(false);
    setShowResult(false);
    setScanResult(null);
    setManualInput('');
  };

  const navigateToArticle = () => {
    if (scanResult?.type === 'article') {
      router.push(`/articles/${scanResult.data.id}`);
    }
  };

  const navigateToLocation = () => {
    if (scanResult?.type === 'location') {
      router.push('/storage');
    }
  };

  // Permission not determined yet
  if (!permission) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.permissionText, { color: colors.text }]}>Lade Kamera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>QR-Scanner</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.permissionTitle, { color: colors.text }]}>Kamerazugriff erforderlich</Text>
          <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
            Um QR-Codes zu scannen, benötigt die App Zugriff auf Ihre Kamera.
          </Text>
          <TouchableOpacity style={[styles.permissionButton, { backgroundColor: colors.primary }]} onPress={requestPermission}>
            <Ionicons name="camera" size={20} color="white" />
            <Text style={styles.permissionButtonText}>Kamera aktivieren</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.manualButton, { borderColor: colors.primary }]} onPress={() => setShowManualInput(true)}>
            <Ionicons name="keypad" size={20} color={colors.primary} />
            <Text style={[styles.manualButtonText, { color: colors.primary }]}>Code manuell eingeben</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.cameraHeader}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.cameraHeaderTitle}>QR-Scanner</Text>
        <TouchableOpacity style={styles.headerButton} onPress={() => setFlashMode(!flashMode)}>
          <Ionicons name={flashMode ? "flash" : "flash-off"} size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Camera View */}
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={flashMode}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'code93'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      >
        {/* Scan Overlay */}
        <View style={styles.overlay}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          
          <Text style={styles.scanHint}>
            {loading ? 'Verarbeite...' : 'QR-Code in den Rahmen halten'}
          </Text>
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="white" />
          </View>
        )}
      </CameraView>

      {/* Bottom Actions */}
      <View style={[styles.bottomActions, { backgroundColor: colors.card }]}>
        <TouchableOpacity style={styles.actionButton} onPress={() => setShowManualInput(true)}>
          <Ionicons name="keypad" size={24} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.text }]}>Manuell eingeben</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/qr-generator')}>
          <Ionicons name="qr-code" size={24} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.text }]}>QR generieren</Text>
        </TouchableOpacity>
      </View>

      {/* Manual Input Modal */}
      <Modal visible={showManualInput} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Code manuell eingeben</Text>
              <TouchableOpacity onPress={() => setShowManualInput(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="Inventar-Code oder QR-Code..."
                placeholderTextColor={colors.textSecondary}
                value={manualInput}
                onChangeText={setManualInput}
                autoCapitalize="characters"
                autoFocus
              />
              
              <TouchableOpacity style={[styles.searchButton, { backgroundColor: colors.primary }]} onPress={handleManualSearch}>
                <Ionicons name="search" size={20} color="white" />
                <Text style={styles.searchButtonText}>Suchen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Result Modal */}
      <Modal visible={showResult} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Scan-Ergebnis</Text>
              <TouchableOpacity onPress={resetScanner}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              {scanResult?.type === 'article' && (
                <View style={styles.resultContent}>
                  <View style={[styles.resultIcon, { backgroundColor: '#E3F2FD' }]}>
                    <Ionicons name="cube" size={40} color={colors.primary} />
                  </View>
                  <Text style={[styles.resultTitle, { color: colors.text }]}>{scanResult.data.name}</Text>
                  <Text style={[styles.resultSubtitle, { color: colors.primary }]}>{scanResult.data.inventory_code}</Text>
                  <Text style={[styles.resultInfo, { color: colors.textSecondary }]}>
                    Bestand: {scanResult.data.current_stock} {scanResult.data.base_unit}
                  </Text>
                  
                  <TouchableOpacity style={[styles.resultButton, { backgroundColor: colors.primary }]} onPress={navigateToArticle}>
                    <Text style={styles.resultButtonText}>Artikel öffnen</Text>
                  </TouchableOpacity>
                </View>
              )}

              {scanResult?.type === 'location' && (
                <View style={styles.resultContent}>
                  <View style={[styles.resultIcon, { backgroundColor: '#E8F5E9' }]}>
                    <Ionicons name="location" size={40} color="#34C759" />
                  </View>
                  <Text style={[styles.resultTitle, { color: colors.text }]}>{scanResult.data.name}</Text>
                  <Text style={[styles.resultSubtitle, { color: '#34C759' }]}>{scanResult.data.location_code}</Text>
                  
                  <TouchableOpacity style={[styles.resultButton, { backgroundColor: '#34C759' }]} onPress={navigateToLocation}>
                    <Text style={styles.resultButtonText}>Lagerort öffnen</Text>
                  </TouchableOpacity>
                </View>
              )}

              {scanResult?.type === 'unknown' && (
                <View style={styles.resultContent}>
                  <View style={[styles.resultIcon, { backgroundColor: '#FFF3E0' }]}>
                    <Ionicons name="help-circle" size={40} color="#FF9500" />
                  </View>
                  <Text style={[styles.resultTitle, { color: colors.text }]}>Nicht gefunden</Text>
                  <Text style={[styles.resultInfo, { color: colors.textSecondary }]}>
                    Code: {scanResult.data?.scannedCode}
                  </Text>
                  <Text style={[styles.resultHint, { color: colors.textSecondary }]}>
                    Dieser Code ist nicht im System registriert.
                  </Text>
                </View>
              )}

              <TouchableOpacity style={[styles.scanAgainButton, { borderColor: colors.primary }]} onPress={resetScanner}>
                <Ionicons name="scan" size={20} color={colors.primary} />
                <Text style={[styles.scanAgainText, { color: colors.primary }]}>Erneut scannen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');
const SCAN_FRAME_SIZE = width * 0.7;

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
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 2,
    marginTop: 16,
    gap: 8,
  },
  manualButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  camera: {
    flex: 1,
  },
  cameraHeader: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraHeaderTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: SCAN_FRAME_SIZE,
    height: SCAN_FRAME_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: 'white',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanHint: {
    color: 'white',
    fontSize: 16,
    marginTop: 24,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalBody: {
    padding: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  searchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  resultIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  resultSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  resultInfo: {
    fontSize: 14,
    marginBottom: 4,
  },
  resultHint: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  resultButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 16,
  },
  resultButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 2,
    marginTop: 16,
    gap: 8,
  },
  scanAgainText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
