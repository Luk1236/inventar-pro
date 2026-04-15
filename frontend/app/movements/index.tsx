import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Article {
  id: string;
  name: string;
  inventory_code: string;
  current_stock: number;
  base_unit: string;
}

interface Movement {
  id: string;
  article_id: string;
  movement_type: string;
  quantity: number;
  reason?: string;
  created_at: string;
}

interface QuickBooking {
  article_id: string;
  movement_type: 'IN' | 'OUT';
  quantity: string;
  reason: string;
}

export default function MovementsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<Article[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [showQuickBooking, setShowQuickBooking] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [bookingInProgress, setBookingInProgress] = useState(false);

  const [quickBooking, setQuickBooking] = useState<QuickBooking>({
    article_id: '',
    movement_type: 'IN',
    quantity: '',
    reason: '',
  });

  useEffect(() => {
    loadData();
  }, []);
  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    try {
      const [articlesData, movementsData] = await Promise.all([
        apiService.get<Article[]>('/api/articles', { showErrorAlert: false }),
        apiService.get<Movement[]>('/api/movements', { showErrorAlert: false }),
      ]);

      setArticles(articlesData);
      setMovements(movementsData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Fehler', 'Netzwerkfehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const openQuickBooking = (article: Article) => {
    setSelectedArticle(article);
    setQuickBooking({
      article_id: article.id,
      movement_type: 'IN',
      quantity: '',
      reason: '',
    });
    setShowQuickBooking(true);
  };

  const executeQuickBooking = async () => {
    if (!selectedArticle || !quickBooking.quantity || isNaN(Number(quickBooking.quantity))) {
      Alert.alert('Fehler', 'Bitte geben Sie eine gültige Menge ein');
      return;
    }

    if (quickBooking.movement_type === 'OUT' && 
        Number(quickBooking.quantity) > selectedArticle.current_stock) {
      Alert.alert('Fehler', 'Nicht genügend Bestand verfügbar');
      return;
    }

    setBookingInProgress(true);

    try {
      const movementData = {
        article_id: quickBooking.article_id,
        movement_type: quickBooking.movement_type,
        quantity: Number(quickBooking.quantity),
        reason: quickBooking.reason || `${quickBooking.movement_type === 'IN' ? 'Eingang' : 'Ausgang'} - Schnellbuchung`,
      };

      await apiService.post('/api/movements', movementData);
      
      Alert.alert(
        'Erfolgreich',
        `${quickBooking.movement_type === 'IN' ? 'Eingang' : 'Ausgang'} wurde gebucht`,
        [
          { text: 'OK', onPress: () => {
            setShowQuickBooking(false);
            loadData(); // Reload data to update stock
          }}
        ]
      );
    } catch (error: any) {
      console.error('Error creating movement:', error);
      Alert.alert('Fehler', error.message || 'Buchung konnte nicht durchgeführt werden');
    } finally {
      setBookingInProgress(false);
    }
  };

  const getFilteredArticles = () => {
    if (!searchTerm) return articles;
    return articles.filter(article =>
      article.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.inventory_code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'IN': return 'arrow-down-circle';
      case 'OUT': return 'arrow-up-circle';
      case 'TRANSFER': return 'swap-horizontal';
      default: return 'help-circle';
    }
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'IN': return '#34C759';
      case 'OUT': return '#FF3B30';
      case 'TRANSFER': return '#007AFF';
      default: return '#666';
    }
  };

  const getMovementTypeText = (type: string) => {
    switch (type) {
      case 'IN': return 'Eingang';
      case 'OUT': return 'Ausgang';
      case 'TRANSFER': return 'Transfer';
      default: return type;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getArticleName = (articleId: string) => {
    const article = articles.find(a => a.id === articleId);
    return article?.name || 'Unbekannter Artikel';
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Lade Bewegungen...</Text>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Lagerbewegungen</Text>
        <TouchableOpacity onPress={() => router.push('/movements/create')}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={[styles.quickActionsContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.quickActionsTitle, { color: colors.text }]}>Schnellbuchung</Text>
        
        <View style={[styles.searchContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Artikel für Buchung suchen..."
            placeholderTextColor={colors.textSecondary}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {/* Articles for Quick Booking */}
        {searchTerm.length > 0 && (
          <View style={styles.articlesSection}>
            <Text style={styles.sectionTitle}>
              {getFilteredArticles().length} Artikel gefunden
            </Text>
            
            {getFilteredArticles().map(article => (
              <TouchableOpacity
                key={article.id}
                style={styles.articleItem}
                onPress={() => openQuickBooking(article)}
              >
                <View style={styles.articleInfo}>
                  <Text style={styles.articleName}>{article.name}</Text>
                  <Text style={styles.articleCode}>Code: {article.inventory_code}</Text>
                  <Text style={styles.articleStock}>
                    Bestand: {article.current_stock} {article.base_unit}
                  </Text>
                </View>
                
                <View style={styles.quickBookingButtons}>
                  <TouchableOpacity
                    style={[styles.quickButton, styles.inButton]}
                    onPress={(e) => {
                      e.stopPropagation();
                      setQuickBooking(prev => ({ ...prev, movement_type: 'IN' }));
                      openQuickBooking(article);
                    }}
                  >
                    <Ionicons name="add" size={16} color="white" />
                    <Text style={styles.quickButtonText}>Ein</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.quickButton, styles.outButton]}
                    onPress={(e) => {
                      e.stopPropagation();
                      setQuickBooking(prev => ({ ...prev, movement_type: 'OUT' }));
                      openQuickBooking(article);
                    }}
                  >
                    <Ionicons name="remove" size={16} color="white" />
                    <Text style={styles.quickButtonText}>Aus</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recent Movements */}
        <View style={styles.movementsSection}>
          <Text style={styles.sectionTitle}>
            Letzte Bewegungen ({movements.length})
          </Text>
          
          {movements.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="swap-horizontal-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>Keine Bewegungen vorhanden</Text>
              <Text style={styles.emptyText}>
                Führen Sie Ihre erste Buchung durch, um sie hier zu sehen
              </Text>
            </View>
          ) : (
            movements.map(movement => (
              <View key={movement.id} style={styles.movementItem}>
                <View style={styles.movementIcon}>
                  <Ionicons
                    name={getMovementIcon(movement.movement_type) as any}
                    size={24}
                    color={getMovementColor(movement.movement_type)}
                  />
                </View>
                
                <View style={styles.movementInfo}>
                  <Text style={styles.movementType}>
                    {getMovementTypeText(movement.movement_type)}
                  </Text>
                  <Text style={styles.movementArticle}>
                    {getArticleName(movement.article_id)}
                  </Text>
                  {movement.reason && (
                    <Text style={styles.movementReason}>{movement.reason}</Text>
                  )}
                </View>
                
                <View style={styles.movementDetails}>
                  <Text style={[
                    styles.movementQuantity,
                    { color: getMovementColor(movement.movement_type) }
                  ]}>
                    {movement.movement_type === 'OUT' ? '-' : '+'}{movement.quantity}
                  </Text>
                  <Text style={styles.movementDate}>
                    {formatDate(movement.created_at)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Quick Booking Modal */}
      <Modal
        visible={showQuickBooking}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowQuickBooking(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bookingModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schnellbuchung</Text>
              <TouchableOpacity onPress={() => setShowQuickBooking(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedArticle && (
              <View style={styles.modalContent}>
                <View style={styles.articlePreview}>
                  <Text style={styles.previewName}>{selectedArticle.name}</Text>
                  <Text style={styles.previewStock}>
                    Aktueller Bestand: {selectedArticle.current_stock} {selectedArticle.base_unit}
                  </Text>
                </View>

                <View style={styles.movementTypeSelector}>
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      quickBooking.movement_type === 'IN' && styles.activeTypeButton,
                      styles.inTypeButton,
                    ]}
                    onPress={() => setQuickBooking(prev => ({ ...prev, movement_type: 'IN' }))}
                  >
                    <Ionicons name="arrow-down" size={20} color="white" />
                    <Text style={styles.typeButtonText}>Eingang</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      quickBooking.movement_type === 'OUT' && styles.activeTypeButton,
                      styles.outTypeButton,
                    ]}
                    onPress={() => setQuickBooking(prev => ({ ...prev, movement_type: 'OUT' }))}
                  >
                    <Ionicons name="arrow-up" size={20} color="white" />
                    <Text style={styles.typeButtonText}>Ausgang</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Menge</Text>
                  <TextInput
                    style={styles.quantityInput}
                    value={quickBooking.quantity}
                    onChangeText={(text) => setQuickBooking(prev => ({ ...prev, quantity: text }))}
                    placeholder="Anzahl eingeben..."
                    keyboardType="numeric"
                    autoFocus
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Grund (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={quickBooking.reason}
                    onChangeText={(text) => setQuickBooking(prev => ({ ...prev, reason: text }))}
                    placeholder="Grund für die Bewegung..."
                    multiline
                    numberOfLines={2}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.executeButton, bookingInProgress && styles.executeButtonDisabled]}
                  onPress={executeQuickBooking}
                  disabled={bookingInProgress}
                >
                  {bookingInProgress ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color="white" />
                      <Text style={styles.executeButtonText}>
                        {quickBooking.movement_type === 'IN' ? 'Eingang' : 'Ausgang'} buchen
                      </Text>
                    </>
                  )}
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
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  quickActionsContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f3f4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  content: {
    flex: 1,
  },
  articlesSection: {
    backgroundColor: 'white',
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  articleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  articleInfo: {
    flex: 1,
  },
  articleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  articleCode: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  articleStock: {
    fontSize: 12,
    color: '#007AFF',
  },
  quickBookingButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  quickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  inButton: {
    backgroundColor: '#34C759',
  },
  outButton: {
    backgroundColor: '#FF3B30',
  },
  quickButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  movementsSection: {
    backgroundColor: 'white',
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  movementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  movementIcon: {
    width: 40,
    alignItems: 'center',
    marginRight: 12,
  },
  movementInfo: {
    flex: 1,
  },
  movementType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  movementArticle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  movementReason: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
    fontStyle: 'italic',
  },
  movementDetails: {
    alignItems: 'flex-end',
  },
  movementQuantity: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  movementDate: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    margin: 24,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalContent: {
    padding: 24,
  },
  articlePreview: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  previewName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  previewStock: {
    fontSize: 14,
    color: '#666',
  },
  movementTypeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  activeTypeButton: {
    // Additional active styles handled by specific type buttons
  },
  inTypeButton: {
    backgroundColor: '#34C759',
  },
  outTypeButton: {
    backgroundColor: '#FF3B30',
  },
  typeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: 'white',
  },
  quantityInput: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    backgroundColor: 'white',
    textAlign: 'center',
  },
  executeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 16,
    gap: 8,
  },
  executeButtonDisabled: {
    opacity: 0.6,
  },
  executeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});