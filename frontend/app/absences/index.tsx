import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import SignaturePad from '../../components/SignaturePad';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AbsenceRequest {
  id: string;
  crew_member_name: string;
  start_date: string;
  end_date: string;
  type: 'urlaub' | 'krank' | 'sonstige';
  reason?: string;
  status: 'ausstehend' | 'genehmigt' | 'abgelehnt';
  created_at: string;
}

const TYPE_COLORS: Record<string, string> = {
  urlaub: '#007AFF',
  krank: '#FF9500',
  sonstige: '#8E8E93',
};

const TYPE_LABELS: Record<string, string> = {
  urlaub: 'Urlaub',
  krank: 'Krank',
  sonstige: 'Sonstige',
};

const STATUS_COLORS: Record<string, string> = {
  ausstehend: '#FF9500',
  genehmigt: '#34C759',
  abgelehnt: '#FF3B30',
};

const STATUS_LABELS: Record<string, string> = {
  ausstehend: 'Ausstehend',
  genehmigt: 'Genehmigt',
  abgelehnt: 'Abgelehnt',
};

const STATUS_ORDER: AbsenceRequest['status'][] = ['ausstehend', 'genehmigt', 'abgelehnt'];

export default function AbsencesPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [requests, setRequests] = useState<AbsenceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Signature state
  const [signPadVisible, setSignPadVisible] = useState(false);
  const [signingItem, setSigningItem] = useState<AbsenceRequest | null>(null);
  const [pendingStatus, setPendingStatus] = useState<'genehmigt' | 'abgelehnt'>('genehmigt');
  const [approverName, setApproverName] = useState('');
  const [nameModalVisible, setNameModalVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiService.get<AbsenceRequest[]>('/api/absence-requests');
      setRequests(data || []);
    } catch {
      // errors handled by apiService
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(load);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleStatusChange = (item: AbsenceRequest) => {
    Alert.alert(
      'Status ändern',
      `Antrag von ${item.crew_member_name}`,
      [
        {
          text: 'Genehmigen (mit Unterschrift)',
          onPress: () => {
            setSigningItem(item);
            setPendingStatus('genehmigt');
            setApproverName('');
            setNameModalVisible(true);
          },
        },
        {
          text: 'Ablehnen (mit Unterschrift)',
          style: 'destructive',
          onPress: () => {
            setSigningItem(item);
            setPendingStatus('abgelehnt');
            setApproverName('');
            setNameModalVisible(true);
          },
        },
        { text: 'Abbrechen', style: 'cancel' },
      ]
    );
  };

  const saveApprovalSignature = async (base64Svg: string) => {
    if (!signingItem) return;
    try {
      await apiService.put(`/api/absence-requests/${signingItem.id}/sign`, {
        signature: base64Svg,
        signed_by: approverName,
        status: pendingStatus,
      });
      await load();
      Alert.alert('Erfolg', pendingStatus === 'genehmigt' ? 'Antrag genehmigt' : 'Antrag abgelehnt');
    } catch {
      Alert.alert('Fehler', 'Unterschrift konnte nicht gespeichert werden');
    }
  };

  const handleDelete = async (item: AbsenceRequest) => {
    if (!(window as any).confirm(`Antrag von "${item.crew_member_name}" wirklich löschen?`)) return;
    try { await apiService.delete(`/api/absence-requests/${item.id}`); await load(); }
    catch { /* handled by apiService */ }
  };

  const grouped = STATUS_ORDER.map(status => ({
    status,
    items: requests.filter(r => r.status === status),
  })).filter(g => g.items.length > 0);

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Abwesenheitsanträge</Text>
        <TouchableOpacity onPress={() => router.push('/absences/create')} style={styles.headerBtn}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {requests.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={52} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Keine Abwesenheitsanträge vorhanden
              </Text>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/absences/create')}
              >
                <Text style={styles.emptyBtnText}>Antrag erstellen</Text>
              </TouchableOpacity>
            </View>
          ) : (
            grouped.map(({ status, items }) => (
              <View key={status}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, { backgroundColor: STATUS_COLORS[status] }]} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {STATUS_LABELS[status]}
                  </Text>
                  <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
                    ({items.length})
                  </Text>
                </View>

                {items.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.card, { backgroundColor: colors.card }]}
                    onLongPress={() => handleDelete(item)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.cardTop}>
                      <Text style={[styles.cardName, { color: colors.text }]}>
                        {item.crew_member_name}
                      </Text>
                      <View style={[styles.typeBadge, { backgroundColor: TYPE_COLORS[item.type] + '20' }]}>
                        <Text style={[styles.typeBadgeText, { color: TYPE_COLORS[item.type] }]}>
                          {TYPE_LABELS[item.type]}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.dateRange, { color: colors.textSecondary }]}>
                      {item.start_date} bis {item.end_date}
                    </Text>

                    {item.reason ? (
                      <Text style={[styles.reason, { color: colors.textSecondary }]} numberOfLines={2}>
                        {item.reason}
                      </Text>
                    ) : null}

                    <View style={styles.cardBottom}>
                      <TouchableOpacity
                        style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] }]}
                        onPress={() => handleStatusChange(item)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.statusBadgeText}>{STATUS_LABELS[item.status]}</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}
      {/* Approver name modal */}
      <Modal visible={nameModalVisible} animationType="fade" transparent onRequestClose={() => setNameModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
              {pendingStatus === 'genehmigt' ? 'Genehmigung' : 'Ablehnung'} unterschreiben
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 14 }}>
              Antrag von: {signingItem?.crew_member_name}
            </Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text, backgroundColor: colors.background, marginBottom: 16 }}
              value={approverName}
              onChangeText={setApproverName}
              placeholder="Name des Genehmigenden"
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => setNameModalVisible(false)} style={{ flex: 1, padding: 13, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setNameModalVisible(false); setSignPadVisible(true); }}
                style={{ flex: 2, padding: 13, borderRadius: 10, backgroundColor: pendingStatus === 'genehmigt' ? '#34C759' : '#FF3B30', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
              >
                <Ionicons name="create-outline" size={16} color="white" />
                <Text style={{ color: 'white', fontWeight: '600' }}>Zur Unterschrift</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Approval Signature Pad */}
      <SignaturePad
        visible={signPadVisible}
        title={pendingStatus === 'genehmigt' ? 'Genehmigung' : 'Ablehnung'}
        description={`Bitte unterschreiben Sie zur ${pendingStatus === 'genehmigt' ? 'Genehmigung' : 'Ablehnung'} des Antrags`}
        onSave={saveApprovalSignature}
        onClose={() => setSignPadVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyText: { marginTop: 14, fontSize: 15, textAlign: 'center' },
  emptyBtn: {
    marginTop: 20,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  emptyBtnText: { color: 'white', fontWeight: '600', fontSize: 15 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionCount: { fontSize: 13 },
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardName: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  typeBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeBadgeText: { fontSize: 12, fontWeight: '600' },
  dateRange: { fontSize: 13, marginBottom: 4 },
  reason: { fontSize: 13, marginTop: 2, marginBottom: 6 },
  cardBottom: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusBadgeText: { color: 'white', fontSize: 12, fontWeight: '700' },
});
