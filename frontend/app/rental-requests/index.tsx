import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, Alert, ActivityIndicator, RefreshControl, Modal, FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const toISO = (d: string) => { if (!d || !d.includes('.')) return d; const [dd, mm, yyyy] = d.split('.'); return `${yyyy}-${mm}-${dd}`; };
const fmtDate = (d?: string) => { if (!d) return ''; const p = d.split('T')[0]; const [y,m,dd] = p.split('-'); return `${dd}.${m}.${y}`; };

const STATUSES = [
  { value: 'neu', label: 'Neu', color: '#007AFF' },
  { value: 'in_bearbeitung', label: 'In Bearbeitung', color: '#FF9500' },
  { value: 'angebot_gesendet', label: 'Angebot gesendet', color: '#5856D6' },
  { value: 'bestaetigt', label: 'Bestätigt', color: '#34C759' },
  { value: 'abgelehnt', label: 'Abgelehnt', color: '#FF3B30' },
];

const emptyForm = {
  customer_name: '', customer_email: '', customer_phone: '',
  event_name: '', event_date: '', event_location: '',
  description: '', status: 'neu', notes: '',
};

export default function RentalRequestsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiService.get<any[]>('/api/rental-requests');
      setRequests(data || []);
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const openCreate = () => {
    setEditingItem(null);
    setFormData({ ...emptyForm });
    setShowModal(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      customer_name: item.customer_name || '',
      customer_email: item.customer_email || '',
      customer_phone: item.customer_phone || '',
      event_name: item.event_name || '',
      event_date: fmtDate(item.event_date),
      event_location: item.event_location || '',
      description: item.description || '',
      status: item.status || 'neu',
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.customer_name.trim()) { Alert.alert('Fehler', 'Kundenname ist erforderlich'); return; }
    setSaving(true);
    try {
      if (editingItem) {
        await apiService.put(`/api/rental-requests/${editingItem.id}`, { ...formData, event_date: formData.event_date ? toISO(formData.event_date) : '' });
      } else {
        await apiService.post('/api/rental-requests', { ...formData, event_date: formData.event_date ? toISO(formData.event_date) : '' });
      }
      setShowModal(false);
      load();
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Fehler beim Speichern');
    } finally { setSaving(false); }
  };

  const handleDelete = (item: any) => {
    Alert.alert('Anfrage löschen', `Anfrage von "${item.customer_name}" löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => {
        try { await apiService.delete(`/api/rental-requests/${item.id}`); load(); }
        catch { Alert.alert('Fehler', 'Löschen fehlgeschlagen'); }
      }},
    ]);
  };

  const getStatus = (v: string) => STATUSES.find(s => s.value === v) || STATUSES[0];
  const inputStyle = { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, borderRadius: 8, padding: 12, fontSize: 16, borderWidth: 1, marginBottom: 4 };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Vermietungsanfragen</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {requests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Keine Vermietungsanfragen</Text>
          </View>
        ) : requests.map(item => {
          const statusInfo = getStatus(item.status);
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, { backgroundColor: colors.card }]}
              onPress={() => openEdit(item)}
              onLongPress={() => handleDelete(item)}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{item.customer_name}</Text>
                  {item.event_name && (
                    <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '500', marginTop: 2 }}>{item.event_name}</Text>
                  )}
                  {item.event_date && (
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                      {fmtDate(item.event_date)}
                    </Text>
                  )}
                  {item.event_location && (
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>📍 {item.event_location}</Text>
                  )}
                  {item.customer_email && (
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>{item.customer_email}</Text>
                  )}
                </View>
                <View style={[styles.badge, { backgroundColor: statusInfo.color + '20' }]}>
                  <Text style={{ color: statusInfo.color, fontSize: 12, fontWeight: '600' }}>{statusInfo.label}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>
                {editingItem ? 'Anfrage bearbeiten' : 'Neue Anfrage'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 20 }} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>Kundenname *</Text>
              <TextInput style={inputStyle} placeholder="Max Mustermann / Firma GmbH" placeholderTextColor={colors.textSecondary} value={formData.customer_name} onChangeText={v => setFormData(p => ({ ...p, customer_name: v }))} />

              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6, marginTop: 8 }}>E-Mail</Text>
              <TextInput style={inputStyle} placeholder="email@firma.de" placeholderTextColor={colors.textSecondary} value={formData.customer_email} onChangeText={v => setFormData(p => ({ ...p, customer_email: v }))} keyboardType="email-address" autoCapitalize="none" />

              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6, marginTop: 8 }}>Telefon</Text>
              <TextInput style={inputStyle} placeholder="+49 ..." placeholderTextColor={colors.textSecondary} value={formData.customer_phone} onChangeText={v => setFormData(p => ({ ...p, customer_phone: v }))} keyboardType="phone-pad" />

              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6, marginTop: 8 }}>Veranstaltungsname</Text>
              <TextInput style={inputStyle} placeholder="z.B. Firmenjubiläum 2025" placeholderTextColor={colors.textSecondary} value={formData.event_name} onChangeText={v => setFormData(p => ({ ...p, event_name: v }))} />

              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6, marginTop: 8 }}>Datum</Text>
              <TextInput style={inputStyle} placeholder="TT.MM.JJJJ" placeholderTextColor={colors.textSecondary} value={formData.event_date} onChangeText={v => setFormData(p => ({ ...p, event_date: v }))} />

              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6, marginTop: 8 }}>Veranstaltungsort</Text>
              <TextInput style={inputStyle} placeholder="Adresse / Ort" placeholderTextColor={colors.textSecondary} value={formData.event_location} onChangeText={v => setFormData(p => ({ ...p, event_location: v }))} />

              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6, marginTop: 8 }}>Beschreibung / Anfrage</Text>
              <TextInput style={[inputStyle, { height: 80, textAlignVertical: 'top' }]} placeholder="Welche Leistungen werden benötigt?" placeholderTextColor={colors.textSecondary} value={formData.description} onChangeText={v => setFormData(p => ({ ...p, description: v }))} multiline numberOfLines={3} />

              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8, marginTop: 8 }}>Status</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                {STATUSES.map(s => (
                  <TouchableOpacity
                    key={s.value}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, backgroundColor: formData.status === s.value ? s.color : 'transparent', borderColor: formData.status === s.value ? s.color : colors.border }}
                    onPress={() => setFormData(p => ({ ...p, status: s.value }))}
                  >
                    <Text style={{ color: formData.status === s.value ? 'white' : colors.text, fontSize: 12 }}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                <TouchableOpacity onPress={() => setShowModal(false)} style={{ flex: 1, borderRadius: 8, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} disabled={saving} style={{ flex: 1, borderRadius: 8, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }}>
                  {saving ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '600' }}>{editingItem ? 'Speichern' : 'Erstellen'}</Text>}
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16 },
  card: { borderRadius: 12, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
});
