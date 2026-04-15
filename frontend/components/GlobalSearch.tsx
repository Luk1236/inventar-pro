import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import apiService from '../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SearchResult {
  id: string;
  type: 'article' | 'customer' | 'event' | 'bundle';
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  route: string;
}

interface GlobalSearchProps {
  visible: boolean;
  onClose: () => void;
}

export default function GlobalSearch({ visible, onClose }: GlobalSearchProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    try {
      const searchResults: SearchResult[] = [];

      // Search articles
      const articles = await apiService.get<any[]>(`/api/articles?search=${encodeURIComponent(searchQuery)}`, { showErrorAlert: false });
      if (articles) {
        articles.slice(0, 5).forEach(article => {
          searchResults.push({
            id: article.id,
            type: 'article',
            title: article.name,
            subtitle: `${article.inventory_code} • ${article.current_stock} Stk.`,
            icon: 'cube-outline',
            color: '#007AFF',
            route: `/articles/${article.id}`
          });
        });
      }

      // Search customers
      const customers = await apiService.get<any[]>('/api/customers', { showErrorAlert: false });
      if (customers) {
        const filteredCustomers = customers.filter(c => 
          c.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.contact_person?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        filteredCustomers.slice(0, 3).forEach(customer => {
          searchResults.push({
            id: customer.id,
            type: 'customer',
            title: customer.company_name,
            subtitle: customer.contact_person || customer.email,
            icon: 'people-outline',
            color: '#34C759',
            route: `/customers/edit/${customer.id}`
          });
        });
      }

      // Search events
      const events = await apiService.get<any[]>('/api/events', { showErrorAlert: false });
      if (events) {
        const filteredEvents = events.filter(e => 
          e.event_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.event_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.location?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        filteredEvents.slice(0, 3).forEach(event => {
          searchResults.push({
            id: event.id,
            type: 'event',
            title: event.event_name,
            subtitle: `${event.event_number} • ${event.location}`,
            icon: 'calendar-outline',
            color: '#5856D6',
            route: `/events/detail/${event.id}`
          });
        });
      }

      // Search bundles
      const bundles = await apiService.get<any[]>('/api/bundles?active_only=false', { showErrorAlert: false });
      if (bundles) {
        const filteredBundles = bundles.filter(b => 
          b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.bundle_code?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        filteredBundles.slice(0, 2).forEach(bundle => {
          searchResults.push({
            id: bundle.id,
            type: 'bundle',
            title: bundle.name,
            subtitle: `${bundle.bundle_code} • ${bundle.total_items} Artikel`,
            icon: 'cube',
            color: '#FF9500',
            route: '/bundles'
          });
        });
      }

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultPress = (result: SearchResult) => {
    // Save to recent searches
    const updatedRecent = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updatedRecent);
    
    onClose();
    setQuery('');
    router.push(result.route as any);
  };

  const handleRecentSearch = (search: string) => {
    setQuery(search);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    Keyboard.dismiss();
  };

  const renderResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={[styles.resultItem, { backgroundColor: colors.card }]}
      onPress={() => handleResultPress(item)}
    >
      <View style={[styles.resultIcon, { backgroundColor: item.color + '20' }]}>
        <Ionicons name={item.icon as any} size={22} color={item.color} />
      </View>
      <View style={styles.resultContent}>
        <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.subtitle}
        </Text>
      </View>
      <View style={[styles.typeBadge, { backgroundColor: item.color + '15' }]}>
        <Text style={[styles.typeText, { color: item.color }]}>
          {item.type === 'article' ? 'Artikel' : 
           item.type === 'customer' ? 'Kunde' : 
           item.type === 'event' ? 'Event' : 'Bundle'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        {/* Search Header */}
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={[styles.searchBar, { backgroundColor: colors.background }]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Artikel, Kunden, Events suchen..."
              placeholderTextColor={colors.textSecondary}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={clearSearch}>
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={[styles.cancelText, { color: colors.primary }]}>Abbrechen</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Suche...</Text>
            </View>
          ) : query.length < 2 ? (
            <View style={styles.emptyState}>
              {recentSearches.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Letzte Suchen</Text>
                  {recentSearches.map((search, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.recentItem, { backgroundColor: colors.card }]}
                      onPress={() => handleRecentSearch(search)}
                    >
                      <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                      <Text style={[styles.recentText, { color: colors.text }]}>{search}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
              
              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Schnellzugriff</Text>
              <View style={styles.quickLinks}>
                <TouchableOpacity 
                  style={[styles.quickLink, { backgroundColor: colors.card }]}
                  onPress={() => { onClose(); router.push('/articles'); }}
                >
                  <Ionicons name="cube-outline" size={24} color="#007AFF" />
                  <Text style={[styles.quickLinkText, { color: colors.text }]}>Artikel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.quickLink, { backgroundColor: colors.card }]}
                  onPress={() => { onClose(); router.push('/events'); }}
                >
                  <Ionicons name="calendar-outline" size={24} color="#5856D6" />
                  <Text style={[styles.quickLinkText, { color: colors.text }]}>Events</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.quickLink, { backgroundColor: colors.card }]}
                  onPress={() => { onClose(); router.push('/customers'); }}
                >
                  <Ionicons name="people-outline" size={24} color="#34C759" />
                  <Text style={[styles.quickLinkText, { color: colors.text }]}>Kunden</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.quickLink, { backgroundColor: colors.card }]}
                  onPress={() => { onClose(); router.push('/scanner'); }}
                >
                  <Ionicons name="qr-code-outline" size={24} color="#FF9500" />
                  <Text style={[styles.quickLinkText, { color: colors.text }]}>Scanner</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.noResults}>
              <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.noResultsText, { color: colors.text }]}>
                {`Keine Ergebnisse für "${query}"`}
              </Text>
              <Text style={[styles.noResultsHint, { color: colors.textSecondary }]}>
                Versuchen Sie andere Suchbegriffe
              </Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => `${item.type}-${item.id}`}
              renderItem={renderResult}
              contentContainerStyle={styles.resultsList}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
                  {results.length} Ergebnisse gefunden
                </Text>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  cancelButton: {
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyState: {
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    gap: 10,
  },
  recentText: {
    fontSize: 15,
  },
  quickLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickLink: {
    width: '47%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  quickLinkText: {
    fontSize: 13,
    fontWeight: '500',
  },
  noResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  noResultsHint: {
    fontSize: 14,
    marginTop: 8,
  },
  resultsList: {
    paddingBottom: 20,
  },
  resultsCount: {
    fontSize: 13,
    marginBottom: 12,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
  },
  resultIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  resultSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
