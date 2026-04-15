import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const toISO = (d: string) => { if (!d || !d.includes('.')) return d; const [dd, mm, yyyy] = d.split('.'); return `${yyyy}-${mm}-${dd}`; };

interface CrewMember {
  id: number | string;
  first_name?: string;
  last_name?: string;
  name?: string;
}

interface EventItem {
  id: number | string;
  name?: string;
  title?: string;
}

type Priority = 'niedrig' | 'normal' | 'hoch' | 'dringend';

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'niedrig', label: 'niedrig', color: '#8E8E93' },
  { value: 'normal',  label: 'normal',  color: '#007AFF' },
  { value: 'hoch',    label: 'hoch',    color: '#FF9500' },
  { value: 'dringend',label: 'dringend',color: '#FF3B30' },
];

export default function CreateTaskPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [titleError, setTitleError] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [dueDate, setDueDate] = useState('');

  // Crew picker state
  const [crewList, setCrewList] = useState<CrewMember[]>([]);
  const [selectedCrew, setSelectedCrew] = useState<CrewMember | null>(null);
  const [showCrewModal, setShowCrewModal] = useState(false);

  // Event picker state
  const [eventList, setEventList] = useState<EventItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);

  useEffect(() => {
    loadCrew();
    loadEvents();
  }, []);

  const loadCrew = async () => {
    try {
      const data = await apiService.get<CrewMember[]>('/api/crew', { showErrorAlert: false });
      setCrewList(Array.isArray(data) ? data : []);
    } catch {
      setCrewList([]);
    }
  };

  const loadEvents = async () => {
    try {
      const data = await apiService.get<EventItem[]>('/api/events', { showErrorAlert: false });
      setEventList(Array.isArray(data) ? data : []);
    } catch {
      setEventList([]);
    }
  };

  const getCrewDisplayName = (member: CrewMember): string => {
    if (member.first_name || member.last_name) {
      return `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim();
    }
    return member.name ?? '';
  };

  const getEventDisplayName = (event: EventItem): string => {
    return event.name ?? event.title ?? '';
  };

  const validateTitle = (value: string): boolean => {
    if (!value.trim()) {
      setTitleError('Titel ist erforderlich');
      return false;
    }
    setTitleError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validateTitle(title)) {
      Alert.alert('Fehler', 'Bitte füllen Sie alle Pflichtfelder aus');
      return;
    }

    setLoading(true);
    try {
      const crewName = selectedCrew ? getCrewDisplayName(selectedCrew) : null;
      const eventName = selectedEvent ? getEventDisplayName(selectedEvent) : null;

      await apiService.post<any>('/api/tasks', {
        title: title.trim(),
        description: description.trim() || null,
        assigned_to_id: selectedCrew?.id ?? null,
        assigned_to_name: crewName,
        priority,
        due_date: dueDate.trim() ? toISO(dueDate.trim()) : null,
        event_id: selectedEvent?.id ?? null,
        event_name: eventName,
        status: 'offen',
      });
      router.back();
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Fehler beim Erstellen der Aufgabe');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
  ];

  return (
    <SafeAreaView
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: colors.background },
      ]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Neue Aufgabe</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          {/* Section: Grundinformationen */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Grundinformationen</Text>

            <Text style={[styles.label, { color: colors.textSecondary }, titleError ? styles.labelError : null]}>
              Titel *
            </Text>
            <TextInput
              style={[inputStyle, titleError ? styles.inputError : null]}
              placeholder="z.B. Bühne aufbauen"
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={(v) => {
                setTitle(v);
                if (titleError) validateTitle(v);
              }}
              onBlur={() => validateTitle(title)}
            />
            {titleError ? <Text style={styles.errorText}>{titleError}</Text> : null}

            <Text style={[styles.label, { color: colors.textSecondary }]}>Beschreibung</Text>
            <TextInput
              style={[inputStyle, styles.textArea]}
              placeholder="Optionale Beschreibung..."
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Section: Priorität */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Priorität</Text>
            <View style={styles.chipRow}>
              {PRIORITY_OPTIONS.map((opt) => {
                const isSelected = priority === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setPriority(opt.value)}
                    style={[
                      styles.chip,
                      isSelected
                        ? { backgroundColor: opt.color, borderColor: opt.color }
                        : { backgroundColor: 'transparent', borderColor: opt.color },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: isSelected ? '#ffffff' : opt.color },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section: Zuweisung & Datum */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Zuweisung & Datum</Text>

            {/* Crew picker */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>Zugewiesen an</Text>
            <TouchableOpacity
              style={[styles.pickerButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => setShowCrewModal(true)}
            >
              <Text style={{ color: selectedCrew ? colors.text : colors.textSecondary, fontSize: 16 }}>
                {selectedCrew ? getCrewDisplayName(selectedCrew) : 'Niemand'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Due date */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>Fälligkeitsdatum</Text>
            <TextInput
              style={inputStyle}
              placeholder="TT.MM.JJJJ"
              placeholderTextColor={colors.textSecondary}
              value={dueDate}
              onChangeText={setDueDate}
              keyboardType="numbers-and-punctuation"
            />

            {/* Event picker */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>Event (Optional)</Text>
            <TouchableOpacity
              style={[styles.pickerButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => setShowEventModal(true)}
            >
              <Text style={{ color: selectedEvent ? colors.text : colors.textSecondary, fontSize: 16 }}>
                {selectedEvent ? getEventDisplayName(selectedEvent) : 'Kein Event'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Submit button */}
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: colors.primary }, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.submitButtonText}>Aufgabe erstellen</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Crew Modal */}
      <Modal visible={showCrewModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Crew-Mitglied wählen</Text>
              <TouchableOpacity onPress={() => setShowCrewModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={[null, ...crewList]}
              keyExtractor={(item, index) => (item ? String(item.id) : 'nobody')}
              renderItem={({ item }) => {
                const label = item ? getCrewDisplayName(item) : 'Niemand';
                const isSelected = item === null ? selectedCrew === null : selectedCrew?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.modalItem,
                      { borderBottomColor: colors.border },
                      isSelected && { backgroundColor: colors.primary + '18' },
                    ]}
                    onPress={() => {
                      setSelectedCrew(item);
                      setShowCrewModal(false);
                    }}
                  >
                    <Text style={[styles.modalItemText, { color: colors.text }, isSelected && { color: colors.primary, fontWeight: '600' }]}>
                      {label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }}
              style={{ maxHeight: 400 }}
            />
          </View>
        </View>
      </Modal>

      {/* Event Modal */}
      <Modal visible={showEventModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Event wählen</Text>
              <TouchableOpacity onPress={() => setShowEventModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={[null, ...eventList]}
              keyExtractor={(item, index) => (item ? String(item.id) : 'no-event')}
              renderItem={({ item }) => {
                const label = item ? getEventDisplayName(item) : 'Kein Event';
                const isSelected = item === null ? selectedEvent === null : selectedEvent?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.modalItem,
                      { borderBottomColor: colors.border },
                      isSelected && { backgroundColor: colors.primary + '18' },
                    ]}
                    onPress={() => {
                      setSelectedEvent(item);
                      setShowEventModal(false);
                    }}
                  >
                    <Text style={[styles.modalItemText, { color: colors.text }, isSelected && { color: colors.primary, fontWeight: '600' }]}>
                      {label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }}
              style={{ maxHeight: 400 }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  section: { borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6, marginTop: 12 },
  labelError: { color: '#dc3545' },
  input: { borderRadius: 8, padding: 12, fontSize: 16, borderWidth: 1 },
  inputError: { borderColor: '#dc3545', borderWidth: 1.5 },
  errorText: { color: '#dc3545', fontSize: 12, marginTop: 4 },
  textArea: { height: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
  },
  submitButton: {
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginVertical: 24,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalItemText: { fontSize: 16 },
});
