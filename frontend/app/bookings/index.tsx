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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Booking {
  id: string;
  event_id: string;
  article_id: string;
  quantity: number;
  status: string;
  pickup_date: string;
  return_date: string;
  actual_return_date?: string;
  notes?: string;
}

export default function BookingsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [events, setEvents] = useState<any>({});
  const [articles, setArticles] = useState<any>({});

  useEffect(() => {
    loadBookings();
  }, []);

  // P2-T5: Auto-refresh when bookings change via WebSocket
  useWebSocket((msg) => {
    if (msg.type === 'booking_created' || msg.type === 'booking_cancelled') {
      loadBookings();
    }
  });

  const loadBookings = async () => {
    try {
      const [bookingsData, eventsData, articlesData] = await Promise.all([
        apiService.get<Booking[]>('/api/bookings', { showErrorAlert: false }),
        apiService.get<any[]>('/api/events', { showErrorAlert: false }),
        apiService.get<any[]>('/api/articles', { showErrorAlert: false }),
      ]);

      setBookings(bookingsData || []);
      
      const eventsMap: any = {};
      (eventsData || []).forEach((e: any) => eventsMap[e.id] = e);
      setEvents(eventsMap);

      const articlesMap: any = {};
      (articlesData || []).forEach((a: any) => articlesMap[a.id] = a);
      setArticles(articlesMap);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async (bookingId: string) => {
    Alert.alert(
      'Rückgabe bestätigen',
      'Wurden die Artikel vollständig zurückgegeben?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Rückgabe bestätigen',
          onPress: async () => {
            try {
              await apiService.put(`/api/bookings/${bookingId}/return`, {});
              Alert.alert('✅ Erfolg', 'Rückgabe erfolgreich erfasst', [
                { text: 'OK', onPress: () => loadBookings() }
              ]);
            } catch (error) {
              Alert.alert('Fehler', 'Rückgabe fehlgeschlagen');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return colors.primary;
      case 'picked_up': return '#FF9500';
      case 'returned': return '#34C759';
      case 'cancelled': return '#FF3B30';
      default: return colors.textSecondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Bestätigt';
      case 'picked_up': return 'Abgeholt';
      case 'returned': return 'Zurückgegeben';
      case 'cancelled': return 'Storniert';
      default: return status;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Lade Buchungen...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Buchungen ({bookings.length})</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {bookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Keine Buchungen</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Es gibt noch keine Buchungen</Text>
          </View>
        ) : (
          bookings.map((booking) => {
            const event = events[booking.event_id];
            const article = articles[booking.article_id];
            
            return (
              <View key={booking.id} style={[styles.bookingCard, { backgroundColor: colors.card }]}>
                <View style={styles.bookingHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
                    <Text style={styles.statusText}>{getStatusText(booking.status)}</Text>
                  </View>
                  <Text style={[styles.bookingQuantity, { color: colors.text }]}>{booking.quantity}x</Text>
                </View>

                <Text style={[styles.eventName, { color: colors.text }]}>
                  {event ? event.event_name : 'Event wird geladen...'}
                </Text>
                <Text style={[styles.eventNumber, { color: colors.primary }]}>
                  {event ? event.event_number : ''}
                </Text>

                <View style={styles.articleRow}>
                  <Ionicons name="cube-outline" size={16} color={colors.primary} />
                  <Text style={[styles.articleName, { color: colors.textSecondary }]}>
                    {article ? article.name : 'Artikel wird geladen...'}
                  </Text>
                </View>

                <View style={styles.datesRow}>
                  <View style={styles.dateItem}>
                    <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Abholung:</Text>
                    <Text style={[styles.dateValue, { color: colors.text }]}>
                      {new Date(booking.pickup_date).toLocaleDateString('de-DE')}
                    </Text>
                  </View>
                  <View style={styles.dateItem}>
                    <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Rückgabe:</Text>
                    <Text style={[styles.dateValue, { color: colors.text }]}>
                      {new Date(booking.return_date).toLocaleDateString('de-DE')}
                    </Text>
                  </View>
                </View>

                {booking.actual_return_date && (
                  <Text style={styles.actualReturn}>
                    ✅ Zurückgegeben: {new Date(booking.actual_return_date).toLocaleDateString('de-DE')}
                  </Text>
                )}

                {/* Mietfaktoren-Rechner */}
                {booking.pickup_date && booking.return_date && (() => {
                  const days = Math.max(1, Math.ceil(
                    (new Date(booking.return_date).getTime() - new Date(booking.pickup_date).getTime()) / (1000 * 60 * 60 * 24)
                  ));
                  const art = articles[booking.article_id];
                  if (!art) return null;
                  const basePrice = art.rental_price_day || art.rental_price || 0;
                  const weekPrice = art.rental_price_week || (basePrice * 5);
                  let price = 0, tier = '', discount = 0;
                  if (days <= 3) {
                    price = basePrice * days * booking.quantity;
                    tier = `${days}T × ${basePrice.toFixed(2)}€`;
                  } else if (days <= 7) {
                    price = weekPrice * booking.quantity;
                    tier = `Woche × ${weekPrice.toFixed(2)}€`;
                    discount = Math.round((1 - weekPrice / (basePrice * days)) * 100);
                  } else {
                    const weeks = Math.ceil(days / 7);
                    price = weekPrice * weeks * booking.quantity;
                    tier = `${weeks} Wo. × ${weekPrice.toFixed(2)}€`;
                    discount = Math.round((1 - (weekPrice * weeks) / (basePrice * days)) * 100);
                  }
                  if (price <= 0) return null;
                  return (
                    <View style={[styles.priceBox, { backgroundColor: colors.background }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>⏱ {days} Tag{days !== 1 ? 'e' : ''} · {tier}</Text>
                        {discount > 0 && (
                          <Text style={{ fontSize: 11, color: '#34C759', fontWeight: '700' }}>-{discount}%</Text>
                        )}
                      </View>
                      <Text style={[styles.dateValue, { color: colors.primary, fontSize: 16 }]}>
                        {price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </Text>
                    </View>
                  );
                })()}

                {booking.notes && (
                  <Text style={[styles.notes, { color: colors.textSecondary }]}>📝 {booking.notes}</Text>
                )}

                {booking.status === 'confirmed' && (
                  <TouchableOpacity
                    style={styles.returnButton}
                    onPress={() => handleReturn(booking.id)}
                  >
                    <Text style={styles.returnButtonText}>Rückgabe erfassen</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
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
  content: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
  },
  bookingCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  bookingQuantity: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  eventName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventNumber: {
    fontSize: 12,
    marginBottom: 12,
  },
  articleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  articleName: {
    fontSize: 14,
  },
  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  actualReturn: {
    fontSize: 12,
    color: '#34C759',
    marginTop: 8,
  },
  notes: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  returnButton: {
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  returnButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  priceBox: {
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    gap: 4,
  },
});
