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

interface Article {
  id: string;
  name: string;
  sku?: string;
  status?: string;
  location?: string;
  notes?: string;
}

export default function LostItemsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [items, setItems] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await apiService.get<Article[]>('/api/articles');
      const lost = (data || []).filter(
        a => a.status === 'verloren' || a.status === 'lost'
      );
      setItems(lost);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const markAsFound = (article: Article) => {
    Alert.alert(
      'Artikel gefunden',
      `"${article.name}" als gefunden markieren?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Als gefunden markieren',
          onPress: async () => {
            try {
              await apiService.put(`/api/articles/${article.id}`, { status: 'verfügbar' });
              await load();
            } catch (e: any) {
              Alert.alert('Fehler', e.message || 'Aktualisierung fehlgeschlagen');
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Verlorene Materialien</Text>
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
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Artikel mit Status 'Verloren'
            </Text>
          </View>

          {items.length === 0 ? (
            <View style={styles.center}>
              <Text style={{ fontSize: 36, marginBottom: 12 }}>✅</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Keine verlorenen Materialien</Text>
            </View>
          ) : (
            items.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, { backgroundColor: colors.card }]}
                onPress={() => markAsFound(item)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{item.name}</Text>
                    {item.sku ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{item.sku}</Text>
                    ) : null}
                    <View style={[styles.badge, styles.lostBadge]}>
                      <Text style={styles.lostBadgeText}>Verloren</Text>
                    </View>
                    {item.location ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 }}>
                        <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{item.location}</Text>
                      </View>
                    ) : null}
                    {item.notes ? (
                      <Text
                        numberOfLines={2}
                        style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}
                      >
                        {item.notes}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="checkmark-circle-outline" size={22} color={colors.primary} style={{ marginLeft: 8 }} />
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
  lostBadge: { backgroundColor: '#FF3B30' },
  lostBadgeText: { color: 'white', fontSize: 11, fontWeight: '600' },
});
