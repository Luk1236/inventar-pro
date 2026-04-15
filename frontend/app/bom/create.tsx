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
import { useTheme } from '../../contexts/ThemeContext';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface BOMItem {
  article_id: string;
  quantity: number;
  is_optional: boolean;
}

export default function CreateBOMPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [articles, setArticles] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    package_price: '',
  });
  const [bomItems, setBomItems] = useState<BOMItem[]>([]);
  const [showArticlePicker, setShowArticlePicker] = useState(false);

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
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
      marginTop: 12,
    },
    input: {
      backgroundColor: colors.background,
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
    categoryButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    categoryButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryButtonText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    categoryButtonTextActive: {
      color: colors.card,
    },
    addItemButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    addItemButtonText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
    },
    articlePicker: {
      marginBottom: 12,
    },
    articleList: {
      maxHeight: 200,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    articleOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
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
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 8,
    },
    itemsList: {
      gap: 12,
    },
    bomItem: {
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bomItemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    bomItemInfo: {
      flex: 1,
    },
    bomItemName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    bomItemCode: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    bomItemControls: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    quantityControl: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    controlLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    quantityInput: {
      backgroundColor: colors.card,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 6,
      fontSize: 14,
      width: 60,
      textAlign: 'center',
      color: colors.text,
    },
    optionalToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    optionalToggleActive: {
    },
    optionalText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    optionalTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    createButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 32,
    },
    createButtonText: {
      color: colors.card,
      fontSize: 16,
      fontWeight: '600',
    },
  });

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/api/articles`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setArticles(data);
      }
    } catch (error) {
      console.error('Error loading articles:', error);
    }
  };

  const addArticle = (articleId: string) => {
    const existing = bomItems.find(item => item.article_id === articleId);
    if (existing) {
      Alert.alert('Info', 'Artikel ist bereits in der Strukturliste');
      return;
    }

    setBomItems([
      ...bomItems,
      {
        article_id: articleId,
        quantity: 1,
        is_optional: false,
      },
    ]);
    setShowArticlePicker(false);
  };

  const removeArticle = (articleId: string) => {
    Alert.alert(
      'Artikel entfernen',
      'Möchten Sie diesen Artikel aus der Strukturliste entfernen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: () => {
            setBomItems(bomItems.filter(item => item.article_id !== articleId));
          },
        },
      ]
    );
  };

  const updateQuantity = (articleId: string, quantity: string) => {
    const qty = parseInt(quantity) || 1;
    setBomItems(
      bomItems.map(item =>
        item.article_id === articleId ? { ...item, quantity: qty } : item
      )
    );
  };

  const toggleOptional = (articleId: string) => {
    setBomItems(
      bomItems.map(item =>
        item.article_id === articleId ? { ...item, is_optional: !item.is_optional } : item
      )
    );
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Fehler', 'Name ist erforderlich');
      return;
    }

    if (bomItems.length === 0) {
      Alert.alert('Fehler', 'Bitte fügen Sie mindestens einen Artikel hinzu');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/api/bom`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          category: formData.category || null,
          package_price: formData.package_price ? parseFloat(formData.package_price) : null,
          items: bomItems,
        }),
      });

      if (response.ok) {
        router.back();
      } else {
        Alert.alert('Fehler', 'Erstellen fehlgeschlagen');
      }
    } catch (error) {
      console.error('Error creating BOM:', error);
      Alert.alert('Fehler', 'Netzwerkfehler');
    }
  };

  const getArticleById = (id: string) => {
    return articles.find(a => a.id === id);
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Strukturliste erstellen</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Basic Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Grundinformationen</Text>

            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="z.B. Standardpaket Konzert"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.label}>Beschreibung</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder="Zusätzliche Informationen..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.label}>Kategorie</Text>
            <View style={styles.categoryButtons}>
              {['Konzert', 'Messe', 'Hochzeit', 'Firmenevent', 'Sonstiges'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    formData.category === cat && styles.categoryButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, category: cat })}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      formData.category === cat && styles.categoryButtonTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Paketpreis (optional)</Text>
            <TextInput
              style={styles.input}
              value={formData.package_price}
              onChangeText={(text) => setFormData({ ...formData, package_price: text })}
              placeholder="€"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Items */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Artikel ({bomItems.length})</Text>
              <TouchableOpacity
                style={styles.addItemButton}
                onPress={() => setShowArticlePicker(!showArticlePicker)}
              >
                <Ionicons name="add-circle" size={24} color={colors.primary} />
                <Text style={styles.addItemButtonText}>Hinzufügen</Text>
              </TouchableOpacity>
            </View>

            {showArticlePicker && (
              <View style={styles.articlePicker}>
                <ScrollView style={styles.articleList} nestedScrollEnabled>
                  {articles.map((article) => (
                    <TouchableOpacity
                      key={article.id}
                      style={styles.articleOption}
                      onPress={() => addArticle(article.id)}
                    >
                      <View style={styles.articleInfo}>
                        <Text style={styles.articleName}>{article.name}</Text>
                        <Text style={styles.articleCode}>{article.inventory_code}</Text>
                      </View>
                      <Ionicons name="add" size={24} color={colors.primary} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {bomItems.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="cube-outline" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyText}>Keine Artikel hinzugefügt</Text>
              </View>
            ) : (
              <View style={styles.itemsList}>
                {bomItems.map((item) => {
                  const article = getArticleById(item.article_id);
                  if (!article) return null;

                  return (
                    <View key={item.article_id} style={styles.bomItem}>
                      <View style={styles.bomItemHeader}>
                        <View style={styles.bomItemInfo}>
                          <Text style={styles.bomItemName}>{article.name}</Text>
                          <Text style={styles.bomItemCode}>{article.inventory_code}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => removeArticle(item.article_id)}
                        >
                          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.bomItemControls}>
                        <View style={styles.quantityControl}>
                          <Text style={styles.controlLabel}>Menge:</Text>
                          <TextInput
                            style={styles.quantityInput}
                            value={item.quantity.toString()}
                            onChangeText={(text) => updateQuantity(item.article_id, text)}
                            keyboardType="numeric"
                          />
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.optionalToggle,
                            item.is_optional && styles.optionalToggleActive,
                          ]}
                          onPress={() => toggleOptional(item.article_id)}
                        >
                          <Ionicons
                            name={item.is_optional ? 'checkmark-circle' : 'ellipse-outline'}
                            size={20}
                            color={item.is_optional ? colors.primary : colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.optionalText,
                              item.is_optional && styles.optionalTextActive,
                            ]}
                          >
                            Optional
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreate}
          >
            <Text style={styles.createButtonText}>Strukturliste erstellen</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
