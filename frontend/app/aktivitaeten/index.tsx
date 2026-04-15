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

interface Activity {
  id: string;
  title: string;
  description?: string;
  crew_member_name?: string;
  event_name?: string;
  date?: string;
  duration_hours?: number;
  activity_type: string;
  status: string;
}

interface CrewMember {
  id: string;
  name: string;
}

interface Event {
  id: string;
  name: string;
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  allgemein: 'Allgemein',
  auf_und_abbau: 'Auf- & Abbau',
  transport: 'Transport',
  probe: 'Probe',
  veranstaltung: 'Veranstaltung',
};

const STATUS_COLORS: Record<string, string> = {
  geplant: '#FF9500',
  in_bearbeitung: '#007AFF',
  abgeschlossen: '#34C759',
};

const STATUS_LABELS: Record<string, string> = {
  geplant: 'Geplant',
  in_bearbeitung: 'In Bearbeitung',
  abgeschlossen: 'Abgeschlossen',
};

const ACTIVITY_TYPES = ['allgemein', 'auf_und_abbau', 'transport', 'probe', 'veranstaltung'];
const STATUSES = ['geplant', 'in_bearbeitung', 'abgeschlossen'];
const FILTER_TABS = ['Alle', 'Geplant', 'Abgeschlossen'];

const emptyForm = {
  title: '',
  description: '',
  activity_type: 'allgemein',
  date: '',
  duration_hours: '',
  status: 'geplant',
  crew_member_id: '',
  crew_member_name: '',
  event_id: '',
  event_name: '',
};

