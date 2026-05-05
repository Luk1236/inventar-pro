import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { router } from 'expo-router';
import apiService, { getToken } from '../../services/apiService';
import { useTheme } from '../../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWebSocket } from '../../hooks/useWebSocket';

interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  notes?: string;
}

export default function SuppliersPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    notes: '',
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  useWebSocket((msg) => {
    if (msg.type === 'supplier_created' || msg.type === 'supplier_updated' || msg.type === 'supplier_deleted') {
      loadSuppliers();
    }
  });

  const loadSuppliers = async () => {
    try {
      const token = await getToken();
      if (!token) {
        router.replace('/');
        return;
      }

      const data = await apiService.get<Supplier[]>('/api/suppliers', { showErrorAlert: false });
      setSuppliers(data);
    } catch (error: any) {
      console.error('Error loading suppliers:', error);
      if (error.message !== 'Authentication failed') {
        Alert.alert('Fehler', 'Lieferanten konnten nicht geladen werden');
      }
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      website: '',
      notes: '',
    });
    setShowModal(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      website: supplier.website || '',
      notes: supplier.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Fehler', 'Name ist erforderlich');
      return;
    }

    try {
      if (editingSupplier) {
        await apiService.put(`/api/suppliers/${editingSupplier.id}`, formData);
      } else {
        await apiService.post('/api/suppliers', formData);
      }

      Alert.alert(
        '✅ Erfolg',
        editingSupplier ? 'Lieferant aktualisiert!' : 'Lieferant erstellt!',
        [{ text: 'OK', onPress: () => {
          setShowModal(false);
          loadSuppliers();
        }}]
      );
    } catch (error: any) {
      if (error.message !== 'Authentication failed') {
        Alert.alert('Fehler', 'Speichern fehlgeschlagen');
      }
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!(window as any).confirm(`"${supplier.name}" wirklich löschen?`)) return;
    try {
      await apiService.delete(`/api/suppliers/${supplier.id}`);
      loadSuppliers();
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Löschen fehlgeschlagen');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Lieferanten ({suppliers.length})</Text>
        <TouchableOpacity onPress={openCreateModal}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {suppliers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Keine Lieferanten</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Fügen Sie Ihren ersten Lieferanten hinzu</Text>
            <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={openCreateModal}>
              <Text style={styles.addButtonText}>Lieferant erstellen</Text>
            </TouchableOpacity>
          </View>
        ) : (
          suppliers.map((supplier) => (
            <View key={supplier.id} style={[styles.supplierCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.supplierContent}
                onPress={() => openEditModal(supplier)}
              >
                <View style={[styles.supplierIcon, { backgroundColor: isDark ? '#1c3a5e' : '#E3F2FD' }]}>
                  <Ionicons name="business" size={24} color={colors.primary} />
                </View>
                <View style={styles.supplierInfo}>
                  <Text style={styles.supplierName}>{supplier.name}</Text>
                  {supplier.contact_person && (
                    <Text style={styles.supplierDetail}>👤 {supplier.contact_person}</Text>
                  )}
                  {supplier.email && (
                    <Text style={styles.supplierDetail}>📧 {supplier.email}</Text>
                  )}
                  {supplier.phone && (
                    <Text style={styles.supplierDetail}>📞 {supplier.phone}</Text>
                  )}
                </View>
              </TouchableOpacity>
              <View style={styles.supplierActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => openEditModal(supplier)}
                >
                  <Ionicons name="create-outline" size={20} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDelete(supplier)}
                >
                  <Ionicons name="trash-outline" size={20} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingSupplier ? 'Lieferant bearbeiten' : 'Neuer Lieferant'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({...formData, name: text})}
                placeholder="Lieferantenname"
              />

              <Text style={styles.label}>Kontaktperson</Text>
              <TextInput
                style={styles.input}
                value={formData.contact_person}
                onChangeText={(text) => setFormData({...formData, contact_person: text})}
                placeholder="Name der Kontaktperson"
              />

              <Text style={styles.label}>E-Mail</Text>
              <TextInput
                style={styles.input}
                value={formData.email}
                onChangeText={(text) => setFormData({...formData, email: text})}
                placeholder="email@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Telefon</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(text) => setFormData({...formData, phone: text})}
                placeholder="+49 123 456789"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Adresse</Text>
              <TextInput
                style={styles.input}
                value={formData.address}
                onChangeText={(text) => setFormData({...formData, address: text})}
                placeholder="Straße, PLZ Stadt"
              />

              <Text style={styles.label}>Website</Text>
              <TextInput
                style={styles.input}
                value={formData.website}
                onChangeText={(text) => setFormData({...formData, website: text})}
                placeholder="https://example.com"
                keyboardType="url"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Notizen</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notes}
                onChangeText={(text) => setFormData({...formData, notes: text})}
                placeholder="Zusätzliche Informationen..."
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Speichern</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  addButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 24,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  supplierCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  supplierContent: {
    flexDirection: 'row',
    padding: 16,
  },
  supplierIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f3f4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  supplierInfo: {
    flex: 1,
  },
  supplierName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  supplierDetail: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  supplierActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f3f4',
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#FF3B30',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalForm: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
