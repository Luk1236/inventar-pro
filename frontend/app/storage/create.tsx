import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Slider,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import ShelfVisualizer3D from '../../components/warehouse/ShelfVisualizer3D';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function CreateStoragePage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [storageType, setStorageType] = useState<'zone' | 'location'>('zone');
  const [zones, setZones] = useState<any[]>([]);
  const [show3DPreview, setShow3DPreview] = useState(false);
  const [preview3DParams, setPreview3DParams] = useState({ blocks: 2, levels: 3, spots: 3 });
  const [formData, setFormData] = useState({
    name: '',
    type: 'Innenlager',
    description: '',
    zone_id: '',
    capacity: '',
    grid_width: '',
    grid_depth: '',
  });

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
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    typeSelectorContainer: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    typeSelector: {
      flexDirection: 'row',
      gap: 12,
    },
    typeOption: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.border,
    },
    typeOptionActive: {
      borderColor: colors.primary,
      backgroundColor: '#f0f8ff',
    },
    typeOptionText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 8,
    },
    typeOptionTextActive: {
      color: colors.primary,
    },
    typeOptionDesc: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 4,
    },
    formContainer: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
      marginTop: 16,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    typeButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    typeButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    typeButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    typeButtonText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    typeButtonTextActive: {
      color: 'white',
    },
    noZonesContainer: {
      backgroundColor: '#fff3cd',
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: '#ffc107',
    },
    noZonesText: {
      fontSize: 13,
      color: '#856404',
    },
    zoneButtons: {
      gap: 8,
    },
    zoneButton: {
      padding: 12,
      borderRadius: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    zoneButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    zoneButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    zoneButtonTextActive: {
      color: 'white',
    },
    zoneButtonType: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    createButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 32,
    },
    createButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    preview3DButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: 'transparent',
    },
    preview3DButtonText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '600',
    },
    preview3DModal: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    preview3DContainer: {
      flex: 1,
      backgroundColor: colors.background,
      marginTop: 60,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      overflow: 'hidden',
    },
    preview3DHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    preview3DHeaderTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    preview3DCloseButton: {
      padding: 8,
    },
    preview3DControls: {
      backgroundColor: colors.card,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    preview3DControlRow: {
      marginVertical: 10,
    },
    preview3DLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    preview3DLabelText: {
      flex: 1,
    },
    preview3DLabelValue: {
      color: colors.primary,
      fontWeight: '700',
    },
    preview3DSlider: {
      width: '100%',
      height: 40,
    },
    preview3DContent: {
      flex: 1,
      backgroundColor: '#141e2e',
    },
  });

  useEffect(() => {
    if (storageType === 'location') {
      loadZones();
    }
  }, [storageType]);

  const loadZones = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/api/storage-zones`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setZones(data);
      }
    } catch (error) {
      console.error('Error loading zones:', error);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Fehler', 'Name ist erforderlich');
      return;
    }

    if (storageType === 'location' && !formData.zone_id) {
      Alert.alert('Fehler', 'Bitte wählen Sie eine Lagerzone aus');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('auth_token');
      const endpoint = storageType === 'zone' ? '/api/storage-zones' : '/api/storage-locations';

      const payload = storageType === 'zone'
        ? {
            name: formData.name,
            type: formData.type,
            description: formData.description,
            grid_width: formData.grid_width ? parseInt(formData.grid_width) : undefined,
            grid_depth: formData.grid_depth ? parseInt(formData.grid_depth) : undefined,
          }
        : {
            name: formData.name,
            zone_id: formData.zone_id,
            type: formData.type,
            capacity: formData.capacity ? parseInt(formData.capacity) : null,
          };

      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        router.back();
      } else {
        Alert.alert('Fehler', 'Erstellen fehlgeschlagen');
      }
    } catch (error) {
      console.error('Error creating storage:', error);
      Alert.alert('Fehler', 'Netzwerkfehler');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {storageType === 'zone' ? 'Lagerzone erstellen' : 'Lagerort erstellen'}
        </Text>
        {storageType === 'location' && (
          <TouchableOpacity 
            style={styles.preview3DButton}
            onPress={() => setShow3DPreview(true)}
          >
            <Ionicons name="cube-outline" size={14} color={colors.primary} />
            <Text style={styles.preview3DButtonText}>3D</Text>
          </TouchableOpacity>
        )}
        {storageType !== 'location' && <View style={{ width: 24 }} />}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Type Selector */}
          <View style={styles.typeSelectorContainer}>
            <Text style={styles.sectionTitle}>Was möchten Sie erstellen?</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeOption, storageType === 'zone' && styles.typeOptionActive]}
                onPress={() => setStorageType('zone')}
              >
                <Ionicons
                  name="business-outline"
                  size={24}
                  color={storageType === 'zone' ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.typeOptionText, storageType === 'zone' && styles.typeOptionTextActive]}>
                  Lagerzone
                </Text>
                <Text style={styles.typeOptionDesc}>Hauptbereich</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeOption, storageType === 'location' && styles.typeOptionActive]}
                onPress={() => setStorageType('location')}
              >
                <Ionicons
                  name="location-outline"
                  size={24}
                  color={storageType === 'location' ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.typeOptionText, storageType === 'location' && styles.typeOptionTextActive]}>
                  Lagerort
                </Text>
                <Text style={styles.typeOptionDesc}>Innerhalb Zone</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder={storageType === 'zone' ? 'z.B. Innenlager 1' : 'z.B. Regal A1'}
              placeholderTextColor={colors.textSecondary}
            />

            {storageType === 'zone' && (
              <>
                <Text style={styles.label}>Typ</Text>
                <View style={styles.typeButtons}>
                  {['Innenlager', 'Sperrlager', 'Transport', 'Außenlager'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        formData.type === type && styles.typeButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, type })}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          formData.type === type && styles.typeButtonTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Beschreibung</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholder="Zusätzliche Informationen..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={3}
                />

                <Text style={styles.label}>Größe (Felder)</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
                  1 Feld = 1,5 m × 1,5 m · Leer lassen = automatisch
                </Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Länge (Felder)</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.grid_width}
                      onChangeText={(text) => setFormData({ ...formData, grid_width: text.replace(/[^0-9]/g, '') })}
                      placeholder="z.B. 8"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Breite (Felder)</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.grid_depth}
                      onChangeText={(text) => setFormData({ ...formData, grid_depth: text.replace(/[^0-9]/g, '') })}
                      placeholder="z.B. 6"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                {(formData.grid_width || formData.grid_depth) && (
                  <View style={{ backgroundColor: colors.primary + '18', borderRadius: 8, padding: 10, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>📐</Text>
                    <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>
                      {formData.grid_width ? `${(parseInt(formData.grid_width) * 1.5).toFixed(1)} m` : '?'}
                      {' × '}
                      {formData.grid_depth ? `${(parseInt(formData.grid_depth) * 1.5).toFixed(1)} m` : '?'}
                      {formData.grid_width && formData.grid_depth
                        ? ` = ${(parseInt(formData.grid_width) * parseInt(formData.grid_depth) * 2.25).toFixed(1)} m²`
                        : ''}
                    </Text>
                  </View>
                )}
              </>
            )}

            {storageType === 'location' && (
              <>
                <Text style={styles.label}>Lagerzone *</Text>
                {zones.length === 0 ? (
                  <View style={styles.noZonesContainer}>
                    <Text style={styles.noZonesText}>
                      ⚠️ Keine Lagerzonen verfügbar. Bitte erstellen Sie zuerst eine Lagerzone.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.zoneButtons}>
                    {zones.map((zone) => (
                      <TouchableOpacity
                        key={zone.id}
                        style={[
                          styles.zoneButton,
                          formData.zone_id === zone.id && styles.zoneButtonActive,
                        ]}
                        onPress={() => setFormData({ ...formData, zone_id: zone.id })}
                      >
                        <Text
                          style={[
                            styles.zoneButtonText,
                            formData.zone_id === zone.id && styles.zoneButtonTextActive,
                          ]}
                        >
                          {zone.name}
                        </Text>
                        <Text style={styles.zoneButtonType}>{zone.type}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <Text style={styles.label}>Lagerort-Typ</Text>
                <View style={styles.typeButtons}>
                  {['Regal', 'Fach', 'Case', 'Container'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        formData.type === type && styles.typeButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, type })}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          formData.type === type && styles.typeButtonTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Kapazität (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.capacity}
                  onChangeText={(text) => setFormData({ ...formData, capacity: text })}
                  placeholder="Max. Anzahl Artikel"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </>
            )}
          </View>

          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreate}
          >
            <Text style={styles.createButtonText}>Erstellen</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 3D Shelving Preview Modal */}
      <Modal
        visible={show3DPreview}
        transparent
        animationType="slide"
        onRequestClose={() => setShow3DPreview(false)}
      >
        <View style={styles.preview3DModal}>
          <View style={styles.preview3DContainer}>
            {/* Header */}
            <View style={styles.preview3DHeader}>
              <Text style={styles.preview3DHeaderTitle}>Regal-Vorschau 3D</Text>
              <TouchableOpacity
                style={styles.preview3DCloseButton}
                onPress={() => setShow3DPreview(false)}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Controls */}
            <View style={styles.preview3DControls}>
              <View style={styles.preview3DControlRow}>
                <View style={styles.preview3DLabel}>
                  <Text style={styles.preview3DLabelText}>Blöcke: </Text>
                  <Text style={styles.preview3DLabelValue}>{preview3DParams.blocks}</Text>
                </View>
                <Slider
                  style={styles.preview3DSlider}
                  min={1}
                  max={5}
                  step={1}
                  value={preview3DParams.blocks}
                  onValueChange={(val) =>
                    setPreview3DParams({ ...preview3DParams, blocks: val })
                  }
                />
              </View>

              <View style={styles.preview3DControlRow}>
                <View style={styles.preview3DLabel}>
                  <Text style={styles.preview3DLabelText}>Etagen: </Text>
                  <Text style={styles.preview3DLabelValue}>{preview3DParams.levels}</Text>
                </View>
                <Slider
                  style={styles.preview3DSlider}
                  min={1}
                  max={6}
                  step={1}
                  value={preview3DParams.levels}
                  onValueChange={(val) =>
                    setPreview3DParams({ ...preview3DParams, levels: val })
                  }
                />
              </View>

              <View style={styles.preview3DControlRow}>
                <View style={styles.preview3DLabel}>
                  <Text style={styles.preview3DLabelText}>Stellplätze: </Text>
                  <Text style={styles.preview3DLabelValue}>{preview3DParams.spots}</Text>
                </View>
                <Slider
                  style={styles.preview3DSlider}
                  min={1}
                  max={6}
                  step={1}
                  value={preview3DParams.spots}
                  onValueChange={(val) =>
                    setPreview3DParams({ ...preview3DParams, spots: val })
                  }
                />
              </View>
            </View>

            {/* 3D Visualizer */}
            <View style={styles.preview3DContent}>
              <ShelfVisualizer3D
                blocks={preview3DParams.blocks}
                levels={preview3DParams.levels}
                spots={preview3DParams.spots}
                fillData={{}}
                onSpotPress={(b, l, s, code, pct) => {
                  console.log(`Spot selected: ${code}`);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
