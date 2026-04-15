import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ArchivedArticle {
  id: string;
  name: string;
  sku?: string;
  category_name?: string;
  quantity?: number;
  status?: string;
}

export default function ArchivedArticlesPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [articles, setArticles] = useState<ArchivedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await apiService.get<ArchivedArticle[]>('/api/articles/archived');
      setArticles(data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const restoreArticle = (article: ArchivedArticle) => {
    Alert.alert(
      'Artikel wiederherstellen?',
      `"${article.name}" aus dem Archiv wiederherstellen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Wiederherstellen',
          onPress: async () => {
            try {
              await apiService.post(`/api/articles/${article.id}/unarchive`);
              await load();
            } catch (e: any) {
              Alert.alert('Fehler', e.message || 'Wiederherstellen fehlgeschlagen');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Archivierte Materialien</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1, padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="archive-outline" size={18} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Archivierte Artikel werden nicht in der regulären Ansicht angezeigt
            </Text>
          </View>

          {articles.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="archive-outline" size={48} color={colors.border} />
              <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 16 }}>
                Keine archivierten Artikel
              </Text>
            </View>
          ) : (
            articles.map(article => (
              <TouchableOpacity
                key={article.id}
                style={[styles.card, { backgroundColor: colors.card }]}
                onPress={() => restoreArticle(article)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{article.name}</Text>
                    {article.sku ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{article.sku}</Text>
                    ) : null}
                    {article.category_name ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                        {article.category_name}
                      </Text>
                    ) : null}
                    <View style={[styles.badge, styles.archivedBadge]}>
                      <Text style={styles.archivedBadgeText}>Archiviert</Text>
                    </View>
                  </View>
                  <Ionicons name="refresh-outline" size={20} color={colors.primary} style={{ marginLeft: 8 }} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1,
  },
  infoText: { fontSize: 13, flex: 1 },
  card: {
    borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  archivedBadge: { backgroundColor: '#8E8E93' },
  archivedBadgeText: { color: 'white', fontSize: 11, fontWeight: '600' },
});
