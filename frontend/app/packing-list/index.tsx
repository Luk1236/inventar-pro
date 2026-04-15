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
  Modal,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { printScreen } from '../../utils/printUtils';
import SignaturePad from '../../components/SignaturePad';

interface PackingItem {
  id: string;
  article_id: string;
  article_name: string;
  inventory_code: string;
  quantity: number;
  zone_name: string;
  location_name: string;
  weight_kg: number;
  // Check-Out
  checked_out: boolean;
  checked_out_by?: string;
  checked_out_at?: string;
  // Check-In
  checked_in: boolean;
  checked_in_by?: string;
  checked_in_at?: string;
  checkin_condition?: string;
  checkin_notes?: string;
}

interface PackingStats {
  total: number;
  checked_out: number;
  checked_in: number;
  missing: number;
  defect: number;
  dirty: number;
  pending_checkout: number;
  pending_checkin: number;
}

interface Event {
  id: string;
  event_name: string;
  event_number: string;
  start_date: string;
  end_date: string;
  status: string;
}

type ViewMode = 'checkout' | 'checkin';
type CheckinCondition = 'OK' | 'DIRTY' | 'DEFECT' | 'MISSING';

export default function PackingListPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [items, setItems] = useState<PackingItem[]>([]);
  const [stats, setStats] = useState<PackingStats | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('checkout');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Check-in Modal
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [checkinItem, setCheckinItem] = useState<PackingItem | null>(null);
  const [checkinCondition, setCheckinCondition] = useState<CheckinCondition>('OK');
  const [checkinNotes, setCheckinNotes] = useState('');

  // Signature sign-off
  const [signPadVisible, setSignPadVisible] = useState(false);
  const [signedByName, setSignedByName] = useState('');

  const savePackingListSignature = async (base64Svg: string) => {
    if (!selectedEventId) return;
    try {
      await apiService.post(`/api/events/${selectedEventId}/packing-list/sign`, {
        signature: base64Svg,
        signed_by: signedByName,
      });
      Alert.alert('Erfolg', 'Packliste wurde abgezeichnet');
    } catch {
      Alert.alert('Fehler', 'Abzeichnen fehlgeschlagen');
    }
  };

  const loadEvents = useCallback(async () => {
    try {
      const data = await apiService.get<Event[]>('/api/events', { showErrorAlert: false });
      // Filter for active/upcoming events
      const activeEvents = data.filter(e => e.status !== 'cancelled');
      setEvents(activeEvents);
      if (activeEvents.length > 0 && !selectedEventId) {
        setSelectedEventId(activeEvents[0].id);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedEventId]);

  const loadPackingList = useCallback(async () => {
    if (!selectedEventId) return;

    try {
      const data = await apiService.get<{ items: PackingItem[], stats: PackingStats }>(
        `/api/events/${selectedEventId}/packing-list-items`,
        { showErrorAlert: false }
      );
      setItems(data.items || []);
      setStats(data.stats || null);
    } catch (error) {
      console.error('Error loading packing list:', error);
      setItems([]);
      setStats(null);
    } finally {
      setRefreshing(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (selectedEventId) {
      loadPackingList();
    }
  }, [selectedEventId, loadPackingList]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadPackingList();
  };

  // Check-Out Functions
  const toggleSelectItem = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleCheckoutSelected = async () => {
    if (selectedItems.size === 0) {
      Alert.alert('Hinweis', 'Bitte wählen Sie mindestens einen Artikel aus');
      return;
    }

    Alert.alert(
      '📦 Check-Out bestätigen',
      `${selectedItems.size} Artikel auschecken?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Check-Out',
          onPress: async () => {
            try {
              await apiService.post('/api/packing-list/checkout', {
                item_ids: Array.from(selectedItems),
                condition: 'OK'
              });
              Alert.alert('✅ Erfolg', `${selectedItems.size} Artikel ausgecheckt`);
              setSelectedItems(new Set());
              loadPackingList();
            } catch {
              Alert.alert('Fehler', 'Check-Out fehlgeschlagen');
            }
          }
        }
      ]
    );
  };

  const handleCheckoutAll = async () => {
    const pending = items.filter(i => !i.checked_out).length;
    if (pending === 0) {
      Alert.alert('Hinweis', 'Alle Artikel sind bereits ausgecheckt');
      return;
    }

    Alert.alert(
      '📦 Alle auschecken',
      `${pending} Artikel werden ausgecheckt. Fortfahren?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Alle Check-Out',
          onPress: async () => {
            try {
              await apiService.post(`/api/packing-list/checkout-all/${selectedEventId}`, null);
              Alert.alert('✅ Erfolg', 'Alle Artikel ausgecheckt');
              loadPackingList();
            } catch {
              Alert.alert('Fehler', 'Check-Out fehlgeschlagen');
            }
          }
        }
      ]
    );
  };

  // Check-In Functions
  const openCheckinModal = (item: PackingItem) => {
    setCheckinItem(item);
    setCheckinCondition('OK');
    setCheckinNotes('');
    setShowCheckinModal(true);
  };

  const handleCheckin = async () => {
    if (!checkinItem) return;

    try {
      await apiService.post('/api/packing-list/checkin', {
        item_id: checkinItem.id,
        condition: checkinCondition,
        notes: checkinNotes,
        photos: []
      });

      let message = 'Artikel eingecheckt';
      if (checkinCondition === 'DEFECT') {
        message = 'Artikel als DEFEKT markiert. Wartungsauftrag wurde erstellt.';
      } else if (checkinCondition === 'DIRTY') {
        message = 'Artikel als VERSCHMUTZT markiert.';
      } else if (checkinCondition === 'MISSING') {
        message = 'Artikel als FEHLEND markiert!';
      }

      Alert.alert('✅ Erfolg', message);
      setShowCheckinModal(false);
      loadPackingList();
    } catch {
      Alert.alert('Fehler', 'Check-In fehlgeschlagen');
    }
  };

  const handleCheckinAllOK = async () => {
    const pending = items.filter(i => i.checked_out && !i.checked_in).length;
    if (pending === 0) {
      Alert.alert('Hinweis', 'Keine Artikel zum Einchecken vorhanden');
      return;
    }

    Alert.alert(
      '✅ Alle als OK einchecken',
      `${pending} Artikel als OK einchecken?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Alle OK',
          onPress: async () => {
            try {
              await apiService.post(`/api/packing-list/checkin-all/${selectedEventId}?condition=OK`, null);
              Alert.alert('✅ Erfolg', 'Alle Artikel eingecheckt');
              loadPackingList();
            } catch {
              Alert.alert('Fehler', 'Check-In fehlgeschlagen');
            }
          }
        }
      ]
    );
  };

  // Group items by zone
  const groupedItems = items.reduce((acc, item) => {
    const zone = item.zone_name || 'Kein Lagerort';
    if (!acc[zone]) {
      acc[zone] = [];
    }
    acc[zone].push(item);
    return acc;
  }, {} as Record<string, PackingItem[]>);

  const getConditionColor = (condition?: string) => {
    switch (condition) {
      case 'OK': return '#34C759';
      case 'DIRTY': return '#FF9500';
      case 'DEFECT': return '#FF3B30';
      case 'MISSING': return '#8B0000';
      default: return colors.textSecondary;
    }
  };

  const getConditionIcon = (condition?: string) => {
    switch (condition) {
      case 'OK': return 'checkmark-circle';
      case 'DIRTY': return 'water';
      case 'DEFECT': return 'warning';
      case 'MISSING': return 'alert-circle';
      default: return 'help-circle';
    }
  };

  const getConditionText = (condition?: string) => {
    switch (condition) {
      case 'OK': return 'OK';
      case 'DIRTY': return 'Verschmutzt';
      case 'DEFECT': return 'Defekt';
      case 'MISSING': return 'Fehlend';
      default: return 'Ausstehend';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Lade Daten...</Text>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>📦 Lager-Logistik</Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <TouchableOpacity onPress={printScreen}>
            <Ionicons name="print-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRefresh}>
            <Ionicons name="refresh" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Event Selector */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>🎪 Event auswählen</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.eventChips}>
              {events.map(event => (
                <TouchableOpacity
                  key={event.id}
                  style={[
                    styles.eventChip,
                    { backgroundColor: colors.background },
                    selectedEventId === event.id && { backgroundColor: colors.primary }
                  ]}
                  onPress={() => setSelectedEventId(event.id)}
                >
                  <Text style={[
                    styles.eventChipText,
                    { color: selectedEventId === event.id ? 'white' : colors.text }
                  ]}>
                    {event.event_name}
                  </Text>
                  <Text style={[
                    styles.eventChipNumber,
                    { color: selectedEventId === event.id ? 'rgba(255,255,255,0.8)' : colors.textSecondary }
                  ]}>
                    {event.event_number}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Mode Selector */}
        <View style={[styles.modeSelector, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              viewMode === 'checkout' && { backgroundColor: colors.primary }
            ]}
            onPress={() => setViewMode('checkout')}
          >
            <Ionicons 
              name="log-out" 
              size={20} 
              color={viewMode === 'checkout' ? 'white' : colors.text} 
            />
            <Text style={[
              styles.modeButtonText,
              { color: viewMode === 'checkout' ? 'white' : colors.text }
            ]}>
              Check-Out
            </Text>
            {stats && stats.pending_checkout > 0 && (
              <View style={styles.modeBadge}>
                <Text style={styles.modeBadgeText}>{stats.pending_checkout}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.modeButton,
              viewMode === 'checkin' && { backgroundColor: '#34C759' }
            ]}
            onPress={() => setViewMode('checkin')}
          >
            <Ionicons 
              name="log-in" 
              size={20} 
              color={viewMode === 'checkin' ? 'white' : colors.text} 
            />
            <Text style={[
              styles.modeButtonText,
              { color: viewMode === 'checkin' ? 'white' : colors.text }
            ]}>
              Check-In
            </Text>
            {stats && stats.pending_checkin > 0 && (
              <View style={[styles.modeBadge, { backgroundColor: '#FF9500' }]}>
                <Text style={styles.modeBadgeText}>{stats.pending_checkin}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Stats */}
        {stats && (
          <View style={[styles.statsRow, { backgroundColor: colors.card }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{stats.total}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Gesamt</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#007AFF' }]}>{stats.checked_out}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Aus</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#34C759' }]}>{stats.checked_in}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Ein</Text>
            </View>
            {stats.missing > 0 && (
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#FF3B30' }]}>{stats.missing}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Fehlend</Text>
              </View>
            )}
            {stats.defect > 0 && (
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#FF9500' }]}>{stats.defect}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Defekt</Text>
              </View>
            )}
          </View>
        )}

        {/* Warning Banner for Missing Items */}
        {stats && stats.missing > 0 && (
          <View style={[styles.warningBanner, { backgroundColor: '#FFF3CD' }]}>
            <Ionicons name="warning" size={24} color="#856404" />
            <Text style={styles.warningText}>
              ⚠️ {stats.missing} Artikel fehlen! Bitte überprüfen.
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={[styles.actionButtons, { backgroundColor: colors.card }]}>
          {viewMode === 'checkout' ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={handleCheckoutSelected}
              >
                <Ionicons name="checkbox" size={20} color="white" />
                <Text style={styles.actionButtonText}>
                  Ausgewählte ({selectedItems.size})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#34C759' }]}
                onPress={handleCheckoutAll}
              >
                <Ionicons name="checkmark-done" size={20} color="white" />
                <Text style={styles.actionButtonText}>Alle Check-Out</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#34C759', flex: 1 }]}
              onPress={handleCheckinAllOK}
            >
              <Ionicons name="checkmark-done-circle" size={20} color="white" />
              <Text style={styles.actionButtonText}>Alle als OK einchecken</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Items grouped by zone */}
        {Object.entries(groupedItems)
          .sort(([a], [b]) => a.localeCompare(b, 'de'))
          .map(([zone, zoneItems]) => (
          <View key={zone} style={styles.zoneSection}>
            <View style={[styles.zoneHeader, { backgroundColor: colors.primary }]}>
              <Ionicons name="location" size={18} color="white" />
              <Text style={styles.zoneTitle}>{zone}</Text>
              <Text style={styles.zoneCount}>{zoneItems.length} Artikel</Text>
            </View>
            
            {zoneItems.map(item => {
              const isCheckoutMode = viewMode === 'checkout';
              const showInThisMode = isCheckoutMode 
                ? !item.checked_out 
                : (item.checked_out && !item.checked_in);
              
              if (!showInThisMode && viewMode !== 'checkout') {
                // In checkin mode, also show already checked in items
                if (!item.checked_out) return null;
              }
              
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.packingItem,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    item.checked_out && !item.checked_in && { borderLeftColor: '#FF9500', borderLeftWidth: 4 },
                    item.checked_in && { borderLeftColor: getConditionColor(item.checkin_condition), borderLeftWidth: 4 },
                    selectedItems.has(item.id) && styles.selectedItem
                  ]}
                  onPress={() => {
                    if (viewMode === 'checkout' && !item.checked_out) {
                      toggleSelectItem(item.id);
                    } else if (viewMode === 'checkin' && item.checked_out && !item.checked_in) {
                      openCheckinModal(item);
                    }
                  }}
                >
                  {/* Checkbox for checkout mode */}
                  {viewMode === 'checkout' && !item.checked_out && (
                    <View style={styles.itemCheckbox}>
                      <Ionicons
                        name={selectedItems.has(item.id) ? 'checkbox' : 'square-outline'}
                        size={24}
                        color={selectedItems.has(item.id) ? colors.primary : colors.textSecondary}
                      />
                    </View>
                  )}
                  
                  {/* Status indicator */}
                  {item.checked_out && (
                    <View style={styles.itemCheckbox}>
                      <Ionicons
                        name={item.checked_in ? getConditionIcon(item.checkin_condition) : 'time'}
                        size={24}
                        color={item.checked_in ? getConditionColor(item.checkin_condition) : '#FF9500'}
                      />
                    </View>
                  )}
                  
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemName, { color: colors.text }]}>{item.article_name}</Text>
                    <View style={styles.itemMeta}>
                      <Text style={[styles.itemCode, { color: colors.primary }]}>{item.inventory_code}</Text>
                      <Text style={[styles.itemLocation, { color: colors.textSecondary }]}>
                        📍 {item.location_name || zone}
                      </Text>
                    </View>
                    {item.checked_in && item.checkin_condition !== 'OK' && (
                      <View style={[styles.conditionBadge, { backgroundColor: getConditionColor(item.checkin_condition) }]}>
                        <Text style={styles.conditionBadgeText}>
                          {getConditionText(item.checkin_condition)}
                        </Text>
                      </View>
                    )}
                    {item.checkin_notes && (
                      <Text style={[styles.itemNotes, { color: colors.textSecondary }]}>
                        💬 {item.checkin_notes}
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.itemQuantity}>
                    <Text style={[styles.quantityText, { color: colors.text }]}>{item.quantity}x</Text>
                    {item.weight_kg > 0 && (
                      <Text style={[styles.weightText, { color: colors.textSecondary }]}>
                        {item.weight_kg}kg
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {items.length === 0 && selectedEventId && (
          <View style={styles.emptyState}>
            <Ionicons name="clipboard-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.text }]}>Keine Artikel für dieses Event</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Buchen Sie zuerst Artikel für das Event
            </Text>
          </View>
        )}

        {/* Sign-Off Section */}
        {selectedEventId && items.length > 0 && (
          <View style={{ marginHorizontal: 16, marginBottom: 8, padding: 16, borderRadius: 12, backgroundColor: '#34C75910', borderWidth: 1, borderColor: '#34C75940' }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#34C759', marginBottom: 4 }}>Packliste abzeichnen</Text>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
              Bestätigen Sie mit Ihrer Unterschrift, dass alle Artikel korrekt erfasst wurden.
            </Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#34C75940', borderRadius: 8, padding: 10, fontSize: 13, color: '#333', backgroundColor: 'white', marginBottom: 10 }}
              value={signedByName}
              onChangeText={setSignedByName}
              placeholder="Name des Unterzeichners"
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#34C759', paddingVertical: 12, borderRadius: 8 }}
              onPress={() => setSignPadVisible(true)}
            >
              <Ionicons name="create-outline" size={18} color="white" />
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>Jetzt unterschreiben</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Packing List Signature */}
      <SignaturePad
        visible={signPadVisible}
        title="Packliste abzeichnen"
        description="Bitte unterschreiben Sie zur Bestätigung der Packliste"
        onSave={savePackingListSignature}
        onClose={() => setSignPadVisible(false)}
      />

      {/* Check-In Modal */}
      <Modal visible={showCheckinModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>📥 Artikel einchecken</Text>
              <TouchableOpacity onPress={() => setShowCheckinModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {checkinItem && (
              <View style={styles.modalBody}>
                <Text style={[styles.checkinItemName, { color: colors.text }]}>
                  {checkinItem.article_name}
                </Text>
                <Text style={[styles.checkinItemCode, { color: colors.primary }]}>
                  {checkinItem.inventory_code} • {checkinItem.quantity}x
                </Text>

                <Text style={[styles.conditionLabel, { color: colors.text }]}>Zustand:</Text>
                
                <View style={styles.conditionButtons}>
                  {(['OK', 'DIRTY', 'DEFECT', 'MISSING'] as CheckinCondition[]).map(condition => (
                    <TouchableOpacity
                      key={condition}
                      style={[
                        styles.conditionButton,
                        { borderColor: getConditionColor(condition) },
                        checkinCondition === condition && { backgroundColor: getConditionColor(condition) }
                      ]}
                      onPress={() => setCheckinCondition(condition)}
                    >
                      <Ionicons
                        name={getConditionIcon(condition) as any}
                        size={24}
                        color={checkinCondition === condition ? 'white' : getConditionColor(condition)}
                      />
                      <Text style={[
                        styles.conditionButtonText,
                        { color: checkinCondition === condition ? 'white' : getConditionColor(condition) }
                      ]}>
                        {getConditionText(condition)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {checkinCondition !== 'OK' && (
                  <>
                    <Text style={[styles.notesLabel, { color: colors.text }]}>Notizen:</Text>
                    <TextInput
                      style={[styles.notesInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                      placeholder="Beschreiben Sie das Problem..."
                      placeholderTextColor={colors.textSecondary}
                      value={checkinNotes}
                      onChangeText={setCheckinNotes}
                      multiline
                      numberOfLines={3}
                    />
                  </>
                )}

                <TouchableOpacity
                  style={[styles.checkinButton, { backgroundColor: getConditionColor(checkinCondition) }]}
                  onPress={handleCheckin}
                >
                  <Ionicons name="checkmark-circle" size={20} color="white" />
                  <Text style={styles.checkinButtonText}>
                    {checkinCondition === 'OK' ? 'Als OK einchecken' : `Als ${getConditionText(checkinCondition)} markieren`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  section: { margin: 16, marginBottom: 8, padding: 16, borderRadius: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  eventChips: { flexDirection: 'row', gap: 8 },
  eventChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  eventChipText: { fontSize: 14, fontWeight: '600' },
  eventChipNumber: { fontSize: 11, marginTop: 2 },
  modeSelector: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 8, gap: 8 },
  modeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8, gap: 8 },
  modeButtonText: { fontSize: 14, fontWeight: '600' },
  modeBadge: { backgroundColor: '#FF3B30', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  modeBadgeText: { color: 'white', fontSize: 11, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, padding: 16, borderRadius: 12, justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold' },
  statLabel: { fontSize: 11, marginTop: 2 },
  warningBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 8, gap: 12 },
  warningText: { flex: 1, color: '#856404', fontWeight: '600' },
  actionButtons: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, padding: 12, borderRadius: 12, gap: 8 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8, gap: 6 },
  actionButtonText: { color: 'white', fontSize: 13, fontWeight: '600' },
  zoneSection: { marginHorizontal: 16, marginBottom: 16 },
  zoneHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopLeftRadius: 12, borderTopRightRadius: 12, gap: 8 },
  zoneTitle: { flex: 1, color: 'white', fontSize: 14, fontWeight: '600' },
  zoneCount: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  packingItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderTopWidth: 0 },
  selectedItem: { backgroundColor: 'rgba(0,122,255,0.1)' },
  itemCheckbox: { marginRight: 12 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600' },
  itemMeta: { flexDirection: 'row', gap: 12, marginTop: 4 },
  itemCode: { fontSize: 11 },
  itemLocation: { fontSize: 11 },
  itemNotes: { fontSize: 11, fontStyle: 'italic', marginTop: 4 },
  itemQuantity: { alignItems: 'flex-end' },
  quantityText: { fontSize: 16, fontWeight: 'bold' },
  weightText: { fontSize: 11, marginTop: 2 },
  conditionBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 6 },
  conditionBadgeText: { color: 'white', fontSize: 11, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  emptySubtext: { fontSize: 12, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  modalBody: { padding: 16 },
  checkinItemName: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  checkinItemCode: { fontSize: 14, marginBottom: 20 },
  conditionLabel: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  conditionButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  conditionButton: { flex: 1, minWidth: '45%', alignItems: 'center', paddingVertical: 16, borderRadius: 12, borderWidth: 2, gap: 8 },
  conditionButtonText: { fontSize: 12, fontWeight: '600' },
  notesLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  notesInput: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14, height: 80, textAlignVertical: 'top', marginBottom: 16 },
  checkinButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 8, gap: 8 },
  checkinButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
