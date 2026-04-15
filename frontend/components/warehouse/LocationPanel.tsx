// frontend/components/warehouse/LocationPanel.tsx
// Seitenpanel (absolutes Overlay rechts) für Artikelliste und Verschieben-Flow.

import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../../services/apiService';
import { buildMovePayload, validateMove } from '../../utils/locationPanelLogic';
import { getStockColor, Article, StorageZone, StorageLocation } from '../../utils/warehouseUtils';

interface Props {
  location: StorageLocation;
  zone: StorageZone;
  articles: Article[];
  allLocations: StorageLocation[];
  onClose: () => void;
  onArticleMoved: (articleId: string, newLocationId: string) => void;
}

export default function LocationPanel({
  location, zone, articles, allLocations, onClose, onArticleMoved
}: Props) {
  const [movingArticleId, setMovingArticleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const startMove = (articleId: string) => setMovingArticleId(articleId);
  const cancelMove = () => setMovingArticleId(null);

  const confirmMove = async (article: Article, targetLocationId: string) => {
    const error = validateMove(location.id, targetLocationId);
    if (error) {
      Alert.alert('Fehler', error);
      return;
    }
    const oldLocationId = article.storage_location_id ?? '';
    setLoading(true);
    onArticleMoved(article.id, targetLocationId);
    setMovingArticleId(null);
    try {
      const payload = buildMovePayload(article, targetLocationId);
      await apiService.put(`/api/articles/${article.id}`, payload);
    } catch (err: any) {
      onArticleMoved(article.id, oldLocationId);
      Alert.alert('Fehler', err.message || 'Verschieben fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  const movingArticle = movingArticleId ? articles.find(a => a.id === movingArticleId) : null;
  const otherLocations = allLocations.filter(l => l.id !== location.id);

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.zoneName}>{zone.name}</Text>
          <Text style={styles.locationName}>{location.name}</Text>
          <Text style={styles.locationMeta}>{location.type} · {articles.length} Artikel</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {movingArticle && (
        <View style={styles.movePanel}>
          <Text style={styles.movePanelTitle}>„{movingArticle.name}" verschieben nach:</Text>
          <ScrollView style={styles.locationList}>
            {otherLocations.map(loc => (
              <TouchableOpacity
                key={loc.id}
                style={styles.locationOption}
                onPress={() => confirmMove(movingArticle, loc.id)}
                disabled={loading}
              >
                <Ionicons name="location-outline" size={16} color="#FF9500" />
                <Text style={styles.locationOptionText}>{loc.name}</Text>
                <Text style={styles.locationOptionType}>{loc.type}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={cancelMove} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Abbrechen</Text>
          </TouchableOpacity>
        </View>
      )}

      {!movingArticle && (
        <>
          {articles.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color="#C7C7CC" />
              <Text style={styles.emptyText}>Keine Artikel hier</Text>
            </View>
          ) : (
            <FlatList
              data={articles}
              keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const stockColor = getStockColor(item.current_stock, item.min_stock_level);
                return (
                  <View style={styles.articleRow}>
                    <View style={[styles.stockDot, { backgroundColor: stockColor }]} />
                    <View style={styles.articleInfo}>
                      <Text style={styles.articleName}>{item.name}</Text>
                      <Text style={styles.articleCode}>{item.inventory_code}</Text>
                      <Text style={[styles.articleStock, { color: stockColor }]}>
                        Bestand: {item.current_stock} / Min: {item.min_stock_level}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.moveButton}
                      onPress={() => startMove(item.id)}
                      disabled={loading}
                    >
                      <Ionicons name="arrow-redo-outline" size={18} color="#007AFF" />
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 300,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#F2F2F7',
  },
  headerText: { flex: 1 },
  zoneName: { fontSize: 12, color: '#8E8E93', fontWeight: '600', textTransform: 'uppercase' },
  locationName: { fontSize: 18, fontWeight: '700', color: '#1C1C1E', marginTop: 2 },
  locationMeta: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  closeButton: { padding: 4 },
  articleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  stockDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  articleInfo: { flex: 1 },
  articleName: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  articleCode: { fontSize: 12, color: '#8E8E93', marginTop: 1 },
  articleStock: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  moveButton: { padding: 8 },
  movePanel: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFF9E6',
  },
  movePanelTitle: { fontSize: 14, fontWeight: '600', color: '#1C1C1E', marginBottom: 8 },
  locationList: { maxHeight: 200 },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 8,
  },
  locationOptionText: { flex: 1, fontSize: 14, color: '#1C1C1E' },
  locationOptionType: { fontSize: 12, color: '#8E8E93' },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#E5E5EA',
    borderRadius: 8,
  },
  cancelButtonText: { fontSize: 14, color: '#FF3B30', fontWeight: '600' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyText: { fontSize: 14, color: '#8E8E93', textAlign: 'center' },
});
