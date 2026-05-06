import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWebSocket } from '../../hooks/useWebSocket';

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

export default function EventsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => { loadEvents(); }, []);
  useFocusEffect(useCallback(() => { loadEvents(); }, []));

  useWebSocket((msg) => {
    if (msg.type === 'event_created' || msg.type === 'event_updated' || msg.type === 'event_deleted') {
      loadEvents();
    }
  });

  const loadEvents = async () => {
    try {
      const data = await apiService.get<Event[]>('/api/events', { showErrorAlert: false });
      setEvents(data || []);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => { setRefreshing(true); loadEvents(); };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed': return '#34C759';
      case 'planned': return colors.primary;
      case 'in_progress': return '#FF9500';
      case 'completed': return '#666';
      case 'cancelled': return '#FF3B30';
      default: return '#666';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const renderEventCard = useCallback(({ item: event }: { item: Event }) => (
    <TouchableOpacity style={[styles.eventCard, { backgroundColor: colors.card }]} onPress={() => router.push(`/events/detail/${event.id}`)}>
      <View style={styles.eventHeader}>
        <View style={[styles.eventIcon, { backgroundColor: isDark ? '#1a3a5c' : '#f0f6ff' }]}>
          <Ionicons name="calendar" size={24} color={colors.primary} />
        </View>
        <View style={styles.eventInfo}>
          <Text style={[styles.eventName, { color: colors.text }]}>{event.event_name}</Text>
          <Text style={[styles.eventNumber, { color: colors.primary }]}>{event.event_number}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(event.status) }]}>
          <Text style={styles.statusText}>{event.status.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.eventDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="pricetag-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>{event.event_type}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>{event.location}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>{formatDate(event.start_date)} - {formatDate(event.end_date)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  ), [colors, isDark, getStatusColor, formatDate]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Lade Veranstaltungen...</Text>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Veranstaltungen</Text>
        <TouchableOpacity onPress={() => router.push('/events/create')}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        style={styles.content}
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={renderEventCard}
        removeClippedSubviews
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={8}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListHeaderComponent={
          events.length > 0 ? (
            <Text style={[styles.countText, { color: colors.textSecondary }]}>
              {events.length} Veranstaltung{events.length !== 1 ? 'en' : ''}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Keine Veranstaltungen</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Erstellen Sie Ihre erste Veranstaltung</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  content: { flex: 1 },
  eventsList: { padding: 16 },
  countText: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  eventCard: { borderRadius: 12, padding: 16, marginBottom: 12 },
  eventHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  eventIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  eventInfo: { flex: 1 },
  eventName: { fontSize: 16, fontWeight: '600' },
  eventNumber: { fontSize: 13, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  statusText: { fontSize: 11, fontWeight: '700', color: 'white' },
  eventDetails: { gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 14, flex: 1 },
  emptyContainer: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginTop: 16 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 8 },
});
