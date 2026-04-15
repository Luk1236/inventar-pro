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
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';

interface BundleItem {
  article_id: string;
  article_name?: string;
  inventory_code?: string;
  quantity: number;
  is_optional: boolean;
  available_stock?: number;
}

interface Bundle {
  id: string;
  name: string;
  description?: string;
  bundle_code: string;
  category: string;
  items: BundleItem[];
  total_items: number;
  total_weight_kg: number;
  total_power_watt: number;
  rental_price_day: number;
  rental_price_week: number;
  rental_price_month: number;
  bundle_discount_percent: number;
  is_active: boolean;
  image_base64?: string;
}

interface Article {
  id: string;
  name: string;
  inventory_code: string;
  current_stock: number;
  rental_price?: number;
}

interface Event {
  id: string;
  event_name: string;
  event_number: string;
}

export default function BundlesPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  
  // Create Modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [bundleName, setBundleName] = useState('');
  const [bundleDescription, setBundleDescription] = useState('');
  const [bundleCategory, setBundleCategory] = useState('Standard');
  const [bundleDiscount, setBundleDiscount] = useState('0');
  const [selectedItems, setSelectedItems] = useState<BundleItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  // Book Modal
  const [bookModalVisible, setBookModalVisible] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [excludedItems, setExcludedItems] = useState<string[]>([]);
  
  // Add Item Modal
  const [addItemModalVisible, setAddItemModalVisible] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemOptional, setItemOptional] = useState(false);

  const categories = ['PA', 'Licht', 'Video', 'Rigging', 'Strom', 'Standard', 'Sonstige'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [bundlesData, articlesData, eventsData] = await Promise.all([
        apiService.get<Bundle[]>('/api/bundles?active_only=false', { showErrorAlert: false }),
        apiService.get<Article[]>('/api/articles', { showErrorAlert: false }),
        apiService.get<Event[]>('/api/events', { showErrorAlert: false }),
      ]);
      setBundles(bundlesData || []);
      setArticles(articlesData || []);
      setEvents(eventsData || []);
    } catch (error) {
      console.error('Error loading bundles:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAddItem = () => {
    if (!selectedArticleId) {
      Alert.alert('Fehler', 'Bitte Artikel wählen');
      return;
    }
    
    const article = articles.find(a => a.id === selectedArticleId);
    if (!article) return;
    
    // Check if already added
    if (selectedItems.some(i => i.article_id === selectedArticleId)) {
      Alert.alert('Info', 'Artikel bereits im Bundle');
      return;
    }
    
    setSelectedItems([...selectedItems, {
      article_id: selectedArticleId,
      article_name: article.name,
      inventory_code: article.inventory_code,
      quantity: parseInt(itemQuantity) || 1,
      is_optional: itemOptional,
      available_stock: article.current_stock
    }]);
    
    setAddItemModalVisible(false);
    setSelectedArticleId('');
    setItemQuantity('1');
    setItemOptional(false);
  };

  const removeItem = (articleId: string) => {
    setSelectedItems(selectedItems.filter(i => i.article_id !== articleId));
  };

  const handleCreateBundle = async () => {
    if (!bundleName || selectedItems.length === 0) {
      Alert.alert('Fehler', 'Name und mindestens ein Artikel erforderlich');
      return;
    }

    setSubmitting(true);
    try {
      await apiService.post('/api/bundles', {
        name: bundleName,
        description: bundleDescription || undefined,
        bundle_code: '',
        category: bundleCategory,
        items: selectedItems.map(i => ({
          article_id: i.article_id,
          quantity: i.quantity,
          is_optional: i.is_optional
        })),
        bundle_discount_percent: parseFloat(bundleDiscount) || 0,
      });
      
      Alert.alert('Erfolg', 'Bundle wurde erstellt');
      setCreateModalVisible(false);
      resetCreateForm();
      loadData();
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Bundle konnte nicht erstellt werden');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookBundle = async () => {
    if (!selectedBundle || !selectedEventId) {
      Alert.alert('Fehler', 'Bitte Event wählen');
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiService.post<any>(
        `/api/bundles/${selectedBundle.id}/book?event_id=${selectedEventId}`,
        { exclude_items: excludedItems }
      );
      
      Alert.alert(
        'Erfolg', 
        `${result.bookings?.length || 0} Artikel gebucht!\nGesamt: €${result.total_price?.toFixed(2) || '0.00'}`
      );
      setBookModalVisible(false);
      setSelectedBundle(null);
      setSelectedEventId('');
      setExcludedItems([]);
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Buchung fehlgeschlagen');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleExcludeItem = (articleId: string) => {
    if (excludedItems.includes(articleId)) {
      setExcludedItems(excludedItems.filter(id => id !== articleId));
    } else {
      setExcludedItems([...excludedItems, articleId]);
    }
  };

  const deleteBundle = async (bundleId: string) => {
    Alert.alert(
      'Bundle deaktivieren',
      'Möchten Sie dieses Bundle wirklich deaktivieren?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Deaktivieren',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.delete(`/api/bundles/${bundleId}`);
              loadData();
            } catch {
              Alert.alert('Fehler', 'Konnte nicht deaktiviert werden');
            }
          }
        }
      ]
    );
  };

  const resetCreateForm = () => {
    setBundleName('');
    setBundleDescription('');
    setBundleCategory('Standard');
    setBundleDiscount('0');
    setSelectedItems([]);
  };

  const getCategoryColor = (category: string) => {
    const colorMap: Record<string, string> = {
      'PA': '#FF3B30',
      'Licht': '#FFCC00',
      'Video': '#5856D6',
      'Rigging': '#8E8E93',
      'Strom': '#FF9500',
      'Standard': '#007AFF',
      'Sonstige': '#34C759'
    };
    return colorMap[category] || '#007AFF';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Lade Bundles...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>📦 Sets & Bundles</Text>
        <TouchableOpacity onPress={() => setCreateModalVisible(true)}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={[styles.statsRow, { backgroundColor: colors.card }]}>
        <View style={styles.stat}>
          <Text style={[styles.statNumber, { color: colors.primary }]}>{bundles.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Bundles</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statNumber, { color: '#34C759' }]}>
            {bundles.filter(b => b.is_active).length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Aktiv</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statNumber, { color: '#FF9500' }]}>
            {bundles.reduce((sum, b) => sum + b.total_items, 0)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Artikel gesamt</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        {bundles.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Keine Bundles</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Erstellen Sie Ihr erstes Bundle, um Artikel zu gruppieren
            </Text>
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: colors.primary }]}
              onPress={() => setCreateModalVisible(true)}
            >
              <Ionicons name="add" size={20} color="white" />
              <Text style={styles.emptyButtonText}>Neues Bundle</Text>
            </TouchableOpacity>
          </View>
        ) : (
          bundles.map(bundle => (
            <View key={bundle.id} style={[styles.bundleCard, { backgroundColor: colors.card }, !bundle.is_active && styles.inactiveCard]}>
              <View style={styles.bundleHeader}>
                <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(bundle.category) + '20' }]}>
                  <Text style={[styles.categoryText, { color: getCategoryColor(bundle.category) }]}>
                    {bundle.category}
                  </Text>
                </View>
                <Text style={[styles.bundleCode, { color: colors.textSecondary }]}>{bundle.bundle_code}</Text>
              </View>
              
              <Text style={[styles.bundleName, { color: colors.text }]}>{bundle.name}</Text>
              {bundle.description && (
                <Text style={[styles.bundleDesc, { color: colors.textSecondary }]}>{bundle.description}</Text>
              )}
              
              <View style={styles.bundleStats}>
                <View style={styles.bundleStat}>
                  <Ionicons name="cube-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.bundleStatText, { color: colors.textSecondary }]}>
                    {bundle.total_items} Artikel
                  </Text>
                </View>
                <View style={styles.bundleStat}>
                  <Ionicons name="scale-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.bundleStatText, { color: colors.textSecondary }]}>
                    {bundle.total_weight_kg} kg
                  </Text>
                </View>
                <View style={styles.bundleStat}>
                  <Ionicons name="flash-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.bundleStatText, { color: colors.textSecondary }]}>
                    {bundle.total_power_watt} W
                  </Text>
                </View>
              </View>
              
              <View style={styles.priceRow}>
                <View style={styles.priceItem}>
                  <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Tag</Text>
                  <Text style={[styles.priceValue, { color: colors.text }]}>{formatCurrency(bundle.rental_price_day)}</Text>
                </View>
                <View style={styles.priceItem}>
                  <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Woche</Text>
                  <Text style={[styles.priceValue, { color: colors.text }]}>{formatCurrency(bundle.rental_price_week)}</Text>
                </View>
                <View style={styles.priceItem}>
                  <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Monat</Text>
                  <Text style={[styles.priceValue, { color: colors.text }]}>{formatCurrency(bundle.rental_price_month)}</Text>
                </View>
              </View>
              
              {bundle.bundle_discount_percent > 0 && (
                <View style={styles.discountBadge}>
                  <Ionicons name="pricetag" size={14} color="#34C759" />
                  <Text style={styles.discountText}>{bundle.bundle_discount_percent}% Bundle-Rabatt</Text>
                </View>
              )}
              
              {/* Items Preview */}
              <View style={styles.itemsPreview}>
                <Text style={[styles.itemsTitle, { color: colors.text }]}>Enthaltene Artikel:</Text>
                {bundle.items.slice(0, 3).map((item, idx) => (
                  <Text key={idx} style={[styles.itemPreviewText, { color: colors.textSecondary }]}>
                    • {item.article_name} x{item.quantity} {item.is_optional && '(optional)'}
                  </Text>
                ))}
                {bundle.items.length > 3 && (
                  <Text style={[styles.itemPreviewText, { color: colors.primary }]}>
                    + {bundle.items.length - 3} weitere...
                  </Text>
                )}
              </View>
              
              <View style={styles.bundleActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#34C75920' }]}
                  onPress={() => { setSelectedBundle(bundle); setBookModalVisible(true); }}
                >
                  <Ionicons name="calendar-outline" size={18} color="#34C759" />
                  <Text style={[styles.actionBtnText, { color: '#34C759' }]}>Buchen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#FF3B3020' }]}
                  onPress={() => deleteBundle(bundle.id)}
                >
                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Create Bundle Modal */}
      <Modal visible={createModalVisible} animationType="slide" transparent onRequestClose={() => setCreateModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Neues Bundle erstellen</Text>
              <TouchableOpacity onPress={() => { setCreateModalVisible(false); resetCreateForm(); }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Name *</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={bundleName}
                onChangeText={setBundleName}
                placeholder="z.B. PA-Set Basic"
                placeholderTextColor={colors.textSecondary}
              />
              
              <Text style={[styles.inputLabel, { color: colors.text }]}>Beschreibung</Text>
              <TextInput
                style={[styles.textInput, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={bundleDescription}
                onChangeText={setBundleDescription}
                placeholder="Optionale Beschreibung..."
                placeholderTextColor={colors.textSecondary}
                multiline
              />
              
              <Text style={[styles.inputLabel, { color: colors.text }]}>Kategorie</Text>
              <View style={[styles.pickerContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Picker selectedValue={bundleCategory} onValueChange={setBundleCategory} style={{ color: colors.text }}>
                  {categories.map(cat => <Picker.Item key={cat} label={cat} value={cat} />)}
                </Picker>
              </View>
              
              <Text style={[styles.inputLabel, { color: colors.text }]}>Bundle-Rabatt (%)</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={bundleDiscount}
                onChangeText={setBundleDiscount}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />
              
              <View style={styles.itemsSection}>
                <View style={styles.itemsSectionHeader}>
                  <Text style={[styles.inputLabel, { color: colors.text, marginTop: 0 }]}>Artikel ({selectedItems.length})</Text>
                  <TouchableOpacity style={styles.addItemBtn} onPress={() => setAddItemModalVisible(true)}>
                    <Ionicons name="add" size={20} color={colors.primary} />
                    <Text style={{ color: colors.primary }}>Hinzufügen</Text>
                  </TouchableOpacity>
                </View>
                
                {selectedItems.map((item, idx) => (
                  <View key={idx} style={[styles.selectedItem, { backgroundColor: colors.background }]}>
                    <View style={styles.selectedItemInfo}>
                      <Text style={[styles.selectedItemName, { color: colors.text }]}>{item.article_name}</Text>
                      <Text style={[styles.selectedItemCode, { color: colors.textSecondary }]}>
                        {item.inventory_code} • x{item.quantity} {item.is_optional && '(optional)'}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => removeItem(item.article_id)}>
                      <Ionicons name="close-circle" size={24} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              
              <TouchableOpacity
                style={[styles.submitButton, submitting && { opacity: 0.6 }]}
                onPress={handleCreateBundle}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color="white" /> : (
                  <>
                    <Ionicons name="checkmark" size={20} color="white" />
                    <Text style={styles.submitButtonText}>Bundle erstellen</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Item Modal */}
      <Modal visible={addItemModalVisible} animationType="fade" transparent onRequestClose={() => setAddItemModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.smallModal, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 16 }]}>Artikel hinzufügen</Text>
            
            <View style={[styles.pickerContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Picker selectedValue={selectedArticleId} onValueChange={setSelectedArticleId} style={{ color: colors.text }}>
                <Picker.Item label="Artikel wählen..." value="" />
                {articles.map(a => <Picker.Item key={a.id} label={`${a.name} (${a.current_stock}x)`} value={a.id} />)}
              </Picker>
            </View>
            
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, marginTop: 12 }]}
              value={itemQuantity}
              onChangeText={setItemQuantity}
              placeholder="Menge"
              keyboardType="number-pad"
            />
            
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setItemOptional(!itemOptional)}>
              <Ionicons name={itemOptional ? 'checkbox' : 'square-outline'} size={24} color={colors.primary} />
              <Text style={[{ color: colors.text, marginLeft: 8 }]}>Optional (kann ausgelassen werden)</Text>
            </TouchableOpacity>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.background }]} onPress={() => setAddItemModalVisible(false)}>
                <Text style={{ color: colors.text }}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={handleAddItem}>
                <Text style={{ color: 'white' }}>Hinzufügen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Book Bundle Modal */}
      <Modal visible={bookModalVisible} animationType="slide" transparent onRequestClose={() => setBookModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Bundle buchen</Text>
              <TouchableOpacity onPress={() => { setBookModalVisible(false); setSelectedBundle(null); setExcludedItems([]); }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            {selectedBundle && (
              <ScrollView style={styles.modalBody}>
                <Text style={[styles.bundleBookName, { color: colors.text }]}>{selectedBundle.name}</Text>
                <Text style={[styles.bundleBookCode, { color: colors.textSecondary }]}>{selectedBundle.bundle_code}</Text>
                
                <Text style={[styles.inputLabel, { color: colors.text }]}>Event auswählen *</Text>
                <View style={[styles.pickerContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Picker selectedValue={selectedEventId} onValueChange={setSelectedEventId} style={{ color: colors.text }}>
                    <Picker.Item label="Event wählen..." value="" />
                    {events.map(e => <Picker.Item key={e.id} label={`${e.event_name} (${e.event_number})`} value={e.id} />)}
                  </Picker>
                </View>
                
                <Text style={[styles.inputLabel, { color: colors.text }]}>Artikel auswählen:</Text>
                {selectedBundle.items.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.bookItem, { backgroundColor: colors.background }, excludedItems.includes(item.article_id) && styles.excludedItem]}
                    onPress={() => item.is_optional && toggleExcludeItem(item.article_id)}
                  >
                    <Ionicons
                      name={excludedItems.includes(item.article_id) ? 'square-outline' : 'checkbox'}
                      size={24}
                      color={excludedItems.includes(item.article_id) ? colors.textSecondary : '#34C759'}
                    />
                    <View style={styles.bookItemInfo}>
                      <Text style={[styles.bookItemName, { color: colors.text }]}>{item.article_name}</Text>
                      <Text style={[styles.bookItemQty, { color: colors.textSecondary }]}>
                        x{item.quantity} {item.is_optional && '(optional)'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
                
                <View style={[styles.bookSummary, { backgroundColor: colors.background }]}>
                  <Text style={[styles.bookSummaryText, { color: colors.text }]}>
                    Gesamtpreis (Tag): {formatCurrency(selectedBundle.rental_price_day * (1 - selectedBundle.bundle_discount_percent / 100))}
                  </Text>
                  {selectedBundle.bundle_discount_percent > 0 && (
                    <Text style={styles.discountInfo}>inkl. {selectedBundle.bundle_discount_percent}% Bundle-Rabatt</Text>
                  )}
                </View>
                
                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: '#34C759' }, submitting && { opacity: 0.6 }]}
                  onPress={handleBookBundle}
                  disabled={submitting}
                >
                  {submitting ? <ActivityIndicator color="white" /> : (
                    <>
                      <Ionicons name="checkmark" size={20} color="white" />
                      <Text style={styles.submitButtonText}>Jetzt buchen</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16 },
  stat: { alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: 'bold' },
  statLabel: { fontSize: 12, marginTop: 4 },
  content: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptyText: { fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
  emptyButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, marginTop: 20, gap: 8 },
  emptyButtonText: { color: 'white', fontSize: 14, fontWeight: '600' },
  bundleCard: { borderRadius: 12, padding: 16, marginBottom: 16 },
  inactiveCard: { opacity: 0.5 },
  bundleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  categoryText: { fontSize: 12, fontWeight: '600' },
  bundleCode: { fontSize: 12 },
  bundleName: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  bundleDesc: { fontSize: 13, marginBottom: 12 },
  bundleStats: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  bundleStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bundleStatText: { fontSize: 12 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  priceItem: { alignItems: 'center' },
  priceLabel: { fontSize: 11 },
  priceValue: { fontSize: 14, fontWeight: '600' },
  discountBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#34C75920', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 12 },
  discountText: { color: '#34C759', fontSize: 12, fontWeight: '600' },
  itemsPreview: { marginBottom: 12 },
  itemsTitle: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  itemPreviewText: { fontSize: 12, marginLeft: 8 },
  bundleActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6 },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  smallModal: { margin: 20, borderRadius: 16, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  modalBody: { padding: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  textInput: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 16 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  pickerContainer: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  itemsSection: { marginTop: 16 },
  itemsSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selectedItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginTop: 8 },
  selectedItemInfo: { flex: 1 },
  selectedItemName: { fontSize: 14, fontWeight: '500' },
  selectedItemCode: { fontSize: 12, marginTop: 2 },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#007AFF', paddingVertical: 14, borderRadius: 10, marginTop: 24, gap: 8 },
  submitButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  bundleBookName: { fontSize: 20, fontWeight: 'bold' },
  bundleBookCode: { fontSize: 14, marginBottom: 16 },
  bookItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginTop: 8, gap: 12 },
  excludedItem: { opacity: 0.5 },
  bookItemInfo: { flex: 1 },
  bookItemName: { fontSize: 14, fontWeight: '500' },
  bookItemQty: { fontSize: 12, marginTop: 2 },
  bookSummary: { padding: 16, borderRadius: 10, marginTop: 16 },
  bookSummaryText: { fontSize: 16, fontWeight: '600' },
  discountInfo: { fontSize: 12, color: '#34C759', marginTop: 4 },
});
