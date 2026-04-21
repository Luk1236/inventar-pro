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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function BOMDetailPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [bomDetails, setBomDetails] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [showEventPicker, setShowEventPicker] = useState(false);

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
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
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
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    bomCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    bomImage: {
      width: '100%',
      height: 150,
      borderRadius: 8,
      marginBottom: 12,
    },
    bomName: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    bomDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 8,
    },
    bomCategory: {
      fontSize: 14,
      color: colors.primary,
    },
    pricingCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    pricingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    pricingLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    pricingValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    packagePrice: {
      color: '#34C759',
      fontSize: 18,
    },
    savingsValue: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FF9500',
    },
    articlesSection: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    articleCard: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    articleImage: {
      width: 60,
      height: 60,
      borderRadius: 8,
      marginRight: 12,
    },
    articleInfo: {
      flex: 1,
    },
    articleName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    articleCode: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    articleQuantity: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
      marginBottom: 4,
    },
    optionalBadge: {
      fontSize: 11,
      color: '#FF9500',
      backgroundColor: '#FFF3E0',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      alignSelf: 'flex-start',
      marginBottom: 4,
    },
    articlePricing: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    articlePrice: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    articleTotal: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    articleStock: {
      fontSize: 11,
      color: '#34C759',
    },
    bookButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 16,
      marginBottom: 32,
      gap: 8,
    },
    bookButtonText: {
      color: colors.card,
      fontSize: 16,
      fontWeight: '600',
    },
    eventPickerOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    eventPickerContent: {
      backgroundColor: colors.card,
      borderRadius: 12,
      width: '90%',
      maxHeight: '80%',
    },
    eventPickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    eventPickerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    eventList: {
      maxHeight: 400,
    },
    eventItem: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    eventName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    eventNumber: {
      fontSize: 12,
      color: colors.primary,
      marginBottom: 2,
    },
    eventDate: {
      fontSize: 12,
      color: colors.textSecondary,
    },
  });

  const loadBOMDetails = useCallback(async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${BACKEND_URL}/api/bom/${id}/details`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBomDetails(data);
      }
    } catch (error) {
      console.error('Error loading BOM:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadEvents = useCallback(async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${BACKEND_URL}/api/events`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    }
  }, []);

  useEffect(() => {
    loadBOMDetails();
    loadEvents();
  }, [id, loadBOMDetails, loadEvents]);

  const bookToEvent = async (eventId: string) => {
    try {
      const token = await getToken();
      const response = await fetch(`${BACKEND_URL}/api/bom/${id}/book-to-event?event_id=${eventId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        Alert.alert(
          '✅ Erfolg!',
          `${result.bookings_created} Artikel wurden gebucht!`,
          [{ text: 'OK', onPress: () => setShowEventPicker(false) }]
        );
      } else if (response.status === 409) {
        Alert.alert('⚠️ Konflikt', 'Einige Artikel sind bereits gebucht oder nicht verfügbar');
      } else {
        Alert.alert('Fehler', 'Buchung fehlgeschlagen');
      }
    } catch (error) {
      Alert.alert('Fehler', 'Netzwerkfehler');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!bomDetails) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>BOM nicht gefunden</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>BOM Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {/* BOM Info */}
        <View style={styles.bomCard}>
          {bomDetails.bom.image_base64 && (
            <Image
              source={{ uri: bomDetails.bom.image_base64 }}
              style={styles.bomImage}
              resizeMode="cover"
            />
          )}
          <Text style={styles.bomName}>{bomDetails.bom.name}</Text>
          {bomDetails.bom.description && (
            <Text style={styles.bomDescription}>{bomDetails.bom.description}</Text>
          )}
          {bomDetails.bom.category && (
            <Text style={styles.bomCategory}>📂 {bomDetails.bom.category}</Text>
          )}
        </View>

        {/* Pricing */}
        <View style={styles.pricingCard}>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Regulärer Preis:</Text>
            <Text style={styles.pricingValue}>€{bomDetails.total_regular_price.toFixed(2)}</Text>
          </View>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Paket-Preis:</Text>
            <Text style={[styles.pricingValue, styles.packagePrice]}>€{bomDetails.package_price.toFixed(2)}</Text>
          </View>
          {bomDetails.discount_amount > 0 && (
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Ersparnis:</Text>
              <Text style={styles.savingsValue}>-€{bomDetails.discount_amount.toFixed(2)} ({bomDetails.discount_percent}%)</Text>
            </View>
          )}
        </View>

        {/* Articles List */}
        <View style={styles.articlesSection}>
          <Text style={styles.sectionTitle}>Enthaltene Artikel ({bomDetails.items.length})</Text>

          {bomDetails.items.map((item: any, index: number) => (
            <View key={index} style={styles.articleCard}>
              {item.image_base64 && (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${item.image_base64}` }}
                  style={styles.articleImage}
                />
              )}
              <View style={styles.articleInfo}>
                <Text style={styles.articleName}>{item.article_name}</Text>
                <Text style={styles.articleCode}>{item.article_code}</Text>
                <Text style={styles.articleQuantity}>Menge: {item.quantity}x</Text>
                {item.is_optional && (
                  <Text style={styles.optionalBadge}>Optional</Text>
                )}
                <View style={styles.articlePricing}>
                  <Text style={styles.articlePrice}>€{item.unit_price.toFixed(2)}/Stk</Text>
                  <Text style={styles.articleTotal}>Gesamt: €{item.total_price.toFixed(2)}</Text>
                </View>
                <Text style={styles.articleStock}>
                  Verfügbar: {item.current_stock} Stk
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Book to Event Button */}
        <TouchableOpacity
          style={styles.bookButton}
          onPress={() => setShowEventPicker(true)}
        >
          <Ionicons name="calendar" size={20} color={colors.card} />
          <Text style={styles.bookButtonText}>Zu Event buchen</Text>
        </TouchableOpacity>

        {/* Event Picker Modal */}
        {showEventPicker && (
          <View style={styles.eventPickerOverlay}>
            <View style={styles.eventPickerContent}>
              <View style={styles.eventPickerHeader}>
                <Text style={styles.eventPickerTitle}>Event auswählen</Text>
                <TouchableOpacity onPress={() => setShowEventPicker(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.eventList}>
                {events.map((event) => (
                  <TouchableOpacity
                    key={event.id}
                    style={styles.eventItem}
                    onPress={() => bookToEvent(event.id)}
                  >
                    <Text style={styles.eventName}>{event.event_name}</Text>
                    <Text style={styles.eventNumber}>{event.event_number}</Text>
                    <Text style={styles.eventDate}>
                      {new Date(event.start_date).toLocaleDateString('de-DE')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
