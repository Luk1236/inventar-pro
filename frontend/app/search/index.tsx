import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SearchPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  const searchTypes = [
    { key: 'all', label: 'Alle', icon: 'search-outline' },
    { key: 'articles', label: 'Artikel', icon: 'cube-outline' },
    { key: 'customers', label: 'Kunden', icon: 'people-outline' },
    { key: 'events', label: 'Events', icon: 'calendar-outline' },
    { key: 'suppliers', label: 'Lieferanten', icon: 'business-outline' },
  ];

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const results: any = {};

      // Search Articles
      if (activeFilter === 'all' || activeFilter === 'articles') {
        try {
          const articles = await apiService.get<any[]>('/api/articles', { showErrorAlert: false });
          results.articles = articles.filter((a: any) =>
            a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.inventory_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.description?.toLowerCase().includes(searchQuery.toLowerCase())
          );
        } catch (e) { console.error('Articles search error:', e); }
      }

      // Search Customers
      if (activeFilter === 'all' || activeFilter === 'customers') {
        try {
          const customers = await apiService.get<any[]>('/api/customers', { showErrorAlert: false });
          results.customers = customers.filter((c: any) =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.company?.toLowerCase().includes(searchQuery.toLowerCase())
          );
        } catch (e) { console.error('Customers search error:', e); }
      }

      // Search Events
      if (activeFilter === 'all' || activeFilter === 'events') {
        try {
          const events = await apiService.get<any[]>('/api/events', { showErrorAlert: false });
          results.events = events.filter((e: any) =>
            e.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.location?.toLowerCase().includes(searchQuery.toLowerCase())
          );
        } catch (e) { console.error('Events search error:', e); }
      }

      // Search Suppliers
      if (activeFilter === 'all' || activeFilter === 'suppliers') {
        try {
          const suppliers = await apiService.get<any[]>('/api/suppliers', { showErrorAlert: false });
          results.suppliers = suppliers.filter((s: any) =>
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.address?.toLowerCase().includes(searchQuery.toLowerCase())
          );
        } catch (e) { console.error('Suppliers search error:', e); }
      }

      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTotalResults = () => {
    return Object.values(searchResults).reduce((sum: number, arr: any) => sum + (arr?.length || 0), 0);
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Suche</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.searchSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.searchContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Artikel, Kunden, Events durchsuchen..."
            placeholderTextColor={colors.textSecondary}
            onSubmitEditing={handleSearch}
            autoFocus
          />
          {searchQuery && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults({}); }}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={[styles.searchButton, { backgroundColor: colors.primary }]} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Suchen</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filterContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {searchTypes.map((type) => (
          <TouchableOpacity
            key={type.key}
            style={[
              styles.filterChip, 
              { backgroundColor: colors.background },
              activeFilter === type.key && { backgroundColor: colors.primary }
            ]}
            onPress={() => setActiveFilter(type.key)}
          >
            <Ionicons
              name={type.icon as any}
              size={16}
              color={activeFilter === type.key ? '#fff' : colors.textSecondary}
            />
            <Text style={[
              styles.filterChipText, 
              { color: colors.textSecondary },
              activeFilter === type.key && styles.filterChipTextActive
            ]}>
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Suche läuft...</Text>
          </View>
        ) : getTotalResults() === 0 && searchQuery ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Keine Ergebnisse gefunden</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Versuchen Sie andere Suchbegriffe</Text>
          </View>
        ) : getTotalResults() > 0 ? (
          <View style={styles.resultsContainer}>
            <View style={styles.resultsHeader}>
              <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
                {getTotalResults()} Ergebnis{getTotalResults() !== 1 ? 'se' : ''} gefunden
              </Text>
            </View>

            {searchResults.articles?.length > 0 && (
              <View style={[styles.resultSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.sectionHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                  <Ionicons name="cube" size={20} color={colors.primary} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Artikel ({searchResults.articles.length})</Text>
                </View>
                {searchResults.articles.map((article: any) => (
                  <TouchableOpacity
                    key={article.id}
                    style={[styles.resultItem, { borderBottomColor: colors.border }]}
                    onPress={() => router.push('/articles')}
                  >
                    <View style={styles.resultInfo}>
                      <Text style={[styles.resultName, { color: colors.text }]}>{article.name}</Text>
                      <Text style={[styles.resultDetails, { color: colors.textSecondary }]}>{article.inventory_code}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {searchResults.customers?.length > 0 && (
              <View style={[styles.resultSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.sectionHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                  <Ionicons name="people" size={20} color={colors.primary} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Kunden ({searchResults.customers.length})</Text>
                </View>
                {searchResults.customers.map((customer: any) => (
                  <TouchableOpacity
                    key={customer.id}
                    style={[styles.resultItem, { borderBottomColor: colors.border }]}
                    onPress={() => router.push('/customers')}
                  >
                    <View style={styles.resultInfo}>
                      <Text style={[styles.resultName, { color: colors.text }]}>{customer.name}</Text>
                      <Text style={[styles.resultDetails, { color: colors.textSecondary }]}>{customer.email || customer.company}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {searchResults.events?.length > 0 && (
              <View style={[styles.resultSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.sectionHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                  <Ionicons name="calendar" size={20} color={colors.primary} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Events ({searchResults.events.length})</Text>
                </View>
                {searchResults.events.map((event: any) => (
                  <TouchableOpacity
                    key={event.id}
                    style={[styles.resultItem, { borderBottomColor: colors.border }]}
                    onPress={() => router.push('/events')}
                  >
                    <View style={styles.resultInfo}>
                      <Text style={[styles.resultName, { color: colors.text }]}>{event.title}</Text>
                      <Text style={[styles.resultDetails, { color: colors.textSecondary }]}>{event.location}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {searchResults.suppliers?.length > 0 && (
              <View style={[styles.resultSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.sectionHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                  <Ionicons name="business" size={20} color={colors.primary} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Lieferanten ({searchResults.suppliers.length})</Text>
                </View>
                {searchResults.suppliers.map((supplier: any) => (
                  <TouchableOpacity
                    key={supplier.id}
                    style={[styles.resultItem, { borderBottomColor: colors.border }]}
                    onPress={() => router.push('/suppliers')}
                  >
                    <View style={styles.resultInfo}>
                      <Text style={[styles.resultName, { color: colors.text }]}>{supplier.name}</Text>
                      <Text style={[styles.resultDetails, { color: colors.textSecondary }]}>{supplier.email}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="search" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Geben Sie einen Suchbegriff ein</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Durchsuchen Sie Artikel, Kunden, Events und mehr</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    fontSize: 20,
    fontWeight: 'bold',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
  },
  searchButton: {
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: 'white',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 13,
    marginTop: 8,
  },
  resultsContainer: {
    padding: 16,
  },
  resultsHeader: {
    marginBottom: 16,
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  resultSection: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '600',
  },
  resultDetails: {
    fontSize: 13,
    marginTop: 4,
  },
});
