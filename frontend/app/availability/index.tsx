import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CalendarDay {
  date: string;
  bookings_count: number;
  total_quantity: number;
  events: Array<{
    event_id: string;
    event_name: string;
    event_number: string;
    status: string;
  }>;
  articles: Array<{
    article_id: string;
    article_name: string;
    quantity: number;
  }>;
}

interface MarkedDates {
  [date: string]: {
    marked?: boolean;
    dotColor?: string;
    selected?: boolean;
    selectedColor?: string;
    customStyles?: {
      container?: object;
      text?: object;
    };
  };
}

export default function AvailabilityCalendarPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedDayData, setSelectedDayData] = useState<CalendarDay | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [refreshing, setRefreshing] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const loadCalendarData = useCallback(async (month: number, year: number) => {
    try {
      const data = await apiService.get<{ days: CalendarDay[] }>(
        `/api/availability/calendar?month=${month}&year=${year}`,
        { showErrorAlert: false }
      );
      
      setCalendarData(data.days || []);
      processCalendarData(data.days || []);
    } catch (error) {
      console.error('Error loading calendar:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCalendarData(currentMonth, currentYear);
  }, [currentMonth, currentYear, loadCalendarData]);

  const processCalendarData = (days: CalendarDay[]) => {
    const marked: MarkedDates = {};

    days.forEach(day => {
      if (day.bookings_count > 0 || day.events.length > 0) {
        let dotColor = colors.primary;
        
        if (day.bookings_count > 5) {
          dotColor = '#FF3B30'; // Red for heavy booking
        } else if (day.bookings_count > 2) {
          dotColor = '#FF9500'; // Orange for medium booking
        } else if (day.events.length > 0) {
          dotColor = '#34C759'; // Green for events
        }

        marked[day.date] = {
          marked: true,
          dotColor: dotColor,
        };
      }
    });

    setMarkedDates(marked);
  };

  const onDayPress = (day: any) => {
    const dateString = day.dateString;
    setSelectedDate(dateString);
    
    const dayData = calendarData.find(d => d.date === dateString);
    setSelectedDayData(dayData || null);
    
    if (dayData && (dayData.bookings_count > 0 || dayData.events.length > 0)) {
      setDetailModalVisible(true);
    }

    // Update selection styling
    const updatedMarked = { ...markedDates };
    Object.keys(updatedMarked).forEach(date => {
      if (updatedMarked[date].selected) {
        delete updatedMarked[date].selected;
        delete updatedMarked[date].selectedColor;
      }
    });
    
    updatedMarked[dateString] = {
      ...updatedMarked[dateString],
      selected: true,
      selectedColor: isDark ? '#1a3a5c' : '#e3f2fd',
    };
    
    setMarkedDates(updatedMarked);
  };

  const onMonthChange = (month: any) => {
    setCurrentMonth(month.month);
    setCurrentYear(month.year);
    setLoading(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed': return '#34C759';
      case 'planned': return colors.primary;
      case 'in_progress': return '#FF9500';
      case 'completed': return '#666';
      case 'cancelled': return '#FF3B30';
      default: return colors.primary;
    }
  };

  // Calculate monthly summary
  const monthlySummary = {
    totalBookings: calendarData.reduce((sum, d) => sum + d.bookings_count, 0),
    totalQuantity: calendarData.reduce((sum, d) => sum + d.total_quantity, 0),
    totalEvents: new Set(calendarData.flatMap(d => d.events.map(e => e.event_id))).size,
    busyDays: calendarData.filter(d => d.bookings_count > 0).length,
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Lade Verfügbarkeitskalender...
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Verfügbarkeitskalender</Text>
        <TouchableOpacity onPress={() => router.push('/articles/availability')}>
          <Ionicons name="list" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadCalendarData(currentMonth, currentYear);
            }}
          />
        }
      >
        {/* Calendar */}
        <View style={[styles.calendarContainer, { backgroundColor: colors.card }]}>
          <Calendar
            markedDates={markedDates}
            onDayPress={onDayPress}
            onMonthChange={onMonthChange}
            theme={{
              backgroundColor: colors.card,
              calendarBackground: colors.card,
              textSectionTitleColor: colors.textSecondary,
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: '#ffffff',
              todayTextColor: colors.primary,
              dayTextColor: colors.text,
              textDisabledColor: colors.textSecondary,
              dotColor: colors.primary,
              selectedDotColor: '#ffffff',
              arrowColor: colors.primary,
              monthTextColor: colors.text,
              textDayFontWeight: '400',
              textMonthFontWeight: 'bold',
              textDayHeaderFontWeight: '600',
              textDayFontSize: 16,
              textMonthFontSize: 18,
              textDayHeaderFontSize: 14,
            }}
            monthFormat={'MMMM yyyy'}
            firstDay={1}
            enableSwipeMonths={true}
          />
        </View>

        {/* Legend */}
        <View style={[styles.legendContainer, { backgroundColor: colors.card }]}>
          <Text style={[styles.legendTitle, { color: colors.textSecondary }]}>Legende:</Text>
          <View style={styles.legendItems}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Events</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>1-2 Buchungen</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FF9500' }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>3-5 Buchungen</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FF3B30' }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>6+ Buchungen</Text>
            </View>
          </View>
        </View>

        {/* Monthly Summary */}
        <View style={[styles.summaryContainer, { backgroundColor: colors.card }]}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>
            Monatsübersicht
          </Text>
          <View style={styles.summaryStats}>
            <View style={[styles.statCard, { backgroundColor: colors.background }]}>
              <Ionicons name="calendar" size={24} color="#34C759" />
              <Text style={[styles.statNumber, { color: colors.primary }]}>
                {monthlySummary.totalEvents}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Events</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.background }]}>
              <Ionicons name="bookmark" size={24} color="#FF9500" />
              <Text style={[styles.statNumber, { color: colors.primary }]}>
                {monthlySummary.totalBookings}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Buchungen</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.background }]}>
              <Ionicons name="cube" size={24} color={colors.primary} />
              <Text style={[styles.statNumber, { color: colors.primary }]}>
                {monthlySummary.totalQuantity}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Artikel</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.background }]}>
              <Ionicons name="today" size={24} color="#FF3B30" />
              <Text style={[styles.statNumber, { color: colors.primary }]}>
                {monthlySummary.busyDays}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Aktive Tage</Text>
            </View>
          </View>
        </View>

        {/* Quick Links */}
        <View style={[styles.quickLinksContainer, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Schnellzugriff</Text>
          <View style={styles.quickLinks}>
            <TouchableOpacity
              style={[styles.quickLinkBtn, { backgroundColor: colors.background }]}
              onPress={() => router.push('/sub-rentals')}
            >
              <Ionicons name="git-compare" size={24} color="#FF9500" />
              <Text style={[styles.quickLinkText, { color: colors.text }]}>Zumietungen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickLinkBtn, { backgroundColor: colors.background }]}
              onPress={() => router.push('/events')}
            >
              <Ionicons name="calendar-outline" size={24} color="#34C759" />
              <Text style={[styles.quickLinkText, { color: colors.text }]}>Events</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickLinkBtn, { backgroundColor: colors.background }]}
              onPress={() => router.push('/bookings')}
            >
              <Ionicons name="bookmark-outline" size={24} color={colors.primary} />
              <Text style={[styles.quickLinkText, { color: colors.text }]}>Buchungen</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {selectedDate ? formatDate(selectedDate) : ''}
              </Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
              {selectedDayData?.events && selectedDayData.events.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={[styles.modalSectionTitle, { color: colors.text }]}>
                    <Ionicons name="calendar" size={16} /> Events ({selectedDayData.events.length})
                  </Text>
                  {selectedDayData.events.map((event, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.eventItem, { backgroundColor: colors.background }]}
                      onPress={() => {
                        setDetailModalVisible(false);
                        router.push(`/events/detail/${event.event_id}`);
                      }}
                    >
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(event.status) }]} />
                      <View style={styles.eventInfo}>
                        <Text style={[styles.eventName, { color: colors.text }]}>{event.event_name}</Text>
                        <Text style={[styles.eventNumber, { color: colors.textSecondary }]}>
                          {event.event_number}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {selectedDayData?.articles && selectedDayData.articles.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={[styles.modalSectionTitle, { color: colors.text }]}>
                    <Ionicons name="cube" size={16} /> Gebuchte Artikel ({selectedDayData.articles.length})
                  </Text>
                  {selectedDayData.articles.map((article, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.articleItem, { backgroundColor: colors.background }]}
                      onPress={() => {
                        setDetailModalVisible(false);
                        router.push(`/articles/${article.article_id}`);
                      }}
                    >
                      <View style={styles.articleInfo}>
                        <Text style={[styles.articleName, { color: colors.text }]}>
                          {article.article_name}
                        </Text>
                      </View>
                      <View style={styles.quantityBadge}>
                        <Text style={styles.quantityText}>x{article.quantity}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {(!selectedDayData?.events?.length && !selectedDayData?.articles?.length) && (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={48} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Keine Buchungen an diesem Tag
                  </Text>
                </View>
              )}
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
  content: {
    flex: 1,
  },
  calendarContainer: {
    marginBottom: 12,
    paddingVertical: 16,
  },
  legendContainer: {
    padding: 16,
    marginBottom: 12,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
  },
  summaryContainer: {
    padding: 16,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  quickLinksContainer: {
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  quickLinks: {
    flexDirection: 'row',
    gap: 12,
  },
  quickLinkBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  quickLinkText: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
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
    maxHeight: '70%',
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
    padding: 16,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    fontSize: 14,
    fontWeight: '600',
  },
  eventNumber: {
    fontSize: 12,
    marginTop: 2,
  },
  articleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  articleInfo: {
    flex: 1,
  },
  articleName: {
    fontSize: 14,
    fontWeight: '500',
  },
  quantityBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  quantityText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
});
