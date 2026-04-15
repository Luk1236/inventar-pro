import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, TextInput, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import apiService from '../../services/apiService';
import { useTheme } from '../../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const toISO = (d: string) => { if (!d || !d.includes('.')) return d; const [dd, mm, yyyy] = d.split('.'); return `${yyyy}-${mm}-${dd}`; };
const todayDisplay = () => { const n = new Date(); const d = String(n.getDate()).padStart(2,'0'); const m = String(n.getMonth()+1).padStart(2,'0'); return `${d}.${m}.${n.getFullYear()}`; };

export default function CreateTimeEntryPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [crew, setCrew] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [showCrewPicker, setShowCrewPicker] = useState(false);
  const [showEventPicker, setShowEventPicker] = useState(false);

  const [crewId, setCrewId] = useState('');
  const [crewName, setCrewName] = useState('');
  const [eventId, setEventId] = useState('');
  const [eventName, setEventName] = useState('');
  const [date, setDate] = useState(todayDisplay());
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [breakMinutes, setBreakMinutes] = useState('0');
  const [activity, setActivity] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [c, e] = await Promise.all([
          apiService.get<any[]>('/api/crew', { showErrorAlert: false }),
          apiService.get<any[]>('/api/events', { showErrorAlert: false }),
        ]);
        setCrew(c || []);
        setEvents(e || []);
      } catch {}
    };
    load();
  }, []);

  const calcHours = () => {
    try {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      const mins = (eh * 60 + em) - (sh * 60 + sm) - (parseInt(breakMinutes) || 0);
      return Math.max(0, mins / 60).toFixed(1);
    } catch { return '0.0'; }
  };

  const handleSave = async () => {
    if (!crewId) { Alert.alert('Fehler', 'Bitte Mitarbeiter auswählen'); return; }
    if (!date) { Alert.alert('Fehler', 'Datum ist erforderlich'); return; }
    setLoading(true);
    try {
      await apiService.post('/api/time-entries', {
        crew_member_id: crewId,
        event_id: eventId || null,
        date: toISO(date),
        start_time: startTime,
        end_time: endTime,
        break_minutes: parseInt(breakMinutes) || 0,
        activity: activity || null,
        notes: notes || null,
      });
      router.back();
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Speichern fehlgeschlagen');
    } finally { setLoading(false); }
  };

  const inputStyle = [styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }];

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Stunden erfassen</Text>
          <TouchableOpacity onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>Speichern</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Mitarbeiter & Event</Text>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Mitarbeiter *</Text>
            <TouchableOpacity style={[inputStyle, { justifyContent: 'center' }]} onPress={() => setShowCrewPicker(true)}>
              <Text style={{ color: crewName ? colors.text : colors.textSecondary }}>{crewName || 'Mitarbeiter auswählen...'}</Text>
            </TouchableOpacity>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Event (optional)</Text>
            <TouchableOpacity style={[inputStyle, { justifyContent: 'center' }]} onPress={() => setShowEventPicker(true)}>
              <Text style={{ color: eventName ? colors.text : colors.textSecondary }}>{eventName || 'Event auswählen (optional)...'}</Text>
            </TouchableOpacity>
            {eventName ? (
              <TouchableOpacity onPress={() => { setEventId(''); setEventName(''); }} style={{ marginTop: 4 }}>
                <Text style={{ color: '#FF3B30', fontSize: 13 }}>Event entfernen</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Zeiterfassung</Text>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Datum *</Text>
            <TextInput style={inputStyle} value={date} onChangeText={setDate} placeholder="TT.MM.JJJJ" placeholderTextColor={colors.textSecondary} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Beginn</Text>
                <TextInput style={inputStyle} value={startTime} onChangeText={setStartTime} placeholder="08:00" placeholderTextColor={colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Ende</Text>
                <TextInput style={inputStyle} value={endTime} onChangeText={setEndTime} placeholder="17:00" placeholderTextColor={colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Pause (min)</Text>
                <TextInput style={inputStyle} value={breakMinutes} onChangeText={setBreakMinutes} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textSecondary} />
              </View>
            </View>
            <View style={{ backgroundColor: colors.background, borderRadius: 8, padding: 12, marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Arbeitsstunden</Text>
              <Text style={{ color: colors.primary, fontSize: 28, fontWeight: '700' }}>{calcHours()}h</Text>
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Details</Text>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Tätigkeit</Text>
            <TextInput style={inputStyle} value={activity} onChangeText={setActivity} placeholder="z.B. Aufbau, Transport, Techniker" placeholderTextColor={colors.textSecondary} />
            <Text style={[styles.label, { color: colors.textSecondary }]}>Notizen</Text>
            <TextInput style={[inputStyle, { height: 70, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} multiline placeholder="Zusätzliche Notizen..." placeholderTextColor={colors.textSecondary} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showCrewPicker} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '65%' }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Mitarbeiter auswählen</Text>
            <ScrollView>
              {crew.map(c => (
                <TouchableOpacity key={c.id} onPress={() => { setCrewId(c.id); setCrewName(c.name); setShowCrewPicker(false); }}
                  style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{c.name}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{c.role}{c.hourly_rate > 0 ? ` · €${c.hourly_rate}/h` : ''}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setShowCrewPicker(false)} style={{ marginTop: 16, alignItems: 'center' }}>
                <Text style={{ color: '#FF3B30', fontWeight: '600' }}>Abbrechen</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showEventPicker} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '65%' }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Event auswählen</Text>
            <ScrollView>
              {events.map(e => (
                <TouchableOpacity key={e.id} onPress={() => { setEventId(e.id); setEventName(e.event_name); setShowEventPicker(false); }}
                  style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{e.event_name}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{e.event_number}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setShowEventPicker(false)} style={{ marginTop: 16, alignItems: 'center' }}>
                <Text style={{ color: '#FF3B30', fontWeight: '600' }}>Abbrechen</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  section: { borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6, marginTop: 8 },
  input: { borderRadius: 8, padding: 12, fontSize: 15, borderWidth: 1 },
});
