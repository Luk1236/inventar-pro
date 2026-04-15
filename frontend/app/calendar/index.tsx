import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Event {
  id: string;
  event_number: string;
  event_name: string;
  event_type: string;
  location: string;
  start_date: string;
  end_date: string;
  status: string;
  customer_id: string;
}

interface MarkedDates {
  [date: string]: {
    marked?: boolean;
    dotColor?: string;
    selected?: boolean;
    selectedColor?: string;
    events?: Event[];
  };
}

export default function CalendarPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<Event[]>([]);

  const loadEvents = useCallback(async () => {
    try {
      const data = await apiService.get<Event[]>('/api/events', { showErrorAlert: false });
      setEvents(data || []);
      processEventsForCalendar(data || []);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const processEventsForCalendar = (eventsData: Event[]) => {
    const marked: MarkedDates = {};

    eventsData.forEach(event => {
      const startDate = new Date(event.start_date);
      const endDate = new Date(event.end_date);

      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateString = currentDate.toISOString().split('T')[0];
        
        if (!marked[dateString]) {
          marked[dateString] = {
            marked: true,
            dotColor: getStatusColor(event.status),
            events: [],
          };
        }
        
        marked[dateString].events?.push(event);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    setMarkedDates(marked);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed': return '#34C759';
      case 'planned': return colors.primary;
      case 'in_progress': return '#FF9500';
      case 'completed': return '#666';
      case 'cancelled': return '#FF3B30';
      default: return colors.primary;
    }
  };

  const onDayPress = (day: any) => {
    const dateString = day.dateString;
    setSelectedDate(dateString);
    
    const eventsForDate = markedDates[dateString]?.events || [];
    setSelectedEvents(eventsForDate);

    const updatedMarked = { ...markedDates };
    Object.keys(updatedMarked).forEach(date => {
      if (updatedMarked[date].selected) {
        delete updatedMarked[date].selected;
        delete updatedMarked[date].selectedColor;
      }
    });
    
    if (updatedMarked[dateString]) {
      updatedMarked[dateString].selected = true;
      updatedMarked[dateString].selectedColor = isDark ? '#1a3a5c' : '#e3f2fd';
    }
    
    setMarkedDates(updatedMarked);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const renderEventCard = (event: Event) => (
    <TouchableOpacity
      key={event.id}
      style={[styles.eventCard, { backgroundColor: colors.background }]}
      onPress={() => router.push(`/events/detail/${event.id}`)}
    >
      <View style={styles.eventCardHeader}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(event.status) }]} />
        <View style={styles.eventCardInfo}>
          <Text style={[styles.eventCardTitle, { color: colors.text }]}>{event.event_name}</Text>
          <Text style={[styles.eventCardNumber, { color: colors.primary }]}>{event.event_number}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </View>
      <View style={styles.eventCardDetails}>
        <View style={styles.eventCardDetail}>
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.eventCardDetailText, { color: colors.textSecondary }]}>{event.location}</Text>
        </View>
        <View style={styles.eventCardDetail}>
          <Ionicons name="pricetag-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.eventCardDetailText, { color: colors.textSecondary }]}>{event.event_type}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Lade Kalender...</Text>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Veranstaltungskalender</Text>
        <TouchableOpacity onPress={() => router.push('/events/create')}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        <View style={[styles.calendarContainer, { backgroundColor: colors.card }]}>
          <Calendar
            markedDates={markedDates}
            onDayPress={onDayPress}
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

        <View style={[styles.legendContainer, { backgroundColor: colors.card }]}>
          <Text style={[styles.legendTitle, { color: colors.textSecondary }]}>Legende:</Text>
          <View style={styles.legendItems}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Geplant</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Bestätigt</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FF9500' }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Laufend</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#666' }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Abgeschlossen</Text>
            </View>
          </View>
        </View>

        {selectedDate && (
          <View style={[styles.selectedDateContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.selectedDateTitle, { color: colors.text }]}>
              {formatDate(selectedDate)}
            </Text>
            {selectedEvents.length > 0 ? (
              <View style={styles.eventsContainer}>
                <Text style={[styles.eventsCount, { color: colors.textSecondary }]}>
                  {selectedEvents.length} Veranstaltung{selectedEvents.length !== 1 ? 'en' : ''}
                </Text>
                {selectedEvents.map(renderEventCard)}
              </View>
            ) : (
              <View style={styles.noEventsContainer}>
                <Ionicons name="calendar-outline" size={48} color={colors.textSecondary} />
                <Text style={[styles.noEventsText, { color: colors.textSecondary }]}>Keine Veranstaltungen an diesem Tag</Text>
              </View>
            )}
          </View>
        )}

        {!selectedDate && (
          <View style={[styles.summaryContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>Übersicht</Text>
            <View style={styles.summaryStats}>
              <View style={[styles.statCard, { backgroundColor: colors.background }]}>
                <Text style={[styles.statNumber, { color: colors.primary }]}>{events.length}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Gesamt Veranstaltungen</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.background }]}>
                <Text style={[styles.statNumber, { color: colors.primary }]}>
                  {events.filter(e => e.status === 'planned').length}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Geplant</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.background }]}>
                <Text style={[styles.statNumber, { color: colors.primary }]}>
                  {events.filter(e => e.status === 'confirmed').length}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Bestätigt</Text>
              </View>
            </View>
          </View>
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
    fontSize: 13,
  },
  selectedDateContainer: {
    padding: 16,
    marginBottom: 12,
  },
  selectedDateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  eventsContainer: {
    marginTop: 8,
  },
  eventsCount: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  eventCard: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  eventCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  eventCardInfo: {
    flex: 1,
  },
  eventCardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  eventCardNumber: {
    fontSize: 12,
    marginTop: 2,
  },
  eventCardDetails: {
    flexDirection: 'row',
    gap: 12,
    marginLeft: 24,
  },
  eventCardDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventCardDetailText: {
    fontSize: 12,
  },
  noEventsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noEventsText: {
    fontSize: 14,
    marginTop: 12,
  },
  summaryContainer: {
    padding: 16,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
});
