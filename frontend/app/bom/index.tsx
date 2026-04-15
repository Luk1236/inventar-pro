import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BOM {
  id: string;
  name: string;
  description?: string;
  category?: string;
  items: Array<{ article_id: string; quantity: number; is_optional: boolean }>;
  package_price?: number;
  image_base64?: string;
}

export default function BOMListPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [boms, setBoms] = useState<BOM[]>([]);

  useEffect(() => {
    loadBOMs();
  }, []);

  const loadBOMs = async () => {
    try {
      const data = await apiService.get<BOM[]>('/api/bom', { showErrorAlert: false });
      setBoms(data || []);
    } catch (error) {
      console.error('Error loading BOMs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadBOMs();
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Lade Strukturlisten...</Text>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Strukturlisten (BOM)</Text>
        <TouchableOpacity onPress={() => router.push('/bom/create')}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {boms.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="list-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Keine Strukturlisten</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Erstellen Sie Equipment-Pakete für schnelle Buchungen
            </Text>
            <TouchableOpacity 
              style={[styles.addButton, { backgroundColor: colors.primary }]} 
              onPress={() => router.push('/bom/create')}
            >
              <Text style={styles.addButtonText}>Erste Strukturliste erstellen</Text>
            </TouchableOpacity>
          </View>
        ) : (
          boms.map((bom) => (
            <TouchableOpacity
              key={bom.id}
              style={[styles.bomCard, { backgroundColor: colors.card }]}
              onPress={() => router.push(`/bom/detail/${bom.id}`)}
            >
              {bom.image_base64 && (
                <Image
                  source={{ uri: bom.image_base64 }}
                  style={styles.bomImage}
                  resizeMode="cover"
                />
              )}
              <View style={styles.bomContent}>
                <View style={styles.bomHeader}>
                  <Ionicons name="file-tray-stacked" size={24} color={colors.primary} />
                  <View style={styles.bomInfo}>
                    <Text style={[styles.bomName, { color: colors.text }]}>{bom.name}</Text>
                    {bom.category && (
                      <Text style={[styles.bomCategory, { color: colors.primary }]}>📂 {bom.category}</Text>
                    )}
                  </View>
                </View>
                
                {bom.description && (
                  <Text style={[styles.bomDescription, { color: colors.textSecondary }]}>{bom.description}</Text>
                )}

                <View style={[styles.bomFooter, { borderTopColor: colors.border }]}>
                  <Text style={[styles.bomItems, { color: colors.textSecondary }]}>
                    {bom.items.length} Artikel
                  </Text>
                  {bom.package_price && (
                    <Text style={styles.bomPrice}>
                      €{bom.package_price.toFixed(2)}
                    </Text>
                  )}
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  addButton: {
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
  bomCard: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  bomImage: {
    width: '100%',
    height: 120,
  },
  bomContent: {
    padding: 16,
  },
  bomHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bomInfo: {
    flex: 1,
    marginLeft: 12,
  },
  bomName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  bomCategory: {
    fontSize: 12,
  },
  bomDescription: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  bomFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  bomItems: {
    fontSize: 13,
    flex: 1,
  },
  bomPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34C759',
    marginRight: 8,
  },
});
