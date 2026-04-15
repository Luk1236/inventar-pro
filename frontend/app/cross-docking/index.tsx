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

interface CrossDockingEntry {
  id: string;
  article_name?: string;
  quantity?: number;
  source_event_name?: string;
  target_event_name?: string;
  transfer_date?: string;
  status: string;
  notes?: string;
}

interface Event {
  id: string;
  name: string;
}

interface Article {
  id: string;
  name: string;
}

const STATUS_COLORS: Record<string, string> = {
  geplant: '#8E8E93',
  bereit: '#FF9500',
  übertragen: '#34C759',
  abgebrochen: '#FF3B30',
};

const STATUSES = ['geplant', 'bereit', 'übertragen', 'abgebrochen'];

function formatDisplayDate(iso?: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export default function CrossDockingPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [entries, setEntries] = useState<CrossDockingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<CrossDockingEntry | null>(null);
  const [saving, setSaving] = useState(false);

  const [events, setEvents] = useState<Event[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);

  const [showArticlePicker, setShowArticlePicker] = useState(false);
  const [showSourceEventPicker, setShowSourceEventPicker] = useState(false);
  const [showTargetEventPicker, setShowTargetEventPicker] = useState(false);

  const [form, setForm] = useState({
    article_id: '',
    article_name: '',
    quantity: '',
    source_event_id: '',
    source_event_name: '',
    target_event_id: '',
    target_event_name: '',
    transfer_date: '',
    status: 'geplant',
    notes: '',
  });

  const load = async () => {
    try {
      const data = await apiService.get<CrossDockingEntry[]>('/api/cross-docking');
      setEntries(data || []);
    } catch { }
    setLoading(false);
  };

  const loadPickerData = async () => {
    try {
      const [evData, artData] = await Promise.all([
        apiService.get<Event[]>('/api/events'),
        apiService.get<Article[]>('/api/articles'),
      ]);
      setEvents(evData || []);
      setArticles(artData || []);
    } catch { }
  };

  useEffect(() => { load(); loadPickerData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openCreate = () => {
    setEditEntry(null);
    setForm({
      article_id: '', article_name: '', quantity: '',
      source_event_id: '', source_event_name: '',
      target_event_id: '', target_event_name: '',
      transfer_date: '', status: 'geplant', notes: '',
    });
    setShowModal(true);
  };

  const openEdit = (entry: CrossDockingEntry) => {
    setEditEntry(entry);
    setForm({
      article_id: '',
      article_name: entry.article_name || '',
      quantity: entry.quantity != null ? String(entry.quantity) : '',
      source_event_id: '',
      source_event_name: entry.source_event_name || '',
      target_event_id: '',
      target_event_name: entry.target_event_name || '',
      transfer_date: entry.transfer_date || '',
      status: entry.status || 'geplant',
      notes: entry.notes || '',
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.article_name.trim()) { Alert.alert('Fehler', 'Artikel ist erforderlich'); return; }
    setSaving(true);
    try {
      const payload: any = {
        article_id: form.article_id || undefined,
        quantity: form.quantity ? parseFloat(form.quantity) : undefined,
        source_event_id: form.source_event_id || undefined,
        target_event_id: form.target_event_id || undefined,
        transfer_date: form.transfer_date || undefined,
        status: form.status,
        notes: form.notes || undefined,
      };
      if (editEntry) {
        await apiService.put(`/api/cross-docking/${editEntry.id}`, payload);
      } else {
        await apiService.post('/api/cross-docking', payload);
      }
      setShowModal(false);
      await load();
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Speichern fehlgeschlagen');
    }
    setSaving(false);
  };

  const deleteEntry = (entry: CrossDockingEntry) => {
    Alert.alert('Eintrag löschen', `"${entry.article_name || 'Eintrag'}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          try {
            await apiService.delete(`/api/cross-docking/${entry.id}`);
            await load();
          } catch (e: any) {
            Alert.alert('Fehler', e.message || 'Löschen fehlgeschlagen');
          }
        }
      }
    ]);
  };

  const inputStyle = [styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }];

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Cross-Docking</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {entries.length === 0 && (
            <View style={styles.center}>
              <Ionicons name="swap-horizontal-outline" size={48} color={colors.border} />
              <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Keine Cross-Docking-Einträge</Text>
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={openCreate}>
                <Text style={{ color: 'white', fontWeight: '600' }}>Eintrag erstellen</Text>
              </TouchableOpacity>
            </View>
          )}

          {entries.map(entry => (
            <TouchableOpacity
              key={entry.id}
              style={[styles.card, { backgroundColor: colors.card }]}
              onPress={() => openEdit(entry)}
              onLongPress={() => deleteEntry(entry)}
              activeOpacity={0.85}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {entry.article_name || 'Unbekannter Artikel'}
                  </Text>

                  {entry.quantity != null && (
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 3 }}>
                      Menge: {entry.quantity}
                    </Text>
                  )}

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap', gap: 4 }}>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>
                      {entry.source_event_name || 'Kein Quell-Event'}
                    </Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>
                      {entry.target_event_name || 'Kein Ziel-Event'}
                    </Text>
                  </View>

                  {entry.transfer_date && (
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                      <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
                      {' '}{formatDisplayDate(entry.transfer_date)}
                    </Text>
                  )}
                </View>

                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[entry.status] || '#8E8E93' }]}>
                  <Text style={styles.statusBadgeText}>{entry.status}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Create / Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editEntry ? 'Cross-Docking bearbeiten' : 'Neuer Cross-Docking-Eintrag'}
              </Text>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Artikel *</Text>
              <TouchableOpacity
                style={[inputStyle, styles.selectorRow]}
                onPress={() => setShowArticlePicker(true)}
              >
                <Text style={{ color: form.article_name ? colors.text : colors.textSecondary, fontSize: 15 }}>
                  {form.article_name || 'Artikel auswählen...'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Menge</Text>
              <TextInput
                style={inputStyle}
                value={form.quantity}
                onChangeText={v => setForm(p => ({ ...p, quantity: v }))}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Quell-Event</Text>
              <TouchableOpacity
                style={[inputStyle, styles.selectorRow]}
                onPress={() => setShowSourceEventPicker(true)}
              >
                <Text style={{ color: form.source_event_name ? colors.text : colors.textSecondary, fontSize: 15 }}>
                  {form.source_event_name || 'Quell-Event auswählen...'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Ziel-Event</Text>
              <TouchableOpacity
                style={[inputStyle, styles.selectorRow]}
                onPress={() => setShowTargetEventPicker(true)}
              >
                <Text style={{ color: form.target_event_name ? colors.text : colors.textSecondary, fontSize: 15 }}>
                  {form.target_event_name || 'Ziel-Event auswählen...'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Übergabedatum (JJJJ-MM-TT)</Text>
              <TextInput
                style={inputStyle}
                value={form.transfer_date}
                onChangeText={v => setForm(p => ({ ...p, transfer_date: v }))}
                placeholder="2025-01-15"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Status</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {STATUSES.map(s => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setForm(p => ({ ...p, status: s }))}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: form.status === s ? (STATUS_COLORS[s] || colors.primary) : colors.background,
                        borderColor: form.status === s ? (STATUS_COLORS[s] || colors.primary) : colors.border,
                      }
                    ]}
                  >
                    <Text style={{ color: form.status === s ? 'white' : colors.text, fontSize: 13 }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Notizen</Text>
              <TextInput
                style={[inputStyle, { height: 80, textAlignVertical: 'top' }]}
                value={form.notes}
                onChangeText={v => setForm(p => ({ ...p, notes: v }))}
                multiline
                placeholder="Notizen..."
                placeholderTextColor={colors.textSecondary}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={[styles.btn, { borderWidth: 1, borderColor: colors.border, flex: 1 }]}
                  onPress={() => setShowModal(false)}
                >
                  <Text style={{ color: colors.text, fontWeight: '600' }}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: colors.primary, flex: 1 }]}
                  onPress={save}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color="white" size="small" />
                    : <Text style={{ color: 'white', fontWeight: '600' }}>Speichern</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Article Picker Modal */}
      <Modal visible={showArticlePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Artikel auswählen</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {articles.map(art => (
                <TouchableOpacity
                  key={art.id}
                  style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setForm(p => ({ ...p, article_id: art.id, article_name: art.name }));
                    setShowArticlePicker(false);
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 15 }}>{art.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.btn, { borderWidth: 1, borderColor: colors.border, marginTop: 12 }]}
              onPress={() => setShowArticlePicker(false)}
            >
              <Text style={{ color: colors.text, fontWeight: '600' }}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Source Event Picker Modal */}
      <Modal visible={showSourceEventPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Quell-Event auswählen</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setForm(p => ({ ...p, source_event_id: '', source_event_name: '' }));
                  setShowSourceEventPicker(false);
                }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 15 }}>Kein Event</Text>
              </TouchableOpacity>
              {events.map(ev => (
                <TouchableOpacity
                  key={ev.id}
                  style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setForm(p => ({ ...p, source_event_id: ev.id, source_event_name: ev.name }));
                    setShowSourceEventPicker(false);
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 15 }}>{ev.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.btn, { borderWidth: 1, borderColor: colors.border, marginTop: 12 }]}
              onPress={() => setShowSourceEventPicker(false)}
            >
              <Text style={{ color: colors.text, fontWeight: '600' }}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Target Event Picker Modal */}
      <Modal visible={showTargetEventPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Ziel-Event auswählen</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setForm(p => ({ ...p, target_event_id: '', target_event_name: '' }));
                  setShowTargetEventPicker(false);
                }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 15 }}>Kein Event</Text>
              </TouchableOpacity>
              {events.map(ev => (
                <TouchableOpacity
                  key={ev.id}
                  style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setForm(p => ({ ...p, target_event_id: ev.id, target_event_name: ev.name }));
                    setShowTargetEventPicker(false);
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 15 }}>{ev.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.btn, { borderWidth: 1, borderColor: colors.border, marginTop: 12 }]}
              onPress={() => setShowTargetEventPicker(false)}
            >
              <Text style={{ color: colors.text, fontWeight: '600' }}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  card: {
    borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  statusBadgeText: { color: 'white', fontSize: 11, fontWeight: '600' },
  addBtn: { marginTop: 16, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20 },
  label: { fontSize: 13, fontWeight: '500', marginTop: 10, marginBottom: 4 },
  input: { borderRadius: 8, borderWidth: 1, padding: 11, fontSize: 15, marginBottom: 4 },
  chip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  btn: { borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  selectorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerItem: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
});
