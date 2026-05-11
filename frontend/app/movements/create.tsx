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

import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { getToken } from '../../services/apiService';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function CreateMovementPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [articles, setArticles] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    article_id: '',
    movement_type: 'IN',
    quantity: '',
    from_location_id: '',
    to_location_id: '',
    reason: '',
    reference_number: '',
  });

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
      fontSize: 20,
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
    movementTypeSelector: {
      flexDirection: 'row',
      gap: 8,
    },
    movementTypeOption: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.border,
    },
    movementTypeOptionActive: {
      backgroundColor: colors.background,
    },
    movementTypeLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 8,
    },
    movementTypeDesc: {
      fontSize: 10,
      color: colors.textSecondary,
      marginTop: 2,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
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
    warningBox: {
      backgroundColor: '#fff3cd',
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: '#ffc107',
    },
    warningText: {
      fontSize: 13,
      color: '#856404',
    },
    articleList: {
      maxHeight: 200,
      backgroundColor: colors.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    articleOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    articleOptionActive: {
      backgroundColor: '#f0f8ff',
    },
    articleInfo: {
      flex: 1,
    },
    articleName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    articleCode: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    articleStock: {
      fontSize: 11,
      color: colors.primary,
      marginTop: 4,
    },
    locationButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    locationButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    locationButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    locationButtonText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    locationButtonTextActive: {
      color: 'white',
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      paddingVertical: 16,
      marginBottom: 32,
      gap: 8,
    },
    createButtonText: {
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
      const token = await getToken();
      if (!token) {
        router.replace('/');
        return;
      }

      // Load articles
      const articlesResponse = await fetch(`${BACKEND_URL}/api/articles`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (articlesResponse.ok) {
        const articlesData = await articlesResponse.json();
        setArticles(articlesData);
      }

      // Load storage locations
      const locationsResponse = await fetch(`${BACKEND_URL}/api/storage-locations`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (locationsResponse.ok) {
        const locationsData = await locationsResponse.json();
        setLocations(locationsData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Fehler', 'Daten konnten nicht geladen werden');
    }
  };

  const handleCreate = async () => {
    if (!formData.article_id) {
      Alert.alert('Fehler', 'Bitte wählen Sie einen Artikel aus');
      return;
    }

    if (!formData.quantity || parseInt(formData.quantity) <= 0) {
      Alert.alert('Fehler', 'Bitte geben Sie eine gültige Menge ein');
      return;
    }

    if (formData.movement_type === 'OUT' && !formData.from_location_id) {
      Alert.alert('Fehler', 'Bitte wählen Sie einen Quellort aus');
      return;
    }

    if (formData.movement_type === 'IN' && !formData.to_location_id) {
      Alert.alert('Fehler', 'Bitte wählen Sie einen Zielort aus');
      return;
    }

    if (formData.movement_type === 'TRANSFER' && (!formData.from_location_id || !formData.to_location_id)) {
      Alert.alert('Fehler', 'Bitte wählen Sie Quell- und Zielort aus');
      return;
    }

    try {
      const token = await getToken();
      const response = await fetch(`${BACKEND_URL}/api/movements`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          quantity: parseInt(formData.quantity),
        }),
      });

      if (response.ok) {
        router.back();
      } else {
        const error = await response.json();
        Alert.alert('Fehler', Array.isArray(error.detail) ? error.detail.map((e: any) => e.msg).join('\n') : error.detail || 'Bewegung konnte nicht erfasst werden');
      }
    } catch (error) {
      console.error('Error creating movement:', error);
      Alert.alert('Fehler', 'Netzwerkfehler');
    }
  };

  const getMovementTypeIcon = (type: string) => {
    switch (type) {
      case 'IN': return 'arrow-down-circle';
      case 'OUT': return 'arrow-up-circle';
      case 'TRANSFER': return 'swap-horizontal';
      default: return 'help-circle';
    }
  };

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'IN': return '#34C759';
      case 'OUT': return '#FF3B30';
      case 'TRANSFER': return '#007AFF';
      default: return colors.textSecondary;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bewegung erfassen</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Movement Type Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bewegungstyp</Text>
            <View style={styles.movementTypeSelector}>
              {[
                { type: 'IN', label: 'Eingang', desc: 'Wareneingang' },
                { type: 'OUT', label: 'Ausgang', desc: 'Warenausgang' },
                { type: 'TRANSFER', label: 'Umlagerung', desc: 'Zwischen Orten' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.type}
                  style={[
                    styles.movementTypeOption,
                    formData.movement_type === item.type && {
                      ...styles.movementTypeOptionActive,
                      borderColor: getMovementTypeColor(item.type),
                    },
                  ]}
                  onPress={() => setFormData({ ...formData, movement_type: item.type })}
                >
                  <Ionicons
                    name={getMovementTypeIcon(item.type) as any}
                    size={28}
                    color={formData.movement_type === item.type ? getMovementTypeColor(item.type) : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.movementTypeLabel,
                      formData.movement_type === item.type && {
                        color: getMovementTypeColor(item.type),
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text style={styles.movementTypeDesc}>{item.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Article Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>Artikel *</Text>
            {articles.length === 0 ? (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>⚠️ Keine Artikel verfügbar</Text>
              </View>
            ) : (
              <ScrollView style={styles.articleList} nestedScrollEnabled>
                {articles.map((article) => (
                  <TouchableOpacity
                    key={article.id}
                    style={[
                      styles.articleOption,
                      formData.article_id === article.id && styles.articleOptionActive,
                    ]}
                    onPress={() => setFormData({ ...formData, article_id: article.id })}
                  >
                    <View style={styles.articleInfo}>
                      <Text style={styles.articleName}>{article.name}</Text>
                      <Text style={styles.articleCode}>{article.inventory_code}</Text>
                      <Text style={styles.articleStock}>
                        Bestand: {article.current_stock} {article.base_unit}
                      </Text>
                    </View>
                    {formData.article_id === article.id && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Quantity */}
          <View style={styles.section}>
            <Text style={styles.label}>Menge *</Text>
            <TextInput
              style={styles.input}
              value={formData.quantity}
              onChangeText={(text) => setFormData({ ...formData, quantity: text })}
              placeholder="Anzahl"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />
          </View>

          {/* Locations */}
          {(formData.movement_type === 'OUT' || formData.movement_type === 'TRANSFER') && (
            <View style={styles.section}>
              <Text style={styles.label}>Von Lagerort *</Text>
              {locations.length === 0 ? (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>⚠️ Keine Lagerorte verfügbar</Text>
                </View>
              ) : (
                <View style={styles.locationButtons}>
                  {locations.map((location) => (
                    <TouchableOpacity
                      key={location.id}
                      style={[
                        styles.locationButton,
                        formData.from_location_id === location.id && styles.locationButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, from_location_id: location.id })}
                    >
                      <Text
                        style={[
                          styles.locationButtonText,
                          formData.from_location_id === location.id && styles.locationButtonTextActive,
                        ]}
                      >
                        {location.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {(formData.movement_type === 'IN' || formData.movement_type === 'TRANSFER') && (
            <View style={styles.section}>
              <Text style={styles.label}>Nach Lagerort *</Text>
              {locations.length === 0 ? (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>⚠️ Keine Lagerorte verfügbar</Text>
                </View>
              ) : (
                <View style={styles.locationButtons}>
                  {locations.map((location) => (
                    <TouchableOpacity
                      key={location.id}
                      style={[
                        styles.locationButton,
                        formData.to_location_id === location.id && styles.locationButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, to_location_id: location.id })}
                    >
                      <Text
                        style={[
                          styles.locationButtonText,
                          formData.to_location_id === location.id && styles.locationButtonTextActive,
                        ]}
                      >
                        {location.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Additional Info */}
          <View style={styles.section}>
            <Text style={styles.label}>Grund / Notizen</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.reason}
              onChangeText={(text) => setFormData({ ...formData, reason: text })}
              placeholder="z.B. Wareneingang, Inventur, Event XY..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.label}>Referenznummer (optional)</Text>
            <TextInput
              style={styles.input}
              value={formData.reference_number}
              onChangeText={(text) => setFormData({ ...formData, reference_number: text })}
              placeholder="z.B. Lieferschein-Nr., Bestellnummer..."
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: getMovementTypeColor(formData.movement_type) }]}
            onPress={handleCreate}
          >
            <Ionicons name={getMovementTypeIcon(formData.movement_type) as any} size={20} color="white" />
            <Text style={styles.createButtonText}>Bewegung erfassen</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
