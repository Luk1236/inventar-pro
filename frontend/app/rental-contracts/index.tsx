import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Picker } from '@react-native-picker/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SignaturePad from '../../components/SignaturePad';

interface RentalContract {
  id: string;
  contract_number: string;
  event_id: string;
  customer_id: string;
  items: Array<{
    article_name: string;
    inventory_code: string;
    quantity: number;
    unit_price: number;
    price_label: string;
    item_total: number;
  }>;
  start_date: string;
  end_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  deposit_amount: number;
  status: string;
  notes?: string;
  created_at: string;
}

interface Event {
  id: string;
  event_name: string;
  event_number: string;
}

export default function RentalContractsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<RentalContract[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsMap, setEventsMap] = useState<Record<string, Event>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Signature state
  const [signPadVisible, setSignPadVisible] = useState(false);
  const [signingContract, setSigningContract] = useState<RentalContract | null>(null);
  const [signedByName, setSignedByName] = useState('');
  const [nameModalVisible, setNameModalVisible] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [contractsData, eventsData] = await Promise.all([
        apiService.get<RentalContract[]>('/api/rental-contracts', { showErrorAlert: false }),
        apiService.get<Event[]>('/api/events', { showErrorAlert: false }),
      ]);

      setContracts(contractsData || []);
      setEvents(eventsData || []);

      const eMap: Record<string, Event> = {};
      (eventsData || []).forEach(e => eMap[e.id] = e);
      setEventsMap(eMap);

    } catch (error) {
      console.error('Error loading contracts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreateContract = async () => {
    if (!selectedEventId) {
      Alert.alert('Fehler', 'Bitte wählen Sie ein Event aus');
      return;
    }

    setSubmitting(true);
    try {
      const params = new URLSearchParams({
        event_id: selectedEventId,
        deposit_amount: depositAmount || '0',
      });
      if (notes) params.append('notes', notes);

      await apiService.post(`/api/rental-contracts?${params.toString()}`, {});
      
      Alert.alert('Erfolg', 'Mietvertrag wurde erstellt');
      setModalVisible(false);
      setSelectedEventId('');
      setDepositAmount('');
      setNotes('');
      loadData();
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Mietvertrag konnte nicht erstellt werden');
    } finally {
      setSubmitting(false);
    }
  };

  const generateContractPDF = async (contract: RentalContract) => {
    try {
      const pdfData = await apiService.get<{ html: string }>(
        `/api/rental-contracts/${contract.id}/pdf-data`,
        { showErrorAlert: false }
      );

      const { uri } = await Print.printToFileAsync({ html: pdfData.html });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Mietvertrag ${contract.contract_number}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Erfolg', 'PDF wurde erstellt');
      }
    } catch (error) {
      console.error('PDF error:', error);
      Alert.alert('Fehler', 'PDF konnte nicht erstellt werden');
    }
  };

  const handleSignContract = (contract: RentalContract) => {
    setSigningContract(contract);
    setSignedByName('');
    setNameModalVisible(true);
  };

  const saveSignature = async (base64Svg: string) => {
    if (!signingContract) return;
    try {
      await apiService.put(`/api/rental-contracts/${signingContract.id}/sign`, {
        signature_customer: base64Svg,
        signed_by: signedByName,
      });
      Alert.alert('Erfolg', 'Vertrag wurde unterschrieben');
      loadData();
    } catch {
      Alert.alert('Fehler', 'Unterschrift konnte nicht gespeichert werden');
    }
  };

  const updateContractStatus = async (contractId: string, newStatus: string) => {
    try {
      await apiService.put(`/api/rental-contracts/${contractId}/status?status=${newStatus}`, {});
      Alert.alert('Erfolg', `Status geändert zu: ${getStatusText(newStatus)}`);
      loadData();
    } catch {
      Alert.alert('Fehler', 'Status konnte nicht geändert werden');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return '#666';
      case 'signed': return '#007AFF';
      case 'active': return '#34C759';
      case 'completed': return '#8E8E93';
      case 'cancelled': return '#FF3B30';
      default: return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return 'Entwurf';
      case 'signed': return 'Unterschrieben';
      case 'active': return 'Aktiv';
      case 'completed': return 'Abgeschlossen';
      case 'cancelled': return 'Storniert';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  // Summary stats
  const activeContracts = contracts.filter(c => c.status === 'active').length;
  const totalValue = contracts.filter(c => c.status !== 'cancelled')
    .reduce((sum, c) => sum + c.total_amount, 0);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Lade Mietverträge...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Mietverträge</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={[styles.statsContainer, { backgroundColor: colors.card }]}>
        <View style={styles.statItem}>
          <Ionicons name="document-text" size={24} color="#FF9500" />
          <Text style={[styles.statNumber, { color: colors.text }]}>{contracts.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Verträge</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="checkmark-circle" size={24} color="#34C759" />
          <Text style={[styles.statNumber, { color: colors.text }]}>{activeContracts}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Aktiv</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="cash" size={24} color={colors.primary} />
          <Text style={[styles.statNumber, { color: colors.text }]}>{formatCurrency(totalValue)}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Gesamtwert</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
        }
      >
        {contracts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Keine Mietverträge</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Erstellen Sie einen Mietvertrag für ein Event
            </Text>
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: colors.primary }]}
              onPress={() => setModalVisible(true)}
            >
              <Ionicons name="add" size={20} color="white" />
              <Text style={styles.emptyButtonText}>Neuer Mietvertrag</Text>
            </TouchableOpacity>
          </View>
        ) : (
          contracts.map(contract => (
            <View key={contract.id} style={[styles.contractCard, { backgroundColor: colors.card }]}>
              <View style={styles.contractHeader}>
                <View style={styles.contractInfo}>
                  <Text style={[styles.contractNumber, { color: colors.primary }]}>
                    {contract.contract_number}
                  </Text>
                  <Text style={[styles.eventName, { color: colors.text }]}>
                    {eventsMap[contract.event_id]?.event_name || 'Event nicht gefunden'}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(contract.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(contract.status) }]}>
                    {getStatusText(contract.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.contractDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {formatDate(contract.start_date)} - {formatDate(contract.end_date)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="cube-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {contract.items?.length || 0} Positionen
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="cash-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.detailText, { color: colors.text, fontWeight: '600' }]}>
                    {formatCurrency(contract.total_amount)}
                  </Text>
                </View>
                {contract.deposit_amount > 0 && (
                  <View style={styles.detailRow}>
                    <Ionicons name="shield-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                      Kaution: {formatCurrency(contract.deposit_amount)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.contractActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#FF950020' }]}
                  onPress={() => generateContractPDF(contract)}
                >
                  <Ionicons name="document-outline" size={18} color="#FF9500" />
                  <Text style={[styles.actionBtnText, { color: '#FF9500' }]}>PDF</Text>
                </TouchableOpacity>

                {contract.status === 'draft' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#007AFF20' }]}
                    onPress={() => handleSignContract(contract)}
                  >
                    <Ionicons name="create-outline" size={18} color="#007AFF" />
                    <Text style={[styles.actionBtnText, { color: '#007AFF' }]}>Unterschreiben</Text>
                  </TouchableOpacity>
                )}

                {contract.status === 'signed' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#34C75920' }]}
                    onPress={() => updateContractStatus(contract.id, 'active')}
                  >
                    <Ionicons name="checkmark-outline" size={18} color="#34C759" />
                    <Text style={[styles.actionBtnText, { color: '#34C759' }]}>Aktivieren</Text>
                  </TouchableOpacity>
                )}

                {contract.status === 'active' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#8E8E9320' }]}
                    onPress={() => updateContractStatus(contract.id, 'completed')}
                  >
                    <Ionicons name="checkmark-done-outline" size={18} color="#8E8E93" />
                    <Text style={[styles.actionBtnText, { color: '#8E8E93' }]}>Abschließen</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Name input before signature */}
      <Modal
        visible={nameModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setNameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, maxHeight: 260 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Unterzeichner</Text>
              <TouchableOpacity onPress={() => setNameModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20 }}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Name des Unterzeichners</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={signedByName}
                onChangeText={setSignedByName}
                placeholder="Vor- und Nachname"
                placeholderTextColor={colors.textSecondary}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.submitButton, { marginTop: 16, marginBottom: 0 }]}
                onPress={() => { setNameModalVisible(false); setSignPadVisible(true); }}
              >
                <Ionicons name="create-outline" size={18} color="white" />
                <Text style={styles.submitButtonText}>Weiter zur Unterschrift</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Signature Pad */}
      <SignaturePad
        visible={signPadVisible}
        title={signingContract ? `Vertrag ${signingContract.contract_number}` : 'Unterschrift'}
        description="Bitte unterschreiben Sie zur Bestätigung des Mietvertrags"
        onSave={saveSignature}
        onClose={() => setSignPadVisible(false)}
      />

      {/* Create Contract Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Neuer Mietvertrag</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Event auswählen *</Text>
              <View style={[styles.pickerContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Picker
                  selectedValue={selectedEventId}
                  onValueChange={setSelectedEventId}
                  style={{ color: colors.text }}
                >
                  <Picker.Item label="Event wählen..." value="" />
                  {events.map(event => (
                    <Picker.Item
                      key={event.id}
                      label={`${event.event_name} (${event.event_number})`}
                      value={event.id}
                    />
                  ))}
                </Picker>
              </View>

              <Text style={[styles.inputLabel, { color: colors.text }]}>Kaution (€)</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={depositAmount}
                onChangeText={setDepositAmount}
                placeholder="z.B. 500.00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />

              <Text style={[styles.inputLabel, { color: colors.text }]}>Notizen</Text>
              <TextInput
                style={[styles.textInput, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Besondere Bedingungen..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />

              <View style={[styles.infoBox, { backgroundColor: '#fff3cd' }]}>
                <Ionicons name="information-circle" size={20} color="#856404" />
                <Text style={styles.infoText}>
                  Der Mietvertrag wird automatisch aus den Event-Buchungen generiert. 
                  Die gestaffelten Preise (Tages-/Wochen-/Monatspreis) werden basierend 
                  auf der Mietdauer angewendet.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, submitting && { opacity: 0.6 }]}
                onPress={handleCreateContract}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="white" />
                    <Text style={styles.submitButtonText}>Mietvertrag erstellen</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#ddd',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
    gap: 8,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  contractCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  contractHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  contractInfo: {
    flex: 1,
  },
  contractNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  eventName: {
    fontSize: 14,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  contractDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
  },
  contractActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  infoBox: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#856404',
    lineHeight: 18,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9500',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 24,
    marginBottom: 20,
    gap: 8,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
