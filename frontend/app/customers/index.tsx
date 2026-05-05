import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import apiService, { getToken } from '../../services/apiService';
import { useTheme } from '../../contexts/ThemeContext';

interface ColorScheme {
  background: string; card: string; text: string; textSecondary: string;
  border: string; primary: string; secondary: string; success: string;
  warning: string; danger: string; info: string;
}
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWebSocket } from '../../hooks/useWebSocket';

interface Customer {
  id: string;
  customer_number: string;
  company_name: string;
  contact_person: string;
  phone: string;
  email: string;
  address_city?: string;
  created_at: string;
}

export default function CustomersPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [lastFetch, setLastFetch] = useState<number>(0);

  useEffect(() => {
    loadCustomers();
  }, []);

  useFocusEffect(useCallback(() => {
    if (Date.now() - lastFetch > 5 * 60 * 1000) {
      loadCustomers();
    }
  }, [lastFetch]));

  useWebSocket((msg) => {
    if (msg.type === 'customer_created' || msg.type === 'customer_updated' || msg.type === 'customer_deleted') {
      loadCustomers();
    }
  });

  useEffect(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      setFilteredCustomers(customers.filter(c =>
        c.company_name.toLowerCase().includes(q) ||
        c.contact_person.toLowerCase().includes(q) ||
        c.customer_number.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      ));
    } else {
      setFilteredCustomers(customers);
    }
  }, [searchQuery, customers]);

  const loadCustomers = async () => {
    try {
      const token = await getToken();
      if (!token) { router.replace('/'); return; }
      const data = await apiService.get<Customer[]>('/api/customers', { showErrorAlert: false });
      setCustomers(data);
      setFilteredCustomers(data);
      setLastFetch(Date.now());
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => { setRefreshing(true); loadCustomers(); };

  const styles = makeStyles(colors, isDark);

  const renderCustomerCard = (customer: Customer) => (
    <TouchableOpacity
      key={customer.id}
      style={styles.customerCard}
      onPress={() => router.push(`/customers/edit/${customer.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Kunde: ${customer.company_name}, Kundennummer: ${customer.customer_number}`}
    >
      <View style={styles.customerHeader}>
        <View style={styles.customerIcon}>
          <Ionicons name="business" size={24} color={colors.primary} />
        </View>
        <View style={styles.customerInfo}>
          <Text style={styles.companyName}>{customer.company_name}</Text>
          <Text style={styles.customerNumber}>{customer.customer_number}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </View>

      <View style={styles.customerDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.detailText}>{customer.contact_person}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="mail-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.detailText}>{customer.email}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="call-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.detailText}>{customer.phone}</Text>
        </View>
        {customer.address_city && (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.detailText}>{customer.address_city}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Lade Kunden...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kunden</Text>
        <TouchableOpacity
          onPress={() => router.push('/customers/create')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Neuen Kunden erstellen"
        >
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Firma, Kontakt, E-Mail suchen..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Suche leeren"
          >
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {filteredCustomers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="business-outline" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'Keine Kunden gefunden' : 'Keine Kunden'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? 'Versuchen Sie eine andere Suche'
                : 'Erstellen Sie Ihren ersten Kunden'}
            </Text>
          </View>
        ) : (
          <View style={styles.customersList}>
            <Text style={styles.countText}>
              {filteredCustomers.length} Kunde{filteredCustomers.length !== 1 ? 'n' : ''}
            </Text>
            {filteredCustomers.map(renderCustomerCard)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorScheme, isDark: boolean) {
  return StyleSheet.create({
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
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      marginHorizontal: 16,
      marginVertical: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
    },
    content: {
      flex: 1,
    },
    customersList: {
      padding: 16,
    },
    countText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 12,
    },
    customerCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    customerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    customerIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: isDark ? '#1a3a5c' : '#f0f6ff',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    customerInfo: {
      flex: 1,
    },
    companyName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    customerNumber: {
      fontSize: 13,
      color: colors.primary,
      marginTop: 2,
    },
    customerDetails: {
      gap: 8,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    detailText: {
      fontSize: 14,
      color: colors.textSecondary,
      flex: 1,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 64,
      paddingHorizontal: 24,
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
    },
  });
}
