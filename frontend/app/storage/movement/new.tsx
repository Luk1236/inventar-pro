import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function NewMovementPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [articles, setArticles] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [movementType, setMovementType] = useState<'in' | 'out' | 'transfer'>('in');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [showArticlePicker, setShowArticlePicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    typeRow: {
      flexDirection: 'row',
      gap: 12,
    },
    typeButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 16,
      gap: 8,
    },
    typeButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    typeText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    typeTextActive: {
      color: 'white',
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    picker: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pickerText: {
      fontSize: 15,
      color: colors.text,
    },
    placeholder: {
      color: colors.textSecondary,
    },
    pickerList: {
      backgroundColor: colors.card,
      borderRadius: 8,
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 200,
    },
    pickerScroll: {
      maxHeight: 200,
    },
    pickerItem: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    pickerItemText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    pickerItemSubtext: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    pickerItemStock: {
      fontSize: 11,
      color: '#34C759',
    },
    input: {
      backgroundColor: colors.card,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    hint: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 16,
      marginBottom: 32,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');

      const [articlesRes, locationsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/articles`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${BACKEND_URL}/api/storage-locations`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (articlesRes.ok) setArticles(await articlesRes.json());
      if (locationsRes.ok) setLocations(await locationsRes.json());
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleSubmit = async () => {
    if (!selectedArticle || !quantity || !selectedLocation) {
      Alert.alert('Fehler', 'Bitte füllen Sie alle Felder aus');
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Fehler', 'Ungültige Menge');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/api/movements`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          article_id: selectedArticle.id,
          movement_type: movementType,
          quantity: qty,
          from_location_id: movementType === 'out' ? selectedLocation.id : undefined,
          to_location_id: movementType === 'in' ? selectedLocation.id : undefined,
          notes: notes.trim() || undefined,
        }),
      });

      if (response.ok) {
        router.back();
      } else {
        const error = await response.json();
        Alert.alert('Fehler', Array.isArray(error.detail) ? error.detail.map((e: any) => e.msg).join('\n') : error.detail || 'Bewegung konnte nicht erfasst werden');
      }
    } catch (error) {
      Alert.alert('Fehler', 'Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Neue Bewegung</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          {/* Movement Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bewegungsart</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeButton, movementType === 'in' && styles.typeButtonActive]}
                onPress={() => setMovementType('in')}
              >
                <Ionicons name="arrow-down-circle" size={24} color={movementType === 'in' ? 'white' : '#34C759'} />
                <Text style={[styles.typeText, movementType === 'in' && styles.typeTextActive]}>Einlagerung</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, movementType === 'out' && styles.typeButtonActive]}
                onPress={() => setMovementType('out')}
              >
                <Ionicons name="arrow-up-circle" size={24} color={movementType === 'out' ? 'white' : '#FF9500'} />
                <Text style={[styles.typeText, movementType === 'out' && styles.typeTextActive]}>Auslagerung</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Article Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>Artikel *</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowArticlePicker(!showArticlePicker)}
            >
              <Text style={[styles.pickerText, !selectedArticle && styles.placeholder]}>
                {selectedArticle ? `${selectedArticle.name} (${selectedArticle.inventory_code})` : 'Artikel auswählen'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {showArticlePicker && (
              <View style={styles.pickerList}>
                <ScrollView style={styles.pickerScroll}>
                  {articles.map((article) => (
                    <TouchableOpacity
                      key={article.id}
                      style={styles.pickerItem}
                      onPress={() => {
                        setSelectedArticle(article);
                        setShowArticlePicker(false);
                      }}
                    >
                      <Text style={styles.pickerItemText}>{article.name}</Text>
                      <Text style={styles.pickerItemSubtext}>{article.inventory_code}</Text>
                      <Text style={styles.pickerItemStock}>Bestand: {article.current_stock}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Location Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>
              {movementType === 'in' ? 'Ziellagerort' : 'Quelllagerort'} *
            </Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowLocationPicker(!showLocationPicker)}
            >
              <Text style={[styles.pickerText, !selectedLocation && styles.placeholder]}>
                {selectedLocation ? selectedLocation.name : 'Lagerort auswählen'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {showLocationPicker && (
              <View style={styles.pickerList}>
                <ScrollView style={styles.pickerScroll}>
                  {locations.map((location) => (
                    <TouchableOpacity
                      key={location.id}
                      style={styles.pickerItem}
                      onPress={() => {
                        setSelectedLocation(location);
                        setShowLocationPicker(false);
                      }}
                    >
                      <Text style={styles.pickerItemText}>{location.name}</Text>
                      <Text style={styles.pickerItemSubtext}>{location.type}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Quantity */}
          <View style={styles.section}>
            <Text style={styles.label}>Menge *</Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              placeholder="z.B. 5"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />
            {selectedArticle && (
              <Text style={styles.hint}>Aktueller Bestand: {selectedArticle.current_stock}</Text>
            )}
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.label}>Notizen (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Zusätzliche Informationen..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Speichern...' : 'Bewegung erfassen'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
