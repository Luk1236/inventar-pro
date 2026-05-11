import React, { useState, useEffect } from 'react';
import {View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  RefreshControl} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService, { getToken } from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ShelfVisualizer3D from '../../components/warehouse/ShelfVisualizer3D';
import Slider from '@react-native-community/slider';

interface StorageLocation {
  id: string;
  zone_id: string;
  name: string;
  type: string;
  row?: string;
  level?: string;
  position?: string;
  capacity?: number;
  current_stock?: number;
  qr_code?: string;
}

interface StorageZone {
  id: string;
  name: string;
  description?: string;
}

export default function StorageLocationsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [zones, setZones] = useState<StorageZone[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<StorageLocation | null>(null);
  
  // Form states
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [locationType, setLocationType] = useState<'structured' | 'custom'>('structured');
  const [rowNumber, setRowNumber] = useState('');
  const [levelNumber, setLevelNumber] = useState('');
  const [positionNumber, setPositionNumber] = useState('');
  const [customName, setCustomName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [saving, setSaving] = useState(false);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [zoneDescription, setZoneDescription] = useState('');
  const [zoneType, setZoneType] = useState('Innenlager');
  const [savingZone, setSavingZone] = useState(false);
  const [show3DPreview, setShow3DPreview] = useState(false);
  const [preview3DParams, setPreview3DParams] = useState({ blocks: 2, levels: 3, spots: 3 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const token = await getToken();
      if (!token) {
        router.replace('/');
        return;
      }

      const [locationsData, zonesData] = await Promise.all([
        apiService.get<StorageLocation[]>('/api/storage-locations', { showErrorAlert: false }),
        apiService.get<StorageZone[]>('/api/storage-zones', { showErrorAlert: false }),
      ]);

      setLocations(locationsData);
      setZones(zonesData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Fehler', 'Netzwerkfehler');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (location: StorageLocation) => {
    setEditingLocation(location);
    setSelectedZoneId(location.zone_id);
    
    // Check if it's a structured location (has row-level-position format)
    if (location.name.includes('-') && location.name.split('-').length === 3) {
      const [row, level, position] = location.name.split('-');
      setLocationType('structured');
      setRowNumber(row);
      setLevelNumber(level);
      setPositionNumber(position);
    } else {
      setLocationType('custom');
      setCustomName(location.name);
    }
    
    setCapacity(location.capacity?.toString() || '');
    setShowEditModal(true);
  };

  const resetForm = () => {
    setEditingLocation(null);
    setSelectedZoneId(zones[0]?.id || '');
    setLocationType('structured');
    setRowNumber('');
    setLevelNumber('');
    setPositionNumber('');
    setCustomName('');
    setCapacity('');
  };

  const closeModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    resetForm();
  };

  const validateForm = () => {
    if (!selectedZoneId) {
      (window as any).alert('Fehler: Bitte wählen Sie eine Zone aus');
      return false;
    }

    if (locationType === 'structured') {
      if (!rowNumber || !levelNumber || !positionNumber) {
        (window as any).alert('Fehler: Bitte füllen Sie Reihe, Ebene und Platz aus');
        return false;
      }
      if (isNaN(Number(rowNumber)) || isNaN(Number(levelNumber)) || isNaN(Number(positionNumber))) {
        (window as any).alert('Fehler: Reihe, Ebene und Platz müssen Zahlen sein');
        return false;
      }
    } else {
      if (!customName.trim()) {
        (window as any).alert('Fehler: Bitte geben Sie einen Namen ein');
        return false;
      }
    }

    return true;
  };

  const handleSaveLocation = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const locationName = locationType === 'structured'
        ? `${rowNumber.padStart(2, '0')}-${levelNumber.padStart(2, '0')}-${positionNumber.padStart(2, '0')}`
        : customName.trim();

      const locationData = {
        zone_id: selectedZoneId,
        name: locationName,
        type: locationType === 'structured' ? 'shelf' : 'custom',
        capacity: capacity ? parseInt(capacity) : null,
      };

      if (editingLocation) {
        await apiService.put(`/api/storage-locations/${editingLocation.id}`, locationData);
      } else {
        await apiService.post('/api/storage-locations', locationData);
      }

      closeModals();
      loadData();
    } catch (error: any) {
      console.error('Error saving location:', error);
      (window as any).alert('Fehler: ' + (error.message || 'Speichern fehlgeschlagen'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveZone = async () => {
    if (!zoneName.trim()) {
      (window as any).alert('Fehler: Name ist erforderlich');
      return;
    }
    setSavingZone(true);
    try {
      await apiService.post('/api/storage-zones', { name: zoneName.trim(), type: zoneType, description: zoneDescription.trim() || null });
      setShowZoneModal(false);
      setZoneName('');
      setZoneDescription('');
      setZoneType('Innenlager');
      loadData();
    } catch (e: any) {
      (window as any).alert('Fehler: ' + (e.message || 'Zone konnte nicht erstellt werden'));
    } finally {
      setSavingZone(false);
    }
  };

  const handleDeleteZone = async (zoneId: string, zoneName: string) => {
    if (!(window as any).confirm(`Zone "${zoneName}" wirklich löschen?`)) return;
    try {
      await apiService.delete(`/api/storage-zones/${zoneId}`);
      loadData();
    } catch {
      Alert.alert('Fehler', 'Zone konnte nicht gelöscht werden');
    }
  };

  const handleDeleteLocation = async (locationId: string, locationName: string) => {
    if (!(window as any).confirm(`"${locationName}" wirklich löschen?`)) return;
    try {
      await apiService.delete(`/api/storage-locations/${locationId}`);
      loadData();
    } catch {
      (window as any).alert('Fehler: Löschen fehlgeschlagen');
    }
  };

  const getZoneName = (zoneId: string) => {
    return zones.find(z => z.id === zoneId)?.name || 'Unbekannte Zone';
  };

  const renderLocationForm = (isEdit: boolean) => (
    <View style={styles.modalContent}>
      {/* Zone Selection */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Zone *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipContainer}>
            {zones.map(zone => (
              <TouchableOpacity
                key={zone.id}
                style={[styles.chip, selectedZoneId === zone.id && styles.selectedChip]}
                onPress={() => setSelectedZoneId(zone.id)}
              >
                <Text style={[styles.chipText, selectedZoneId === zone.id && styles.selectedChipText]}>
                  {zone.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Location Type */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Typ *</Text>
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[styles.typeButton, locationType === 'structured' && styles.typeButtonActive]}
            onPress={() => setLocationType('structured')}
          >
            <Ionicons 
              name="grid-outline" 
              size={20} 
              color={locationType === 'structured' ? '#007AFF' : '#666'} 
            />
            <Text style={[styles.typeButtonText, locationType === 'structured' && styles.typeButtonTextActive]}>
              Strukturiert
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.typeButton, locationType === 'custom' && styles.typeButtonActive]}
            onPress={() => setLocationType('custom')}
          >
            <Ionicons 
              name="pencil-outline" 
              size={20} 
              color={locationType === 'custom' ? '#007AFF' : '#666'} 
            />
            <Text style={[styles.typeButtonText, locationType === 'custom' && styles.typeButtonTextActive]}>
              Benutzerdefiniert
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Structured Input */}
      {locationType === 'structured' ? (
        <View style={styles.structuredContainer}>
          <Text style={styles.structuredTitle}>Lagerort-Struktur</Text>
          <View style={styles.structuredInputs}>
            <View style={styles.structuredInputGroup}>
              <Text style={styles.structuredLabel}>Reihe</Text>
              <TextInput
                style={styles.structuredInput}
                value={rowNumber}
                onChangeText={setRowNumber}
                placeholder="01"
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
            
            <Text style={styles.structuredSeparator}>-</Text>
            
            <View style={styles.structuredInputGroup}>
              <Text style={styles.structuredLabel}>Ebene</Text>
              <TextInput
                style={styles.structuredInput}
                value={levelNumber}
                onChangeText={setLevelNumber}
                placeholder="02"
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
            
            <Text style={styles.structuredSeparator}>-</Text>
            
            <View style={styles.structuredInputGroup}>
              <Text style={styles.structuredLabel}>Platz</Text>
              <TextInput
                style={styles.structuredInput}
                value={positionNumber}
                onChangeText={setPositionNumber}
                placeholder="03"
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
          </View>
          
          {rowNumber && levelNumber && positionNumber && (
            <View style={styles.previewContainer}>
              <Text style={styles.previewLabel}>Vorschau:</Text>
              <Text style={styles.previewText}>
                {rowNumber.padStart(2, '0')}-{levelNumber.padStart(2, '0')}-{positionNumber.padStart(2, '0')}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            value={customName}
            onChangeText={setCustomName}
            placeholder="z.B. Regal-A, Case-123"
          />
        </View>
      )}

      {/* Capacity */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Kapazität (optional)</Text>
        <TextInput
          style={styles.input}
          value={capacity}
          onChangeText={setCapacity}
          placeholder="Maximale Anzahl Artikel"
          keyboardType="number-pad"
        />
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSaveLocation}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.saveButtonText}>
            {isEdit ? 'Änderungen speichern' : 'Lagerort erstellen'}
          </Text>
        )}
      </TouchableOpacity>

      {/* 3D Preview Button */}
      <TouchableOpacity
        style={styles.preview3DButtonLocation}
        onPress={() => setShow3DPreview(true)}
      >
        <Ionicons name="cube-outline" size={16} color={colors.primary} />
        <Text style={[styles.saveButtonText, { color: colors.primary, fontSize: 14 }]}>
          3D-Regal-Vorschau anzeigen
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Lade Lagerorte...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Lagerorte</Text>
        <TouchableOpacity onPress={openAddModal}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Zones Section */}
        <View style={{ margin: 16, marginBottom: 0 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Zonen ({zones.length})</Text>
            <TouchableOpacity onPress={() => setShowZoneModal(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
              <Ionicons name="add" size={18} color="white" />
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>Zone anlegen</Text>
            </TouchableOpacity>
          </View>
          {zones.length === 0 ? (
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>Noch keine Zonen. Zuerst eine Zone anlegen, dann Lagerorte erstellen.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {zones.map(zone => (
                  <View key={zone.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, gap: 6 }}>
                    <Text style={{ color: colors.text, fontWeight: '500' }}>{zone.name}</Text>
                    <TouchableOpacity onPress={() => handleDeleteZone(zone.id, zone.name)}>
                      <Ionicons name="close-circle" size={18} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#007AFF" />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>Strukturierte Lagerorte</Text>
            <Text style={styles.infoText}>
              Format: Reihe-Ebene-Platz (z.B. 01-02-03)
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>
            {locations.length} Lagerort{locations.length !== 1 ? 'e' : ''}
          </Text>
        </View>

        {/* Locations List */}
        {locations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="location-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>Keine Lagerorte gefunden</Text>
            <Text style={styles.emptyText}>
              Erstellen Sie Ihren ersten Lagerort
            </Text>
            <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
              <Text style={styles.addButtonText}>Lagerort hinzufügen</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.locationsList}>
            {locations.map(location => (
              <View key={location.id} style={styles.locationCard}>
                <View style={styles.locationHeader}>
                  <View style={styles.locationIconContainer}>
                    <Ionicons name="location" size={24} color="#007AFF" />
                  </View>
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationName}>{location.name}</Text>
                    <Text style={styles.locationZone}>{getZoneName(location.zone_id)}</Text>
                    {location.capacity && (
                      <View style={styles.capacityContainer}>
                        <Ionicons name="cube-outline" size={14} color="#666" />
                        <Text style={styles.capacityText}>
                          {location.current_stock || 0} / {location.capacity}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.locationActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => openEditModal(location)}
                  >
                    <Ionicons name="create-outline" size={20} color="#007AFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteLocation(location.id, location.name)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={closeModals}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Neuer Lagerort</Text>
              <TouchableOpacity onPress={closeModals}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
              {renderLocationForm(false)}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Zone Modal */}
      <Modal visible={showZoneModal} transparent animationType="slide" onRequestClose={() => setShowZoneModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Neue Zone anlegen</Text>
              <TouchableOpacity onPress={() => setShowZoneModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 24 }}>
              <Text style={styles.label}>Name *</Text>
              <TextInput style={styles.input} value={zoneName} onChangeText={setZoneName} placeholder="z.B. Hauptlager, Bühne, Außenlager" />
              <Text style={[styles.label, { marginTop: 16 }]}>Typ *</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                {['Innenlager', 'Sperrlager', 'Transport'].map(t => (
                  <TouchableOpacity key={t} onPress={() => setZoneType(t)} style={{ flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 2, borderColor: zoneType === t ? colors.primary : colors.border, backgroundColor: zoneType === t ? (isDark ? '#1a3a5c' : '#f0f8ff') : colors.background, alignItems: 'center' }}>
                    <Text style={{ color: zoneType === t ? colors.primary : colors.textSecondary, fontWeight: '600', fontSize: 13 }}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.label, { marginTop: 16 }]}>Beschreibung</Text>
              <TextInput style={styles.input} value={zoneDescription} onChangeText={setZoneDescription} placeholder="Optional" />
              <TouchableOpacity style={[styles.saveButton, { marginTop: 24 }, savingZone && styles.saveButtonDisabled]} onPress={handleSaveZone} disabled={savingZone}>
                {savingZone ? <ActivityIndicator color="white" /> : <Text style={styles.saveButtonText}>Zone erstellen</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={closeModals}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lagerort bearbeiten</Text>
              <TouchableOpacity onPress={closeModals}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {renderLocationForm(true)}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  infoTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
  },
  statsContainer: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  statsText: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  addButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 24,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  locationsList: {
    padding: 16,
  },
  locationCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  locationIconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  locationZone: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 4,
  },
  capacityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  capacityText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  locationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalContent: {
    padding: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: 'white',
  },
  chipContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f3f4',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  selectedChip: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  chipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedChipText: {
    color: 'white',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f1f3f4',
    borderWidth: 2,
    borderColor: '#e9ecef',
    gap: 8,
  },
  typeButtonActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  structuredContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  structuredTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  structuredInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  structuredInputGroup: {
    flex: 1,
    alignItems: 'center',
  },
  structuredLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  structuredInput: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
    backgroundColor: 'white',
  },
  structuredSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginHorizontal: 8,
  },
  previewContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  previewText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
