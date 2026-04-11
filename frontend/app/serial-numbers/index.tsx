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

const toISO = (d: string) => { if (!d || !d.includes('.')) return d; const [dd, mm, yyyy] = d.split('.'); return `${yyyy}-${mm}-${dd}`; };
const fmtDate = (d?: string) => { if (!d) return ''; const p = d.split('T')[0]; const [y,m,dd] = p.split('-'); return `${dd}.${m}.${y}`; };

const STATUSES = [
  { value: 'verfügbar', label: 'Verfügbar', color: '#34C759' },
  { value: 'verliehen', label: 'Verliehen', color: '#007AFF' },
  { value: 'defekt', label: 'Defekt', color: '#FF9500' },
  { value: 'verschrottet', label: 'Verschrottet', color: '#FF3B30' },
];

const CONDITIONS = [
  { value: 'neu', label: 'Neu' },
  { value: 'gut', label: 'Gut' },
  { value: 'akzeptabel', label: 'Akzeptabel' },
  { value: 'schlecht', label: 'Schlecht' },
];

const emptyForm = {
  article_id: '', article_name: '', serial_number: '',
  status: 'verfügbar', condition: 'gut',
  purchase_date: '', purchase_price: '', notes: '',
};

export default function SerialNumbersPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [serialNumbers, setSerialNumbers] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [showArticlePicker, setShowArticlePicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'filter' | 'form'>('form');

  const load = useCallback(async () => {
    try {
      const [sns, arts] = await Promise.all([
        apiService.get<any[]>('/api/serial-numbers'),
        apiService.get<any[]>('/api/articles'),
      ]);
      setSerialNumbers(sns || []);
      setArticles(arts || []);
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = selectedArticleId
    ? serialNumbers.filter(sn => sn.article_id === selectedArticleId)
    : serialNumbers;

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
      serial_number: item.serial_number || '',
      status: item.status || 'verfügbar',
      condition: item.condition || 'gut',
      purchase_date: fmtDate(item.purchase_date),
      purchase_price: item.purchase_price != null ? String(item.purchase_price) : '',
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.article_id) { Alert.alert('Fehler', 'Bitte wählen Sie einen Artikel'); return; }
    if (!formData.serial_number.trim()) { Alert.alert('Fehler', 'Seriennummer ist erforderlich'); return; }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
        purchase_date: formData.purchase_date ? toISO(formData.purchase_date) : null,
      };
      if (editingItem) {
        await apiService.put(`/api/serial-numbers/${editingItem.id}`, payload);
      } else {
        await apiService.post('/api/serial-numbers', payload);
      }
      setShowModal(false);
      load();
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: any) => {
    Alert.alert('Seriennummer löschen', `"${item.serial_number}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => {
        try {
          await apiService.delete(`/api/serial-numbers/${item.id}`);
          load();
        } catch { Alert.alert('Fehler', 'Löschen fehlgeschlagen'); }
      }},
    ]);
  };

  const getStatus = (v: string) => STATUSES.find(s => s.value === v) || STATUSES[0];

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Seriennummern</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Article filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }} contentContainerStyle={{ padding: 12, gap: 8, flexDirection: 'row' }}>
        <TouchableOpacity
          style={[styles.filterChip, { backgroundColor: !selectedArticleId ? colors.primary : 'transparent', borderColor: !selectedArticleId ? colors.primary : colors.border }]}
          onPress={() => setSelectedArticleId(null)}
        >
          <Text style={{ color: !selectedArticleId ? 'white' : colors.text, fontSize: 13, fontWeight: '500' }}>Alle</Text>
        </TouchableOpacity>
        {articles.map(art => (
          <TouchableOpacity
            key={art.id}
            style={[styles.filterChip, { backgroundColor: selectedArticleId === art.id ? colors.primary : 'transparent', borderColor: selectedArticleId === art.id ? colors.primary : colors.border }]}
            onPress={() => setSelectedArticleId(selectedArticleId === art.id ? null : art.id)}
          >
            <Text style={{ color: selectedArticleId === art.id ? 'white' : colors.text, fontSize: 13 }}>{art.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="barcode-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Keine Seriennummern</Text>
          </View>
        ) : filtered.map(item => {
          const statusInfo = getStatus(item.status);
          const conditionInfo = CONDITIONS.find(c => c.value === item.condition);
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, { backgroundColor: colors.card }]}
              onPress={() => openEdit(item)}
              onLongPress={() => handleDelete(item)}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.snText, { color: colors.text }]}>{item.serial_number}</Text>
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '500', marginTop: 2 }}>{item.article_name}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    {item.purchase_date && (
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Gekauft: {fmtDate(item.purchase_date)}</Text>
                    )}
                    {item.purchase_price != null && (
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{Number(item.purchase_price).toFixed(2)} €</Text>
                    )}
                  </View>
                </View>
                <View style={{ gap: 6, alignItems: 'flex-end' }}>
                  <View style={[styles.badge, { backgroundColor: statusInfo.color + '20' }]}>
                    <Text style={{ color: statusInfo.color, fontSize: 12, fontWeight: '600' }}>{statusInfo.label}</Text>
                  </View>
                  {conditionInfo && (
                    <View style={[styles.badge, { backgroundColor: colors.background }]}>
                      <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{conditionInfo.label}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>
                {editingItem ? 'Seriennummer bearbeiten' : 'Neue Seriennummer'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <ScrollView style={{ padding: 20 }} contentContainerStyle={{ paddingBottom: 20 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Artikel *</Text>
                <TouchableOpacity
                  style={[styles.selectorButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => { setPickerTarget('form'); setShowArticlePicker(true); }}
                >
                  <Text style={{ color: formData.article_name ? colors.text : colors.textSecondary, fontSize: 16 }}>
                    {formData.article_name || 'Artikel wählen...'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </TouchableOpacity>

                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Seriennummer *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}
                  placeholder="SN-12345" placeholderTextColor={colors.textSecondary}
                  value={formData.serial_number} onChangeText={v => setFormData(p => ({ ...p, serial_number: v }))}
                  autoCapitalize="characters"
                />

                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Status</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                  {STATUSES.map(s => (
                    <TouchableOpacity
                      key={s.value}
                      style={[styles.chip, formData.status === s.value
                        ? { backgroundColor: s.color, borderColor: s.color }
                        : { backgroundColor: 'transparent', borderColor: colors.border }]}
                      onPress={() => setFormData(p => ({ ...p, status: s.value }))}
                    >
                      <Text style={{ color: formData.status === s.value ? 'white' : colors.text, fontSize: 13 }}>{s.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Zustand</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                  {CONDITIONS.map(c => (
                    <TouchableOpacity
                      key={c.value}
                      style={[styles.chip, formData.condition === c.value
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: 'transparent', borderColor: colors.border }]}
                      onPress={() => setFormData(p => ({ ...p, condition: c.value }))}
                    >
                      <Text style={{ color: formData.condition === c.value ? 'white' : colors.text, fontSize: 13 }}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Kaufdatum</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="TT.MM.JJJJ" placeholderTextColor={colors.textSecondary}
                  value={formData.purchase_date} onChangeText={v => setFormData(p => ({ ...p, purchase_date: v }))}
                />

                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Kaufpreis (€)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="0.00" placeholderTextColor={colors.textSecondary}
                  value={formData.purchase_price} onChangeText={v => setFormData(p => ({ ...p, purchase_price: v }))}
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
              data={articles}
              keyExtractor={item => item.id}
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
              ListEmptyComponent={<Text style={{ color: colors.textSecondary, padding: 20, textAlign: 'center' }}>Keine Artikel gefunden</Text>}
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
  snText: { fontSize: 16, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  fieldLabel: { fontSize: 14, fontWeight: '500', marginBottom: 6, marginTop: 12 },
  input: { borderRadius: 8, padding: 12, fontSize: 16, borderWidth: 1 },
  selectorButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 8, padding: 12, borderWidth: 1 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
});
