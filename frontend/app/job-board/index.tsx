import React, { useState, useEffect, useCallback } from 'react';
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

interface JobEntry {
  id: string;
  title: string;
  description?: string;
  event_name?: string;
  assigned_to_name?: string;
  job_type: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  status: string;
}

interface Event {
  id: string;
  name: string;
}

interface CrewMember {
  id: string;
  name: string;
}

const JOB_TYPE_COLORS: Record<string, string> = {
  aufbau: '#007AFF',
  abbau: '#FF9500',
  transport: '#AF52DE',
  technik: '#34C759',
  sonstiges: '#8E8E93',
};

const JOB_TYPE_LABELS: Record<string, string> = {
  aufbau: 'Aufbau',
  abbau: 'Abbau',
  transport: 'Transport',
  technik: 'Technik',
  sonstiges: 'Sonstiges',
};

const STATUS_COLORS: Record<string, string> = {
  offen: '#FF9500',
  besetzt: '#007AFF',
  abgeschlossen: '#34C759',
};

const STATUS_CYCLE: Record<string, string> = {
  offen: 'besetzt',
  besetzt: 'abgeschlossen',
  abgeschlossen: 'offen',
};

const JOB_TYPES = ['aufbau', 'abbau', 'transport', 'technik', 'sonstiges'];

