import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../contexts/ThemeContext';
import apiService from '../../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Event {
  id: string;
  event_number: string;
  event_name: string;
  event_type: string;
  location: string;
  location_type?: string;
  start_date: string;
  end_date: string;
  status: string;
  customer_id: string;
  description?: string;
  notes?: string;
}

interface BookingSummary {
  bookings: Array<{
    booking_id: string;
    article_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    status: string;
  }>;
  total_items: number;
  total_value: number;
}

interface SubRentalRecord {
  id: string;
  article_name: string;
  supplier_name: string;
  cost: number;
  quantity: number;
  status: string;
  billable_to_customer: boolean;
  overdue: boolean;
  rental_end?: string;
}

interface EventRequirements {
  weight: {
    total_kg: number;
    recommendations: string;
  };
  power: {
    total_230v_watt: number;
    total_400v_watt: number;
    total_watt: number;
    ampere_230v: number;
    ampere_400v: number;
    schuko_16a_needed: number;
    cee_32a_needed: number;
  };
  rental: {
    daily_cost: number;
    total_cost: number;
    duration_days: number;
  };
  articles: Array<{
    article_name: string;
    quantity: number;
    weight_kg?: number;
    power_watt?: number;
    is_sub_rental: boolean;
  }>;
  total_bookings: number;
}

