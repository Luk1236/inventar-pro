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

interface LogEntry {
  id: string;
  type: string;
  direction: string;
  subject?: string;
  body?: string;
  recipient?: string;
  sender?: string;
  customer_name?: string;
  event_name?: string;
  sent_at?: string;
  status?: string;
  created_at?: string;
}

type LogType = 'email' | 'note' | 'sms' | 'anruf';
type Direction = 'ausgehend' | 'eingehend';

const TYPE_ICONS: Record<string, any> = {
  email: 'mail-outline',
  note: 'chatbubble-outline',
  sms: 'phone-portrait-outline',
  anruf: 'call-outline',
};

const TYPE_LABELS: Record<string, string> = {
  email: 'E-Mail',
  note: 'Notiz',
  sms: 'SMS',
  anruf: 'Anruf',
};

const FILTER_TABS = ['Alle', 'E-Mail', 'Notizen', 'Anrufe'];

const FILTER_TYPE_MAP: Record<string, string | null> = {
  'Alle': null,
  'E-Mail': 'email',
  'Notizen': 'note',
  'Anrufe': 'anruf',
};

const LOG_TYPES: LogType[] = ['email', 'note', 'sms', 'anruf'];
const DIRECTIONS: Direction[] = ['ausgehend', 'eingehend'];