function formatDateChip(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}.${m}`;
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDisplayDate(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export default function JobBoardPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('alle');

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [events, setEvents] = useState<Event[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [showCrewPicker, setShowCrewPicker] = useState(false);

  const [form, setForm] = useState({
    title: '',
    job_type: 'aufbau',
    date: '',
    start_time: '',
    end_time: '',
    location: '',
    event_id: '',
    event_name: '',
    assigned_to_id: '',
    assigned_to_name: '',
    description: '',
    status: 'offen',
  });

  const dateChips = React.useMemo(() => {
    const chips: { label: string; value: string }[] = [{ label: 'Alle', value: 'alle' }];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      chips.push({ label: formatDateChip(d), value: toISODate(d) });
    }
    return chips;
  }, []);

  const load = async () => {
    try {
      const data = await apiService.get<JobEntry[]>('/api/job-board');
      setJobs(data || []);
    } catch { }
    setLoading(false);
  };

  const loadPickerData = async () => {
    try {
      const [evData, crewData] = await Promise.all([
        apiService.get<Event[]>('/api/events'),
        apiService.get<CrewMember[]>('/api/crew'),
      ]);
      setEvents(evData || []);
      setCrew(crewData || []);
    } catch { }
  };

  useEffect(() => { load(); loadPickerData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openCreate = () => {
    setForm({
      title: '', job_type: 'aufbau', date: '', start_time: '', end_time: '',
      location: '', event_id: '', event_name: '', assigned_to_id: '',
      assigned_to_name: '', description: '', status: 'offen',
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.title.trim()) { Alert.alert('Fehler', 'Titel ist erforderlich'); return; }
    setSaving(true);
    try {
      const payload: any = {
        title: form.title.trim(),
        job_type: form.job_type,
        date: form.date || undefined,
        start_time: form.start_time || undefined,
        end_time: form.end_time || undefined,
        location: form.location || undefined,
        event_id: form.event_id || undefined,
        assigned_to_id: form.assigned_to_id || undefined,
        description: form.description || undefined,
        status: form.status,
      };
      await apiService.post('/api/job-board', payload);
      setShowModal(false);
      await load();
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Speichern fehlgeschlagen');
    }
    setSaving(false);
  };

  const cycleStatus = async (job: JobEntry) => {
    const nextStatus = STATUS_CYCLE[job.status] || 'offen';
    try {
      await apiService.put(`/api/job-board/${job.id}`, { ...job, status: nextStatus });
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: nextStatus } : j));
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Status konnte nicht geändert werden');
    }
  };

  const deleteJob = (job: JobEntry) => {
    Alert.alert('Job löschen', `"${job.title}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          try {
            await apiService.delete(`/api/job-board/${job.id}`);
            await load();
          } catch (e: any) {
            Alert.alert('Fehler', e.message || 'Löschen fehlgeschlagen');
          }
        }
      }
    ]);
  };

  const filteredJobs = selectedDate === 'alle'
    ? jobs
    : jobs.filter(j => j.date === selectedDate);

  const groupedJobs = React.useMemo(() => {
    const groups: Record<string, JobEntry[]> = {};
    for (const job of filteredJobs) {
      const key = job.date || 'Kein Datum';
      if (!groups[key]) groups[key] = [];
      groups[key].push(job);
    }
    return groups;
  }, [filteredJobs]);

  const inputStyle = [styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }];

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Job Board</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Date filter chips */}
      <View style={[styles.chipBarWrapper, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipBar}>
          {dateChips.map(chip => (
            <TouchableOpacity
              key={chip.value}
              onPress={() => setSelectedDate(chip.value)}
              style={[
                styles.dateChip,
                {
                  backgroundColor: selectedDate === chip.value ? colors.primary : colors.background,
                  borderColor: selectedDate === chip.value ? colors.primary : colors.border,
                }
              ]}
            >
              <Text style={{ color: selectedDate === chip.value ? 'white' : colors.text, fontSize: 13, fontWeight: '500' }}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {filteredJobs.length === 0 && (
            <View style={styles.center}>
              <Ionicons name="briefcase-outline" size={48} color={colors.border} />
              <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Keine Jobs vorhanden</Text>
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={openCreate}>
                <Text style={{ color: 'white', fontWeight: '600' }}>Job erstellen</Text>
              </TouchableOpacity>
            </View>
          )}

          {Object.entries(groupedJobs).map(([date, dateJobs]) => (
            <View key={date}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                {date === 'Kein Datum' ? date : formatDisplayDate(date)}
              </Text>
              {dateJobs.map(job => (
                <TouchableOpacity
                  key={job.id}
                  style={[styles.card, { backgroundColor: colors.card }]}
                  onLongPress={() => deleteJob(job)}
                  activeOpacity={0.85}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    {/* Job type badge */}
                    <View style={[styles.typeBadge, { backgroundColor: (JOB_TYPE_COLORS[job.job_type] || '#8E8E93') + '20' }]}>
                      <Text style={[styles.typeBadgeText, { color: JOB_TYPE_COLORS[job.job_type] || '#8E8E93' }]}>
                        {JOB_TYPE_LABELS[job.job_type] || job.job_type}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>{job.title}</Text>

                      {(job.start_time || job.end_time) && (
                        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 3 }}>
                          <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
                          {' '}{job.start_time || '--:--'} - {job.end_time || '--:--'}
                        </Text>
                      )}

                      {job.location ? (
                        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                          <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                          {' '}{job.location}
                        </Text>
                      ) : null}

                      {job.assigned_to_name ? (
                        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                          <Ionicons name="person-outline" size={12} color={colors.textSecondary} />
                          {' '}{job.assigned_to_name}
                        </Text>
                      ) : null}
                    </View>

                    {/* Status badge - tappable */}
                    <TouchableOpacity
                      onPress={() => cycleStatus(job)}
                      style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[job.status] || '#8E8E93' }]}
                    >
                      <Text style={styles.statusBadgeText}>{job.status}</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Create Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Neuer Job</Text>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Titel *</Text>
              <TextInput
                style={inputStyle}
                value={form.title}
                onChangeText={v => setForm(p => ({ ...p, title: v }))}
                placeholder="Job-Titel"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Job-Typ</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {JOB_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setForm(p => ({ ...p, job_type: t }))}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: form.job_type === t ? (JOB_TYPE_COLORS[t] || colors.primary) : colors.background,
                        borderColor: form.job_type === t ? (JOB_TYPE_COLORS[t] || colors.primary) : colors.border,
                      }
                    ]}
                  >
                    <Text style={{ color: form.job_type === t ? 'white' : colors.text, fontSize: 13 }}>
                      {JOB_TYPE_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Datum (JJJJ-MM-TT)</Text>
              <TextInput
                style={inputStyle}
                value={form.date}
                onChangeText={v => setForm(p => ({ ...p, date: v }))}
                placeholder="2025-01-15"
                placeholderTextColor={colors.textSecondary}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Von</Text>
                  <TextInput
                    style={inputStyle}
                    value={form.start_time}
                    onChangeText={v => setForm(p => ({ ...p, start_time: v }))}
                    placeholder="08:00"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Bis</Text>
                  <TextInput
                    style={inputStyle}
                    value={form.end_time}
                    onChangeText={v => setForm(p => ({ ...p, end_time: v }))}
                    placeholder="17:00"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Ort</Text>
              <TextInput
                style={inputStyle}
                value={form.location}
                onChangeText={v => setForm(p => ({ ...p, location: v }))}
                placeholder="Veranstaltungsort"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Event</Text>
              <TouchableOpacity
                style={[inputStyle, styles.selectorRow]}
                onPress={() => setShowEventPicker(true)}
              >
                <Text style={{ color: form.event_name ? colors.text : colors.textSecondary, fontSize: 15 }}>
                  {form.event_name || 'Event auswählen...'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Zugewiesen an</Text>
              <TouchableOpacity
                style={[inputStyle, styles.selectorRow]}
                onPress={() => setShowCrewPicker(true)}
              >
                <Text style={{ color: form.assigned_to_name ? colors.text : colors.textSecondary, fontSize: 15 }}>
                  {form.assigned_to_name || 'Person auswählen...'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Beschreibung</Text>
              <TextInput
                style={[inputStyle, { height: 80, textAlignVertical: 'top' }]}
                value={form.description}
                onChangeText={v => setForm(p => ({ ...p, description: v }))}
                multiline
                placeholder="Beschreibung..."
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
                    : <Text style={{ color: 'white', fontWeight: '600' }}>Erstellen</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Event Picker Modal */}
      <Modal visible={showEventPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Event auswählen</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setForm(p => ({ ...p, event_id: '', event_name: '' }));
                  setShowEventPicker(false);
                }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 15 }}>Kein Event</Text>
              </TouchableOpacity>
              {events.map(ev => (
                <TouchableOpacity
                  key={ev.id}
                  style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setForm(p => ({ ...p, event_id: ev.id, event_name: ev.name }));
                    setShowEventPicker(false);
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 15 }}>{ev.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.btn, { borderWidth: 1, borderColor: colors.border, marginTop: 12 }]}
              onPress={() => setShowEventPicker(false)}
            >
              <Text style={{ color: colors.text, fontWeight: '600' }}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Crew Picker Modal */}
      <Modal visible={showCrewPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Person auswählen</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setForm(p => ({ ...p, assigned_to_id: '', assigned_to_name: '' }));
                  setShowCrewPicker(false);
                }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 15 }}>Niemand</Text>
              </TouchableOpacity>
              {crew.map(member => (
                <TouchableOpacity
                  key={member.id}
                  style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setForm(p => ({ ...p, assigned_to_id: member.id, assigned_to_name: member.name }));
                    setShowCrewPicker(false);
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 15 }}>{member.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.btn, { borderWidth: 1, borderColor: colors.border, marginTop: 12 }]}
              onPress={() => setShowCrewPicker(false)}
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
  chipBarWrapper: { borderBottomWidth: 1 },
  chipBar: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  dateChip: {
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  sectionHeader: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: {
    borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  typeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
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
