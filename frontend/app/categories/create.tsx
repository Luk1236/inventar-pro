import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CreateCategoryPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams();
  const editId = params.id as string | undefined;
  
  const [formData, setFormData] = useState({
    name: params.name as string || '',
    description: params.description as string || '',
  });

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Fehler', 'Name ist erforderlich');
      return;
    }

    try {
      if (editId) {
        await apiService.put(`/api/categories/${editId}`, formData);
      } else {
        await apiService.post('/api/categories', formData);
      }

      router.back();
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Speichern fehlgeschlagen');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {editId ? 'Kategorie bearbeiten' : 'Kategorie erstellen'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.formContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.label, { color: colors.text }]}>Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="z.B. Lichttechnik, Tontechnik..."
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />

            <Text style={[styles.label, { color: colors.text }]}>Beschreibung</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder="Zusätzliche Informationen zur Kategorie..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
            />

            <View style={[styles.examplesContainer, { backgroundColor: isDark ? '#1a3a5c' : '#f0f8ff', borderColor: isDark ? '#2a5a8c' : '#cce7ff' }]}>
              <Text style={[styles.examplesTitle, { color: colors.primary }]}>💡 Beispiele für Kategorien:</Text>
              <Text style={[styles.exampleText, { color: colors.textSecondary }]}>• Lichttechnik</Text>
              <Text style={[styles.exampleText, { color: colors.textSecondary }]}>• Tontechnik</Text>
              <Text style={[styles.exampleText, { color: colors.textSecondary }]}>• Videotechnik</Text>
              <Text style={[styles.exampleText, { color: colors.textSecondary }]}>• Bühnenbau</Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Speichern</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  formContainer: { borderRadius: 12, padding: 16, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  input: { borderRadius: 8, padding: 12, fontSize: 16, borderWidth: 1 },
  textArea: { height: 100, textAlignVertical: 'top' },
  examplesContainer: { borderRadius: 8, padding: 12, marginTop: 16, borderWidth: 1 },
  examplesTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  exampleText: { fontSize: 12, marginTop: 4 },
  saveButton: { borderRadius: 8, paddingVertical: 16, alignItems: 'center', marginBottom: 32 },
  saveButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
