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
  Image,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';

interface Article {
  id: string;
  name: string;
  description?: string;
  category_id: string;
  supplier_id?: string;
  serial_number?: string;
  inventory_code: string;
  base_unit: string;
  current_stock: number;
  min_stock_level: number;
  price_per_unit: number;
  rental_price?: number;
  status: string;
  last_maintenance?: string;
  next_maintenance?: string;
  image_base64?: string;
  images?: string[];
  qr_code?: string;
  weight_kg?: number;
  power_watt?: number;
  is_sub_rental?: boolean;
  sub_rental_supplier_id?: string;
  sub_rental_cost?: number;
  created_at: string;
  updated_at: string;
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
  phone?: string;
  address?: string;
}

interface Movement {
  id: string;
  movement_type: string;
  quantity: number;
  reason?: string;
  user_id: string;
  created_at: string;
}

export default function ArticleDetailPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [subRentalSupplier, setSubRentalSupplier] = useState<Supplier | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImageModal, setShowImageModal] = useState(false);

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
      color: '#FF3B30',
      marginTop: 16,
      marginBottom: 24,
    },
    backButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 24,
      paddingVertical: 12,
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
      flex: 1,
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginHorizontal: 16,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 8,
    },
    headerAction: {
      padding: 8,
    },
    content: {
      flex: 1,
    },
    imageSection: {
      backgroundColor: colors.card,
      alignItems: 'center',
      paddingVertical: 24,
    },
    articleImage: {
      width: 200,
      height: 200,
      borderRadius: 12,
    },
    gallerySection: {
      backgroundColor: colors.card,
      paddingHorizontal: 24,
      paddingVertical: 16,
      marginTop: 12,
    },
    gallerySectionLabel: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    galleryImage: {
      width: 200,
      height: 150,
      borderRadius: 8,
      marginRight: 8,
    },
    card: {
      backgroundColor: colors.card,
      marginTop: 12,
      paddingHorizontal: 24,
      paddingVertical: 20,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    viewAllText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '500',
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    infoLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      flex: 1,
    },
    infoValue: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '500',
      flex: 2,
      textAlign: 'right',
    },
    codeText: {
      fontFamily: 'monospace',
      fontSize: 12,
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '600',
    },
    stockHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    stockInfo: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    stockNumber: {
      fontSize: 32,
      fontWeight: 'bold',
      color: colors.text,
    },
    stockUnit: {
      fontSize: 16,
      color: colors.textSecondary,
      marginLeft: 8,
    },
    stockStatus: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    stockStatusText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '600',
    },
    priceValue: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: '600',
      flex: 2,
      textAlign: 'right',
    },
    overdueText: {
      color: '#FF3B30',
    },
    emptyMovements: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 8,
    },
    movementItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    movementIcon: {
      width: 40,
      alignItems: 'center',
    },
    movementInfo: {
      flex: 1,
      marginLeft: 12,
    },
    movementType: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    movementReason: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    movementDetails: {
      alignItems: 'flex-end',
    },
    movementQuantity: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    movementDate: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    imageModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.9)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageModalClose: {
      position: 'absolute',
      top: 60,
      right: 24,
      zIndex: 1,
    },
    fullscreenImage: {
      width: '90%',
      height: '70%',
    },
  });

  const loadArticleData = useCallback(async () => {
    try {
      // Load article details using apiService
      const articleData = await apiService.get<Article>(`/api/articles/${id}`);
      if (!articleData) {
        Alert.alert('Fehler', 'Artikel nicht gefunden');
        router.back();
        return;
      }
      setArticle(articleData);

      // Load category and supplier info in parallel
      const [categories, suppliers, movementsData] = await Promise.all([
        apiService.get<Category[]>('/api/categories'),
        apiService.get<Supplier[]>('/api/suppliers'),
        apiService.get<any[]>(`/api/movements?article_id=${id}`),
      ]);

      if (categories) {
        const articleCategory = categories.find((c) => c.id === articleData.category_id);
        setCategory(articleCategory || null);
      }

      if (suppliers && articleData.supplier_id) {
        const articleSupplier = suppliers.find((s) => s.id === articleData.supplier_id);
        setSupplier(articleSupplier || null);
      }

      if (suppliers && articleData.sub_rental_supplier_id) {
        const srSupplier = suppliers.find((s) => s.id === articleData.sub_rental_supplier_id);
        setSubRentalSupplier(srSupplier || null);
      }

      if (movementsData) {
        setMovements(movementsData.slice(0, 10)); // Show last 10 movements
      }

    } catch (error) {
      console.error('Error loading article:', error);
      Alert.alert('Fehler', 'Fehler beim Laden der Artikeldaten');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadArticleData();
    }
  }, [id, loadArticleData]);

  const handleDelete = async () => {
    Alert.alert(
      'Artikel löschen',
      'Sind Sie sicher, dass Sie diesen Artikel löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.delete(`/api/articles/${id}`);
              Alert.alert('Erfolg', 'Artikel wurde gelöscht', [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } catch (error) {
              Alert.alert('Fehler', 'Artikel konnte nicht gelöscht werden');
            }
          },
        },
      ]
    );
  };

  const getStockStatusColor = (current: number, min: number) => {
    if (current === 0) return '#FF3B30';
    if (current <= min) return '#FF9500';
    return '#34C759';
  };

  const getStockStatusText = (current: number, min: number) => {
    if (current === 0) return 'Ausverkauft';
    if (current <= min) return 'Niedriger Bestand';
    return 'Verfügbar';
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ok': return '#34C759';
      case 'defekt': return '#FF3B30';
      case 'gesperrt': return '#FF9500';
      default: return colors.textSecondary;
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
      case 'TRANSFER': return colors.primary;
      default: return colors.textSecondary;
    }
  };

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

  if (!article) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
          <Text style={styles.errorText}>Artikel nicht gefunden</Text>
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
        <Text style={styles.headerTitle} numberOfLines={1}>{article.name}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => router.push(`/articles/edit/${article.id}`)}
          >
            <Ionicons name="create-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {/* Image Section */}
        {article.image_base64 && (
          <View style={styles.imageSection}>
            <TouchableOpacity
              onPress={() => setShowImageModal(true)}
            >
              <Image
                source={{ uri: `data:image/jpeg;base64,${article.image_base64}` }}
                style={styles.articleImage}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Fotos Gallery */}
        {article.images && article.images.length > 0 && (
          <View style={styles.gallerySection}>
            <Text style={styles.gallerySectionLabel}>Fotos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {article.images.map((image, index) => (
                <Image
                  key={index}
                  source={{ uri: image }}
                  style={styles.galleryImage}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Basic Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Grundinformationen</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{article.name}</Text>
          </View>

          {article.description && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Beschreibung</Text>
              <Text style={styles.infoValue}>{article.description}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Kategorie</Text>
            <Text style={styles.infoValue}>{category?.name || 'Unbekannt'}</Text>
          </View>

          {supplier && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Lieferant</Text>
              <Text style={styles.infoValue}>{supplier.name}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Inventar-Code</Text>
            <Text style={[styles.infoValue, styles.codeText]}>{article.inventory_code}</Text>
          </View>

          {article.qr_code && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>QR-Code</Text>
              <Text style={[styles.infoValue, styles.codeText]}>{article.qr_code}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Maßeinheit</Text>
            <Text style={styles.infoValue}>{article.base_unit}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(article.status) }]}>
              <Text style={styles.statusText}>{article.status}</Text>
            </View>
          </View>
        </View>

        {/* Sub-Rental Card */}
        {article.is_sub_rental && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Zumietung (Sub-Rental)</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <View style={[styles.statusBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.statusText}>Zumietartikel</Text>
              </View>
            </View>

            {subRentalSupplier && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Vermieter</Text>
                <Text style={styles.infoValue}>{subRentalSupplier.name}</Text>
              </View>
            )}

            {article.sub_rental_cost !== undefined && article.sub_rental_cost !== null && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Mietkosten</Text>
                <Text style={[styles.infoValue, { color: '#FF3B30' }]}>
                  €{article.sub_rental_cost}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Technical Data Card */}
        {(article.weight_kg !== undefined || article.power_watt !== undefined) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Technische Daten</Text>

            {article.weight_kg !== undefined && article.weight_kg !== null && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Gewicht</Text>
                <Text style={styles.infoValue}>{article.weight_kg} kg</Text>
              </View>
            )}

            {article.power_watt !== undefined && article.power_watt !== null && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Leistung</Text>
                <Text style={styles.infoValue}>{article.power_watt} Watt</Text>
              </View>
            )}
          </View>
        )}

        {/* Stock Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Lagerbestand</Text>

          <View style={styles.stockHeader}>
            <View style={styles.stockInfo}>
              <Text style={styles.stockNumber}>{article.current_stock}</Text>
              <Text style={styles.stockUnit}>{article.base_unit}</Text>
            </View>
            <View style={[
              styles.stockStatus,
              { backgroundColor: getStockStatusColor(article.current_stock, article.min_stock_level) }
            ]}>
              <Text style={styles.stockStatusText}>
                {getStockStatusText(article.current_stock, article.min_stock_level)}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Mindestbestand</Text>
            <Text style={styles.infoValue}>{article.min_stock_level} {article.base_unit}</Text>
          </View>
        </View>

        {/* Price Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Preise</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Preis pro Einheit</Text>
            <Text style={styles.priceValue}>€{article.price_per_unit}</Text>
          </View>

          {article.rental_price && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Mietpreis pro Tag</Text>
              <Text style={styles.priceValue}>€{article.rental_price}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Gesamtwert Bestand</Text>
            <Text style={styles.priceValue}>
              €{(article.current_stock * article.price_per_unit).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Maintenance Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Wartung</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Letzte Wartung</Text>
            <Text style={styles.infoValue}>
              {article.last_maintenance ? formatDate(article.last_maintenance) : 'Keine Angabe'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nächste Wartung</Text>
            <Text style={[
              styles.infoValue,
              article.next_maintenance && new Date(article.next_maintenance) <= new Date() ? styles.overdueText : null
            ]}>
              {article.next_maintenance ? formatDate(article.next_maintenance) : 'Keine geplant'}
            </Text>
          </View>
        </View>

        {/* Recent Movements Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Letzte Bewegungen</Text>
            <TouchableOpacity onPress={() => router.push(`/movements?article_id=${article.id}`)}>
              <Text style={styles.viewAllText}>Alle anzeigen</Text>
            </TouchableOpacity>
          </View>

          {movements.length === 0 ? (
            <View style={styles.emptyMovements}>
              <Ionicons name="swap-horizontal-outline" size={32} color="#ccc" />
              <Text style={styles.emptyText}>Keine Bewegungen vorhanden</Text>
            </View>
          ) : (
            movements.map((movement) => (
              <View key={movement.id} style={styles.movementItem}>
                <View style={styles.movementIcon}>
                  <Ionicons
                    name={getMovementIcon(movement.movement_type) as any}
                    size={20}
                    color={getMovementColor(movement.movement_type)}
                  />
                </View>
                <View style={styles.movementInfo}>
                  <Text style={styles.movementType}>{movement.movement_type}</Text>
                  <Text style={styles.movementReason}>{movement.reason || 'Keine Begründung'}</Text>
                </View>
                <View style={styles.movementDetails}>
                  <Text style={styles.movementQuantity}>
                    {movement.movement_type === 'OUT' ? '-' : '+'}{movement.quantity}
                  </Text>
                  <Text style={styles.movementDate}>{formatDate(movement.created_at)}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Timestamps Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Zeitstempel</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Erstellt</Text>
            <Text style={styles.infoValue}>{formatDate(article.created_at)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Zuletzt bearbeitet</Text>
            <Text style={styles.infoValue}>{formatDate(article.updated_at)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Image Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity
            style={styles.imageModalClose}
            onPress={() => setShowImageModal(false)}
          >
            <Ionicons name="close" size={32} color="white" />
          </TouchableOpacity>
          {article.image_base64 && (
            <Image
              source={{ uri: `data:image/jpeg;base64,${article.image_base64}` }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
