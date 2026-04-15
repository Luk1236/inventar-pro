import React, { useState, useCallback } from 'react';
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

const WEBHOOK_EVENTS = [
  { key: 'event_created', label: 'Event erstellt' },
  { key: 'booking_confirmed', label: 'Buchung bestätigt' },
  { key: 'invoice_created', label: 'Rechnung erstellt' },
  { key: 'invoice_paid', label: 'Rechnung bezahlt' },
  { key: 'quote_accepted', label: 'Angebot akzeptiert' },
  { key: 'customer_created', label: 'Kunde erstellt' },
];

const EMPTY_FORM = { url: '', events: [] as string[], active: true, secret: '' };

export default function IntegrationsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const load = useCallback(async () => {
    try {
      const data = await apiService.get<any[]>('/api/webhooks', { showErrorAlert: false });
      setWebhooks(data);
    } catch { }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(load);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, events: [] });
    setModalVisible(true);
  };

  const openEdit = (w: any) => {
    setEditingId(w.id);
    setForm({ url: w.url || '', events: w.events || [], active: w.active ?? true, secret: w.secret || '' });
    setModalVisible(true);
  };

  const toggleEvent = (key: string) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(key) ? f.events.filter(e => e !== key) : [...f.events, key],
    }));
  };

  const handleSave = async () => {
    if (!form.url.trim() || !form.url.startsWith('http')) {
      Alert.alert('Fehler', 'Gültige URL erforderlich (https://...)');
      return;
    }
    setSaving(true);
    try {
      const payload = { url: form.url.trim(), events: form.events, active: form.active, secret: form.secret.trim() };
      if (editingId) {
        const updated = await apiService.put<any>(`/api/webhooks/${editingId}`, payload);
        setWebhooks(prev => prev.map(w => w.id === editingId ? updated : w));
      } else {
        const created = await apiService.post<any>('/api/webhooks', payload);
        setWebhooks(prev => [created, ...prev]);
      }
      setModalVisible(false);
    } catch {
      Alert.alert('Fehler', 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (w: any) => {
    Alert.alert('Webhook löschen', `"${w.url}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive',
        onPress: async () => {
          try {
            await apiService.delete(`/api/webhooks/${w.id}`);
            setWebhooks(prev => prev.filter(x => x.id !== w.id));
          } catch { Alert.alert('Fehler', 'Löschen fehlgeschlagen'); }
        },
      },
    ]);
  };

  const toggleActive = async (w: any) => {
    try {
      const updated = await apiService.put<any>(`/api/webhooks/${w.id}`, { ...w, active: !w.active });
      setWebhooks(prev => prev.map(x => x.id === w.id ? updated : x));
    } catch { }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 12 },
    cardUrl: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1, marginRight: 8 },
    infoBox: { backgroundColor: colors.primary + '15', borderRadius: 10, marginHorizontal: 16, marginTop: 16, padding: 14, flexDirection: 'row', gap: 10 },
    emptyBox: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 14, color: colors.textSecondary, marginTop: 10 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 12 },
    input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text },
    chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, marginBottom: 6 },
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
        <Text style={styles.headerTitle}>Integrationen</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView>
        <View style={styles.infoBox}>
          <Ionicons name="extension-puzzle-outline" size={20} color={colors.primary} />
          <Text style={{ flex: 1, fontSize: 13, color: colors.primary, lineHeight: 18 }}>
            Webhooks benachrichtigen externe Systeme (Zapier, Make, eigene APIs) automatisch bei bestimmten Ereignissen.
          </Text>
        </View>

        <View style={{ paddingTop: 16 }}>
          {webhooks.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="extension-puzzle-outline" size={52} color={colors.border} />
              <Text style={styles.emptyText}>Keine Webhooks konfiguriert</Text>
              <TouchableOpacity onPress={openCreate} style={{ marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}>
                <Text style={{ color: 'white', fontWeight: '600' }}>Ersten Webhook erstellen</Text>
              </TouchableOpacity>
            </View>
          ) : (
            webhooks.map(w => (
              <View key={w.id} style={styles.card}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <Text style={styles.cardUrl} numberOfLines={1}>{w.url}</Text>
                  <Switch
                    value={w.active}
                    onValueChange={() => toggleActive(w)}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="white"
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
                </View>
                {w.events?.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                    {w.events.map((e: string) => (
                      <View key={e} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.background }}>
                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>{WEBHOOK_EVENTS.find(x => x.key === e)?.label ?? e}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }} onPress={() => openEdit(w)}>
                    <Ionicons name="create-outline" size={15} color={colors.text} />
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Bearbeiten</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#FF3B30' }} onPress={() => handleDelete(w)}>
                    <Ionicons name="trash-outline" size={15} color="#FF3B30" />
                    <Text style={{ color: '#FF3B30', fontSize: 13, fontWeight: '600' }}>Löschen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>{editingId ? 'Webhook bearbeiten' : 'Neuer Webhook'}</Text>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>URL *</Text>
                <TextInput
                  style={styles.input}
                  value={form.url}
                  onChangeText={v => setForm(f => ({ ...f, url: v }))}
                  placeholder="https://hooks.example.com/webhook"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="url"
                  autoCapitalize="none"
                />

                <Text style={styles.label}>Ereignisse</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {WEBHOOK_EVENTS.map(e => (
                    <TouchableOpacity
                      key={e.key}
                      style={[styles.chip, {
                        borderColor: form.events.includes(e.key) ? colors.primary : colors.border,
                        backgroundColor: form.events.includes(e.key) ? colors.primary + '20' : 'transparent',
                      }]}
                      onPress={() => toggleEvent(e.key)}
                    >
                      <Text style={{ color: form.events.includes(e.key) ? colors.primary : colors.textSecondary, fontSize: 13 }}>{e.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Secret (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={form.secret}
                  onChangeText={v => setForm(f => ({ ...f, secret: v }))}
                  placeholder="Webhook-Secret für HMAC-Signatur"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                  <Text style={{ fontSize: 15, color: colors.text }}>Aktiv</Text>
                  <Switch
                    value={form.active}
                    onValueChange={v => setForm(f => ({ ...f, active: v }))}
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
