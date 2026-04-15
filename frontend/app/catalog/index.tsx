import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CatalogArticle {
  id: string;
  name: string;
  inventory_code: string;
  description?: string;
  category_id?: string;
  price_per_unit?: number;
  rental_price?: number;
  image_base64?: string;
  current_stock: number;
}

export default function CatalogPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<CatalogArticle[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [articlesData, categoriesData] = await Promise.all([
        apiService.get<CatalogArticle[]>('/api/articles', { showErrorAlert: false }),
        apiService.get<any[]>('/api/categories', { showErrorAlert: false }),
      ]);
      setArticles(articlesData || []);
      setCategories(categoriesData || []);
    } catch (error) {
      console.error('Error loading catalog:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredArticles = selectedCategory
    ? articles.filter(a => a.category_id === selectedCategory)
    : articles;

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return 'Ohne Kategorie';
    const cat = categories.find(c => c.id === categoryId);
    return cat?.name || 'Unbekannt';
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Lade Katalog...</Text>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Artikelkatalog</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.categoryFilter, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={[styles.categoryChip, { backgroundColor: colors.background }, !selectedCategory && { backgroundColor: colors.primary }]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text style={[styles.categoryChipText, { color: colors.textSecondary }, !selectedCategory && { color: 'white' }]}>Alle</Text>
        </TouchableOpacity>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryChip, { backgroundColor: colors.background }, selectedCategory === cat.id && { backgroundColor: colors.primary }]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Text style={[styles.categoryChipText, { color: colors.textSecondary }, selectedCategory === cat.id && { color: 'white' }]}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        <Text style={[styles.countText, { color: colors.textSecondary }]}>{filteredArticles.length} Artikel</Text>
        <View style={styles.catalogGrid}>
          {filteredArticles.map((article) => (
            <TouchableOpacity key={article.id} style={[styles.catalogCard, { backgroundColor: colors.card }]} onPress={() => router.push(`/articles/${article.id}`)}>
              {article.image_base64 ? (
                <Image source={{ uri: article.image_base64 }} style={styles.articleImage} resizeMode="cover" />
              ) : (
                <View style={[styles.placeholderImage, { backgroundColor: colors.background }]}>
                  <Ionicons name="cube-outline" size={40} color={colors.textSecondary} />
                </View>
              )}
              <View style={styles.articleInfo}>
                <Text style={[styles.articleName, { color: colors.text }]} numberOfLines={2}>{article.name}</Text>
                <Text style={[styles.articleCode, { color: colors.primary }]}>{article.inventory_code}</Text>
                <Text style={[styles.articleCategory, { color: colors.textSecondary }]}>{getCategoryName(article.category_id)}</Text>
                <View style={styles.priceRow}>
                  {article.rental_price && (
                    <Text style={styles.rentalPrice}>\u20ac{article.rental_price.toFixed(2)}/Tag</Text>
                  )}
                  <Text style={[styles.stock, { color: article.current_stock > 0 ? '#34C759' : '#FF3B30' }]}>
                    {article.current_stock > 0 ? `${article.current_stock} verf.` : 'Nicht verf.'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  categoryFilter: { paddingHorizontal: 16, paddingVertical: 12 },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  categoryChipText: { fontSize: 13, fontWeight: '500' },
  content: { flex: 1, padding: 16 },
  countText: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  catalogGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  catalogCard: { width: '48%', borderRadius: 12, overflow: 'hidden' },
  articleImage: { width: '100%', height: 120 },
  placeholderImage: { width: '100%', height: 120, justifyContent: 'center', alignItems: 'center' },
  articleInfo: { padding: 12 },
  articleName: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  articleCode: { fontSize: 11, marginBottom: 4 },
  articleCategory: { fontSize: 11, marginBottom: 8 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rentalPrice: { fontSize: 14, fontWeight: '600', color: '#34C759' },
  stock: { fontSize: 11 },
});
