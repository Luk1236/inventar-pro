import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  Modal,
  Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import apiService, { getToken, getBackendUrl } from '../../services/apiService';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useTheme } from '../../contexts/ThemeContext';

interface Article {
  id: string;
  name: string;
  description?: string;
  category_id: string;
  supplier_id?: string;
  inventory_code: string;
  current_stock: number;
  min_stock_level: number;
  price_per_unit: number;
  rental_price?: number;
  status: string;
  image_base64?: string;
  qr_code?: string;
  created_at: string;
  is_consumable?: boolean;
}

interface Category {
  id: string;
  name: string;
  description?: string;
}

interface Supplier {
  id: string;
  name: string;
  contact_email?: string;
}

export default function ArticlesPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetch, setLastFetch] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [consumableAlertCount, setConsumableAlertCount] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

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
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 16,
      backgroundColor: colors.card,
      gap: 12,
    },
    searchInputContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    searchInput: {
      flex: 1,
      marginLeft: 8,
      fontSize: 16,
      color: colors.text,
    },
    filterButton: {
      padding: 8,
    },
    viewModeButton: {
      padding: 8,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    filterModal: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      margin: 24,
      width: '90%',
      maxHeight: '80%',
    },
    filterHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    filterTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    filterLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    categoryFilters: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 24,
    },
    categoryChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selectedChip: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    selectedChipText: {
      color: colors.card,
    },
    applyButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
    },
    applyButtonText: {
      color: colors.card,
      fontSize: 16,
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    consumableAlertBanner: {
      backgroundColor: '#FF3B30',
      paddingHorizontal: 24,
      paddingVertical: 10,
    },
    consumableAlertText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
    },
    statsBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    statsText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    manageText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '500',
    },
    articlesContainer: {
      padding: 16,
    },
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    articleCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
      overflow: 'hidden',
    },
    cardContent: {
      flex: 1,
    },
    gridCard: {
      width: '48%',
      marginBottom: 16,
    },
    articleHeader: {
      flexDirection: 'row',
      padding: 12,
    },
    articleImage: {
      width: 80,
      height: 80,
      borderRadius: 8,
    },
    placeholderImage: {
      width: 80,
      height: 80,
      borderRadius: 8,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    articleInfo: {
      flex: 1,
      marginLeft: 12,
      justifyContent: 'space-between',
    },
    articleName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    articleCode: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    categoryName: {
      fontSize: 12,
      color: colors.primary,
      marginBottom: 8,
    },
    stockContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stockBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      marginRight: 8,
    },
    stockBadgeText: {
      color: 'white',
      fontSize: 11,
      fontWeight: '600',
    },
    stockText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    articleActionsRow: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    editButtonLarge: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      backgroundColor: colors.primary,
      gap: 8,
    },
    deleteButtonLarge: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      backgroundColor: '#FF3B30',
      gap: 8,
    },
    buttonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
    },
    articleActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    actionButton: {
      padding: 8,
    },
    deleteButton: {
      padding: 8,
      backgroundColor: '#FF3B30',
      borderRadius: 6,
      marginLeft: 8,
    },
    priceContainer: {
      alignItems: 'flex-end',
    },
    priceText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    rentalText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 64,
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
    importButton: {
      borderRadius: 8,
      padding: 6,
    },
    addButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 24,
      paddingVertical: 12,
      marginTop: 24,
    },
    addButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  // B1: Nur neu laden wenn Screen-Focus UND Daten > 5 Min alt
  useFocusEffect(useCallback(() => {
    if (Date.now() - lastFetch > 5 * 60 * 1000) {
      loadData();
    }
  }, [lastFetch]));

  useWebSocket((msg) => {
    if (msg.type === 'article_created' || msg.type === 'article_updated' || msg.type === 'article_deleted') {
      loadData();
    }
  });

  const loadData = async () => {
    try {
      const token = await getToken();
      if (!token) {
        router.replace('/');
        return;
      }

      // Load articles, categories, suppliers and consumable alerts in parallel with retry logic
      const [articlesData, categoriesData, suppliersData, consumableAlerts] = await Promise.all([
        apiService.get<Article[]>('/api/articles', { showErrorAlert: false }),
        apiService.get<Category[]>('/api/categories', { showErrorAlert: false }),
        apiService.get<Supplier[]>('/api/suppliers', { showErrorAlert: false }),
        apiService.get<Article[]>('/api/articles/consumable-alerts', { showErrorAlert: false }).catch(() => []),
      ]);

      setArticles(articlesData);
      setCategories(categoriesData);
      setSuppliers(suppliersData);
      setConsumableAlertCount(Array.isArray(consumableAlerts) ? consumableAlerts.length : 0);
      setLastFetch(Date.now());
    } catch (error: any) {
      console.error('Error loading data:', error);
      if (error.message !== 'Authentication failed') {
        Alert.alert('Fehler', 'Daten konnten nicht geladen werden');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleDeleteArticle = async (articleId: string) => {
    try {
      await apiService.delete(`/api/articles/${articleId}`);
      setArticles(prev => prev.filter(a => a.id !== articleId));
    } catch (error: any) {
      console.error('Delete exception:', error);
      if (error.message !== 'Authentication failed') {
        Alert.alert('Fehler', 'Artikel konnte nicht gelöscht werden');
      }
    }
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Unbekannte Kategorie';
  };

  const getStockStatusColor = (current: number, min: number) => {
    if (current === 0) return '#FF3B30'; // Red for out of stock
    if (current <= min) return '#FF9500'; // Orange for low stock
    return '#34C759'; // Green for good stock
  };

  const getStockStatusText = (current: number, min: number) => {
    if (current === 0) return 'Ausverkauft';
    if (current <= min) return 'Niedriger Bestand';
    return 'Verfügbar';
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filteredArticles.map(a => a.id)));
  const clearSelection = () => { setSelectedIds(new Set()); setSelectMode(false); };

  const downloadExcel = async () => {
    try {
      const token = await getToken();
      const base = getBackendUrl();
      const url = `${base}/api/reports/articles-xlsx`;
      const dest = (FileSystem.cacheDirectory ?? '') + 'artikel.xlsx';
      const dl = await FileSystem.downloadAsync(url, dest, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (dl.status === 200) {
        await Sharing.shareAsync(dl.uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Artikel exportieren',
        });
      } else {
        Alert.alert('Fehler', 'Export fehlgeschlagen.');
      }
    } catch (e) {
      Alert.alert('Fehler', 'Excel-Export fehlgeschlagen.');
    }
  };

  const bulkDelete = () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      'Artikel löschen',
      `${selectedIds.size} Artikel wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen', style: 'destructive', onPress: async () => {
            setBulkLoading(true);
            const ids = [...selectedIds];
            await Promise.all(ids.map(id => apiService.delete(`/api/articles/${id}`, { showErrorAlert: false }).catch(() => {})));
            setArticles(prev => prev.filter(a => !selectedIds.has(a.id)));
            clearSelection();
            setBulkLoading(false);
          }
        }
      ]
    );
  };

  const bulkSetStatus = async (status: string) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    await Promise.all([...selectedIds].map(id =>
      apiService.put(`/api/articles/${id}`, { status }, { showErrorAlert: false }).catch(() => {})
    ));
    setArticles(prev => prev.map(a => selectedIds.has(a.id) ? { ...a, status } : a));
    clearSelection();
    setBulkLoading(false);
  };

  const filteredArticles = useMemo(() => articles.filter(article => {
    const matchesSearch = searchTerm === '' ||
      article.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.inventory_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (article.description && article.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === '' || article.category_id === selectedCategory;

    return matchesSearch && matchesCategory;
  }), [articles, searchTerm, selectedCategory]);

  const renderArticleCard = useCallback(({ item: article }: { item: Article }) => (
    <Swipeable
      enabled={!selectMode}
      renderRightActions={(prog, drag) => {
        const trans = drag.interpolate({ inputRange: [-80, 0], outputRange: [0, 80] });
        return (
          <Animated.View style={{ width: 80, transform: [{ translateX: trans }] }}>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center', borderRadius: 12, margin: 4 }}
              onPress={() => Alert.alert('Artikel löschen', `"${article.name}" wirklich löschen?`, [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'Löschen', style: 'destructive', onPress: () => handleDeleteArticle(article.id) },
              ])}
            >
              <Ionicons name="trash" size={24} color="white" />
            </TouchableOpacity>
          </Animated.View>
        );
      }}
    >
    <View
      key={article.id}
      style={[styles.articleCard, viewMode === 'grid' && styles.gridCard, selectMode && selectedIds.has(article.id) && { borderColor: colors.primary, borderWidth: 2 }]}
    >
      {selectMode && (
        <TouchableOpacity
          onPress={() => toggleSelect(article.id)}
          style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: selectedIds.has(article.id) ? colors.primary : colors.border, justifyContent: 'center', alignItems: 'center' }}
        >
          {selectedIds.has(article.id) && <Ionicons name="checkmark" size={16} color="white" />}
        </TouchableOpacity>
      )}
      <View style={styles.cardContent}>
        <TouchableOpacity
          style={styles.articleHeader}
          onPress={() => {
            if (selectMode) { toggleSelect(article.id); return; }
            router.push(`/articles/${article.id}`);
          }}
          activeOpacity={0.7}
        >
          {article.image_base64 && (
            <Image
              source={{ uri: `data:image/jpeg;base64,${article.image_base64}` }}
              style={styles.articleImage}
            />
          )}
          {!article.image_base64 && (
            <View style={styles.placeholderImage}>
              <Ionicons name="image-outline" size={32} color="#ccc" />
            </View>
          )}

          <View style={styles.articleInfo}>
            <Text style={styles.articleName} numberOfLines={2}>{article.name}</Text>
            <Text style={styles.articleCode}>Code: {article.inventory_code}</Text>
            <Text style={styles.categoryName}>{getCategoryName(article.category_id)}</Text>

            <View style={styles.stockContainer}>
              <View style={[
                styles.stockBadge,
                { backgroundColor: getStockStatusColor(article.current_stock, article.min_stock_level) }
              ]}>
                <Text style={styles.stockBadgeText}>
                  {getStockStatusText(article.current_stock, article.min_stock_level)}
                </Text>
              </View>
              <Text style={styles.stockText}>
                {article.current_stock} / {article.min_stock_level} Min.
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.articleActionsRow}>
        <TouchableOpacity
          style={styles.editButtonLarge}
          onPress={() => {
            router.push(`/articles/edit/${article.id}`);
          }}
          activeOpacity={0.6}
        >
          <Ionicons name="create-outline" size={18} color="white" />
          <Text style={styles.buttonText}>Bearbeiten</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButtonLarge}
          onPress={() => {
            Alert.alert(
              'Artikel löschen',
              `Artikel "${article.name}" wirklich löschen?`,
              [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'Löschen', style: 'destructive', onPress: () => handleDeleteArticle(article.id) },
              ]
            );
          }}
          activeOpacity={0.6}
        >
          <Ionicons name="trash-outline" size={18} color="white" />
          <Text style={styles.buttonText}>Löschen</Text>
        </TouchableOpacity>
      </View>
    </View>
    </Swipeable>
  ), [viewMode, handleDeleteArticle, getCategoryName, getStockStatusColor, getStockStatusText, colors, isDark, selectMode, selectedIds, toggleSelect]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Lade Artikel...</Text>
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
        <Text style={styles.headerTitle}>Artikel ({articles.length})</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.importButton}
            onPress={downloadExcel}
          >
            <Ionicons name="document-text-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.importButton}
            onPress={() => router.push('/articles/import')}
          >
            <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.importButton, selectMode && { backgroundColor: colors.primary + '20' }]}
            onPress={() => { setSelectMode(s => !s); if (selectMode) clearSelection(); }}
          >
            <Ionicons name={selectMode ? 'checkmark-done-outline' : 'checkbox-outline'} size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/articles/add')}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bulk Action Bar */}
      {selectMode && (
        <View style={{ backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 }}>
          <TouchableOpacity onPress={selectAll}>
            <Text style={{ color: 'white', fontWeight: '600' }}>Alle ({filteredArticles.length})</Text>
          </TouchableOpacity>
          <Text style={{ color: 'rgba(255,255,255,0.6)' }}>|</Text>
          <Text style={{ color: 'white', flex: 1 }}>{selectedIds.size} ausgewählt</Text>
          {bulkLoading
            ? <ActivityIndicator color="white" />
            : <>
              <TouchableOpacity onPress={() => bulkSetStatus('verfügbar')} style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: 'white', fontSize: 13 }}>Verfügbar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => bulkSetStatus('defekt')} style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: 'white', fontSize: 13 }}>Defekt</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={bulkDelete} style={{ backgroundColor: '#FF3B30', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: 'white', fontSize: 13 }}>Löschen</Text>
              </TouchableOpacity>
            </>
          }
        </View>
      )}

      {/* Search and Filter Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Artikel suchen..."
            placeholderTextColor={colors.textSecondary}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name="filter-outline" size={20} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.viewModeButton}
          onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
        >
          <Ionicons
            name={viewMode === 'list' ? 'grid-outline' : 'list-outline'}
            size={20}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filter</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterLabel}>Kategorie</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.categoryFilters}>
                <TouchableOpacity
                  style={[styles.categoryChip, selectedCategory === '' && styles.selectedChip]}
                  onPress={() => setSelectedCategory('')}
                >
                  <Text style={[styles.chipText, selectedCategory === '' && styles.selectedChipText]}>
                    Alle
                  </Text>
                </TouchableOpacity>

                {categories.map(category => (
                  <TouchableOpacity
                    key={category.id}
                    style={[styles.categoryChip, selectedCategory === category.id && styles.selectedChip]}
                    onPress={() => setSelectedCategory(category.id)}
                  >
                    <Text style={[styles.chipText, selectedCategory === category.id && styles.selectedChipText]}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.applyButtonText}>Filter anwenden</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Articles List */}
      <FlatList
        key={viewMode}
        style={styles.content}
        data={filteredArticles}
        keyExtractor={(item) => item.id}
        renderItem={renderArticleCard}
        numColumns={viewMode === 'grid' ? 2 : 1}
        removeClippedSubviews
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={8}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListHeaderComponent={
          <>
            {consumableAlertCount > 0 && (
              <View style={styles.consumableAlertBanner}>
                <Text style={styles.consumableAlertText}>
                  ⚠️ {consumableAlertCount} Verbrauchsmaterial nachbestellen
                </Text>
              </View>
            )}
            <View style={styles.statsBar}>
              <Text style={styles.statsText}>
                {filteredArticles.length} von {articles.length} Artikel
              </Text>
              <TouchableOpacity onPress={() => router.push('/categories')}>
                <Text style={styles.manageText}>Kategorien verwalten</Text>
              </TouchableOpacity>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>Keine Artikel gefunden</Text>
            <Text style={styles.emptyText}>
              {searchTerm || selectedCategory
                ? 'Versuchen Sie andere Suchbegriffe'
                : 'Fügen Sie Ihren ersten Artikel hinzu'}
            </Text>
            <TouchableOpacity style={styles.addButton} onPress={() => router.push('/articles/add')}>
              <Text style={styles.addButtonText}>Artikel hinzufügen</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}
