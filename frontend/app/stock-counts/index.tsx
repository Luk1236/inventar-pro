import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ----- Types -----

interface StockCountItem {
  article_id: string;
  article_name: string;
  expected_quantity: number;
  counted_quantity: number | null;
}

interface StockCountSummary {
  id: string;
  name: string;
  status: 'offen' | 'abgeschlossen';
  created_at: string;
  items: StockCountItem[];
}

interface StockCountFull extends StockCountSummary {
  items: StockCountItem[];
}

// ----- Helpers -----

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return iso;
  }
}

// ----- Main Component -----

export default function StockCountsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  // View state
  const [view, setView] = useState<'list' | 'detail'>('list');

  // List state
  const [counts, setCounts] = useState<StockCountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);

  // Detail state
  const [selectedCount, setSelectedCount] = useState<StockCountFull | null>(null);
  const [editItems, setEditItems] = useState<StockCountItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);

  // ----- List actions -----

  const loadCounts = useCallback(async () => {
    try {
      const data = await apiService.get<StockCountSummary[]>('/api/stock-counts');
      setCounts(data || []);
    } catch {
      // error alert handled by apiService
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCounts();
    setRefreshing(false);
  };

  const startNewCount = async () => {
    setStarting(true);
    try {
      const newCount = await apiService.post<StockCountFull>('/api/stock-counts/start');
      await loadCounts();
      await openDetail(newCount);
    } catch {
      // error alert handled by apiService
    }
    setStarting(false);
  };

  const confirmDelete = async (count: StockCountSummary) => {
    if (!(window as any).confirm(`"${count.name}" wirklich löschen?`)) return;
    try { await apiService.delete(`/api/stock-counts/${count.id}`); await loadCounts(); }
    catch { /* handled by apiService */ }
  };

  // ----- Detail actions -----

  const openDetail = async (summary: StockCountSummary | StockCountFull) => {
    setDetailLoading(true);
    setView('detail');
    try {
      const full = await apiService.get<StockCountFull>(`/api/stock-counts/${summary.id}`);
      setSelectedCount(full);
      setEditItems(
        (full.items || []).map(item => ({
          ...item,
          counted_quantity: item.counted_quantity ?? 0,
        }))
      );
    } catch {
      // If fetch fails, fall back to whatever data we already have
      const fallback = summary as StockCountFull;
      setSelectedCount(fallback);
      setEditItems(
        (fallback.items || []).map(item => ({
          ...item,
          counted_quantity: item.counted_quantity ?? 0,
        }))
      );
    }
    setDetailLoading(false);
  };

  const goBackToList = () => {
    setView('list');
    setSelectedCount(null);
    setEditItems([]);
  };

  const updateItemQuantity = (articleId: string, value: string) => {
    const num = value === '' ? 0 : parseInt(value, 10);
    setEditItems(prev =>
      prev.map(item =>
        item.article_id === articleId
          ? { ...item, counted_quantity: isNaN(num) ? 0 : num }
          : item
      )
    );
  };

  const saveCount = async () => {
    if (!selectedCount) return;
    setSaving(true);
    try {
      await apiService.put(`/api/stock-counts/${selectedCount.id}`, {
        items: editItems,
        status: 'offen',
      });
      Alert.alert('Gespeichert', 'Bestandszählung wurde gespeichert.');
      await loadCounts();
    } catch {
      // error alert handled by apiService
    }
    setSaving(false);
  };

  const closeCount = async () => {
    if (!selectedCount) return;
    Alert.alert(
      'Zählung abschließen',
      'Möchten Sie die Zählung wirklich abschließen? Sie kann danach nicht mehr bearbeitet werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Abschließen',
          onPress: async () => {
            setClosing(true);
            try {
              await apiService.put(`/api/stock-counts/${selectedCount.id}`, {
                items: editItems,
                status: 'abgeschlossen',
              });
              await loadCounts();
              goBackToList();
            } catch {
              // error alert handled by apiService
            }
            setClosing(false);
          },
        },
      ]
    );
  };

  const isAbgeschlossen = selectedCount?.status === 'abgeschlossen';

  // ----- Render helpers -----

  const getDiffBadge = (item: StockCountItem) => {
    const counted = item.counted_quantity ?? 0;
    const expected = item.expected_quantity ?? 0;
    const diff = counted - expected;
    if (diff > 0) {
      return { label: `+${diff}`, color: colors.success };
    } else if (diff < 0) {
      return { label: `${diff}`, color: colors.danger };
    }
    return { label: '0', color: colors.textSecondary };
  };

  // ----- Render: List View -----

  const renderListView = () => (
    <SafeAreaView
      style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Bestandszählungen</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* Start new count button */}
          <TouchableOpacity
            style={[
              styles.startButton,
              { backgroundColor: colors.primary, opacity: starting ? 0.7 : 1 },
            ]}
            onPress={startNewCount}
            disabled={starting}
          >
            {starting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.startButtonText}>Neue Zählung starten</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Empty state */}
          {counts.length === 0 && (
            <View style={styles.center}>
              <Ionicons name="clipboard-outline" size={48} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Keine Bestandszählungen vorhanden
              </Text>
            </View>
          )}

          {/* Count cards */}
          {counts.map(count => (
            <TouchableOpacity
              key={count.id}
              style={[styles.card, { backgroundColor: colors.card }]}
              onPress={() => openDetail(count)}
              onLongPress={() => confirmDelete(count)}
              activeOpacity={0.75}
            >
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                      {count.name}
                    </Text>
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor:
                            count.status === 'abgeschlossen' ? colors.success : colors.warning,
                        },
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {count.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Offen'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                    {formatDate(count.created_at)}
                  </Text>
                  <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                    {count.items?.length ?? 0} Artikel
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.border} style={{ marginLeft: 8 }} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );

  // ----- Render: Detail View -----

  const renderDetailView = () => (
    <SafeAreaView
      style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={goBackToList}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {selectedCount?.name ?? 'Bestandszählung'}
        </Text>
        <TouchableOpacity
          onPress={closeCount}
          disabled={isAbgeschlossen || closing}
          style={{ opacity: isAbgeschlossen || closing ? 0.4 : 1 }}
        >
          {closing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.headerAction, { color: colors.primary }]}>Abschließen</Text>
          )}
        </TouchableOpacity>
      </View>

      {detailLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={insets.top + 60}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Status info */}
            {isAbgeschlossen && (
              <View style={[styles.infoBox, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginRight: 6 }} />
                <Text style={[styles.infoBoxText, { color: colors.success }]}>
                  Diese Zählung wurde abgeschlossen und kann nicht mehr bearbeitet werden.
                </Text>
              </View>
            )}

            {/* Items */}
            {editItems.length === 0 && (
              <View style={styles.center}>
                <Ionicons name="cube-outline" size={48} color={colors.border} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Keine Artikel in dieser Zählung
                </Text>
              </View>
            )}

            {editItems.map(item => {
              const diff = getDiffBadge(item);
              return (
                <View
                  key={item.article_id}
                  style={[styles.itemRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={2}>
                    {item.article_name}
                  </Text>
                  <Text style={[styles.itemExpected, { color: colors.textSecondary }]}>
                    Erwartet: {item.expected_quantity}
                  </Text>
                  <View style={styles.itemRight}>
                    <TextInput
                      style={[
                        styles.quantityInput,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                        isAbgeschlossen && { opacity: 0.5 },
                      ]}
                      value={
                        item.counted_quantity === null || item.counted_quantity === undefined
                          ? ''
                          : String(item.counted_quantity)
                      }
                      onChangeText={val => updateItemQuantity(item.article_id, val)}
                      keyboardType="numeric"
                      editable={!isAbgeschlossen}
                      selectTextOnFocus
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                    />
                    <View style={[styles.diffBadge, { backgroundColor: diff.color + '22' }]}>
                      <Text style={[styles.diffBadgeText, { color: diff.color }]}>{diff.label}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Bottom actions */}
          {!isAbgeschlossen && (
            <View
              style={[
                styles.bottomBar,
                {
                  backgroundColor: colors.card,
                  borderTopColor: colors.border,
                  paddingBottom: insets.bottom + 12,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 },
                ]}
                onPress={saveCount}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Speichern</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );

  // ----- Root render -----

  return view === 'list' ? renderListView() : renderDetailView();
}

// ----- Styles -----

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerAction: {
    fontSize: 15,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 14,
    marginBottom: 16,
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
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
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  cardMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  infoBoxText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  itemRow: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    minWidth: 120,
  },
  itemExpected: {
    fontSize: 12,
    marginRight: 8,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityInput: {
    width: 64,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 15,
    textAlign: 'center',
  },
  diffBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 36,
    alignItems: 'center',
  },
  diffBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  bottomBar: {
    padding: 16,
    borderTopWidth: 1,
  },
  saveButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});