export default function AktivitaetenPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('Alle');

  const [showModal, setShowModal] = useState(false);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  // Picker modals
  const [showCrewPicker, setShowCrewPicker] = useState(false);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [crewList, setCrewList] = useState<CrewMember[]>([]);
  const [eventList, setEventList] = useState<Event[]>([]);
  const [crewLoading, setCrewLoading] = useState(false);
  const [eventLoading, setEventLoading] = useState(false);

  const load = async () => {
    try {
      const data = await apiService.get<Activity[]>('/api/activities');
      setActivities(data || []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = activities.filter(a => {
    if (activeFilter === 'Alle') return true;
    if (activeFilter === 'Geplant') return a.status === 'geplant' || a.status === 'in_bearbeitung';
    if (activeFilter === 'Abgeschlossen') return a.status === 'abgeschlossen';
    return true;
  });

  const openCreate = () => {
    setEditActivity(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEdit = (a: Activity) => {
    setEditActivity(a);
    setForm({
      title: a.title || '',
      description: a.description || '',
      activity_type: a.activity_type || 'allgemein',
      date: a.date || '',
      duration_hours: a.duration_hours != null ? String(a.duration_hours) : '',
      status: a.status || 'geplant',
      crew_member_id: '',
      crew_member_name: a.crew_member_name || '',
      event_id: '',
      event_name: a.event_name || '',
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.title.trim()) { Alert.alert('Fehler', 'Titel ist erforderlich'); return; }
    setSaving(true);
    try {
      const payload: any = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        activity_type: form.activity_type,
        date: form.date.trim() || undefined,
        duration_hours: form.duration_hours ? parseFloat(form.duration_hours) : undefined,
        status: form.status,
        crew_member_name: form.crew_member_name || undefined,
        event_name: form.event_name || undefined,
      };
      if (editActivity) {
        await apiService.put(`/api/activities/${editActivity.id}`, payload);
      } else {
        await apiService.post('/api/activities', payload);
      }
      setShowModal(false);
      await load();
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Speichern fehlgeschlagen');
    }
    setSaving(false);
  };

  const deleteActivity = (a: Activity) => {
    Alert.alert('Aktivität löschen', `"${a.title}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          try {
            await apiService.delete(`/api/activities/${a.id}`);
            await load();
          } catch (e: any) {
            Alert.alert('Fehler', e.message || 'Löschen fehlgeschlagen');
          }
        }
      }
    ]);
  };

  const openCrewPicker = async () => {
    setShowCrewPicker(true);
    if (crewList.length === 0) {
      setCrewLoading(true);
      try {
        const data = await apiService.get<CrewMember[]>('/api/crew');
        setCrewList(data || []);
      } catch { }
      setCrewLoading(false);
    }
  };

  const openEventPicker = async () => {
    setShowEventPicker(true);
    if (eventList.length === 0) {
      setEventLoading(true);
      try {
        const data = await apiService.get<Event[]>('/api/events');
        setEventList(data || []);
      } catch { }
      setEventLoading(false);
    }
  };

  const selectCrew = (c: CrewMember) => {
    setForm(p => ({ ...p, crew_member_id: c.id, crew_member_name: c.name }));
    setShowCrewPicker(false);
  };

  const selectEvent = (e: Event) => {
    setForm(p => ({ ...p, event_id: e.id, event_name: e.name }));
    setShowEventPicker(false);
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Aktivitäten</Text>
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
              <Ionicons name="calendar-outline" size={48} color={colors.border} />
              <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Keine Aktivitäten vorhanden</Text>
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={openCreate}>
                <Text style={{ color: 'white', fontWeight: '600' }}>Aktivität hinzufügen</Text>
              </TouchableOpacity>
            </View>
          )}
          {filtered.map(a => (
            <TouchableOpacity
              key={a.id}
              style={[styles.card, { backgroundColor: colors.card }]}
              onPress={() => openEdit(a)}
              onLongPress={() => deleteActivity(a)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={[styles.iconCircle, { backgroundColor: (STATUS_COLORS[a.status] || '#8E8E93') + '20' }]}>
                  <Ionicons name="flash-outline" size={20} color={STATUS_COLORS[a.status] || '#8E8E93'} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{a.title}</Text>
                    <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.badgeText, { color: colors.primary }]}>
                        {ACTIVITY_TYPE_LABELS[a.activity_type] || a.activity_type}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    {a.date ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                        <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} /> {a.date}
                      </Text>
                    ) : null}
                    {a.duration_hours != null ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{a.duration_hours} Std.</Text>
                    ) : null}
                  </View>
                  {a.crew_member_name ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                      <Ionicons name="person-outline" size={12} color={colors.textSecondary} /> {a.crew_member_name}
                    </Text>
                  ) : null}
                  {a.event_name ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                      <Ionicons name="star-outline" size={12} color={colors.textSecondary} /> {a.event_name}
                    </Text>
                  ) : null}
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[a.status] || '#8E8E93', marginTop: 6, alignSelf: 'flex-start' }]}>
                    <Text style={styles.badgeText}>{STATUS_LABELS[a.status] || a.status}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => deleteActivity(a)} style={{ padding: 8 }}>
                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Create/Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editActivity ? 'Aktivität bearbeiten' : 'Neue Aktivität'}
              </Text>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Titel *</Text>
              <TextInput
                style={inputStyle}
                value={form.title}
                onChangeText={v => setForm(p => ({ ...p, title: v }))}
                placeholder="Aktivitätstitel"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Aktivitätstyp</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {ACTIVITY_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setForm(p => ({ ...p, activity_type: t }))}
                    style={[styles.chip, { backgroundColor: form.activity_type === t ? colors.primary : colors.background, borderColor: colors.border }]}
                  >
                    <Text style={{ color: form.activity_type === t ? 'white' : colors.text, fontSize: 13 }}>
                      {ACTIVITY_TYPE_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Datum (JJJJ-MM-TT)</Text>
                  <TextInput
                    style={inputStyle}
                    value={form.date}
                    onChangeText={v => setForm(p => ({ ...p, date: v }))}
                    placeholder="2024-12-31"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Dauer (Stunden)</Text>
                  <TextInput
                    style={inputStyle}
                    value={form.duration_hours}
                    onChangeText={v => setForm(p => ({ ...p, duration_hours: v }))}
                    placeholder="2.5"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Status</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {STATUSES.map(s => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setForm(p => ({ ...p, status: s }))}
                    style={[styles.chip, { backgroundColor: form.status === s ? STATUS_COLORS[s] : colors.background, borderColor: colors.border }]}
                  >
                    <Text style={{ color: form.status === s ? 'white' : colors.text, fontSize: 13 }}>
                      {STATUS_LABELS[s]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Mitarbeiter</Text>
              <TouchableOpacity
                style={[inputStyle, { justifyContent: 'center', flexDirection: 'row', alignItems: 'center' }]}
                onPress={openCrewPicker}
              >
                <Text style={{ color: form.crew_member_name ? colors.text : colors.textSecondary, flex: 1, fontSize: 15 }}>
                  {form.crew_member_name || 'Mitarbeiter auswählen...'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Event</Text>
              <TouchableOpacity
                style={[inputStyle, { justifyContent: 'center', flexDirection: 'row', alignItems: 'center' }]}
                onPress={openEventPicker}
              >
                <Text style={{ color: form.event_name ? colors.text : colors.textSecondary, flex: 1, fontSize: 15 }}>
                  {form.event_name || 'Event auswählen...'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Beschreibung</Text>
              <TextInput
                style={[inputStyle, { height: 80, textAlignVertical: 'top' }]}
                value={form.description}
                onChangeText={v => setForm(p => ({ ...p, description: v }))}
                multiline
                placeholder="Zusätzliche Beschreibung..."
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

      {/* Crew Picker Modal */}
      <Modal visible={showCrewPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0 }]}>Mitarbeiter wählen</Text>
              <TouchableOpacity onPress={() => setShowCrewPicker(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            {crewLoading ? (
              <ActivityIndicator color={colors.primary} style={{ padding: 20 }} />
            ) : (
              <ScrollView style={{ maxHeight: 400 }}>
                <TouchableOpacity
                  style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => { setForm(p => ({ ...p, crew_member_id: '', crew_member_name: '' })); setShowCrewPicker(false); }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 15 }}>— Keiner —</Text>
                </TouchableOpacity>
                {crewList.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                    onPress={() => selectCrew(c)}
                  >
                    <Text style={{ color: colors.text, fontSize: 15 }}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
                {crewList.length === 0 && (
                  <Text style={{ color: colors.textSecondary, textAlign: 'center', padding: 20 }}>Keine Mitarbeiter gefunden</Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Event Picker Modal */}
      <Modal visible={showEventPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0 }]}>Event wählen</Text>
              <TouchableOpacity onPress={() => setShowEventPicker(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            {eventLoading ? (
              <ActivityIndicator color={colors.primary} style={{ padding: 20 }} />
            ) : (
              <ScrollView style={{ maxHeight: 400 }}>
                <TouchableOpacity
                  style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => { setForm(p => ({ ...p, event_id: '', event_name: '' })); setShowEventPicker(false); }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 15 }}>— Keines —</Text>
                </TouchableOpacity>
                {eventList.map(e => (
                  <TouchableOpacity
                    key={e.id}
                    style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                    onPress={() => selectEvent(e)}
                  >
                    <Text style={{ color: colors.text, fontSize: 15 }}>{e.name}</Text>
                  </TouchableOpacity>
                ))}
                {eventList.length === 0 && (
                  <Text style={{ color: colors.textSecondary, textAlign: 'center', padding: 20 }}>Keine Events gefunden</Text>
                )}
              </ScrollView>
            )}
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
  tabRow: {
    flexDirection: 'row', borderBottomWidth: 1,
  },
  tab: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
  },
  tabText: { fontSize: 14, fontWeight: '500' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  card: {
    borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: 'white', fontSize: 11, fontWeight: '600' },
  addBtn: { marginTop: 16, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20 },
  label: { fontSize: 13, fontWeight: '500', marginTop: 10, marginBottom: 4 },
  input: { borderRadius: 8, borderWidth: 1, padding: 11, fontSize: 15, marginBottom: 4 },
  chip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  btn: { borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  pickerItem: { paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1 },
});
