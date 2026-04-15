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
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

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
  completed_at?: string;
  estimated_duration?: number;
  actual_duration?: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface Article {
  id: string;
  name: string;
  inventory_code: string;
  status: string;
}

export default function TaskDetailsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<MaintenanceTask | null>(null);
  const [article, setArticle] = useState<Article | null>(null);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.textSecondary,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    errorText: {
      fontSize: 18,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    backButton: {
      backgroundColor: colors.primary,
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
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    content: {
      flex: 1,
    },
    statusBanner: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    statusBannerText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 1,
    },
    section: {
      padding: 24,
      backgroundColor: colors.card,
      marginBottom: 12,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 12,
    },
    priorityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    priorityBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    priorityBadgeText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '700',
    },
    taskType: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    description: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
    },
    articleCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.background,
      borderRadius: 8,
    },
    articleName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    articleCode: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
    },
    timelineCard: {
      gap: 16,
    },
    timelineItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    timelineContent: {
      flex: 1,
    },
    timelineLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    timelineValue: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
      marginTop: 2,
    },
    metaCard: {
      gap: 12,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    metaLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    metaValue: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
      textAlign: 'right',
      flex: 1,
      marginLeft: 12,
    },
    actionsSection: {
      padding: 24,
      gap: 12,
      marginBottom: 32,
    },
    completeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#34C759',
      paddingVertical: 16,
      borderRadius: 8,
      gap: 8,
    },
    completeButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    recordButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      paddingVertical: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.primary,
      gap: 8,
    },
    recordButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
  });

  const loadTaskDetails = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        router.replace('/');
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/maintenance/tasks/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const taskData = await response.json();
        setTask(taskData);

        // Load article details
        const articleResponse = await fetch(`${BACKEND_URL}/api/articles/${taskData.article_id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (articleResponse.ok) {
          const articleData = await articleResponse.json();
          setArticle(articleData);
        }
      } else {
        Alert.alert('Fehler', 'Aufgabe konnte nicht geladen werden');
        router.back();
      }
    } catch (error) {
      console.error('Error loading task details:', error);
      Alert.alert('Fehler', 'Netzwerkfehler beim Laden der Aufgabe');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadTaskDetails();
    }
  }, [id, loadTaskDetails]);

  const completeTask = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/api/maintenance/tasks/${id}/complete`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        Alert.alert('Erfolg', 'Aufgabe wurde abgeschlossen', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('Fehler', 'Aufgabe konnte nicht abgeschlossen werden');
      }
    } catch (error) {
      Alert.alert('Fehler', 'Netzwerkfehler beim Abschließen der Aufgabe');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical': return '#FF3B30';
      case 'high': return '#FF9500';
      case 'medium': return '#007AFF';
      case 'low': return '#34C759';
      default: return colors.textSecondary;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return '#34C759';
      case 'in_progress': return '#007AFF';
      case 'pending': return '#FF9500';
      case 'cancelled': return '#FF3B30';
      default: return colors.textSecondary;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Nicht festgelegt';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Lade Aufgabendetails...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!task) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Aufgabe nicht gefunden</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Zurück</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Aufgabendetails</Text>
        <TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: getStatusColor(task.status) }]}>
          <Text style={styles.statusBannerText}>
            {task.status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>

        {/* Title Section */}
        <View style={styles.section}>
          <Text style={styles.title}>{task.title}</Text>
          <View style={styles.priorityRow}>
            <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(task.priority) }]}>
              <Text style={styles.priorityBadgeText}>{task.priority.toUpperCase()}</Text>
            </View>
            <Text style={styles.taskType}>
              {task.task_type === 'routine' ? '🔄 Routine' : task.task_type === 'repair' ? '🔧 Reparatur' : '🔍 Inspektion'}
            </Text>
          </View>
        </View>

        {/* Description */}
        {task.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Beschreibung</Text>
            <Text style={styles.description}>{task.description}</Text>
          </View>
        )}

        {/* Article Info */}
        {article && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Artikel</Text>
            <TouchableOpacity
              style={styles.articleCard}
              onPress={() => router.push(`/articles/edit/${article.id}`)}
            >
              <View>
                <Text style={styles.articleName}>{article.name}</Text>
                <Text style={styles.articleCode}>{article.inventory_code}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zeitplan</Text>
          <View style={styles.timelineCard}>
            <View style={styles.timelineItem}>
              <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>Fällig am</Text>
                <Text style={styles.timelineValue}>{formatDate(task.due_date)}</Text>
              </View>
            </View>

            <View style={styles.timelineItem}>
              <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>Geschätzte Dauer</Text>
                <Text style={styles.timelineValue}>
                  {task.estimated_duration ? `${task.estimated_duration} Minuten` : 'Nicht festgelegt'}
                </Text>
              </View>
            </View>

            {task.completed_at && (
              <View style={styles.timelineItem}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#34C759" />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Abgeschlossen am</Text>
                  <Text style={styles.timelineValue}>{formatDate(task.completed_at)}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Meta Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weitere Informationen</Text>
          <View style={styles.metaCard}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Erstellt am:</Text>
              <Text style={styles.metaValue}>{formatDate(task.created_at)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Zuletzt aktualisiert:</Text>
              <Text style={styles.metaValue}>{formatDate(task.updated_at)}</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        {task.status !== 'completed' && (
          <View style={styles.actionsSection}>
            <TouchableOpacity
              style={styles.completeButton}
              onPress={() => {
                Alert.alert(
                  'Aufgabe abschließen',
                  'Möchten Sie diese Wartungsaufgabe als abgeschlossen markieren?',
                  [
                    { text: 'Abbrechen', style: 'cancel' },
                    { text: 'Abschließen', onPress: completeTask },
                  ]
                );
              }}
            >
              <Ionicons name="checkmark-circle" size={24} color="white" />
              <Text style={styles.completeButtonText}>Aufgabe abschließen</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.recordButton}
              onPress={() => router.push(`/maintenance/record/${task.id}`)}
            >
              <Ionicons name="document-text" size={24} color={colors.primary} />
              <Text style={styles.recordButtonText}>Wartungsprotokoll erstellen</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
