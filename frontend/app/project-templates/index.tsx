import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import apiService from '../../services/apiService';
import { useTheme } from '../../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const EVENT_TYPES = ['Konzert', 'Messe', 'Hochzeit', 'Firmenevent', 'Theater', 'Festival', 'Privates Event', 'Sonstiges'];
const LOCATION_TYPES = ['Indoor', 'Outdoor', 'Hybrid'];

const EMPTY_FORM = { name: '', description: '', event_type: '', location_type: '', notes_template: '', bom_id: '' };

export default function ProjectTemplatesPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<any[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const load = useCallback(async () => {
    try {
      const [t, b] = await Promise.all([
        apiService.get<any[]>('/api/project-templates', { showErrorAlert: false }),
        apiService.get<any[]>('/api/bom', { showErrorAlert: false }),
      ]);
      setTemplates(t);
      setBoms(b);
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(load);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setModalVisible(true);
  };

  const openEdit = (t: any) => {
    setEditingId(t.id);
    setForm({
      name: t.name || '',
      description: t.description || '',
      event_type: t.event_type || '',
      location_type: t.location_type || '',
      notes_template: t.notes_template || '',
      bom_id: t.bom_id || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Fehler', 'Name ist erforderlich'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        event_type: form.event_type || null,
        location_type: form.location_type || null,
        notes_template: form.notes_template.trim() || null,
        bom_id: form.bom_id || null,
      };
      if (editingId) {
        const updated = await apiService.put<any>(`/api/project-templates/${editingId}`, payload);
        setTemplates(prev => prev.map(t => t.id === editingId ? updated : t));
      } else {
        const created = await apiService.post<any>('/api/project-templates', payload);
        setTemplates(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setModalVisible(false);
    } catch {
      Alert.alert('Fehler', 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (t: any) => {
    Alert.alert('Vorlage löschen', `"${t.name}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive',
        onPress: async () => {
          try {
            await apiService.delete(`/api/project-templates/${t.id}`);
            setTemplates(prev => prev.filter(x => x.id !== t.id));
          } catch {
            Alert.alert('Fehler', 'Löschen fehlgeschlagen');
          }
        },
      },
    ]);
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    content: { flex: 1, padding: 16 },
    card: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
    cardDesc: { fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
    tagsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
    tag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, backgroundColor: colors.background },
    tagText: { fontSize: 12, color: colors.textSecondary },
    actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
    emptyBox: { alignItems: 'center', paddingVertical: 64 },
    emptyText: { fontSize: 15, color: colors.textSecondary, marginTop: 12 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 12 },
    input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text },
    chipsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
    saveBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 20 },
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
        <Text style={styles.headerTitle}>Projektvorlagen ({templates.length})</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {templates.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="copy-outline" size={56} color={colors.border} />
            <Text style={styles.emptyText}>Keine Vorlagen vorhanden</Text>
            <TouchableOpacity onPress={openCreate} style={{ marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}>
              <Text style={{ color: 'white', fontWeight: '600' }}>Erste Vorlage erstellen</Text>
            </TouchableOpacity>
          </View>
        ) : (
          templates.map(t => {
            const bom = boms.find(b => b.id === t.bom_id);
            return (
              <View key={t.id} style={styles.card}>
                <Text style={styles.cardTitle}>{t.name}</Text>
                {t.description ? <Text style={styles.cardDesc}>{t.description}</Text> : null}
                <View style={styles.tagsRow}>
                  {t.event_type ? <View style={styles.tag}><Text style={[styles.tagText, { color: colors.primary }]}>{t.event_type}</Text></View> : null}
                  {t.location_type ? <View style={styles.tag}><Text style={styles.tagText}>{t.location_type}</Text></View> : null}
                  {bom ? <View style={styles.tag}><Text style={styles.tagText}>BOM: {bom.name}</Text></View> : null}
                </View>
                {t.notes_template ? (
                  <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginBottom: 8 }} numberOfLines={2}>
                    Notiz: {t.notes_template}
                  </Text>
                ) : null}
                <View style={styles.actionsRow}>
                  <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={() => openEdit(t)}>
                    <Ionicons name="create-outline" size={16} color={colors.text} />
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Bearbeiten</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { borderColor: '#FF3B30' }]} onPress={() => handleDelete(t)}>
                    <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                    <Text style={{ color: '#FF3B30', fontSize: 13, fontWeight: '600' }}>Löschen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>{editingId ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</Text>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={form.name}
                  onChangeText={v => setForm(f => ({ ...f, name: v }))}
                  placeholder="z.B. Hochzeitspaket Standard"
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={styles.label}>Beschreibung</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60 }]}
                  value={form.description}
                  onChangeText={v => setForm(f => ({ ...f, description: v }))}
                  placeholder="Kurze Beschreibung..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                />

                <Text style={styles.label}>Event-Typ</Text>
                <View style={styles.chipsRow}>
                  {EVENT_TYPES.map(et => (
                    <TouchableOpacity
                      key={et}
                      style={[styles.chip, { borderColor: form.event_type === et ? colors.primary : colors.border, backgroundColor: form.event_type === et ? colors.primary + '20' : 'transparent' }]}
                      onPress={() => setForm(f => ({ ...f, event_type: f.event_type === et ? '' : et }))}
                    >
                      <Text style={{ color: form.event_type === et ? colors.primary : colors.textSecondary, fontSize: 13, fontWeight: '500' }}>{et}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Standort-Typ</Text>
                <View style={styles.chipsRow}>
                  {LOCATION_TYPES.map(lt => (
                    <TouchableOpacity
                      key={lt}
                      style={[styles.chip, { borderColor: form.location_type === lt ? colors.primary : colors.border, backgroundColor: form.location_type === lt ? colors.primary + '20' : 'transparent' }]}
                      onPress={() => setForm(f => ({ ...f, location_type: f.location_type === lt ? '' : lt }))}
                    >
                      <Text style={{ color: form.location_type === lt ? colors.primary : colors.textSecondary, fontSize: 13, fontWeight: '500' }}>{lt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Notizen-Vorlage</Text>
                <TextInput
                  style={[styles.input, { minHeight: 80 }]}
                  value={form.notes_template}
                  onChangeText={v => setForm(f => ({ ...f, notes_template: v }))}
                  placeholder="Notizen die automatisch vorausgefüllt werden..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                />

                {boms.length > 0 && (
                  <>
                    <Text style={styles.label}>Artikelpaket (BOM)</Text>
                    <View style={styles.chipsRow}>
                      <TouchableOpacity
                        style={[styles.chip, { borderColor: !form.bom_id ? colors.primary : colors.border, backgroundColor: !form.bom_id ? colors.primary + '20' : 'transparent' }]}
                        onPress={() => setForm(f => ({ ...f, bom_id: '' }))}
                      >
                        <Text style={{ color: !form.bom_id ? colors.primary : colors.textSecondary, fontSize: 13 }}>Keines</Text>
                      </TouchableOpacity>
                      {boms.map(b => (
                        <TouchableOpacity
                          key={b.id}
                          style={[styles.chip, { borderColor: form.bom_id === b.id ? colors.primary : colors.border, backgroundColor: form.bom_id === b.id ? colors.primary + '20' : 'transparent' }]}
                          onPress={() => setForm(f => ({ ...f, bom_id: b.id }))}
                        >
                          <Text style={{ color: form.bom_id === b.id ? colors.primary : colors.textSecondary, fontSize: 13 }}>{b.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                  <TouchableOpacity onPress={() => setModalVisible(false)} style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.background, alignItems: 'center' }}>
                    <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Abbrechen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.saveBtn, { flex: 2, marginTop: 0, opacity: saving ? 0.6 : 1 }]}>
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
