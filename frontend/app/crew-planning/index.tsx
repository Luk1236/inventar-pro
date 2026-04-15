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
  Modal,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiService from '../../services/apiService';
import { useTheme } from '../../contexts/ThemeContext';

interface CrewMember {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  hourly_rate: number;
  skills: string[];
  is_available: boolean;
}

interface Vehicle {
  id: string;
  name: string;
  type: string;
  license_plate: string;
  capacity_kg: number;
  loading_meters: number;
  is_available: boolean;
}

interface Assignment {
  id: string;
  event_id: string;
  event_name: string;
  crew_ids: string[];
  vehicle_id?: string;
  start_date: string;
  notes: string;
}

export default function CrewPlanningPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'crew' | 'vehicles' | 'assignments'>('crew');
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [_assignments, setAssignments] = useState<Assignment[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', role: '', phone: '', hourly_rate: '' });
  const [newVehicle, setNewVehicle] = useState({ name: '', type: '', license_plate: '', capacity_kg: '' });

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.border },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    tabs: { flexDirection: 'row', backgroundColor: colors.card, padding: 8, gap: 8 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, gap: 6, backgroundColor: colors.background },
    activeTab: { backgroundColor: colors.primary + '15' },
    tabText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
    activeTabText: { color: colors.primary },
    content: { flex: 1, padding: 16 },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 16 },
    emptyHint: { fontSize: 14, color: colors.textSecondary, marginTop: 8 },
    addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, marginTop: 20, gap: 8 },
    addButtonText: { color: colors.card, fontSize: 15, fontWeight: '600' },
    card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 20, fontWeight: '700' },
    vehicleIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    cardInfo: { flex: 1 },
    cardName: { fontSize: 16, fontWeight: '600', color: colors.text },
    roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
    roleText: { fontSize: 12, color: colors.card, fontWeight: '600' },
    licensePlate: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
    statusToggle: { padding: 4 },
    statusAvailable: {},
    cardDetails: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    detailText: { fontSize: 14, color: colors.text },
    vehicleStats: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 20 },
    stat: { alignItems: 'center' },
    statValue: { fontSize: 18, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 11, color: colors.textSecondary },
    typeBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, marginLeft: 'auto' },
    typeText: { fontSize: 12, fontWeight: '600', color: '#5856D6' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    input: { backgroundColor: colors.background, borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 12, color: colors.text },
    saveButton: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
    saveButtonText: { color: colors.card, fontSize: 16, fontWeight: '600' },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load crew members
      const crewData = await apiService.get<CrewMember[]>('/api/crew', { showErrorAlert: false });
      setCrew(crewData || []);

      // Load vehicles
      const vehicleData = await apiService.get<Vehicle[]>('/api/vehicles', { showErrorAlert: false });
      setVehicles(vehicleData || []);

      // Load assignments
      const assignmentData = await apiService.get<Assignment[]>('/api/crew-assignments', { showErrorAlert: false });
      setAssignments(assignmentData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCrewMember = async () => {
    if (!newMember.name || !newMember.role) {
      Alert.alert('Fehler', 'Name und Rolle sind erforderlich');
      return;
    }

    try {
      await apiService.post('/api/crew', {
        ...newMember,
        hourly_rate: parseFloat(newMember.hourly_rate) || 0,
        skills: [],
        is_available: true
      });
      setShowAddModal(false);
      setNewMember({ name: '', role: '', phone: '', hourly_rate: '' });
      loadData();
    } catch (error: any) {
      Alert.alert('Fehler', error.message);
    }
  };

  const handleAddVehicle = async () => {
    if (!newVehicle.name || !newVehicle.license_plate) {
      Alert.alert('Fehler', 'Name und Kennzeichen sind erforderlich');
      return;
    }

    try {
      await apiService.post('/api/vehicles', {
        ...newVehicle,
        capacity_kg: parseFloat(newVehicle.capacity_kg) || 0,
        loading_meters: 0,
        is_available: true
      });
      setShowAddModal(false);
      setNewVehicle({ name: '', type: '', license_plate: '', capacity_kg: '' });
      loadData();
    } catch (error: any) {
      Alert.alert('Fehler', error.message);
    }
  };

  const toggleAvailability = async (type: 'crew' | 'vehicle', id: string, current: boolean) => {
    try {
      const endpoint = type === 'crew' ? `/api/crew/${id}` : `/api/vehicles/${id}`;
      await apiService.put(endpoint, { is_available: !current });
      loadData();
    } catch (error: any) {
      Alert.alert('Fehler', error.message);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'techniker': return '#5856D6';
      case 'fahrer': return '#FF9500';
      case 'projektleiter': return colors.primary;
      case 'helfer': return '#34C759';
      default: return colors.textSecondary;
    }
  };

  const getVehicleIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'sprinter': return 'car-sport';
      case 'lkw': return 'bus';
      case 'anhänger': return 'train';
      default: return 'car';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>👷 Crew & Fuhrpark</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)}>
          <Ionicons name="add-circle" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'crew' && styles.activeTab]}
          onPress={() => setActiveTab('crew')}
        >
          <Ionicons name="people" size={20} color={activeTab === 'crew' ? colors.primary : colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'crew' && styles.activeTabText]}>
            Crew ({crew.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'vehicles' && styles.activeTab]}
          onPress={() => setActiveTab('vehicles')}
        >
          <Ionicons name="car" size={20} color={activeTab === 'vehicles' ? colors.primary : colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'vehicles' && styles.activeTabText]}>
            Fahrzeuge ({vehicles.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'assignments' && styles.activeTab]}
          onPress={() => setActiveTab('assignments')}
        >
          <Ionicons name="calendar" size={20} color={activeTab === 'assignments' ? colors.primary : colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'assignments' && styles.activeTabText]}>
            Einsätze
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Crew Tab */}
        {activeTab === 'crew' && (
          <>
            {crew.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
                <Text style={styles.emptyText}>Keine Crew-Mitglieder</Text>
                <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
                  <Ionicons name="add" size={20} color={colors.card} />
                  <Text style={styles.addButtonText}>Mitarbeiter hinzufügen</Text>
                </TouchableOpacity>
              </View>
            ) : (
              crew.map(member => (
                <View key={member.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.avatar, { backgroundColor: getRoleColor(member.role) + '20' }]}>
                      <Text style={[styles.avatarText, { color: getRoleColor(member.role) }]}>
                        {member.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName}>{member.name}</Text>
                      <View style={[styles.roleBadge, { backgroundColor: getRoleColor(member.role) }]}>
                        <Text style={styles.roleText}>{member.role}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.statusToggle, member.is_available && styles.statusAvailable]}
                      onPress={() => toggleAvailability('crew', member.id, member.is_available)}
                    >
                      <Ionicons
                        name={member.is_available ? 'checkmark-circle' : 'close-circle'}
                        size={24}
                        color={member.is_available ? '#34C759' : '#FF3B30'}
                      />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.cardDetails}>
                    {member.phone && (
                      <View style={styles.detailRow}>
                        <Ionicons name="call-outline" size={16} color={colors.textSecondary} />
                        <Text style={styles.detailText}>{member.phone}</Text>
                      </View>
                    )}
                    <View style={styles.detailRow}>
                      <Ionicons name="cash-outline" size={16} color={colors.textSecondary} />
                      <Text style={styles.detailText}>{member.hourly_rate}€/Stunde</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* Vehicles Tab */}
        {activeTab === 'vehicles' && (
          <>
            {vehicles.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="car-outline" size={64} color={colors.textSecondary} />
                <Text style={styles.emptyText}>Keine Fahrzeuge</Text>
                <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
                  <Ionicons name="add" size={20} color={colors.card} />
                  <Text style={styles.addButtonText}>Fahrzeug hinzufügen</Text>
                </TouchableOpacity>
              </View>
            ) : (
              vehicles.map(vehicle => (
                <View key={vehicle.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.vehicleIcon, { backgroundColor: '#FF950020' }]}>
                      <Ionicons name={getVehicleIcon(vehicle.type) as any} size={24} color="#FF9500" />
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName}>{vehicle.name}</Text>
                      <Text style={styles.licensePlate}>{vehicle.license_plate}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.statusToggle, vehicle.is_available && styles.statusAvailable]}
                      onPress={() => toggleAvailability('vehicle', vehicle.id, vehicle.is_available)}
                    >
                      <Ionicons
                        name={vehicle.is_available ? 'checkmark-circle' : 'close-circle'}
                        size={24}
                        color={vehicle.is_available ? '#34C759' : '#FF3B30'}
                      />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.vehicleStats}>
                    <View style={styles.stat}>
                      <Text style={styles.statValue}>{vehicle.capacity_kg}</Text>
                      <Text style={styles.statLabel}>kg</Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={styles.statValue}>{vehicle.loading_meters || '-'}</Text>
                      <Text style={styles.statLabel}>LDM</Text>
                    </View>
                    <View style={[styles.typeBadge, { backgroundColor: '#5856D620' }]}>
                      <Text style={styles.typeText}>{vehicle.type}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* Assignments Tab */}
        {activeTab === 'assignments' && (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyText}>Einsatzplanung</Text>
            <Text style={styles.emptyHint}>Weisen Sie Crew & Fahrzeuge Events zu</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => router.push('/events')}>
              <Ionicons name="calendar" size={20} color={colors.card} />
              <Text style={styles.addButtonText}>Zu Events</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {activeTab === 'crew' ? '👷 Mitarbeiter hinzufügen' : '🚗 Fahrzeug hinzufügen'}
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {activeTab === 'crew' ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Name *"
                  placeholderTextColor={colors.textSecondary}
                  value={newMember.name}
                  onChangeText={(text) => setNewMember({ ...newMember, name: text })}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Rolle * (z.B. Techniker, Fahrer)"
                  placeholderTextColor={colors.textSecondary}
                  value={newMember.role}
                  onChangeText={(text) => setNewMember({ ...newMember, role: text })}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Telefon"
                  placeholderTextColor={colors.textSecondary}
                  value={newMember.phone}
                  onChangeText={(text) => setNewMember({ ...newMember, phone: text })}
                  keyboardType="phone-pad"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Stundenlohn (€)"
                  placeholderTextColor={colors.textSecondary}
                  value={newMember.hourly_rate}
                  onChangeText={(text) => setNewMember({ ...newMember, hourly_rate: text })}
                  keyboardType="numeric"
                />
                <TouchableOpacity style={styles.saveButton} onPress={handleAddCrewMember}>
                  <Text style={styles.saveButtonText}>Speichern</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Name * (z.B. Sprinter 1)"
                  placeholderTextColor={colors.textSecondary}
                  value={newVehicle.name}
                  onChangeText={(text) => setNewVehicle({ ...newVehicle, name: text })}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Typ (z.B. Sprinter, LKW)"
                  placeholderTextColor={colors.textSecondary}
                  value={newVehicle.type}
                  onChangeText={(text) => setNewVehicle({ ...newVehicle, type: text })}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Kennzeichen *"
                  placeholderTextColor={colors.textSecondary}
                  value={newVehicle.license_plate}
                  onChangeText={(text) => setNewVehicle({ ...newVehicle, license_plate: text })}
                  autoCapitalize="characters"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Kapazität (kg)"
                  placeholderTextColor={colors.textSecondary}
                  value={newVehicle.capacity_kg}
                  onChangeText={(text) => setNewVehicle({ ...newVehicle, capacity_kg: text })}
                  keyboardType="numeric"
                />
                <TouchableOpacity style={styles.saveButton} onPress={handleAddVehicle}>
                  <Text style={styles.saveButtonText}>Speichern</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
