import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, Alert, ActivityIndicator,
  RefreshControl, Modal, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const INSPECTION_TYPES = ['TÜV', 'UVV', 'Sicherheitsprüfung', 'Kalibrierung', 'Sonstige'];
const RESULTS = [
  { value: 'ausstehend', label: 'Ausstehend', color: '#FF9500' },
  { value: 'bestanden', label: 'Bestanden', color: '#34C759' },
  { value: 'nicht_bestanden', label: 'Nicht bestanden', color: '#FF3B30' },
];

const todayStr = new Date().toISOString().split('T')[0];
const formatDate = (d?: string) => {
  if (!d) return '';
  const part = d.split('T')[0];
  const [y, m, dd] = part.split('-');
  return `${dd}.${m}.${y}`;
};
/** Konvertiert TT.MM.JJJJ → YYYY-MM-DD für API-Calls */
const toISO = (d: string) => {
  if (!d || !d.includes('.')) return d;
  const [dd, mm, yyyy] = d.split('.');
  return `${yyyy}-${mm}-${dd}`;
};

const emptyForm = {
  article_id: '', article_name: '', inspection_type: 'TÜV',
  due_date: '', performed_date: '', performed_by: '',
  result: 'ausstehend', next_due_date: '', cost: '', notes: '',
};

