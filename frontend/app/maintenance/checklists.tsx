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
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface MaintenanceChecklist {
  id: string;
  name: string;
  description?: string;
  category_ids?: string[];
  items: Array<{
    title: string;
    required: boolean;
    type: string;
  }>;
  is_template: boolean;
  created_at: string;
}

export default function ChecklistsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checklists, setChecklists] = useState<MaintenanceChecklist[]>([]);

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
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    content: {
      flex: 1,
    },
    checklistsList: {
      padding: 16,
    },
    checklistCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    checklistHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    checklistIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#f0f6ff',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    checklistInfo: {
      flex: 1,
    },
    checklistName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    checklistDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
      lineHeight: 20,
    },
    checklistMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    metaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.background,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    metaText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    templateBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    templateBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.card,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 64,
      paddingHorizontal: 24,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginTop: 16,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 20,
    },
  });

  useEffect(() => {
    loadChecklists();
  }, []);

  const loadChecklists = async () => {
    try {
      const token = await getToken();
      if (!token) {
        router.replace('/');
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/maintenance/checklists`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setChecklists(data);
      } else {
        Alert.alert('Fehler', 'Checklisten konnten nicht geladen werden');
      }
    } catch (error) {
      console.error('Error loading checklists:', error);
      Alert.alert('Fehler', 'Netzwerkfehler beim Laden der Checklisten');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadChecklists();
  };

  const renderChecklistCard = (checklist: MaintenanceChecklist) => (
    <TouchableOpacity
      key={checklist.id}
      style={styles.checklistCard}
      onPress={() => router.push(`/maintenance/checklist/${checklist.id}`)}
    >
      <View style={styles.checklistHeader}>
        <View style={styles.checklistIcon}>
          <Ionicons name="list" size={24} color={colors.primary} />
        </View>
        <View style={styles.checklistInfo}>
          <Text style={styles.checklistName}>{checklist.name}</Text>
          {checklist.description && (
            <Text style={styles.checklistDescription} numberOfLines={2}>
              {checklist.description}
            </Text>
          )}
          <View style={styles.checklistMeta}>
            <View style={styles.metaBadge}>
              <Ionicons name="checkbox-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.metaText}>{checklist.items.length} Punkte</Text>
            </View>
            {checklist.is_template && (
              <View style={styles.templateBadge}>
                <Text style={styles.templateBadgeText}>Vorlage</Text>
              </View>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.primary} />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Lade Checklisten...</Text>
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
        <Text style={styles.headerTitle}>Wartungschecklisten</Text>
        <TouchableOpacity onPress={() => Alert.alert('Info', 'Neue Checkliste erstellen - Kommt bald')}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {checklists.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="list-outline" size={64} color={colors.border} />
            <Text style={styles.emptyTitle}>Keine Checklisten</Text>
            <Text style={styles.emptyText}>
              Wartungschecklisten helfen Ihnen, standardisierte Prüfungen durchzuführen.
            </Text>
          </View>
        ) : (
          <View style={styles.checklistsList}>
            {checklists.map(renderChecklistCard)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
