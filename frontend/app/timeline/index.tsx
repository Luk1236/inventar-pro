import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiService from '../../services/apiService';
import { useTheme } from '../../contexts/ThemeContext';

const DAY_WIDTH = 52;
const ROW_HEIGHT = 62;
const HEADER_HEIGHT = 72;
const EVENT_COL_WIDTH = 180;
const DAYS_IN_WINDOW = 28;

interface Event {
  id: string;
  event_number: string;
  event_name: string;
  event_type: string;
  location: string;
  start_date: string;
  end_date: string;
  setup_date?: string;
  teardown_date?: string;
  status: string;
  customer_id: string;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#34C759',
  planned: '#007AFF',
  in_progress: '#FF9500',
  completed: '#8E8E93',
  cancelled: '#FF3B30',
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Bestätigt',
  planned: 'Geplant',
  in_progress: 'Laufend',
  completed: 'Abgeschlossen',
  cancelled: 'Abgesagt',
};

function getStatusColor(status: string, primaryColor: string): string {
  if (status === 'planned') return primaryColor;
  return STATUS_COLORS[status] || primaryColor;
}

export default function TimelinePage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [offsetDays, setOffsetDays] = useState(-3);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const windowStart = new Date(today);
  windowStart.setDate(today.getDate() + offsetDays);

  const days: Date[] = [];
  for (let i = 0; i < DAYS_IN_WINDOW; i++) {
    const d = new Date(windowStart);
    d.setDate(windowStart.getDate() + i);
    days.push(d);
  }

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.get<Event[]>('/api/events');
      const sorted = (data || []).sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      );
      setEvents(sorted);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  function dayOffset(dateStr: string): number {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return Math.floor((d.getTime() - windowStart.getTime()) / 86400000);
  }

  function getBarProps(start: string, end: string) {
    const startOff = dayOffset(start);
    const endOff = dayOffset(end);
    const rawLeft = startOff * DAY_WIDTH;
    const rawWidth = Math.max((endOff - startOff + 1), 1) * DAY_WIDTH;
    const clampedLeft = Math.max(rawLeft, 0);
    const clampedWidth = Math.min(rawWidth, (DAYS_IN_WINDOW - Math.max(startOff, 0)) * DAY_WIDTH);
    const visible = startOff < DAYS_IN_WINDOW && endOff >= 0 && clampedWidth > 0;
    return { left: clampedLeft, width: clampedWidth - 4, visible };
  }

  const getMonthGroups = () => {
    const groups: { label: string; count: number }[] = [];
    let current = { label: '', count: 0 };
    days.forEach(day => {
      const label = day.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      if (label === current.label) {
        current.count++;
      } else {
        if (current.count > 0) groups.push({ ...current });
        current = { label, count: 1 };
      }
    });
    if (current.count > 0) groups.push({ ...current });
    return groups;
  };

  const getDateRangeLabel = () => {
    const end = days[days.length - 1];
    const s = windowStart.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
    const e = end.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${s} – ${e}`;
  };

  const navigateWeek = (dir: number) => {
    setOffsetDays(prev => prev + dir * 7);
  };

  const goToToday = () => {
    setOffsetDays(-3);
    scrollViewRef.current?.scrollTo({ x: 0, animated: true });
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { color: colors.textSecondary, fontSize: 14 },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.card,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
    },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    navigation: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.card,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
    },
    navButton: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 4 },
    navButtonText: { color: colors.primary, fontSize: 14, fontWeight: '500' },
    navCenter: { alignItems: 'center', gap: 4 },
    dateRangeLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
    todayBtn: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    todayBtnText: { color: colors.primary, fontSize: 11, fontWeight: '500' },
    timelineWrap: { flex: 1, flexDirection: 'row', backgroundColor: colors.card },
    eventCol: {
      width: EVENT_COL_WIDTH,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      backgroundColor: isDark ? colors.background : '#FAFAFA',
    },
    cornerCell: {
      height: HEADER_HEIGHT,
      justifyContent: 'flex-end',
      paddingHorizontal: 12,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    cornerText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    eventCell: {
      height: ROW_HEIGHT,
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
    },
    eventNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    statusDot: { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
    eventName: { fontSize: 13, fontWeight: '600', color: colors.text, flex: 1 },
    eventMeta: { fontSize: 11, color: colors.textSecondary },
    dateHeader: {
      height: HEADER_HEIGHT,
      flexDirection: 'column',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    monthRow: {
      height: 24,
      flexDirection: 'row',
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
    },
    monthCell: {
      justifyContent: 'center',
      paddingHorizontal: 8,
      borderRightWidth: 0.5,
      borderRightColor: colors.border,
    },
    monthLabel: { fontSize: 10, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
    dayRow: { flex: 1, flexDirection: 'row' },
    dayCell: {
      justifyContent: 'center',
      alignItems: 'center',
      borderRightWidth: 0.5,
      borderRightColor: colors.border,
      gap: 1,
    },
    dayCircle: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
    todayCircle: { backgroundColor: colors.primary },
    dayNumber: { fontSize: 13, fontWeight: '600', color: colors.text },
    todayNumber: { color: '#fff' },
    dayName: { fontSize: 9, color: colors.textSecondary },
    todayDayName: { color: colors.primary },
    weekendCell: { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFF7F7' },
    timelineRow: {
      height: ROW_HEIGHT,
      flexDirection: 'row',
      position: 'relative',
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
    },
    gridCell: { borderRightWidth: 0.5, borderRightColor: colors.border },
    weekendGridCell: { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFAFA' },
    todayGridCell: { backgroundColor: isDark ? 'rgba(0,122,255,0.06)' : '#007AFF0A' },
    eventBar: {
      position: 'absolute',
      top: 10,
      height: ROW_HEIGHT - 22,
      borderRadius: 7,
      justifyContent: 'center',
      paddingHorizontal: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
      elevation: 2,
    },
    eventBarText: { color: '#fff', fontSize: 11, fontWeight: '600' },
    eventBarSub: { color: 'rgba(255,255,255,0.8)', fontSize: 10, marginTop: 1 },
    setupBar: {
      position: 'absolute',
      bottom: 6,
      height: 5,
      borderRadius: 3,
      opacity: 0.55,
    },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
    emptyIcon: { marginBottom: 4 },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
    legend: {
      backgroundColor: colors.card,
      borderTopWidth: 0.5,
      borderTopColor: colors.border,
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      borderRadius: 10,
      borderWidth: 0.5,
      borderColor: colors.border,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 9, height: 9, borderRadius: 4.5 },
    legendText: { fontSize: 12, color: colors.textSecondary },
  });

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Eventplan wird geladen…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="analytics-outline" size={20} color={colors.primary} />
          <Text style={styles.headerTitle}>Eventplan</Text>
        </View>
        <TouchableOpacity onPress={loadEvents}>
          <Ionicons name="refresh" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Navigation */}
      <View style={styles.navigation}>
        <TouchableOpacity style={styles.navButton} onPress={() => navigateWeek(-1)}>
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
          <Text style={styles.navButtonText}>Zurück</Text>
        </TouchableOpacity>
        <View style={styles.navCenter}>
          <Text style={styles.dateRangeLabel}>{getDateRangeLabel()}</Text>
          <TouchableOpacity style={styles.todayBtn} onPress={goToToday}>
            <Text style={styles.todayBtnText}>Heute</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.navButton} onPress={() => navigateWeek(1)}>
          <Text style={styles.navButtonText}>Weiter</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Empty state */}
      {events.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={56} color={colors.textSecondary} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>Keine Events geplant</Text>
          <Text style={styles.emptyText}>Erstelle ein Event, um es hier im Eventplan zu sehen.</Text>
        </View>
      ) : (
        <>
          {/* Gantt */}
          <View style={styles.timelineWrap}>
            {/* Fixed left column */}
            <View style={styles.eventCol}>
              <View style={styles.cornerCell}>
                <Text style={styles.cornerText}>Veranstaltung</Text>
              </View>
              {events.map(ev => {
                const color = getStatusColor(ev.status, colors.primary);
                return (
                  <TouchableOpacity
                    key={ev.id}
                    style={styles.eventCell}
                    onPress={() => router.push(`/events/detail/${ev.id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.eventNameRow}>
                      <View style={[styles.statusDot, { backgroundColor: color }]} />
                      <Text style={styles.eventName} numberOfLines={1}>{ev.event_name}</Text>
                    </View>
                    <Text style={styles.eventMeta} numberOfLines={1}>
                      {ev.event_number} · {STATUS_LABELS[ev.status] || ev.status}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Scrollable timeline */}
            <ScrollView
              ref={scrollViewRef}
              horizontal
              showsHorizontalScrollIndicator
              contentContainerStyle={{ width: DAYS_IN_WINDOW * DAY_WIDTH }}
            >
              <View>
                {/* Date header */}
                <View style={styles.dateHeader}>
                  <View style={styles.monthRow}>
                    {getMonthGroups().map((g, i) => (
                      <View key={i} style={[styles.monthCell, { width: g.count * DAY_WIDTH }]}>
                        <Text style={styles.monthLabel} numberOfLines={1}>{g.label}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.dayRow}>
                    {days.map((day, i) => {
                      const isToday = day.toDateString() === today.toDateString();
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      return (
                        <View key={i} style={[styles.dayCell, { width: DAY_WIDTH }, isWeekend && styles.weekendCell]}>
                          <View style={[styles.dayCircle, isToday && styles.todayCircle]}>
                            <Text style={[styles.dayNumber, isToday && styles.todayNumber]}>{day.getDate()}</Text>
                          </View>
                          <Text style={[styles.dayName, isToday && styles.todayDayName]}>
                            {day.toLocaleDateString('de-DE', { weekday: 'short' })}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Event rows */}
                {events.map(ev => {
                  const color = getStatusColor(ev.status, colors.primary);
                  const bar = getBarProps(ev.start_date, ev.end_date);
                  const setupBar = ev.setup_date ? getBarProps(ev.setup_date, ev.start_date) : null;
                  const teardownBar = ev.teardown_date ? getBarProps(ev.end_date, ev.teardown_date) : null;

                  return (
                    <View key={ev.id} style={styles.timelineRow}>
                      {/* Grid cells */}
                      {days.map((day, i) => {
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                        const isToday = day.toDateString() === today.toDateString();
                        return (
                          <View
                            key={i}
                            style={[
                              styles.gridCell,
                              { width: DAY_WIDTH, height: ROW_HEIGHT },
                              isWeekend && styles.weekendGridCell,
                              isToday && styles.todayGridCell,
                            ]}
                          />
                        );
                      })}

                      {/* Setup bar */}
                      {setupBar?.visible && (
                        <View
                          style={[
                            styles.setupBar,
                            { left: setupBar.left + 2, width: setupBar.width - 4, backgroundColor: color },
                          ]}
                        />
                      )}

                      {/* Teardown bar */}
                      {teardownBar?.visible && (
                        <View
                          style={[
                            styles.setupBar,
                            { left: teardownBar.left + 2, width: teardownBar.width - 4, backgroundColor: color },
                          ]}
                        />
                      )}

                      {/* Main event bar */}
                      {bar.visible && (
                        <TouchableOpacity
                          style={[styles.eventBar, { left: bar.left + 2, width: bar.width, backgroundColor: color }]}
                          onPress={() => router.push(`/events/detail/${ev.id}`)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.eventBarText} numberOfLines={1}>{ev.event_name}</Text>
                          {bar.width >= DAY_WIDTH * 2 && (
                            <Text style={styles.eventBarSub} numberOfLines={1}>{ev.location}</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendRow}>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <View key={key} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: getStatusColor(key, colors.primary) }]} />
                  <Text style={styles.legendText}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
