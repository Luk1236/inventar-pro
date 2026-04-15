import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const toISO = (d: string) => { const [dd, mm, yyyy] = d.split('.'); return `${yyyy}-${mm}-${dd}`; };

const TYPES = [
  { value: 'urlaub', label: 'Urlaub' },
  { value: 'krank', label: 'Krank' },
  { value: 'sonstige', label: 'Sonstige' },
];

export default function CreateAbsencePage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [crew, setCrew] = useState<any[]>([]);
  const [showCrewPicker, setShowCrewPicker] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    type: 'urlaub',
    reason: '',
  });

  useEffect(() => {
    apiService.get<any[]>('/api/crew').then(data => setCrew(data || [])).catch(() => {});
  }, []);

  const getCrewName = (member: any) =>
    member.first_name ? `${member.first_name} ${member.last_name}` : member.name || '';

  const handleSubmit = async () => {
    if (!selectedCrew) { Alert.alert('Fehler', 'Bitte wählen Sie einen Mitarbeiter'); return; }
    if (!formData.start_date.trim()) { Alert.alert('Fehler', 'Startdatum ist erforderlich'); return; }
    if (!formData.end_date.trim()) { Alert.alert('Fehler', 'Enddatum ist erforderlich'); return; }
    setLoading(true);
    try {
      await apiService.post('/api/absence-requests', {
        crew_member_id: selectedCrew.id,
        crew_member_name: getCrewName(selectedCrew),
        ...formData,
        start_date: toISO(formData.start_date),
        end_date: toISO(formData.end_date),
      });
      router.back();
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Fehler beim Erstellen');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = [styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }];

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Neuer Antrag</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Mitarbeiter</Text>
            <TouchableOpacity
              style={[styles.selectorButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => setShowCrewPicker(true)}
            >
              <Text style={{ color: selectedCrew ? colors.text : colors.textSecondary, fontSize: 16 }}>
                {selectedCrew ? getCrewName(selectedCrew) : 'Mitarbeiter wählen...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Zeitraum</Text>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Startdatum *</Text>
            <TextInput
              style={inputStyle}
              placeholder="TT.MM.JJJJ"
              placeholderTextColor={colors.textSecondary}
              value={formData.start_date}
              onChangeText={v => setFormData(p => ({ ...p, start_date: v }))}
            />
            <Text style={[styles.label, { color: colors.textSecondary }]}>Enddatum *</Text>
            <TextInput
              style={inputStyle}
              placeholder="TT.MM.JJJJ"
              placeholderTextColor={colors.textSecondary}
              value={formData.end_date}
              onChangeText={v => setFormData(p => ({ ...p, end_date: v }))}
            />
          </View>

          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Art der Abwesenheit</Text>
            <View style={styles.chipRow}>
              {TYPES.map(t => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.chip, formData.type === t.value
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: 'transparent', borderColor: colors.border }]}
                  onPress={() => setFormData(p => ({ ...p, type: t.value }))}
                >
                  <Text style={{ color: formData.type === t.value ? 'white' : colors.text, fontSize: 14, fontWeight: '500' }}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Grund (optional)</Text>
            <TextInput
              style={[inputStyle, styles.textArea]}
              placeholder="Grund für die Abwesenheit..."
              placeholderTextColor={colors.textSecondary}
              value={formData.reason}
              onChangeText={v => setFormData(p => ({ ...p, reason: v }))}
              multiline
              numberOfLines={3}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: colors.primary }, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.submitButtonText}>Antrag erstellen</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showCrewPicker} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>Mitarbeiter wählen</Text>
              <TouchableOpacity onPress={() => setShowCrewPicker(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={crew}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: selectedCrew?.id === item.id ? colors.primary + '20' : 'transparent' }}
                  onPress={() => { setSelectedCrew(item); setShowCrewPicker(false); }}
                >
                  <Text style={{ color: colors.text, fontSize: 16 }}>{getCrewName(item)}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={{ color: colors.textSecondary, padding: 20, textAlign: 'center' }}>Keine Mitarbeiter gefunden</Text>}
            />
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
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6, marginTop: 12 },
  input: { borderRadius: 8, padding: 12, fontSize: 16, borderWidth: 1 },
  textArea: { height: 80, textAlignVertical: 'top' },
  selectorButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 8, padding: 12, borderWidth: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  submitButton: { borderRadius: 8, paddingVertical: 16, alignItems: 'center', marginVertical: 24 },
  submitButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
