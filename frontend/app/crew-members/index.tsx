import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, RefreshControl, TextInput, Alert, Modal, FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ROLES = ['Techniker', 'Fahrer', 'Bühne', 'Licht', 'Ton', 'Rigging', 'Security', 'Sonstige'];

export default function CrewMembersPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [crew, setCrew] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '', phone: '', role: 'Techniker', notes: '',
  });

  const load = useCallback(async () => {
    try {
      const data = await apiService.get<any[]>('/api/crew');
      setCrew(data || []);
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const getName = (m: any) =>
    m.first_name ? `${m.first_name} ${m.last_name}` : m.name || 'Unbekannt';

  const filtered = crew.filter(m =>
    getName(m).toLowerCase().includes(search.toLowerCase()) ||
    (m.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.role || '').toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingItem(null);
    setFormData({ first_name: '', last_name: '', email: '', phone: '', role: 'Techniker', notes: '' });
    setShowModal(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    const parts = (item.name || '').split(' ');
    setFormData({
      first_name: item.first_name || parts[0] || '',
      last_name: item.last_name || parts.slice(1).join(' ') || '',
      email: item.email || '',
      phone: item.phone || '',
      role: item.role || 'Techniker',
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.first_name.trim()) { Alert.alert('Fehler', 'Vorname ist erforderlich'); return; }
    setSaving(true);
    try {
      const payload = { ...formData, name: `${formData.first_name} ${formData.last_name}`.trim() };
      if (editingItem) {
        await apiService.put(`/api/crew/${editingItem.id}`, payload);
      } else {
        await apiService.post('/api/crew', payload);
      }
      setShowModal(false);
      load();
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Fehler beim Speichern');
    } finally { setSaving(false); }
  };

  const handleDelete = async (item: any) => {
    if (!(window as any).confirm(`"${getName(item)}" wirklich löschen?`)) return;
    try { await apiService.delete(`/api/crew/${item.id}`); load(); }
    catch { Alert.alert('Fehler', 'Löschen fehlgeschlagen'); }
  };

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Mitarbeiter</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 10, paddingHorizontal: 12, gap: 8 }}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={{ flex: 1, paddingVertical: 10, color: colors.text, fontSize: 15 }}
            placeholder="Mitarbeiter suchen..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {search ? 'Keine Treffer' : 'Keine Mitarbeiter'}
            </Text>
          </View>
        ) : filtered.map(item => (
          <TouchableOpacity
            key={item.id}
            style={[styles.card, { backgroundColor: colors.card }]}
            onPress={() => openEdit(item)}
            onLongPress={() => handleDelete(item)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: colors.primary, fontSize: 18, fontWeight: 'bold' }}>
                  {getName(item).charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{getName(item)}</Text>
                {item.role && (
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '500' }}>{item.role}</Text>
                )}
                {item.email && (
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{item.email}</Text>
                )}
                {item.phone && (
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{item.phone}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.border} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>
                {editingItem ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 20 }} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>Vorname *</Text>
                  <TextInput style={inputStyle} placeholder="Vorname" placeholderTextColor={colors.textSecondary} value={formData.first_name} onChangeText={v => setFormData(p => ({ ...p, first_name: v }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>Nachname</Text>
                  <TextInput style={inputStyle} placeholder="Nachname" placeholderTextColor={colors.textSecondary} value={formData.last_name} onChangeText={v => setFormData(p => ({ ...p, last_name: v }))} />
                </View>
              </View>

              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6, marginTop: 8 }}>Rolle</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {ROLES.map(r => (
                    <TouchableOpacity
                      key={r}
                      style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, backgroundColor: formData.role === r ? colors.primary : 'transparent', borderColor: formData.role === r ? colors.primary : colors.border }}
                      onPress={() => setFormData(p => ({ ...p, role: r }))}
                    >
                      <Text style={{ color: formData.role === r ? 'white' : colors.text, fontSize: 13 }}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>E-Mail</Text>
              <TextInput style={inputStyle} placeholder="email@firma.de" placeholderTextColor={colors.textSecondary} value={formData.email} onChangeText={v => setFormData(p => ({ ...p, email: v }))} keyboardType="email-address" autoCapitalize="none" />

              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>Telefon</Text>
              <TextInput style={inputStyle} placeholder="+49 ..." placeholderTextColor={colors.textSecondary} value={formData.phone} onChangeText={v => setFormData(p => ({ ...p, phone: v }))} keyboardType="phone-pad" />

              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>Notizen</Text>
              <TextInput style={[inputStyle, { height: 70, textAlignVertical: 'top' }]} placeholder="Notizen..." placeholderTextColor={colors.textSecondary} value={formData.notes} onChangeText={v => setFormData(p => ({ ...p, notes: v }))} multiline numberOfLines={3} />

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
});
