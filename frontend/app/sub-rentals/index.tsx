import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { Picker } from '@react-native-picker/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SubRentalArticle {
  id: string;
  name: string;
  inventory_code: string;
  supplier_id: string;
  supplier_name: string;
  sub_rental_cost: number;
  current_stock: number;
  status: string;
  weight_kg?: number;
  power_watt?: number;
}

interface SubRentalRecord {
  id: string;
  article_id: string;
  article_name: string;
  supplier_id: string;
  supplier_name: string;
  cost: number;
  quantity: number;
  rental_start?: string;
  rental_end?: string;
  status: string;
  event_id?: string;
  billable_to_customer: boolean;
  overdue: boolean;
  notes?: string;
  created_at: string;
}

interface Article {
  id: string;
  name: string;
  inventory_code: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface Event {
  id: string;
  event_name: string;
}

export default function SubRentalsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [subRentalArticles, setSubRentalArticles] = useState<SubRentalArticle[]>([]);
  const [subRentalRecords, setSubRentalRecords] = useState<SubRentalRecord[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'articles' | 'records'>('articles');

  // Form state
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [billableToCustomer, setBillableToCustomer] = useState(false);
  const [cost, setCost] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const subRentalsData = await apiService.get<{
        sub_rental_articles: SubRentalArticle[];
        sub_rental_records: SubRentalRecord[];
      }>('/api/sub-rentals', { showErrorAlert: false });

      setSubRentalArticles(subRentalsData.sub_rental_articles || []);
      setSubRentalRecords(subRentalsData.sub_rental_records || []);

      const [articlesData, suppliersData, eventsData] = await Promise.all([
        apiService.get<Article[]>('/api/articles', { showErrorAlert: false }),
        apiService.get<Supplier[]>('/api/suppliers', { showErrorAlert: false }),
        apiService.get<Event[]>('/api/events', { showErrorAlert: false }),
      ]);
      setArticles(articlesData || []);
      setSuppliers(suppliersData || []);
      setEvents(eventsData || []);
    } catch (error) {
      console.error('Error loading sub-rentals:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreateSubRental = async () => {
    if (!selectedArticleId || !selectedSupplierId || !cost) {
      Alert.alert('Fehler', 'Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    setSubmitting(true);
    try {
      await apiService.post('/api/sub-rentals', {
        article_id: selectedArticleId,
        supplier_id: selectedSupplierId,
        event_id: selectedEventId || undefined,
        billable_to_customer: billableToCustomer,
        cost: parseFloat(cost),
        quantity: parseInt(quantity),
        notes: notes || undefined,
      });

      Alert.alert('Erfolg', 'Zumietung erfolgreich erstellt');
      setModalVisible(false);
      resetForm();
      loadData();
    } catch (error) {
      Alert.alert('Fehler', 'Zumietung konnte nicht erstellt werden');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusAction = (rentalId: string, action: 'confirm' | 'deliver' | 'return' | 'cancel') => {
    const labels: Record<string, { title: string; message: string; btn: string }> = {
      confirm: { title: 'Bestätigen', message: 'Zumietung bestätigen?', btn: 'Bestätigen' },
      deliver: { title: 'Als geliefert markieren', message: 'Als geliefert markieren?', btn: 'Geliefert' },
      return: { title: 'Zurückgeben', message: 'Als zurückgegeben markieren?', btn: 'Zurückgeben' },
      cancel: { title: 'Stornieren', message: 'Zumietung stornieren?', btn: 'Stornieren' },
    };
    const { title, message, btn } = labels[action];

    Alert.alert(title, message, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: btn,
        style: action === 'cancel' ? 'destructive' : 'default',
        onPress: async () => {
          try {
            await apiService.put(`/api/sub-rentals/${rentalId}/${action}`, {});
            loadData();
          } catch {
            Alert.alert('Fehler', 'Aktion konnte nicht ausgeführt werden');
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setSelectedArticleId('');
    setSelectedSupplierId('');
    setSelectedEventId('');
    setBillableToCustomer(false);
    setCost('');
    setQuantity('1');
    setNotes('');
  };

  const getStatusColor = (status: string, overdue?: boolean) => {
    if (overdue) return '#FF3B30';
    switch (status?.toLowerCase()) {
      case 'requested': return '#FF9500';
      case 'confirmed': return '#007AFF';
      case 'delivered': return '#34C759';
      case 'returned': return '#666';
      case 'cancelled': return '#FF3B30';
      case 'ok': return '#34C759';
      case 'defekt': return '#FF3B30';
      case 'gesperrt': return '#FF9500';
      default: return '#888';
    }
  };

  const getStatusText = (status: string, overdue?: boolean) => {
    if (overdue) return 'ÜBERFÄLLIG';
    switch (status?.toLowerCase()) {
      case 'requested': return 'Angefragt';
      case 'confirmed': return 'Bestätigt';
      case 'delivered': return 'Geliefert';
      case 'returned': return 'Zurückgegeben';
      case 'cancelled': return 'Storniert';
      case 'ok': return 'OK';
      case 'defekt': return 'Defekt';
      case 'gesperrt': return 'Gesperrt';
      default: return status;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const activeRecords = subRentalRecords.filter(r => !['returned', 'cancelled'].includes(r.status));
  const totalCost = activeRecords.reduce((sum, r) => sum + r.cost * r.quantity, 0);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Lade Zumietungen...
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Zumietungen</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={[styles.statsContainer, { backgroundColor: colors.card }]}>
        <View style={styles.statItem}>
          <Ionicons name="cube-outline" size={24} color="#FF9500" />
          <Text style={[styles.statNumber, { color: colors.text }]}>{subRentalArticles.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Zumiet-Artikel</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="document-text-outline" size={24} color="#34C759" />
          <Text style={[styles.statNumber, { color: colors.text }]}>{activeRecords.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Aktive Mietungen</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="cash-outline" size={24} color={colors.primary} />
          <Text style={[styles.statNumber, { color: colors.text }]}>{formatCurrency(totalCost)}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Aktive Kosten</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'articles' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('articles')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'articles' ? colors.primary : colors.textSecondary }]}>
            Zumiet-Artikel ({subRentalArticles.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'records' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('records')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'records' ? colors.primary : colors.textSecondary }]}>
            Miet-Historie ({subRentalRecords.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
        }
      >
        {activeTab === 'articles' ? (
          <>
            {subRentalArticles.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="git-compare-outline" size={64} color={colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Keine Zumiet-Artikel</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Erstellen Sie eine neue Zumietung, um Artikel von Lieferanten zu mieten
                </Text>
                <TouchableOpacity
                  style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                  onPress={() => setModalVisible(true)}
                >
                  <Ionicons name="add" size={20} color="white" />
                  <Text style={styles.emptyButtonText}>Neue Zumietung</Text>
                </TouchableOpacity>
              </View>
            ) : (
              subRentalArticles.map(article => (
                <TouchableOpacity
                  key={article.id}
                  style={[styles.articleCard, { backgroundColor: colors.card }]}
                  onPress={() => router.push(`/articles/${article.id}`)}
                >
                  <View style={styles.articleHeader}>
                    <View style={styles.articleIcon}>
                      <Ionicons name="git-compare" size={24} color="#FF9500" />
                    </View>
                    <View style={styles.articleInfo}>
                      <Text style={[styles.articleName, { color: colors.text }]}>{article.name}</Text>
                      <Text style={[styles.articleCode, { color: colors.textSecondary }]}>
                        {article.inventory_code}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(article.status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(article.status) }]}>
                        {getStatusText(article.status)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.articleDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="business-outline" size={14} color={colors.textSecondary} />
                      <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                        {article.supplier_name}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="cash-outline" size={14} color={colors.textSecondary} />
                      <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                        {formatCurrency(article.sub_rental_cost)}/Tag
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="cube-outline" size={14} color={colors.textSecondary} />
                      <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                        Bestand: {article.current_stock}
                      </Text>
                    </View>
                  </View>

                  {(article.weight_kg || article.power_watt) && (
                    <View style={styles.specsRow}>
                      {article.weight_kg && (
                        <View style={[styles.specBadge, { backgroundColor: '#d4edda' }]}>
                          <Text style={styles.specText}>⚖️ {article.weight_kg}kg</Text>
                        </View>
                      )}
                      {article.power_watt && (
                        <View style={[styles.specBadge, { backgroundColor: '#fff3cd' }]}>
                          <Text style={styles.specText}>⚡ {article.power_watt}W</Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              ))
            )}
          </>
        ) : (
          <>
            {subRentalRecords.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={64} color={colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Keine Miet-Historie</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Hier erscheinen alle Zumietungs-Vorgänge
                </Text>
              </View>
            ) : (
              subRentalRecords.map(record => (
                <View key={record.id} style={[styles.recordCard, { backgroundColor: colors.card }]}>
                  <View style={styles.recordHeader}>
                    <View style={styles.recordInfo}>
                      <Text style={[styles.recordArticle, { color: colors.text }]}>{record.article_name}</Text>
                      <Text style={[styles.recordSupplier, { color: colors.textSecondary }]}>
                        von {record.supplier_name}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(record.status, record.overdue) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(record.status, record.overdue) }]}>
                        {getStatusText(record.status, record.overdue)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.recordDetails}>
                    <View style={styles.recordDetailRow}>
                      <Text style={[styles.recordLabel, { color: colors.textSecondary }]}>Menge:</Text>
                      <Text style={[styles.recordValue, { color: colors.text }]}>{record.quantity}x</Text>
                    </View>
                    <View style={styles.recordDetailRow}>
                      <Text style={[styles.recordLabel, { color: colors.textSecondary }]}>Kosten:</Text>
                      <Text style={[styles.recordValue, { color: colors.text }]}>
                        {formatCurrency(record.cost * record.quantity)}
                      </Text>
                    </View>
                    {record.rental_end && (
                      <View style={styles.recordDetailRow}>
                        <Text style={[styles.recordLabel, { color: colors.textSecondary }]}>Rückgabe:</Text>
                        <Text style={[styles.recordValue, { color: record.overdue ? '#FF3B30' : colors.text }]}>
                          {formatDate(record.rental_end)}
                        </Text>
                      </View>
                    )}
                    <View style={styles.recordDetailRow}>
                      <Text style={[styles.recordLabel, { color: colors.textSecondary }]}>Erstellt:</Text>
                      <Text style={[styles.recordValue, { color: colors.text }]}>
                        {formatDate(record.created_at)}
                      </Text>
                    </View>
                    {record.billable_to_customer && (
                      <View style={styles.recordDetailRow}>
                        <Text style={[styles.recordLabel, { color: colors.textSecondary }]}>Abrechenbar:</Text>
                        <Text style={[styles.recordValue, { color: '#34C759' }]}>Ja</Text>
                      </View>
                    )}
                  </View>

                  {record.notes && (
                    <Text style={[styles.recordNotes, { color: colors.textSecondary }]}>
                      📝 {record.notes}
                    </Text>
                  )}

                  {/* Status action buttons */}
                  <View style={styles.actionRow}>
                    {record.status === 'requested' && (
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#007AFF' }]}
                        onPress={() => handleStatusAction(record.id, 'confirm')}
                      >
                        <Ionicons name="checkmark-circle-outline" size={16} color="white" />
                        <Text style={styles.actionButtonText}>Bestätigen</Text>
                      </TouchableOpacity>
                    )}
                    {record.status === 'confirmed' && (
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#34C759' }]}
                        onPress={() => handleStatusAction(record.id, 'deliver')}
                      >
                        <Ionicons name="checkmark-done-outline" size={16} color="white" />
                        <Text style={styles.actionButtonText}>Als geliefert markieren</Text>
                      </TouchableOpacity>
                    )}
                    {record.status === 'delivered' && (
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.primary }]}
                        onPress={() => handleStatusAction(record.id, 'return')}
                      >
                        <Ionicons name="return-down-back" size={16} color="white" />
                        <Text style={styles.actionButtonText}>Zurückgeben</Text>
                      </TouchableOpacity>
                    )}
                    {!['returned', 'cancelled'].includes(record.status) && (
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#FF3B3020', borderWidth: 1, borderColor: '#FF3B30' }]}
                        onPress={() => handleStatusAction(record.id, 'cancel')}
                      >
                        <Ionicons name="close-circle-outline" size={16} color="#FF3B30" />
                        <Text style={[styles.actionButtonText, { color: '#FF3B30' }]}>Stornieren</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Create Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Neue Zumietung</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
              {/* Article Selection */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Artikel *</Text>
              <View style={[styles.pickerContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Picker
                  selectedValue={selectedArticleId}
                  onValueChange={setSelectedArticleId}
                  style={{ color: colors.text }}
                >
                  <Picker.Item label="Artikel wählen..." value="" />
                  {articles.map(article => (
                    <Picker.Item
                      key={article.id}
                      label={`${article.name} (${article.inventory_code})`}
                      value={article.id}
                    />
                  ))}
                </Picker>
              </View>

              {/* Supplier Selection */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Lieferant *</Text>
              <View style={[styles.pickerContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Picker
                  selectedValue={selectedSupplierId}
                  onValueChange={setSelectedSupplierId}
                  style={{ color: colors.text }}
                >
                  <Picker.Item label="Lieferant wählen..." value="" />
                  {suppliers.map(supplier => (
                    <Picker.Item
                      key={supplier.id}
                      label={supplier.name}
                      value={supplier.id}
                    />
                  ))}
                </Picker>
              </View>

              {/* Event Selection (optional) */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Event (optional)</Text>
              <View style={[styles.pickerContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Picker
                  selectedValue={selectedEventId}
                  onValueChange={setSelectedEventId}
                  style={{ color: colors.text }}
                >
                  <Picker.Item label="Kein Event" value="" />
                  {events.map(event => (
                    <Picker.Item
                      key={event.id}
                      label={event.event_name}
                      value={event.id}
                    />
                  ))}
                </Picker>
              </View>

              {/* Billable toggle */}
              <View style={styles.toggleRow}>
                <Text style={[styles.inputLabel, { color: colors.text, marginTop: 0, marginBottom: 0 }]}>
                  Dem Kunden berechnen
                </Text>
                <Switch
                  value={billableToCustomer}
                  onValueChange={setBillableToCustomer}
                  trackColor={{ false: '#ddd', true: colors.primary }}
                />
              </View>

              {/* Cost */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Mietkosten (€/Tag) *</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={cost}
                onChangeText={setCost}
                placeholder="z.B. 50.00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />

              {/* Quantity */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Menge</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={quantity}
                onChangeText={setQuantity}
                placeholder="1"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
              />

              {/* Notes */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Notizen</Text>
              <TextInput
                style={[styles.textInput, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Optionale Notizen..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[styles.submitButton, submitting && { opacity: 0.6 }]}
                onPress={handleCreateSubRental}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="white" />
                    <Text style={styles.submitButtonText}>Zumietung erstellen</Text>
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
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
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
  articleCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  articleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  articleIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FF950020',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  articleInfo: {
    flex: 1,
  },
  articleName: {
    fontSize: 16,
    fontWeight: '600',
  },
  articleCode: {
    fontSize: 12,
    marginTop: 2,
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
  articleDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
  },
  specsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  specBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  specText: {
    fontSize: 12,
    fontWeight: '500',
  },
  recordCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  recordInfo: {
    flex: 1,
  },
  recordArticle: {
    fontSize: 16,
    fontWeight: '600',
  },
  recordSupplier: {
    fontSize: 13,
    marginTop: 2,
  },
  recordDetails: {
    marginTop: 12,
    gap: 6,
  },
  recordDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recordLabel: {
    fontSize: 13,
  },
  recordValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  recordNotes: {
    fontSize: 12,
    marginTop: 12,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  // Modal styles
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
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
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