export default function EventDetailPage() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<Event | null>(null);
  const [bookings, setBookings] = useState<BookingSummary | null>(null);
  const [requirements, setRequirements] = useState<EventRequirements | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [subRentals, setSubRentals] = useState<SubRentalRecord[]>([]);

  const loadEventDetails = useCallback(async () => {
    try {
      const eventData = await apiService.get<Event>(`/api/events/${id}`, { showErrorAlert: false });
      setEvent(eventData);
      
      // Load customer name
      try {
        const customer = await apiService.get<{ company_name: string }>(`/api/customers/${eventData.customer_id}`, { showErrorAlert: false });
        setCustomerName(customer.company_name);
      } catch (e) {
        setCustomerName('Unbekannt');
      }
    } catch (error) {
      console.error('Error loading event:', error);
      Alert.alert('Fehler', 'Event konnte nicht geladen werden');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadBookings = useCallback(async () => {
    try {
      const data = await apiService.get<BookingSummary>(`/api/events/${id}/bookings-summary`, { showErrorAlert: false });
      setBookings(data);
    } catch (error) {
      console.error('Error loading bookings:', error);
    }
  }, [id]);

  const loadRequirements = useCallback(async () => {
    try {
      const data = await apiService.get<EventRequirements>(`/api/events/${id}/requirements`, { showErrorAlert: false });
      setRequirements(data);
    } catch (error) {
      console.error('Error loading requirements:', error);
    }
  }, [id]);

  const loadSubRentals = useCallback(async () => {
    try {
      const data = await apiService.get<{ sub_rental_records: SubRentalRecord[] }>(
        `/api/sub-rentals?event_id=${id}`, { showErrorAlert: false }
      );
      setSubRentals(data.sub_rental_records || []);
    } catch (error) {
      console.error('Error loading sub-rentals:', error);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadEventDetails();
      loadBookings();
      loadRequirements();
      loadSubRentals();
    }
  }, [id, loadEventDetails, loadBookings, loadRequirements, loadSubRentals]);

  const createInvoice = async () => {
    if (!bookings || bookings.bookings.length === 0) {
      Alert.alert('Fehler', 'Keine Buchungen vorhanden. Bitte buchen Sie zuerst Artikel.');
      return;
    }

    Alert.alert(
      'Rechnung erstellen',
      `Möchten Sie eine Rechnung für ${bookings.bookings.length} Positionen erstellen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Erstellen',
          onPress: async () => {
            try {
              const invoice = await apiService.post('/api/invoices', {
                event_id: id,
                due_days: 14,
              }) as { invoice_number: string };
              Alert.alert('Erfolg', `Rechnung ${invoice.invoice_number} wurde erstellt`);
            } catch (error) {
              Alert.alert('Fehler', 'Rechnung konnte nicht erstellt werden');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed': return '#34C759';
      case 'planned': return '#007AFF';
      case 'in_progress': return '#FF9500';
      case 'completed': return '#666';
      case 'cancelled': return '#FF3B30';
      default: return '#666';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Event nicht gefunden</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Zurück</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{event.event_number}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {/* Event Info */}
        <View style={styles.section}>
          <Text style={styles.eventName}>{event.event_name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(event.status) }]}>
            <Text style={styles.statusText}>{event.status.toUpperCase()}</Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.section}>
          <View style={styles.detailRow}>
            <Ionicons name="business" size={20} color="#666" />
            <Text style={styles.detailLabel}>Kunde:</Text>
            <Text style={styles.detailValue}>{customerName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="pricetag" size={20} color="#666" />
            <Text style={styles.detailLabel}>Typ:</Text>
            <Text style={styles.detailValue}>{event.event_type}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="location" size={20} color="#666" />
            <Text style={styles.detailLabel}>Ort:</Text>
            <Text style={styles.detailValue}>{event.location}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={20} color="#666" />
            <Text style={styles.detailLabel}>Von:</Text>
            <Text style={styles.detailValue}>{formatDate(event.start_date)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={20} color="#666" />
            <Text style={styles.detailLabel}>Bis:</Text>
            <Text style={styles.detailValue}>{formatDate(event.end_date)}</Text>
          </View>
        </View>

        {/* Bookings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Gebuchte Artikel</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => Alert.alert('Info', 'Artikel buchen - Frontend noch in Entwicklung')}
            >
              <Ionicons name="add" size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>

          {bookings && bookings.bookings.length > 0 ? (
            <>
              {bookings.bookings.map((booking, index) => (
                <View key={index} style={styles.bookingItem}>
                  <View style={styles.bookingInfo}>
                    <Text style={styles.bookingName}>{booking.article_name}</Text>
                    <Text style={styles.bookingDetails}>
                      {booking.quantity}x à €{booking.unit_price.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={styles.bookingTotal}>
                    €{booking.total_price.toFixed(2)}
                  </Text>
                </View>
              ))}
              
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Gesamtwert:</Text>
                <Text style={styles.totalValue}>€{bookings.total_value.toFixed(2)}</Text>
              </View>

              <TouchableOpacity
                style={styles.invoiceButton}
                onPress={createInvoice}
              >
                <Ionicons name="document-text" size={20} color="white" />
                <Text style={styles.invoiceButtonText}>Rechnung erstellen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.invoiceButton, { backgroundColor: '#34C759', marginTop: 10 }]}
                onPress={() => router.push(`/delivery/${id}`)}
              >
                <Ionicons name="pencil" size={20} color="white" />
                <Text style={styles.invoiceButtonText}>Lieferschein & Unterschrift</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.invoiceButton, { backgroundColor: '#5856D6', marginTop: 10 }]}
                onPress={() => router.push(`/events/detail/${id}/logistics`)}
              >
                <Ionicons name="bus" size={20} color="white" />
                <Text style={styles.invoiceButtonText}>Logistik & LKW-Planung</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.emptyBookings}>
              <Ionicons name="cube-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>Noch keine Artikel gebucht</Text>
              <Text style={styles.emptySubtext}>Fügen Sie Artikel zur Veranstaltung hinzu</Text>
            </View>
          )}
        </View>

        {/* Requirements Section - Gewicht & Strom */}
        {requirements && requirements.total_bookings > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 16 }]}>
              📊 Event-Anforderungen
            </Text>

            {/* Weight */}
            <View style={[styles.requirementCard, { backgroundColor: '#d4edda' }]}>
              <View style={styles.requirementHeader}>
                <Ionicons name="scale" size={24} color="#155724" />
                <Text style={styles.requirementTitle}>⚖️ Gewicht</Text>
              </View>
              <View style={styles.requirementRow}>
                <Text style={styles.requirementLabel}>Gesamtgewicht:</Text>
                <Text style={styles.requirementValue}>{requirements.weight.total_kg} kg</Text>
              </View>
              <View style={styles.requirementRow}>
                <Text style={styles.requirementLabel}>Empfehlung:</Text>
                <Text style={[styles.requirementValue, { fontWeight: 'bold' }]}>
                  🚗 {requirements.weight.recommendations}
                </Text>
              </View>
            </View>

            {/* Power */}
            <View style={[styles.requirementCard, { backgroundColor: '#fff3cd' }]}>
              <View style={styles.requirementHeader}>
                <Ionicons name="flash" size={24} color="#856404" />
                <Text style={styles.requirementTitle}>⚡ Strombedarf</Text>
              </View>
              <View style={styles.requirementRow}>
                <Text style={styles.requirementLabel}>Gesamt:</Text>
                <Text style={styles.requirementValue}>{requirements.power.total_watt} W</Text>
              </View>
              {requirements.power.total_230v_watt > 0 && (
                <View style={styles.requirementRow}>
                  <Text style={styles.requirementLabel}>230V:</Text>
                  <Text style={styles.requirementValue}>
                    {requirements.power.total_230v_watt} W ({requirements.power.ampere_230v} A)
                  </Text>
                </View>
              )}
              {requirements.power.total_400v_watt > 0 && (
                <View style={styles.requirementRow}>
                  <Text style={styles.requirementLabel}>400V:</Text>
                  <Text style={styles.requirementValue}>
                    {requirements.power.total_400v_watt} W ({requirements.power.ampere_400v} A)
                  </Text>
                </View>
              )}
              {requirements.power.schuko_16a_needed > 0 && (
                <View style={styles.requirementRow}>
                  <Text style={styles.requirementLabel}>Schuko 16A:</Text>
                  <Text style={styles.requirementValue}>{requirements.power.schuko_16a_needed}x benötigt</Text>
                </View>
              )}
              {requirements.power.cee_32a_needed > 0 && (
                <View style={styles.requirementRow}>
                  <Text style={styles.requirementLabel}>CEE 32A:</Text>
                  <Text style={styles.requirementValue}>{requirements.power.cee_32a_needed}x benötigt</Text>
                </View>
              )}
            </View>

            {/* Rental Cost */}
            <View style={[styles.requirementCard, { backgroundColor: '#cce5ff' }]}>
              <View style={styles.requirementHeader}>
                <Ionicons name="cash" size={24} color="#004085" />
                <Text style={styles.requirementTitle}>💶 Mietkosten</Text>
              </View>
              <View style={styles.requirementRow}>
                <Text style={styles.requirementLabel}>Tagessatz:</Text>
                <Text style={styles.requirementValue}>€{requirements.rental.daily_cost.toFixed(2)}</Text>
              </View>
              <View style={styles.requirementRow}>
                <Text style={styles.requirementLabel}>Dauer:</Text>
                <Text style={styles.requirementValue}>{requirements.rental.duration_days} Tage</Text>
              </View>
              <View style={[styles.requirementRow, { borderTopWidth: 1, borderTopColor: '#b8daff', paddingTop: 8 }]}>
                <Text style={[styles.requirementLabel, { fontWeight: 'bold' }]}>Gesamt:</Text>
                <Text style={[styles.requirementValue, { fontWeight: 'bold', fontSize: 18 }]}>
                  €{requirements.rental.total_cost.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Sub-Rentals Warning */}
            {requirements.articles.some(a => a.is_sub_rental) && (
              <View style={[styles.requirementCard, { backgroundColor: '#f8d7da' }]}>
                <View style={styles.requirementHeader}>
                  <Ionicons name="git-compare" size={20} color="#721c24" />
                  <Text style={[styles.requirementTitle, { color: '#721c24' }]}>Zumiet-Artikel</Text>
                </View>
                <Text style={{ color: '#721c24', fontSize: 12 }}>
                  ⚠️ Event enthält Zumiet-Artikel. Verfügbarkeit beim Lieferanten prüfen!
                </Text>
                {requirements.articles.filter(a => a.is_sub_rental).map((article, idx) => (
                  <Text key={idx} style={{ color: '#721c24', fontSize: 12, marginTop: 4 }}>
                    • {article.article_name} (x{article.quantity})
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Assigned Sub-Rentals */}
        {subRentals.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>🔄 Zugewiesene Fremdmieten</Text>
              <TouchableOpacity onPress={() => router.push('/sub-rentals')}>
                <Text style={{ color: colors.primary || '#007AFF', fontSize: 13 }}>Alle</Text>
              </TouchableOpacity>
            </View>
            {subRentals.map(rental => (
              <View key={rental.id} style={[styles.bookingItem, { borderLeftWidth: 3, borderLeftColor: rental.overdue ? '#FF3B30' : '#FF9500' }]}>
                <View style={styles.bookingInfo}>
                  <Text style={[styles.bookingName, { color: colors.text }]}>{rental.article_name}</Text>
                  <Text style={[styles.bookingDetails, { color: colors.textSecondary }]}>
                    von {rental.supplier_name} · {rental.quantity}x
                    {rental.billable_to_customer ? ' · abrechenbar' : ''}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                    €{(rental.cost * rental.quantity).toFixed(2)}
                  </Text>
                  <Text style={{ fontSize: 11, color: rental.overdue ? '#FF3B30' : colors.textSecondary, textAlign: 'right' }}>
                    {rental.overdue ? 'ÜBERFÄLLIG' : rental.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: 'white',
    padding: 24,
    marginBottom: 12,
  },
  eventName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    width: 60,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  bookingInfo: {
    flex: 1,
  },
  bookingName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  bookingDetails: {
    fontSize: 13,
    color: '#666',
  },
  bookingTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#e9ecef',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
  },
  invoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  invoiceButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyBookings: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 4,
  },
  // Requirements styles
  requirementCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  requirementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  requirementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  requirementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  requirementLabel: {
    fontSize: 14,
    color: '#555',
  },
  requirementValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
});
