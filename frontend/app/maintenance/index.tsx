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

interface MaintenanceTask {
  id: string;
  article_id: string;
  title: string;
  description?: string;
  task_type: string;
  priority: string;
  status: string;
  assigned_to?: string;
  due_date?: string;
  created_at: string;
}

interface MaintenanceAlerts {
  overdue: MaintenanceTask[];
  upcoming: MaintenanceTask[];
}

export default function MaintenancePage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [alerts, setAlerts] = useState<MaintenanceAlerts>({ overdue: [], upcoming: [] });
  const [activeTab, setActiveTab] = useState<'all' | 'overdue' | 'upcoming' | 'completed'>('all');

  useEffect(() => { loadData(); }, []);
  useFocusEffect(useCallback(() => { loadData(); }, []));

  useWebSocket((msg) => {
    if (msg.type === 'maintenance_created' || msg.type === 'maintenance_updated') {
      loadData();
    }
  });

  const loadData = async () => {
    try {
      const [tasksData, alertsData] = await Promise.all([
        apiService.get<MaintenanceTask[]>('/api/maintenance/tasks', { showErrorAlert: false }),
        apiService.get<MaintenanceAlerts>('/api/maintenance/alerts', { showErrorAlert: false }),
      ]);
      setTasks(tasksData || []);
      setAlerts(alertsData || { overdue: [], upcoming: [] });
    } catch (error) {
      console.error('Error loading maintenance data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => { setRefreshing(true); loadData(); };

  const completeTask = async (taskId: string) => {
    try {
      await apiService.put(`/api/maintenance/tasks/${taskId}/complete`, {});
      Alert.alert('✅ Erfolg', 'Wartungsaufgabe als erledigt markiert');
      loadData();
    } catch { Alert.alert('Fehler', 'Aufgabe konnte nicht abgeschlossen werden'); }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return '#FF3B30';
      case 'medium': return '#FF9500';
      case 'low': return '#34C759';
      default: return '#666';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return colors.primary;
      case 'in_progress': return '#FF9500';
      case 'completed': return '#34C759';
      case 'overdue': return '#FF3B30';
      default: return '#666';
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (activeTab === 'all') return task.status !== 'completed';
    if (activeTab === 'overdue') return alerts.overdue.some(t => t.id === task.id);
    if (activeTab === 'upcoming') return alerts.upcoming.some(t => t.id === task.id);
    if (activeTab === 'completed') return task.status === 'completed';
    return true;
  });

  const renderTaskCard = (task: MaintenanceTask) => (
    <TouchableOpacity key={task.id} style={[styles.taskCard, { backgroundColor: colors.card }]} onPress={() => router.push(`/maintenance/task/${task.id}`)}>
      <View style={styles.taskHeader}>
        <View style={[styles.priorityIndicator, { backgroundColor: getPriorityColor(task.priority) }]} />
        <View style={styles.taskInfo}>
          <Text style={[styles.taskTitle, { color: colors.text }]}>{task.title}</Text>
          <Text style={[styles.taskType, { color: colors.primary }]}>{task.task_type}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(task.status) }]}>
          <Text style={styles.statusText}>{task.status.toUpperCase()}</Text>
        </View>
      </View>
      {task.description && <Text style={[styles.taskDescription, { color: colors.textSecondary }]} numberOfLines={2}>{task.description}</Text>}
      <View style={[styles.taskFooter, { borderTopColor: colors.border }]}>
        {task.due_date && (
          <View style={styles.footerItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>{new Date(task.due_date).toLocaleDateString('de-DE')}</Text>
          </View>
        )}
        {task.assigned_to && (
          <View style={styles.footerItem}>
            <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>{task.assigned_to}</Text>
          </View>
        )}
        {task.status !== 'completed' && (
          <TouchableOpacity style={styles.completeButton} onPress={() => completeTask(task.id)}>
            <Ionicons name="checkmark-circle" size={20} color="#34C759" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Lade Wartungsdaten...</Text>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Wartung & Service</Text>
        <TouchableOpacity onPress={() => router.push('/maintenance/create')}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {(alerts.overdue.length > 0 || alerts.upcoming.length > 0) && (
        <View style={[styles.alertsContainer, { backgroundColor: colors.card }]}>
          {alerts.overdue.length > 0 && (
            <TouchableOpacity style={[styles.alertCard, { backgroundColor: '#FF3B3020' }]} onPress={() => setActiveTab('overdue')}>
              <Ionicons name="warning" size={24} color="#FF3B30" />
              <View style={styles.alertInfo}>
                <Text style={[styles.alertCount, { color: '#FF3B30' }]}>{alerts.overdue.length}</Text>
                <Text style={[styles.alertLabel, { color: colors.textSecondary }]}>\u00dcberf\u00e4llig</Text>
              </View>
            </TouchableOpacity>
          )}
          {alerts.upcoming.length > 0 && (
            <TouchableOpacity style={[styles.alertCard, { backgroundColor: '#FF950020' }]} onPress={() => setActiveTab('upcoming')}>
              <Ionicons name="time" size={24} color="#FF9500" />
              <View style={styles.alertInfo}>
                <Text style={[styles.alertCount, { color: '#FF9500' }]}>{alerts.upcoming.length}</Text>
                <Text style={[styles.alertLabel, { color: colors.textSecondary }]}>Bald f\u00e4llig</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabContainer, { backgroundColor: colors.card }]}>
        {(['all', 'overdue', 'upcoming', 'completed'] as const).map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, { backgroundColor: colors.background }, activeTab === tab && { backgroundColor: colors.primary }]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === tab && styles.tabTextActive]}>
              {tab === 'all' ? 'Offen' : tab === 'overdue' ? '\u00dcberf\u00e4llig' : tab === 'upcoming' ? 'Bald f\u00e4llig' : 'Erledigt'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        {filteredTasks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="build-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Keine Wartungsaufgaben</Text>
          </View>
        ) : (
          <View style={styles.tasksList}>{filteredTasks.map(renderTaskCard)}</View>
        )}
      </ScrollView>

      <View style={[styles.quickActions, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity style={[styles.quickActionButton, { backgroundColor: colors.background }]} onPress={() => router.push('/maintenance/checklists')}>
          <Ionicons name="list" size={20} color={colors.primary} />
          <Text style={[styles.quickActionText, { color: colors.text }]}>Checklisten</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickActionButton, { backgroundColor: colors.background }]} onPress={() => router.push('/maintenance/records')}>
          <Ionicons name="document-text" size={20} color={colors.primary} />
          <Text style={[styles.quickActionText, { color: colors.text }]}>Protokolle</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  alertsContainer: { flexDirection: 'row', padding: 16, gap: 12 },
  alertCard: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, gap: 12 },
  alertInfo: { flex: 1 },
  alertCount: { fontSize: 24, fontWeight: 'bold' },
  alertLabel: { fontSize: 12 },
  tabContainer: { paddingHorizontal: 16, paddingVertical: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  tabText: { fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: 'white' },
  content: { flex: 1 },
  tasksList: { padding: 16 },
  taskCard: { borderRadius: 12, padding: 16, marginBottom: 12 },
  taskHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  priorityIndicator: { width: 4, height: 40, borderRadius: 2, marginRight: 12 },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 16, fontWeight: '600' },
  taskType: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: '700', color: 'white' },
  taskDescription: { fontSize: 13, marginBottom: 12, lineHeight: 18 },
  taskFooter: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, gap: 16 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 12 },
  completeButton: { marginLeft: 'auto' },
  emptyContainer: { alignItems: 'center', paddingVertical: 64 },
  emptyText: { fontSize: 16, marginTop: 16 },
  quickActions: { flexDirection: 'row', padding: 16, borderTopWidth: 1, gap: 12 },
  quickActionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
  quickActionText: { fontSize: 14, fontWeight: '500' },
});
