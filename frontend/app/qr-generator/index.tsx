import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { writeAsStringAsync, documentDirectory, EncodingType } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function QRGeneratorPage() {
  const insets = useSafeAreaInsets();
  const [articles, setArticles] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState<'article' | 'location'>('article');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const qrRef = useRef<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [articlesData, locationsData] = await Promise.all([
        apiService.get<any[]>('/api/articles', { showErrorAlert: false }),
        apiService.get<any[]>('/api/storage-locations', { showErrorAlert: false }),
      ]);
      setArticles(articlesData || []);
      setLocations(locationsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const generateQRData = (item: any) => {
    if (selectedType === 'article') {
      return JSON.stringify({
        type: 'article',
        id: item.id,
        code: item.inventory_code,
        name: item.name,
      });
    } else {
      return JSON.stringify({
        type: 'location',
        id: item.id,
        name: item.name,
      });
    }
  };

  const handleShare = async () => {
    if (!selectedItem) return;

    try {
      if (Platform.OS === 'web') {
        Alert.alert('Info', 'Teilen ist auf Web nicht verfügbar. Machen Sie einen Screenshot.');
        return;
      }

      // Get the QR code as base64
      qrRef.current?.toDataURL(async (data: string) => {
        const filename = documentDirectory + `qr_${selectedItem.id}.png`;
        await writeAsStringAsync(filename, data, {
          encoding: EncodingType.Base64,
        });
        
        await Sharing.shareAsync(filename);
      });
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Fehler', 'QR-Code konnte nicht geteilt werden');
    }
  };

  const handlePrint = () => {
    Alert.alert(
      'Drucken',
      'Machen Sie einen Screenshot und drucken Sie diesen, oder teilen Sie den QR-Code.',
      [
        { text: 'Screenshot machen', onPress: () => {} },
        { text: 'Teilen', onPress: handleShare },
        { text: 'Abbrechen', style: 'cancel' },
      ]
    );
  };

  const currentList = selectedType === 'article' ? articles : locations;

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QR-Code Generator</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {/* Type Selector */}
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[styles.typeButton, selectedType === 'article' && styles.typeButtonActive]}
            onPress={() => { setSelectedType('article'); setSelectedItem(null); }}
          >
            <Ionicons
              name="cube"
              size={24}
              color={selectedType === 'article' ? '#fff' : '#007AFF'}
            />
            <Text style={[styles.typeButtonText, selectedType === 'article' && styles.typeButtonTextActive]}>
              Artikel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeButton, selectedType === 'location' && styles.typeButtonActive]}
            onPress={() => { setSelectedType('location'); setSelectedItem(null); }}
          >
            <Ionicons
              name="location"
              size={24}
              color={selectedType === 'location' ? '#fff' : '#007AFF'}
            />
            <Text style={[styles.typeButtonText, selectedType === 'location' && styles.typeButtonTextActive]}>
              Lagerort
            </Text>
          </TouchableOpacity>
        </View>

        {/* QR Code Display */}
        {selectedItem ? (
          <View style={styles.qrContainer}>
            <View style={styles.qrCard}>
              <Text style={styles.qrTitle}>
                {selectedType === 'article' ? 'Artikel' : 'Lagerort'}
              </Text>
              <Text style={styles.qrItemName}>{selectedItem.name}</Text>
              {selectedType === 'article' && (
                <Text style={styles.qrItemCode}>{selectedItem.inventory_code}</Text>
              )}
              
              <View style={styles.qrCodeWrapper}>
                <QRCode
                  value={generateQRData(selectedItem)}
                  size={200}
                  backgroundColor="white"
                  color="black"
                  getRef={(ref) => (qrRef.current = ref)}
                />
              </View>

              <View style={styles.qrActions}>
                <TouchableOpacity style={styles.qrActionButton} onPress={handleShare}>
                  <Ionicons name="share-outline" size={20} color="#007AFF" />
                  <Text style={styles.qrActionText}>Teilen</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.qrActionButton} onPress={handlePrint}>
                  <Ionicons name="print-outline" size={20} color="#007AFF" />
                  <Text style={styles.qrActionText}>Drucken</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.qrHint}>
                💡 Scannen Sie diesen Code mit der QR-Scanner-Funktion in der App
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyQR}>
            <Ionicons name="qr-code-outline" size={64} color="#ccc" />
            <Text style={styles.emptyQRText}>Wählen Sie ein Element aus</Text>
          </View>
        )}

        {/* Item List */}
        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>
            {selectedType === 'article' ? `Artikel (${articles.length})` : `Lagerorte (${locations.length})`}
          </Text>
          
          {currentList.length === 0 ? (
            <View style={styles.emptyList}>
              <Text style={styles.emptyListText}>
                Keine {selectedType === 'article' ? 'Artikel' : 'Lagerorte'} verfügbar
              </Text>
            </View>
          ) : (
            currentList.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.listItem,
                  selectedItem?.id === item.id && styles.listItemActive,
                ]}
                onPress={() => setSelectedItem(item)}
              >
                <View style={styles.listItemIcon}>
                  <Ionicons
                    name={selectedType === 'article' ? 'cube' : 'location'}
                    size={20}
                    color={selectedItem?.id === item.id ? '#007AFF' : '#666'}
                  />
                </View>
                <View style={styles.listItemInfo}>
                  <Text style={styles.listItemName}>{item.name}</Text>
                  {selectedType === 'article' && (
                    <Text style={styles.listItemCode}>{item.inventory_code}</Text>
                  )}
                </View>
                {selectedItem?.id === item.id && (
                  <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  typeSelector: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#007AFF',
    gap: 8,
  },
  typeButtonActive: {
    backgroundColor: '#007AFF',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  typeButtonTextActive: {
    color: 'white',
  },
  qrContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  qrCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  qrTitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  qrItemName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
    textAlign: 'center',
  },
  qrItemCode: {
    fontSize: 14,
    color: '#007AFF',
    marginTop: 4,
  },
  qrCodeWrapper: {
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    marginVertical: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  qrActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  qrActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f0f8ff',
    gap: 6,
  },
  qrActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  qrHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  emptyQR: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyQRText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  listContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  listItemActive: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  listItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listItemInfo: {
    flex: 1,
  },
  listItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  listItemCode: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  emptyList: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 14,
    color: '#999',
  },
});
