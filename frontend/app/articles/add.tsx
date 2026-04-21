import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as ImagePicker from 'expo-image-picker';

import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Category {
  id: string;
  name: string;
  description?: string;
}

interface Supplier {
  id: string;
  name: string;
  contact_email?: string;
}

interface StorageLocation {
  id: string;
  name: string;
  type: string;
}

interface ArticleFormData {
  name: string;
  description: string;
  category_id: string;
  supplier_id: string;
  storage_location_id: string;
  inventory_code: string;
  base_unit: string;
  min_stock_level: string;
  price_per_unit: string;
  rental_price: string;
  image_base64: string;
  // NEW: Equipment-spezifische Felder
  weight_kg: string;
  power_watt: string;
  power_type: string;
  operating_hours: string;
  max_operating_hours: string;
  rental_factor_weekend: string;
  rental_factor_week: string;
  is_consumable: boolean;
  is_sub_rental: boolean;
  sub_rental_supplier_id: string;
  sub_rental_cost: string;
}

export default function AddArticlePage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showSubRentalSupplierModal, setShowSubRentalSupplierModal] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [formData, setFormData] = useState<ArticleFormData>({
    name: '',
    description: '',
    category_id: '',
    supplier_id: '',
    storage_location_id: '',
    inventory_code: '',
    base_unit: 'Stück',
    min_stock_level: '0',
    price_per_unit: '0',
    rental_price: '',
    image_base64: '',
    weight_kg: '',
    power_watt: '',
    power_type: '',
    operating_hours: '',
    max_operating_hours: '',
    rental_factor_weekend: '',
    rental_factor_week: '',
    is_consumable: false,
    is_sub_rental: false,
    sub_rental_supplier_id: '',
    sub_rental_cost: '',
  });

  const units = ['Stück', 'kg', 'Liter', 'Meter', 'Rolle', 'Karton', 'Paar'];

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
    saveButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingBottom: 32,
    },
    section: {
      backgroundColor: colors.card,
      marginTop: 12,
      paddingHorizontal: 24,
      paddingVertical: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    imageContainer: {
      alignItems: 'center',
      marginBottom: 8,
    },
    selectedImage: {
      width: 150,
      height: 150,
      borderRadius: 12,
    },
    imagePlaceholder: {
      width: 150,
      height: 150,
      borderRadius: 12,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    imagePlaceholderText: {
      marginTop: 8,
      fontSize: 14,
      color: colors.textSecondary,
    },
    inputGroup: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.card,
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    selector: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.card,
    },
    selectorText: {
      fontSize: 16,
      color: colors.text,
    },
    placeholderText: {
      color: colors.textSecondary,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    codeInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    codeInput: {
      flex: 1,
      marginRight: 12,
    },
    generateButton: {
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.card,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modal: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    modalItem: {
      paddingHorizontal: 24,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalItemText: {
      fontSize: 16,
      color: colors.text,
    },
    modalItemSubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
  });

  useEffect(() => {
    loadData();
    generateInventoryCode();
  }, []);

  const loadData = async () => {
    try {
      const token = await getToken();
      if (!token) {
        router.replace('/');
        return;
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const [categoriesRes, suppliersRes, locationsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/categories`, { headers }),
        fetch(`${BACKEND_URL}/api/suppliers`, { headers }),
        fetch(`${BACKEND_URL}/api/storage-locations`, { headers }),
      ]);

      if (categoriesRes.ok && suppliersRes.ok && locationsRes.ok) {
        const [categoriesData, suppliersData, locationsData] = await Promise.all([
          categoriesRes.json(),
          suppliersRes.json(),
          locationsRes.json(),
        ]);

        setCategories(categoriesData);
        setSuppliers(suppliersData);
        setStorageLocations(locationsData);
      } else {
        Alert.alert('Fehler', 'Daten konnten nicht geladen werden');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Fehler', 'Netzwerkfehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const generateInventoryCode = () => {
    const prefix = 'ART';
    const timestamp = Date.now().toString().slice(-6);
    const randomNum = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const code = `${prefix}-${timestamp}-${randomNum}`;
    setFormData(prev => ({ ...prev, inventory_code: code }));
  };

  const handleImagePicker = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Berechtigung erforderlich', 'Bitte erlauben Sie den Zugriff auf die Foto-Bibliothek');
      return;
    }

    Alert.alert(
      'Foto auswählen',
      'Woher möchten Sie das Foto nehmen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Kamera', onPress: () => openCamera() },
        { text: 'Galerie', onPress: () => openImageLibrary() },
      ]
    );
  };

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Berechtigung erforderlich', 'Bitte erlauben Sie den Zugriff auf die Kamera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setFormData(prev => ({ ...prev, image_base64: result.assets[0].base64! }));
    }
  };

  const openImageLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setFormData(prev => ({ ...prev, image_base64: result.assets[0].base64! }));
    }
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert('Fehler', 'Artikelname ist erforderlich');
      return false;
    }
    if (!formData.category_id) {
      Alert.alert('Fehler', 'Bitte wählen Sie eine Kategorie');
      return false;
    }
    if (!formData.inventory_code.trim()) {
      Alert.alert('Fehler', 'Inventar-Code ist erforderlich');
      return false;
    }
    if (isNaN(Number(formData.price_per_unit)) || Number(formData.price_per_unit) < 0) {
      Alert.alert('Fehler', 'Preis pro Einheit muss eine gültige Zahl sein');
      return false;
    }
    if (isNaN(Number(formData.min_stock_level)) || Number(formData.min_stock_level) < 0) {
      Alert.alert('Fehler', 'Mindestbestand muss eine gültige Zahl sein');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const token = await getToken();

      const toFloat = (v: string) => (v.trim() !== '' ? Number(v) : null);
      const toInt = (v: string) => (v.trim() !== '' ? parseInt(v, 10) : null);

      const articleData = {
        ...formData,
        price_per_unit: Number(formData.price_per_unit) || 0,
        min_stock_level: Number(formData.min_stock_level) || 0,
        rental_price: toFloat(formData.rental_price),
        supplier_id: formData.supplier_id || null,
        storage_location_id: formData.storage_location_id || null,
        power_type: formData.power_type || null,
        sub_rental_supplier_id: formData.sub_rental_supplier_id || null,
        weight_kg: toFloat(formData.weight_kg),
        power_watt: toInt(formData.power_watt),
        operating_hours: toFloat(formData.operating_hours) ?? 0,
        max_operating_hours: toFloat(formData.max_operating_hours),
        rental_factor_weekend: toFloat(formData.rental_factor_weekend) ?? 1.5,
        rental_factor_week: toFloat(formData.rental_factor_week) ?? 3.0,
        sub_rental_cost: toFloat(formData.sub_rental_cost),
      };

      const response = await fetch(`${BACKEND_URL}/api/articles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(articleData),
      });

      if (response.ok) {
        router.back();
      } else {
        const error = await response.json();
        const msg = Array.isArray(error.detail)
          ? error.detail.map((e: any) => e.msg).join('\n')
          : error.detail || 'Artikel konnte nicht erstellt werden';
        Alert.alert('Fehler', msg);
      }
    } catch (error) {
      console.error('Error saving article:', error);
      Alert.alert('Fehler', 'Netzwerkfehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Kategorie auswählen';
  };

  const getSupplierName = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || 'Lieferant auswählen';
  };

  const getStorageLocationName = (locationId: string) => {
    const location = storageLocations.find(l => l.id === locationId);
    return location?.name || 'Lagerort auswählen';
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Lade...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Neuer Artikel</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.saveButtonText}>Speichern</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Image Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Foto</Text>
          <TouchableOpacity style={styles.imageContainer} onPress={handleImagePicker}>
            {formData.image_base64 ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${formData.image_base64}` }}
                style={styles.selectedImage}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="camera-outline" size={48} color="#ccc" />
                <Text style={styles.imagePlaceholderText}>Foto hinzufügen</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Basic Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Grundinformationen</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Artikelname *</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
              placeholder="z.B. Mikrofon Shure SM58"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Beschreibung</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              placeholder="Detaillierte Beschreibung des Artikels"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Kategorie *</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowCategoryModal(true)}
            >
              <Text style={[styles.selectorText, !formData.category_id && styles.placeholderText]}>
                {getCategoryName(formData.category_id)}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Lieferant</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowSupplierModal(true)}
            >
              <Text style={[styles.selectorText, !formData.supplier_id && styles.placeholderText]}>
                {getSupplierName(formData.supplier_id)}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Lagerort</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowStorageModal(true)}
            >
              <Text style={[styles.selectorText, !formData.storage_location_id && styles.placeholderText]}>
                {getStorageLocationName(formData.storage_location_id)}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Inventory Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inventar & Bestand</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Inventar-Code *</Text>
            <View style={styles.codeInputContainer}>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={formData.inventory_code}
                onChangeText={(text) => setFormData(prev => ({ ...prev, inventory_code: text }))}
                placeholder="ART-123456-01"
                placeholderTextColor={colors.textSecondary}
              />
              <TouchableOpacity
                style={styles.generateButton}
                onPress={generateInventoryCode}
              >
                <Ionicons name="refresh" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Maßeinheit</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowUnitModal(true)}
            >
              <Text style={styles.selectorText}>{formData.base_unit}</Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mindestbestand</Text>
            <TextInput
              style={styles.input}
              value={formData.min_stock_level}
              onChangeText={(text) => setFormData(prev => ({ ...prev, min_stock_level: text }))}
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.label}>Verbrauchsmaterial</Text>
            <Switch
              value={formData.is_consumable}
              onValueChange={(value) => setFormData(prev => ({ ...prev, is_consumable: value }))}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="white"
            />
          </View>
        </View>

        {/* Technical Specifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Technische Daten</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gewicht (kg)</Text>
            <TextInput
              style={styles.input}
              value={formData.weight_kg}
              onChangeText={(text) => setFormData(prev => ({ ...prev, weight_kg: text }))}
              placeholder="z.B. 12.5"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Leistung (Watt)</Text>
            <TextInput
              style={styles.input}
              value={formData.power_watt}
              onChangeText={(text) => setFormData(prev => ({ ...prev, power_watt: text }))}
              placeholder="z.B. 2000"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Price Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preise</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Preis pro Einheit (€) *</Text>
            <TextInput
              style={styles.input}
              value={formData.price_per_unit}
              onChangeText={(text) => setFormData(prev => ({ ...prev, price_per_unit: text }))}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mietpreis pro Tag (€)</Text>
            <TextInput
              style={styles.input}
              value={formData.rental_price}
              onChangeText={(text) => setFormData(prev => ({ ...prev, rental_price: text }))}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Sub-Rental Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zumietung (Sub-Rental)</Text>

          <View style={styles.switchRow}>
            <Text style={styles.label}>Ist Zumietartikel</Text>
            <Switch
              value={formData.is_sub_rental}
              onValueChange={(value) => setFormData(prev => ({ ...prev, is_sub_rental: value }))}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="white"
            />
          </View>

          {formData.is_sub_rental && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Vermieter / Lieferant</Text>
                <TouchableOpacity
                  style={styles.selector}
                  onPress={() => setShowSubRentalSupplierModal(true)}
                >
                  <Text style={[styles.selectorText, !formData.sub_rental_supplier_id && styles.placeholderText]}>
                    {getSupplierName(formData.sub_rental_supplier_id)}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mietkosten pro Einheit (€)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.sub_rental_cost}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, sub_rental_cost: text }))}
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                />
              </View>
            </>
          )}
        </View>
      </KeyboardAwareScrollView>

      {/* Category Modal */}
      <Modal
        visible={showCategoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kategorie auswählen</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {categories.map(category => (
                <TouchableOpacity
                  key={category.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, category_id: category.id }));
                    setShowCategoryModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{category.name}</Text>
                  {category.description && (
                    <Text style={styles.modalItemSubtext}>{category.description}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Supplier Modal */}
      <Modal
        visible={showSupplierModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSupplierModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lieferant auswählen</Text>
              <TouchableOpacity onPress={() => setShowSupplierModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  setFormData(prev => ({ ...prev, supplier_id: '' }));
                  setShowSupplierModal(false);
                }}
              >
                <Text style={styles.modalItemText}>Kein Lieferant</Text>
              </TouchableOpacity>
              {suppliers.map(supplier => (
                <TouchableOpacity
                  key={supplier.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, supplier_id: supplier.id }));
                    setShowSupplierModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{supplier.name}</Text>
                  {supplier.contact_email && (
                    <Text style={styles.modalItemSubtext}>{supplier.contact_email}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Sub-Rental Supplier Modal */}
      <Modal
        visible={showSubRentalSupplierModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSubRentalSupplierModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Vermieter auswählen</Text>
              <TouchableOpacity onPress={() => setShowSubRentalSupplierModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  setFormData(prev => ({ ...prev, sub_rental_supplier_id: '' }));
                  setShowSubRentalSupplierModal(false);
                }}
              >
                <Text style={styles.modalItemText}>Kein Vermieter</Text>
              </TouchableOpacity>
              {suppliers.map(supplier => (
                <TouchableOpacity
                  key={supplier.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, sub_rental_supplier_id: supplier.id }));
                    setShowSubRentalSupplierModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{supplier.name}</Text>
                  {supplier.contact_email && (
                    <Text style={styles.modalItemSubtext}>{supplier.contact_email}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Storage Location Modal */}
      <Modal
        visible={showStorageModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowStorageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lagerort auswählen</Text>
              <TouchableOpacity onPress={() => setShowStorageModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  setFormData(prev => ({ ...prev, storage_location_id: '' }));
                  setShowStorageModal(false);
                }}
              >
                <Text style={styles.modalItemText}>Kein Lagerort</Text>
              </TouchableOpacity>
              {storageLocations.map(location => (
                <TouchableOpacity
                  key={location.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, storage_location_id: location.id }));
                    setShowStorageModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{location.name}</Text>
                  <Text style={styles.modalItemSubtext}>{location.type}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Unit Modal */}
      <Modal
        visible={showUnitModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowUnitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Maßeinheit auswählen</Text>
              <TouchableOpacity onPress={() => setShowUnitModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {units.map(unit => (
                <TouchableOpacity
                  key={unit}
                  style={styles.modalItem}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, base_unit: unit }));
                    setShowUnitModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{unit}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
