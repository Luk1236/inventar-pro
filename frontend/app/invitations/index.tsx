import React, { useState, useCallback } from 'react';
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

const STATUS_COLORS: Record<string, string> = {
  pending: '#FF9500',
  accepted: '#34C759',
  declined: '#FF3B30',
};
const STATUS_LABELS: Record<string, string> = {
  pending: 'Ausstehend',
  accepted: 'Zugesagt',
  declined: 'Abgesagt',
};

export default function InvitationsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [form, setForm] = useState({ event_id: '', email: '', name: '' });

  const load = useCallback(async () => {
    try {
      const data = await apiService.get<any[]>('/api/invitations', { showErrorAlert: false });
      setInvitations(data);
    } catch { }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(load);

  const filtered = filterStatus ? invitations.filter(i => i.status === filterStatus) : invitations;

  const handleSend = async () => {
    if (!form.event_id.trim() || !form.email.trim()) {
      Alert.alert('Fehler', 'Event-ID und E-Mail sind erforderlich');
      return;
    }
    setSaving(true);
    try {
      const created = await apiService.post<any>(`/api/events/${form.event_id.trim()}/invitations`, {
        event_id: form.event_id.trim(),
        email: form.email.trim(),
        name: form.name.trim(),
      });
      setInvitations(prev => [{ ...created, event_name: '' }, ...prev]);
      setModalVisible(false);
      setForm({ event_id: '', email: '', name: '' });
    } catch {
      Alert.alert('Fehler', 'Einladung konnte nicht gesendet werden');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (inv: any) => {
    Alert.alert('Einladung löschen', `Einladung an ${inv.email} löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive',
        onPress: async () => {
          try {
            await apiService.delete(`/api/invitations/${inv.id}`);
            setInvitations(prev => prev.filter(i => i.id !== inv.id));
          } catch { Alert.alert('Fehler', 'Löschen fehlgeschlagen'); }
        },
      },
    ]);
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    filterRow: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 4 },
    filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
    card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 10 },
    cardEmail: { fontSize: 15, fontWeight: '700', color: colors.text },
    cardName: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    cardEvent: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start', marginTop: 8 },
    emptyBox: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 14, color: colors.textSecondary, marginTop: 10 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 12 },
    input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text },
  });

  const counts = {
    pending: invitations.filter(i => i.status === 'pending').length,
    accepted: invitations.filter(i => i.status === 'accepted').length,
    declined: invitations.filter(i => i.status === 'declined').length,
  };

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
        <Text style={styles.headerTitle}>Einladungen ({invitations.length})</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={{ flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 4 }}>
        {Object.entries(counts).map(([s, c]) => (
          <View key={s} style={{ flex: 1, backgroundColor: colors.card, borderRadius: 10, padding: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: STATUS_COLORS[s] }}>{c}</Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{STATUS_LABELS[s]}</Text>
          </View>
        ))}
      </View>

      {/* Filter */}
      <View style={styles.filterRow}>
        {[null, 'pending', 'accepted', 'declined'].map(s => (
          <TouchableOpacity
            key={s ?? 'all'}
            style={[styles.filterChip, { borderColor: filterStatus === s ? colors.primary : colors.border, backgroundColor: filterStatus === s ? colors.primary + '20' : 'transparent' }]}
            onPress={() => setFilterStatus(s)}
          >
            <Text style={{ fontSize: 12, color: filterStatus === s ? colors.primary : colors.textSecondary, fontWeight: '600' }}>
              {s ? STATUS_LABELS[s] : 'Alle'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1, paddingTop: 8 }}>
        {filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="paper-plane-outline" size={52} color={colors.border} />
            <Text style={styles.emptyText}>Keine Einladungen vorhanden</Text>
            <TouchableOpacity onPress={() => setModalVisible(true)} style={{ marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}>
              <Text style={{ color: 'white', fontWeight: '600' }}>Erste Einladung senden</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filtered.map(inv => (
            <View key={inv.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardEmail}>{inv.email}</Text>
                  {inv.name ? <Text style={styles.cardName}>{inv.name}</Text> : null}
                  {inv.event_name ? <Text style={styles.cardEvent}>Event: {inv.event_name}</Text> : null}
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[inv.status] + '20' }]}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: STATUS_COLORS[inv.status] }}>
                      {STATUS_LABELS[inv.status] ?? inv.status}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDelete(inv)} style={{ padding: 4 }}>
                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
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
              <Text style={styles.modalTitle}>Neue Einladung</Text>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>Event-ID *</Text>
                <TextInput
                  style={styles.input}
                  value={form.event_id}
                  onChangeText={v => setForm(f => ({ ...f, event_id: v }))}
                  placeholder="Event-ID eingeben"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                />
                <Text style={styles.label}>E-Mail *</Text>
                <TextInput
                  style={styles.input}
                  value={form.email}
                  onChangeText={v => setForm(f => ({ ...f, email: v }))}
                  placeholder="gast@example.com"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={form.name}
                  onChangeText={v => setForm(f => ({ ...f, name: v }))}
                  placeholder="Max Mustermann"
                  placeholderTextColor={colors.textSecondary}
                />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                  <TouchableOpacity onPress={() => setModalVisible(false)} style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.background, alignItems: 'center' }}>
                    <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Abbrechen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSend} disabled={saving} style={{ flex: 2, padding: 15, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', opacity: saving ? 0.6 : 1 }}>
                    {saving ? <ActivityIndicator color="white" size="small" /> : <Text style={{ color: 'white', fontWeight: '700' }}>Einladung senden</Text>}
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
