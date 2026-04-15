import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, Alert, ActivityIndicator, Modal, RefreshControl
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Vehicle {
  id: string;
  name: string;
  license_plate: string;
  brand: string;
  model_name: string;
  year?: number;
  tuev_date?: string;
  fuel_type: string;
  status: string;
  notes?: string;
}

const STATUS_COLORS: Record<string, string> = {
  'verfügbar': '#34C759',
  'in_wartung': '#FF9500',
  'ausgeliehen': '#007AFF',
};

const FUEL_TYPES = ['Diesel', 'Benzin', 'Elektro', 'Hybrid', 'Gas'];

export default function VehiclesPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', license_plate: '', brand: '', model_name: '',
    year: '', tuev_date: '', fuel_type: 'Diesel', status: 'verfügbar', notes: ''
  });

  const load = async () => {
    try {
      const data = await apiService.get<Vehicle[]>('/api/vehicles');
      setVehicles(data || []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const openCreate = () => {
    setEditVehicle(null);
    setForm({ name: '', license_plate: '', brand: '', model_name: '', year: '', tuev_date: '', fuel_type: 'Diesel', status: 'verfügbar', notes: '' });
    setShowModal(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditVehicle(v);
    setForm({
      name: v.name, license_plate: v.license_plate || '',
      brand: v.brand || '', model_name: v.model_name || '',
      year: v.year ? String(v.year) : '', tuev_date: v.tuev_date || '',
      fuel_type: v.fuel_type || 'Diesel', status: v.status || 'verfügbar', notes: v.notes || ''
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) { Alert.alert('Fehler', 'Name ist erforderlich'); return; }
    setSaving(true);
    try {
      const payload = { ...form, year: form.year ? parseInt(form.year) : undefined };
      if (editVehicle) {
        await apiService.put(`/api/vehicles/${editVehicle.id}`, payload);
      } else {
        await apiService.post('/api/vehicles', payload);
      }
      setShowModal(false);
      await load();
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Speichern fehlgeschlagen');
    }
    setSaving(false);
  };

  const deleteVehicle = async (v: Vehicle) => {
    if (!(window as any).confirm(`"${v.name}" wirklich löschen?`)) return;
    try { await apiService.delete(`/api/vehicles/${v.id}`); await load(); }
    catch (e: any) { Alert.alert('Fehler', e.message || 'Löschen fehlgeschlagen'); }
  };

  const inputStyle = [styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }];

  const isTuevSoon = (tuev?: string) => {
    if (!tuev) return false;
    const d = new Date(tuev + '-01');
    const now = new Date();
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return diff < 3;
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Fahrzeuge</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView
          style={{ flex: 1, padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {vehicles.length === 0 && (
            <View style={styles.center}>
              <Ionicons name="car-outline" size={48} color={colors.border} />
              <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Keine Fahrzeuge vorhanden</Text>
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={openCreate}>
                <Text style={{ color: 'white', fontWeight: '600' }}>Fahrzeug hinzufügen</Text>
              </TouchableOpacity>
            </View>
          )}
          {vehicles.map(v => (
            <TouchableOpacity
              key={v.id}
              style={[styles.card, { backgroundColor: colors.card }]}
              onPress={() => openEdit(v)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[styles.iconCircle, { backgroundColor: (STATUS_COLORS[v.status] || '#8E8E93') + '20' }]}>
                  <Ionicons name="car" size={22} color={STATUS_COLORS[v.status] || '#8E8E93'} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{v.name}</Text>
                    <View style={[styles.badge, { backgroundColor: STATUS_COLORS[v.status] || '#8E8E93' }]}>
                      <Text style={styles.badgeText}>{v.status}</Text>
                    </View>
                  </View>
                  {v.license_plate ? (
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700', marginTop: 2 }}>{v.license_plate}</Text>
                  ) : null}
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                    {[v.brand, v.model_name, v.year].filter(Boolean).join(' · ')}
                    {v.fuel_type ? ` · ${v.fuel_type}` : ''}
                  </Text>
                  {v.tuev_date && (
                    <Text style={{ color: isTuevSoon(v.tuev_date) ? '#FF3B30' : colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      TÜV: {v.tuev_date} {isTuevSoon(v.tuev_date) ? '⚠️' : ''}
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => deleteVehicle(v)} style={{ padding: 8 }}>
                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editVehicle ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug'}
              </Text>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Name *</Text>
              <TextInput style={inputStyle} value={form.name} onChangeText={v => setForm(p => ({...p, name: v}))} placeholder="z.B. Sprinter 1" placeholderTextColor={colors.textSecondary} />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Kennzeichen</Text>
              <TextInput style={inputStyle} value={form.license_plate} onChangeText={v => setForm(p => ({...p, license_plate: v}))} placeholder="z.B. M-AB 1234" placeholderTextColor={colors.textSecondary} autoCapitalize="characters" />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Marke</Text>
                  <TextInput style={inputStyle} value={form.brand} onChangeText={v => setForm(p => ({...p, brand: v}))} placeholder="Mercedes" placeholderTextColor={colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Modell</Text>
                  <TextInput style={inputStyle} value={form.model_name} onChangeText={v => setForm(p => ({...p, model_name: v}))} placeholder="Sprinter" placeholderTextColor={colors.textSecondary} />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Baujahr</Text>
                  <TextInput style={inputStyle} value={form.year} onChangeText={v => setForm(p => ({...p, year: v}))} placeholder="2022" placeholderTextColor={colors.textSecondary} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>TÜV bis (JJJJ-MM)</Text>
                  <TextInput style={inputStyle} value={form.tuev_date} onChangeText={v => setForm(p => ({...p, tuev_date: v}))} placeholder="2026-06" placeholderTextColor={colors.textSecondary} />
                </View>
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Kraftstoff</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {FUEL_TYPES.map(f => (
                  <TouchableOpacity key={f} onPress={() => setForm(p => ({...p, fuel_type: f}))}
                    style={[styles.chip, { backgroundColor: form.fuel_type === f ? colors.primary : colors.background, borderColor: colors.border }]}>
                    <Text style={{ color: form.fuel_type === f ? 'white' : colors.text, fontSize: 13 }}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Status</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {Object.keys(STATUS_COLORS).map(s => (
                  <TouchableOpacity key={s} onPress={() => setForm(p => ({...p, status: s}))}
                    style={[styles.chip, { backgroundColor: form.status === s ? STATUS_COLORS[s] : colors.background, borderColor: colors.border }]}>
                    <Text style={{ color: form.status === s ? 'white' : colors.text, fontSize: 13 }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Notizen</Text>
              <TextInput style={[inputStyle, { height: 70, textAlignVertical: 'top' }]} value={form.notes} onChangeText={v => setForm(p => ({...p, notes: v}))} multiline placeholder="Zusätzliche Informationen..." placeholderTextColor={colors.textSecondary} />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={[styles.btn, { borderWidth: 1, borderColor: colors.border, flex: 1 }]} onPress={() => setShowModal(false)}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary, flex: 1 }]} onPress={save} disabled={saving}>
                  {saving ? <ActivityIndicator color="white" size="small" /> : <Text style={{ color: 'white', fontWeight: '600' }}>Speichern</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  card: { borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: 'white', fontSize: 11, fontWeight: '600' },
  addBtn: { marginTop: 16, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20 },
  label: { fontSize: 13, fontWeight: '500', marginTop: 10, marginBottom: 4 },
  input: { borderRadius: 8, borderWidth: 1, padding: 11, fontSize: 15, marginBottom: 4 },
  chip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  btn: { borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
});