export default function InspectionsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [inspections, setInspections] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [showArticlePicker, setShowArticlePicker] = useState(false);

  const load = useCallback(async () => {
    try {
      const [insp, arts] = await Promise.all([
        apiService.get<any[]>('/api/inspections'),
        apiService.get<any[]>('/api/articles'),
      ]);
      setInspections(insp || []);
      setArticles(arts || []);
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
      article_id: item.article_id || '',
      article_name: item.article_name || '',
      inspection_type: item.inspection_type || 'TÜV',
      due_date: formatDate(item.due_date),
      performed_date: formatDate(item.performed_date),
      performed_by: item.performed_by || '',
      result: item.result || 'ausstehend',
      next_due_date: formatDate(item.next_due_date),
      cost: item.cost != null ? String(item.cost) : '',
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.due_date.trim()) { Alert.alert('Fehler', 'Fälligkeitsdatum ist erforderlich'); return; }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        due_date: toISO(formData.due_date),
        cost: formData.cost ? parseFloat(formData.cost) : null,
        performed_date: formData.performed_date ? toISO(formData.performed_date) : null,
        next_due_date: formData.next_due_date ? toISO(formData.next_due_date) : null,
        performed_by: formData.performed_by || null,
        article_id: formData.article_id || null,
      };
      if (editingItem) {
        await apiService.put(`/api/inspections/${editingItem.id}`, payload);
      } else {
        await apiService.post('/api/inspections', payload);
      }
      setShowModal(false);
      load();
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: any) => {
    if (!(window as any).confirm(`"${item.inspection_type}" wirklich löschen?`)) return;
    try { await apiService.delete(`/api/inspections/${item.id}`); load(); }
    catch { Alert.alert('Fehler', 'Löschen fehlgeschlagen'); }
  };

  const getResultInfo = (r: string) => RESULTS.find(x => x.value === r) || RESULTS[0];
  const isOverdue = (item: any) =>
    item.result === 'ausstehend' && item.due_date && item.due_date.split('T')[0] < todayStr;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Prüfungen</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {inspections.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="shield-checkmark-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Keine Prüfungen</Text>
          </View>
        ) : inspections.map(item => {
          const overdue = isOverdue(item);
          const resultInfo = getResultInfo(item.result);
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, { backgroundColor: colors.card, borderColor: overdue ? '#FF3B30' : 'transparent', borderWidth: overdue ? 1.5 : 0 }]}
              onPress={() => openEdit(item)}
              onLongPress={() => handleDelete(item)}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {item.article_name || 'Kein Artikel'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>{item.inspection_type}</Text>
                    {overdue && (
                      <View style={{ backgroundColor: '#FF3B3020', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: '#FF3B30', fontSize: 11, fontWeight: '600' }}>ÜBERFÄLLIG</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: overdue ? '#FF3B30' : colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                    Fällig: {formatDate(item.due_date)}
                  </Text>
                  {item.performed_date && (
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      Durchgeführt: {formatDate(item.performed_date)}
                    </Text>
                  )}
                  {item.cost != null && (
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      Kosten: {Number(item.cost).toFixed(2)} €
                    </Text>
                  )}
                </View>
                <View style={[styles.badge, { backgroundColor: resultInfo.color + '20' }]}>
                  <Text style={{ color: resultInfo.color, fontSize: 12, fontWeight: '600' }}>{resultInfo.label}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>
                {editingItem ? 'Prüfung bearbeiten' : 'Neue Prüfung'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <ScrollView style={{ padding: 20 }} contentContainerStyle={{ paddingBottom: 20 }}>
                {/* Article selector */}
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Artikel</Text>
                <TouchableOpacity
                  style={[styles.selectorButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => setShowArticlePicker(true)}
                >
                  <Text style={{ color: formData.article_name ? colors.text : colors.textSecondary, fontSize: 16 }}>
                    {formData.article_name || 'Artikel wählen (optional)'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </TouchableOpacity>

                {/* Inspection type chips */}
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Prüfungstyp</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {INSPECTION_TYPES.map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.chip, formData.inspection_type === t
                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                          : { backgroundColor: 'transparent', borderColor: colors.border }]}
                        onPress={() => setFormData(p => ({ ...p, inspection_type: t }))}
                      >
                        <Text style={{ color: formData.inspection_type === t ? 'white' : colors.text, fontSize: 13 }}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Fälligkeitsdatum *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="TT.MM.JJJJ" placeholderTextColor={colors.textSecondary}
                  value={formData.due_date} onChangeText={v => setFormData(p => ({ ...p, due_date: v }))}
                />

                {/* Result chips */}
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Ergebnis</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                  {RESULTS.map(r => (
                    <TouchableOpacity
                      key={r.value}
                      style={[styles.chip, formData.result === r.value
                        ? { backgroundColor: r.color, borderColor: r.color }
                        : { backgroundColor: 'transparent', borderColor: colors.border }]}
                      onPress={() => setFormData(p => ({ ...p, result: r.value }))}
                    >
                      <Text style={{ color: formData.result === r.value ? 'white' : colors.text, fontSize: 12 }}>{r.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Durchgeführt am</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="TT.MM.JJJJ" placeholderTextColor={colors.textSecondary}
                  value={formData.performed_date} onChangeText={v => setFormData(p => ({ ...p, performed_date: v }))}
                />

                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Durchgeführt von</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="Name" placeholderTextColor={colors.textSecondary}
                  value={formData.performed_by} onChangeText={v => setFormData(p => ({ ...p, performed_by: v }))}
                />

                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Nächstes Datum</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="TT.MM.JJJJ" placeholderTextColor={colors.textSecondary}
                  value={formData.next_due_date} onChangeText={v => setFormData(p => ({ ...p, next_due_date: v }))}
                />

                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Kosten (€)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="0.00" placeholderTextColor={colors.textSecondary}
                  value={formData.cost} onChangeText={v => setFormData(p => ({ ...p, cost: v }))}
                  keyboardType="decimal-pad"
                />

                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Notizen</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, height: 80, textAlignVertical: 'top' }]}
                  placeholder="Notizen..." placeholderTextColor={colors.textSecondary}
                  value={formData.notes} onChangeText={v => setFormData(p => ({ ...p, notes: v }))}
                  multiline numberOfLines={3}
                />

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                  <TouchableOpacity
                    onPress={() => setShowModal(false)}
                    style={{ flex: 1, borderRadius: 8, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
                  >
                    <Text style={{ color: colors.text, fontWeight: '600' }}>Abbrechen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving}
                    style={{ flex: 1, borderRadius: 8, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }}
                  >
                    {saving ? <ActivityIndicator color="white" /> : (
                      <Text style={{ color: 'white', fontWeight: '600' }}>{editingItem ? 'Speichern' : 'Erstellen'}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>

      {/* Article Picker Modal */}
      <Modal visible={showArticlePicker} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>Artikel wählen</Text>
              <TouchableOpacity onPress={() => setShowArticlePicker(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ id: '', name: 'Kein Artikel', sku: '' }, ...articles]}
              keyExtractor={item => item.id || '_none'}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
                  onPress={() => {
                    setFormData(p => ({ ...p, article_id: item.id, article_name: item.name }));
                    setShowArticlePicker(false);
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 16 }}>{item.name}</Text>
                  {item.sku ? <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{item.sku}</Text> : null}
                </TouchableOpacity>
              )}
            />
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
  card: { borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  fieldLabel: { fontSize: 14, fontWeight: '500', marginBottom: 6, marginTop: 12 },
  input: { borderRadius: 8, padding: 12, fontSize: 16, borderWidth: 1 },
  selectorButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 8, padding: 12, borderWidth: 1 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
});