const emptyForm = {
  type: 'email' as LogType,
  direction: 'ausgehend' as Direction,
  subject: '',
  contact: '',
  customer_name: '',
  body: '',
  date: '',
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

export default function CommunicationLogPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('Alle');

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const load = async () => {
    try {
      const data = await apiService.get<LogEntry[]>('/api/communication-log');
      setEntries(data || []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = entries.filter(e => {
    const typeFilter = FILTER_TYPE_MAP[activeFilter];
    if (!typeFilter) return true;
    return e.type === typeFilter;
  });

  const openCreate = () => {
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.subject.trim()) { Alert.alert('Fehler', 'Betreff ist erforderlich'); return; }
    setSaving(true);
    try {
      const isOutgoing = form.direction === 'ausgehend';
      const payload: any = {
        type: form.type,
        direction: form.direction,
        subject: form.subject.trim(),
        body: form.body.trim() || undefined,
        customer_name: form.customer_name.trim() || undefined,
        sent_at: form.date || undefined,
        ...(isOutgoing
          ? { recipient: form.contact.trim() || undefined }
          : { sender: form.contact.trim() || undefined }
        ),
      };
      await apiService.post('/api/communication-log', payload);
      setShowModal(false);
      await load();
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Speichern fehlgeschlagen');
    }
    setSaving(false);
  };

  const deleteEntry = (entry: LogEntry) => {
    Alert.alert('Eintrag löschen', `"${entry.subject || 'Eintrag'}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          try {
            await apiService.delete(`/api/communication-log/${entry.id}`);
            await load();
          } catch (e: any) {
            Alert.alert('Fehler', e.message || 'Löschen fehlgeschlagen');
          }
        }
      }
    ]);
  };

  const inputStyle = [styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }];

  const contactLabel = form.direction === 'ausgehend' ? 'An' : 'Von';

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Kommunikations-Log</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.tabRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeFilter === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveFilter(tab)}
          >
            <Text style={[styles.tabText, { color: activeFilter === tab ? colors.primary : colors.textSecondary }]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView
          style={{ flex: 1, padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {filtered.length === 0 && (
            <View style={styles.center}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.border} />
              <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Keine Einträge vorhanden</Text>
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={openCreate}>
                <Text style={{ color: 'white', fontWeight: '600' }}>Eintrag hinzufügen</Text>
              </TouchableOpacity>
            </View>
          )}
          {filtered.map(entry => {
            const isOutgoing = entry.direction === 'ausgehend';
            const dirColor = isOutgoing ? '#007AFF' : '#34C759';
            const dirArrow = isOutgoing ? '↑' : '↓';
            const contactLine = isOutgoing ? entry.recipient : entry.sender;
            const dateStr = formatDate(entry.sent_at || entry.created_at);

            return (
              <TouchableOpacity
                key={entry.id}
                style={[styles.card, { backgroundColor: colors.card }]}
                onLongPress={() => deleteEntry(entry)}
                activeOpacity={0.85}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  {/* Type icon */}
                  <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name={TYPE_ICONS[entry.type] || 'mail-outline'} size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {/* Direction arrow */}
                      <Text style={{ color: dirColor, fontSize: 16, fontWeight: '700' }}>{dirArrow}</Text>
                      <Text style={[styles.cardTitle, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                        {entry.subject || '(Kein Betreff)'}
                      </Text>
                    </View>
                    {contactLine ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                        {isOutgoing ? 'An: ' : 'Von: '}{contactLine}
                      </Text>
                    ) : null}
                    {(entry.customer_name || entry.event_name) ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                        {[entry.customer_name, entry.event_name].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <View style={[styles.typeBadge, { backgroundColor: colors.primary + '20' }]}>
                        <Text style={[styles.badgeText, { color: colors.primary }]}>
                          {TYPE_LABELS[entry.type] || entry.type}
                        </Text>
                      </View>
                      {dateStr ? (
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{dateStr}</Text>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => deleteEntry(entry)} style={{ padding: 8 }}>
                    <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Create Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalTitle, { color: colors.text }]}>Neuer Eintrag</Text>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Typ</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {LOG_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setForm(p => ({ ...p, type: t }))}
                    style={[styles.chip, { backgroundColor: form.type === t ? colors.primary : colors.background, borderColor: colors.border }]}
                  >
                    <Text style={{ color: form.type === t ? 'white' : colors.text, fontSize: 13 }}>
                      {TYPE_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Richtung</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {DIRECTIONS.map(d => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setForm(p => ({ ...p, direction: d }))}
                    style={[styles.chip, {
                      backgroundColor: form.direction === d
                        ? (d === 'ausgehend' ? '#007AFF' : '#34C759')
                        : colors.background,
                      borderColor: colors.border,
                    }]}
                  >
                    <Text style={{ color: form.direction === d ? 'white' : colors.text, fontSize: 13 }}>
                      {d === 'ausgehend' ? 'Ausgehend' : 'Eingehend'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Betreff</Text>
              <TextInput
                style={inputStyle}
                value={form.subject}
                onChangeText={v => setForm(p => ({ ...p, subject: v }))}
                placeholder="Betreff eingeben"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>{contactLabel}</Text>
              <TextInput
                style={inputStyle}
                value={form.contact}
                onChangeText={v => setForm(p => ({ ...p, contact: v }))}
                placeholder={form.direction === 'ausgehend' ? 'Empfänger...' : 'Absender...'}
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Kunde</Text>
              <TextInput
                style={inputStyle}
                value={form.customer_name}
                onChangeText={v => setForm(p => ({ ...p, customer_name: v }))}
                placeholder="Kundenname"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Datum (JJJJ-MM-TT)</Text>
              <TextInput
                style={inputStyle}
                value={form.date}
                onChangeText={v => setForm(p => ({ ...p, date: v }))}
                placeholder="2024-12-31"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Inhalt</Text>
              <TextInput
                style={[inputStyle, { height: 90, textAlignVertical: 'top' }]}
                value={form.body}
                onChangeText={v => setForm(p => ({ ...p, body: v }))}
                multiline
                placeholder="Nachrichteninhalt..."
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
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: 14, fontWeight: '500' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  card: {
    borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  typeBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  addBtn: { marginTop: 16, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20 },
  label: { fontSize: 13, fontWeight: '500', marginTop: 10, marginBottom: 4 },
  input: { borderRadius: 8, borderWidth: 1, padding: 11, fontSize: 15, marginBottom: 4 },
  chip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  btn: { borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
});
