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
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { printScreen } from '../../utils/printUtils';
import { useTheme } from '../../contexts/ThemeContext';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface MaintenanceRecord {
  id: string;
  task_id: string;
  article_id: string;
  performed_by: string;
  work_description: string;
  parts_used?: Array<{ name: string; quantity: number; cost: number }>;
  cost?: number;
  status_after: string;
  notes?: string;
  created_at: string;
}

interface Article {
  id: string;
  name: string;
  inventory_code: string;
}

export default function RecordsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [articlesMap, setArticlesMap] = useState<Map<string, Article>>(new Map());

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
    recordsList: {
      padding: 16,
    },
    recordsCount: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 12,
    },
    recordCard: {
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
    recordHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    recordInfo: {
      flex: 1,
    },
    articleName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    articleCode: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 16,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '700',
      color: 'white',
    },
    workDescription: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    recordFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    recordMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    recordMetaText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    costBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#f0f6ff',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    costText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    partsSection: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    partsTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 6,
    },
    partText: {
      fontSize: 13,
      color: colors.textSecondary,
      marginLeft: 8,
      marginBottom: 2,
    },
    moreText: {
      fontSize: 12,
      fontStyle: 'italic',
      color: colors.primary,
      marginLeft: 8,
      marginTop: 4,
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
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        router.replace('/');
        return;
      }

      // Load records
      const response = await fetch(`${BACKEND_URL}/api/maintenance/records?limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const recordsData = await response.json();
        setRecords(recordsData);

        // Load articles for these records
        const articlesResponse = await fetch(`${BACKEND_URL}/api/articles`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (articlesResponse.ok) {
          const articlesData = await articlesResponse.json();
          const articlesMapTemp = new Map<string, Article>();
          articlesData.forEach((article: Article) => {
            articlesMapTemp.set(article.id, article);
          });
          setArticlesMap(articlesMapTemp);
        }
      } else {
        Alert.alert('Fehler', 'Wartungsprotokolle konnten nicht geladen werden');
      }
    } catch (error) {
      console.error('Error loading records:', error);
      Alert.alert('Fehler', 'Netzwerkfehler beim Laden der Protokolle');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadRecords();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ok': return '#34C759';
      case 'defekt': return '#FF3B30';
      case 'gesperrt': return '#FF9500';
      default: return colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ok': return 'checkmark-circle';
      case 'defekt': return 'close-circle';
      case 'gesperrt': return 'ban';
      default: return 'help-circle';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderRecordCard = (record: MaintenanceRecord) => {
    const article = articlesMap.get(record.article_id);

    return (
      <TouchableOpacity
        key={record.id}
        style={styles.recordCard}
        onPress={() => Alert.alert('Info', 'Detailansicht - Kommt bald')}
      >
        <View style={styles.recordHeader}>
          <View style={styles.recordInfo}>
            <Text style={styles.articleName}>
              {article ? article.name : 'Artikel wird geladen...'}
            </Text>
            {article && (
              <Text style={styles.articleCode}>{article.inventory_code}</Text>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(record.status_after) }]}>
            <Ionicons
              name={getStatusIcon(record.status_after) as any}
              size={16}
              color="white"
            />
            <Text style={styles.statusText}>{record.status_after.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.workDescription} numberOfLines={3}>
          {record.work_description}
        </Text>

        <View style={styles.recordFooter}>
          <View style={styles.recordMeta}>
            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.recordMetaText}>{formatDate(record.created_at)}</Text>
          </View>

          {record.cost !== undefined && record.cost > 0 && (
            <View style={styles.costBadge}>
              <Ionicons name="cash-outline" size={14} color={colors.primary} />
              <Text style={styles.costText}>€{record.cost.toFixed(2)}</Text>
            </View>
          )}
        </View>

        {record.parts_used && record.parts_used.length > 0 && (
          <View style={styles.partsSection}>
            <Text style={styles.partsTitle}>Verwendete Teile:</Text>
            {record.parts_used.slice(0, 2).map((part, index) => (
              <Text key={index} style={styles.partText}>
                • {part.name} ({part.quantity}x)
              </Text>
            ))}
            {record.parts_used.length > 2 && (
              <Text style={styles.moreText}>+{record.parts_used.length - 2} weitere</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Lade Wartungsprotokolle...</Text>
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
        <Text style={styles.headerTitle}>Wartungsprotokolle</Text>
        <TouchableOpacity onPress={printScreen}>
          <Ionicons name="print-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {records.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color={colors.border} />
            <Text style={styles.emptyTitle}>Keine Protokolle</Text>
            <Text style={styles.emptyText}>
              Wartungsprotokolle werden automatisch erstellt, wenn Sie eine Wartungsaufgabe abschließen.
            </Text>
          </View>
        ) : (
          <View style={styles.recordsList}>
            <Text style={styles.recordsCount}>
              {records.length} Protokoll{records.length !== 1 ? 'e' : ''}
            </Text>
            {records.map(renderRecordCard)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
