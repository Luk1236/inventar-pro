import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  ActivityIndicator, Alert, Modal, TextInput, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import apiService from '../../services/apiService';
import { useTheme } from '../../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ENTITY_TYPES = [
  { key: 'event', label: 'Events' },
  { key: 'quote', label: 'Angebote' },
  { key: 'customer', label: 'Kunden' },
  { key: 'article', label: 'Artikel' },
];

const FIELD_TYPES = [
  { key: 'text', label: 'Text', icon: 'text-outline' },
  { key: 'number', label: 'Zahl', icon: 'calculator-outline' },
  { key: 'date', label: 'Datum', icon: 'calendar-outline' },
  { key: 'checkbox', label: 'Checkbox', icon: 'checkbox-outline' },
  { key: 'select', label: 'Auswahl', icon: 'chevron-down-outline' },
];

const EMPTY_FORM = { field_label: '', field_name: '', field_type: 'text', options: '', required: false, sort_order: 0 };

function slugify(str: string) {
  return str.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export default function CustomFieldsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('event');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const load = useCallback(async () => {
    try {
      const data = await apiService.get<any[]>('/api/custom-fields', { showErrorAlert: false });
      setFields(data);
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const tabFields = fields.filter(f => f.entity_type === activeTab);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setModalVisible(true);
  };

  const openEdit = (f: any) => {
    setEditingId(f.id);
    setForm({
      field_label: f.field_label || '',
      field_name: f.field_name || '',
      field_type: f.field_type || 'text',
      options: (f.options || []).join(', '),
      required: f.required || false,
      sort_order: f.sort_order || 0,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.field_label.trim()) { Alert.alert('Fehler', 'Bezeichnung ist erforderlich'); return; }
    setSaving(true);
    try {
      const payload = {
        entity_type: activeTab,
        field_label: form.field_label.trim(),
        field_name: form.field_name.trim() || slugify(form.field_label),
        field_type: form.field_type,
        options: form.field_type === 'select'
          ? form.options.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [],
        required: form.required,
        sort_order: Number(form.sort_order) || 0,
      };
      if (editingId) {
        const updated = await apiService.put<any>(`/api/custom-fields/${editingId}`, payload);
        setFields(prev => prev.map(f => f.id === editingId ? updated : f));
      } else {
        const created = await apiService.post<any>('/api/custom-fields', payload);
        setFields(prev => [...prev, created]);
      }
      setModalVisible(false);
    } catch {
      Alert.alert('Fehler', 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (f: any) => {
    Alert.alert('Feld löschen', `"${f.field_label}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive',
        onPress: async () => {
          try {
            await apiService.delete(`/api/custom-fields/${f.id}`);
            setFields(prev => prev.filter(x => x.id !== f.id));
          } catch { Alert.alert('Fehler', 'Löschen fehlgeschlagen'); }
        },
      },
    ]);
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    tabs: { flexDirection: 'row', backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabText: { fontSize: 13, fontWeight: '600' },
    card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
    cardLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
    cardName: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.primary + '20', alignSelf: 'flex-start', marginTop: 6 },
    badgeText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
    actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
    emptyBox: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 14, color: colors.textSecondary, marginTop: 10 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 12 },
    input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text },
    chipsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  });

  if (loading) return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Extra Eingabefelder</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {ENTITY_TYPES.map(et => (
          <TouchableOpacity key={et.key} style={styles.tab} onPress={() => setActiveTab(et.key)}>
            <Text style={[styles.tabText, { color: activeTab === et.key ? colors.primary : colors.textSecondary }]}>
              {et.label}
            </Text>
            {activeTab === et.key && (
              <View style={{ height: 2, backgroundColor: colors.primary, borderRadius: 1, width: '60%', marginTop: 4 }} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1, paddingTop: 12 }}>
        {tabFields.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="add-circle-outline" size={52} color={colors.border} />
            <Text style={styles.emptyText}>Keine Felder für {ENTITY_TYPES.find(e => e.key === activeTab)?.label}</Text>
            <TouchableOpacity onPress={openCreate} style={{ marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}>
              <Text style={{ color: 'white', fontWeight: '600' }}>Erstes Feld erstellen</Text>
            </TouchableOpacity>
          </View>
        ) : (
          tabFields.map(f => (
            <View key={f.id} style={styles.card}>
              <Text style={styles.cardLabel}>{f.field_label}{f.required ? ' *' : ''}</Text>
              <Text style={styles.cardName}>{f.field_name}</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{FIELD_TYPES.find(t => t.key === f.field_type)?.label ?? f.field_type}</Text>
                </View>
                {f.required && (
                  <View style={[styles.badge, { backgroundColor: '#FF3B3020' }]}>
                    <Text style={[styles.badgeText, { color: '#FF3B30' }]}>Pflichtfeld</Text>
                  </View>
                )}
                {f.options?.length > 0 && (
                  <View style={[styles.badge, { backgroundColor: colors.border + '50' }]}>
                    <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{f.options.join(' / ')}</Text>
                  </View>
                )}
              </View>
              <View style={styles.actionsRow}>
                <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={() => openEdit(f)}>
                  <Ionicons name="create-outline" size={15} color={colors.text} />
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Bearbeiten</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { borderColor: '#FF3B30' }]} onPress={() => handleDelete(f)}>
                  <Ionicons name="trash-outline" size={15} color="#FF3B30" />
                  <Text style={{ color: '#FF3B30', fontSize: 13, fontWeight: '600' }}>Löschen</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>{editingId ? 'Feld bearbeiten' : 'Neues Feld'}</Text>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>Bezeichnung *</Text>
                <TextInput
                  style={styles.input}
                  value={form.field_label}
                  onChangeText={v => setForm(f => ({ ...f, field_label: v, field_name: slugify(v) }))}
                  placeholder="z.B. Kontingent"
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={styles.label}>Feldname (technisch)</Text>
                <TextInput
                  style={[styles.input, { color: colors.textSecondary }]}
                  value={form.field_name}
                  onChangeText={v => setForm(f => ({ ...f, field_name: slugify(v) }))}
                  placeholder="kontingent"
                  placeholderTextColor={colors.border}
                />

                <Text style={styles.label}>Feldtyp</Text>
                <View style={styles.chipsRow}>
                  {FIELD_TYPES.map(ft => (
                    <TouchableOpacity
                      key={ft.key}
                      style={[styles.chip, { borderColor: form.field_type === ft.key ? colors.primary : colors.border, backgroundColor: form.field_type === ft.key ? colors.primary + '20' : 'transparent' }]}
                      onPress={() => setForm(f => ({ ...f, field_type: ft.key }))}
                    >
                      <Text style={{ color: form.field_type === ft.key ? colors.primary : colors.textSecondary, fontSize: 13 }}>{ft.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {form.field_type === 'select' && (
                  <>
                    <Text style={styles.label}>Optionen (kommagetrennt)</Text>
                    <TextInput
                      style={styles.input}
                      value={form.options}
                      onChangeText={v => setForm(f => ({ ...f, options: v }))}
                      placeholder="Option 1, Option 2, Option 3"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </>
                )}

                <View style={styles.switchRow}>
                  <Text style={{ fontSize: 15, color: colors.text }}>Pflichtfeld</Text>
                  <Switch
                    value={form.required}
                    onValueChange={v => setForm(f => ({ ...f, required: v }))}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="white"
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                  <TouchableOpacity onPress={() => setModalVisible(false)} style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.background, alignItems: 'center' }}>
                    <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Abbrechen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSave} disabled={saving} style={{ flex: 2, padding: 15, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', opacity: saving ? 0.6 : 1 }}>
                    {saving ? <ActivityIndicator color="white" size="small" /> : <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>Speichern</Text>}
                  </TouchableOpacity>
                </View>
                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
