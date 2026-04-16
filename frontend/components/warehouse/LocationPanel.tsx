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

  const capacity = 9; // 3 levels × 3 slots standard
  const fillRatio = Math.min(articles.length / capacity, 1);
  const fillPct = Math.round(fillRatio * 100);
  const isFull = fillRatio >= 0.92;
  const fillColor = fillRatio >= 0.92 ? '#ef4444' : fillRatio >= 0.7 ? '#f59e0b' : '#22c55e';

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.zoneName}>{zone.name}</Text>
          <Text style={styles.locationName}>{location.name}</Text>
          <Text style={styles.locationMeta}>{location.type} · {articles.length} Artikel</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {/* Fill bar */}
      <View style={styles.fillBar}>
        <View style={styles.fillBarRow}>
          <Text style={styles.fillBarLabel}>Füllstand</Text>
          <Text style={[styles.fillBarValue, { color: fillColor }]}>{fillPct}%</Text>
        </View>
        <View style={styles.fillBarTrack}>
          <View style={[styles.fillBarFill, { width: `${fillPct}%` as any, backgroundColor: fillColor }]} />
        </View>
      </View>

      {/* Warning if full */}
      {isFull && (
        <View style={styles.warningBox}>
          <Ionicons name="warning-outline" size={16} color="#ef4444" />
          <Text style={styles.warningText}>Regal ist voll — Artikel bitte verschieben</Text>
        </View>
      )}

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
    position: 'absolute', right: 0, top: 0, bottom: 0, width: 300,
    backgroundColor: '#0f1e35',
    borderLeftWidth: 1, borderLeftColor: '#1e293b',
    shadowColor: '#000', shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 12,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b',
    backgroundColor: '#060e1a',
  },
  headerText: { flex: 1 },
  zoneName: { fontSize: 10, color: '#64748b', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1 },
  locationName: { fontSize: 17, fontWeight: '700', color: '#e2e8f0', marginTop: 2 },
  locationMeta: { fontSize: 12, color: '#475569', marginTop: 2 },
  closeButton: { padding: 4 },
  fillBar: {
    marginHorizontal: 14, marginTop: 12, marginBottom: 4,
  },
  fillBarRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  fillBarLabel: { fontSize: 11, color: '#64748b' },
  fillBarValue: { fontSize: 11, fontWeight: '700' },
  fillBarTrack: { height: 6, backgroundColor: '#1e293b', borderRadius: 3 },
  fillBarFill: { height: 6, borderRadius: 3 },
  warningBox: {
    margin: 14, marginTop: 8, backgroundColor: '#7f1d1d',
    borderWidth: 1, borderColor: '#ef4444', borderRadius: 8,
    padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  warningText: { color: '#fca5a5', fontSize: 12, flex: 1 },
  movePanel: {
    flex: 1, backgroundColor: '#060e1a',
    borderTopWidth: 1, borderTopColor: '#1e293b',
  },
  movePanelTitle: {
    fontSize: 13, color: '#94a3b8', padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  locationList: { flex: 1 },
  locationOption: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  locationOptionText: { flex: 1, fontSize: 14, color: '#e2e8f0' },
  locationOptionType: { fontSize: 11, color: '#475569' },
  cancelButton: {
    margin: 14, padding: 12, borderRadius: 10, backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  cancelButtonText: { color: '#94a3b8', fontWeight: '600' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontSize: 15, color: '#475569' },
  articleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  stockDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  articleInfo: { flex: 1 },
  articleName: { fontSize: 13, fontWeight: '600', color: '#e2e8f0' },
  articleCode: { fontSize: 11, color: '#475569', marginTop: 1 },
  articleStock: { fontSize: 11, marginTop: 1 },
  moveButton: {
    backgroundColor: '#1d4ed820', borderRadius: 8, padding: 8,
    borderWidth: 1, borderColor: '#1d4ed8',
  },
});
