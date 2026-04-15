import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Task {
  id: string;
  title: string;
  description?: string;
  assigned_to_name?: string;
  priority: 'niedrig' | 'normal' | 'hoch' | 'dringend';
  due_date?: string;
  event_name?: string;
  status: 'offen' | 'in_bearbeitung' | 'erledigt';
  created_at?: string;
}

type FilterTab = 'alle' | 'offen' | 'erledigt';

const PRIORITY_COLORS: Record<string, string> = {
  dringend: '#FF3B30',
  hoch: '#FF9500',
  normal: '#007AFF',
  niedrig: '#8E8E93',
};

const PRIORITY_LABELS: Record<string, string> = {
  dringend: 'Dringend',
  hoch: 'Hoch',
  normal: 'Normal',
  niedrig: 'Niedrig',
};

const STATUS_ORDER: Task['status'][] = ['offen', 'in_bearbeitung', 'erledigt'];

const STATUS_LABELS: Record<string, string> = {
  offen: 'Offen',
  in_bearbeitung: 'In Bearbeitung',
  erledigt: 'Erledigt',
};

const STATUS_ICONS: Record<string, string> = {
  offen: 'ellipse-outline',
  in_bearbeitung: 'time-outline',
  erledigt: 'checkmark-circle',
};

const STATUS_ICON_COLORS: Record<string, string> = {
  offen: '#8E8E93',
  in_bearbeitung: '#FF9500',
  erledigt: '#34C759',
};

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'offen', label: 'Offen' },
  { key: 'erledigt', label: 'Erledigt' },
];

function isOverdue(dueDateStr?: string): boolean {
  if (!dueDateStr) return false;
  const due = new Date(dueDateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return due < now;
}

function formatDate(dueDateStr?: string): string {
  if (!dueDateStr) return '';
  // Display the date string as-is (e.g. "2026-03-18" or "2026-03-18T00:00:00")
  const parts = dueDateStr.split('T');
  return parts[0];
}

function getNextStatus(current: Task['status']): Task['status'] {
  const idx = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

export default function TasksPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('alle');

  const load = async () => {
    try {
      const data = await apiService.get<Task[]>('/api/tasks');
      setTasks(data || []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const cycleStatus = async (task: Task) => {
    const newStatus = getNextStatus(task.status);
    try {
      await apiService.put(`/api/tasks/${task.id}`, { ...task, status: newStatus });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Status konnte nicht geändert werden');
    }
  };

  const deleteTask = async (task: Task) => {
    if (!(window as any).confirm(`"${task.title}" wirklich löschen?`)) return;
    try { await apiService.delete(`/api/tasks/${task.id}`); await load(); }
    catch (e: any) { Alert.alert('Fehler', e.message || 'Löschen fehlgeschlagen'); }
  };

  // Filter tasks for display (but always show all section headers)
  const filteredTasks = (statusGroup: Task['status']): Task[] => {
    const groupTasks = tasks.filter(t => t.status === statusGroup);
    if (activeFilter === 'alle') return groupTasks;
    if (activeFilter === 'offen') return groupTasks.filter(t => t.status === 'offen');
    if (activeFilter === 'erledigt') return groupTasks.filter(t => t.status === 'erledigt');
    return groupTasks;
  };

  const totalVisible = STATUS_ORDER.reduce((sum, s) => sum + filteredTasks(s).length, 0);

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Aufgaben</Text>
        <TouchableOpacity onPress={() => router.push('/tasks/create' as any)}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeFilter === tab.key && [styles.tabActive, { borderBottomColor: colors.primary }],
            ]}
            onPress={() => setActiveFilter(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeFilter === tab.key ? colors.primary : colors.textSecondary },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        >
          {totalVisible === 0 && (
            <View style={styles.center}>
              <Ionicons name="checkmark-done-outline" size={48} color={colors.border} />
              <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Keine Aufgaben vorhanden</Text>
            </View>
          )}

          {STATUS_ORDER.map(statusGroup => {
            const groupTasks = filteredTasks(statusGroup);
            return (
              <View key={statusGroup}>
                {/* Section header always shown */}
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, { backgroundColor: STATUS_ICON_COLORS[statusGroup] }]} />
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    {STATUS_LABELS[statusGroup]}
                  </Text>
                  <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
                    ({tasks.filter(t => t.status === statusGroup).length})
                  </Text>
                </View>

                {groupTasks.length === 0 && (
                  <Text style={[styles.emptyGroup, { color: colors.border }]}>Keine Einträge</Text>
                )}

                {groupTasks.map(task => (
                  <TouchableOpacity
                    key={task.id}
                    style={[styles.card, { backgroundColor: colors.card }]}
                    onLongPress={() => deleteTask(task)}
                    activeOpacity={0.85}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                      {/* Status toggle button */}
                      <TouchableOpacity
                        onPress={() => cycleStatus(task)}
                        style={styles.statusBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name={STATUS_ICONS[task.status] as any}
                          size={26}
                          color={STATUS_ICON_COLORS[task.status]}
                        />
                      </TouchableOpacity>

                      <View style={{ flex: 1 }}>
                        {/* Title + priority badge */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Text
                            style={[
                              styles.cardTitle,
                              { color: colors.text },
                              task.status === 'erledigt' && { textDecorationLine: 'line-through', color: colors.textSecondary },
                            ]}
                          >
                            {task.title}
                          </Text>
                          <View style={[styles.badge, { backgroundColor: PRIORITY_COLORS[task.priority] || '#8E8E93' }]}>
                            <Text style={styles.badgeText}>{PRIORITY_LABELS[task.priority] || task.priority}</Text>
                          </View>
                        </View>

                        {/* Assigned to */}
                        {!!task.assigned_to_name && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <Ionicons name="person-outline" size={13} color={colors.textSecondary} />
                            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{task.assigned_to_name}</Text>
                          </View>
                        )}

                        {/* Due date */}
                        {!!task.due_date && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                            <Ionicons
                              name="calendar-outline"
                              size={13}
                              color={isOverdue(task.due_date) && task.status !== 'erledigt' ? '#FF3B30' : colors.textSecondary}
                            />
                            <Text
                              style={{
                                color: isOverdue(task.due_date) && task.status !== 'erledigt' ? '#FF3B30' : colors.textSecondary,
                                fontSize: 13,
                              }}
                            >
                              {formatDate(task.due_date)}
                              {isOverdue(task.due_date) && task.status !== 'erledigt' ? ' · Überfällig' : ''}
                            </Text>
                          </View>
                        )}

                        {/* Event name */}
                        {!!task.event_name && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                            <Ionicons name="calendar" size={13} color={colors.primary} />
                            <Text style={{ color: colors.primary, fontSize: 13 }}>{task.event_name}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabText: { fontSize: 14, fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCount: { fontSize: 12 },
  emptyGroup: { fontSize: 13, fontStyle: 'italic', marginBottom: 4, marginLeft: 16 },
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
  cardTitle: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  statusBtn: { paddingTop: 2 },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: 'white', fontSize: 11, fontWeight: '600' },
});
