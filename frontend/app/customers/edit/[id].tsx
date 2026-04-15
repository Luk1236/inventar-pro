import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../contexts/ThemeContext';
import apiService from '../../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Modal } from 'react-native';

export default function EditCustomerPage() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customerNumber, setCustomerNumber] = useState('');
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [touched, setTouched] = useState<{[key: string]: boolean}>({});
  const [formData, setFormData] = useState({
    company_name: '', contact_person: '', phone: '', email: '',
    address_street: '', address_zip: '', address_city: '', address_country: 'Deutschland',
    payment_terms: '', contract_info: '', notes: '',
  });
  const [contactPersons, setContactPersons] = useState<{name: string; phone: string; email: string; role: string}[]>([]);
  const [showContactModal, setShowContactModal] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', role: '' });

  const addContact = () => {
    if (!newContact.name.trim()) return;
    setContactPersons(prev => [...prev, { ...newContact }]);
    setNewContact({ name: '', phone: '', email: '', role: '' });
    setShowContactModal(false);
  };
  const removeContact = (index: number) => {
    setContactPersons(prev => prev.filter((_, i) => i !== index));
  };

  const loadCustomer = useCallback(async () => {
    try {
      const customer = await apiService.get<any>(`/api/customers/${id}`);
      setCustomerNumber(customer.customer_number);
      setFormData({
        company_name: customer.company_name || '', contact_person: customer.contact_person || '',
        phone: customer.phone || '', email: customer.email || '',
        address_street: customer.address_street || '', address_zip: customer.address_zip || '',
        address_city: customer.address_city || '', address_country: customer.address_country || 'Deutschland',
        payment_terms: customer.payment_terms || '', contract_info: customer.contract_info || '', notes: customer.notes || '',
      });
      setContactPersons(customer.contact_persons || []);
    } catch (error) {
      Alert.alert('Fehler', 'Kunde konnte nicht geladen werden');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) loadCustomer(); }, [id, loadCustomer]);

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};
    if (!formData.company_name.trim()) newErrors.company_name = 'Firmenname ist erforderlich';
    if (!formData.contact_person.trim()) newErrors.contact_person = 'Kontaktperson ist erforderlich';
    if (!formData.phone.trim()) newErrors.phone = 'Telefonnummer ist erforderlich';
    if (!formData.email.trim()) newErrors.email = 'E-Mail ist erforderlich';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Ungültige E-Mail-Adresse';
    setErrors(newErrors);
    setTouched({ company_name: true, contact_person: true, phone: true, email: true });
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) { Alert.alert('Fehler', 'Bitte füllen Sie alle Pflichtfelder korrekt aus'); return; }
    setSaving(true);
    try {
      await apiService.put(`/api/customers/${id}`, { ...formData, contact_persons: contactPersons });
      router.back();
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Fehler beim Aktualisieren');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Kunde löschen', `Möchten Sie "${formData.company_name}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => {
        try {
          await apiService.delete(`/api/customers/${id}`);
          Alert.alert('✅ Erfolg', 'Kunde wurde gelöscht', [{ text: 'OK', onPress: () => router.replace('/customers') }]);
        } catch { Alert.alert('Fehler', 'Löschen fehlgeschlagen'); }
      }},
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Lade Kunde...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const inputStyle = [styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }];

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{customerNumber}</Text>
          <TouchableOpacity onPress={handleDelete}>
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Grundinformationen</Text>
            
            <Text style={[styles.label, { color: colors.textSecondary }, errors.company_name && styles.labelError]}>Firmenname *</Text>
            <TextInput style={[inputStyle, errors.company_name && styles.inputError]} value={formData.company_name} onChangeText={(v) => updateField('company_name', v)} placeholderTextColor={colors.textSecondary} />
            {errors.company_name && touched.company_name && <Text style={styles.errorText}>⚠️ {errors.company_name}</Text>}

            <Text style={[styles.label, { color: colors.textSecondary }, errors.contact_person && styles.labelError]}>Kontaktperson *</Text>
            <TextInput style={[inputStyle, errors.contact_person && styles.inputError]} value={formData.contact_person} onChangeText={(v) => updateField('contact_person', v)} placeholderTextColor={colors.textSecondary} />

            <Text style={[styles.label, { color: colors.textSecondary }, errors.phone && styles.labelError]}>Telefon *</Text>
            <TextInput style={[inputStyle, errors.phone && styles.inputError]} value={formData.phone} onChangeText={(v) => updateField('phone', v)} keyboardType="phone-pad" placeholderTextColor={colors.textSecondary} />

            <Text style={[styles.label, { color: colors.textSecondary }, errors.email && styles.labelError]}>E-Mail *</Text>
            <TextInput style={[inputStyle, errors.email && styles.inputError]} value={formData.email} onChangeText={(v) => updateField('email', v)} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={colors.textSecondary} />
          </View>

          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Adresse</Text>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Straße</Text>
            <TextInput style={inputStyle} value={formData.address_street} onChangeText={(v) => updateField('address_street', v)} placeholderTextColor={colors.textSecondary} />
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>PLZ</Text>
                <TextInput style={inputStyle} value={formData.address_zip} onChangeText={(v) => updateField('address_zip', v)} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
              </View>
              <View style={styles.halfField}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Stadt</Text>
                <TextInput style={inputStyle} value={formData.address_city} onChangeText={(v) => updateField('address_city', v)} placeholderTextColor={colors.textSecondary} />
              </View>
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Notizen</Text>
            <TextInput style={[inputStyle, styles.textArea]} value={formData.notes} onChangeText={(v) => updateField('notes', v)} multiline numberOfLines={3} placeholderTextColor={colors.textSecondary} />
          </View>

          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Kontaktpersonen</Text>
              <TouchableOpacity onPress={() => setShowContactModal(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Hinzufügen</Text>
              </TouchableOpacity>
            </View>
            {contactPersons.length === 0 ? (
              <Text style={{ color: colors.textSecondary, fontSize: 14, fontStyle: 'italic' }}>Keine Kontaktpersonen</Text>
            ) : (
              contactPersons.map((cp, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.background, borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{cp.name}</Text>
                    {cp.role ? <Text style={{ color: colors.primary, fontSize: 12 }}>{cp.role}</Text> : null}
                    {cp.phone ? <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{cp.phone}</Text> : null}
                    {cp.email ? <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{cp.email}</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => removeContact(i)}>
                    <Ionicons name="close-circle" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          <Modal visible={showContactModal} transparent animationType="slide">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
              <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Kontakt hinzufügen</Text>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Name *</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} placeholder="Name" placeholderTextColor={colors.textSecondary} value={newContact.name} onChangeText={v => setNewContact(p => ({ ...p, name: v }))} />
                <Text style={[styles.label, { color: colors.textSecondary }]}>Rolle</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} placeholder="z.B. Geschäftsführer" placeholderTextColor={colors.textSecondary} value={newContact.role} onChangeText={v => setNewContact(p => ({ ...p, role: v }))} />
                <Text style={[styles.label, { color: colors.textSecondary }]}>Telefon</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} placeholder="+49 ..." placeholderTextColor={colors.textSecondary} keyboardType="phone-pad" value={newContact.phone} onChangeText={v => setNewContact(p => ({ ...p, phone: v }))} />
                <Text style={[styles.label, { color: colors.textSecondary }]}>E-Mail</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} placeholder="email@firma.de" placeholderTextColor={colors.textSecondary} keyboardType="email-address" autoCapitalize="none" value={newContact.email} onChangeText={v => setNewContact(p => ({ ...p, email: v }))} />
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                  <TouchableOpacity onPress={() => setShowContactModal(false)} style={{ flex: 1, borderRadius: 8, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.text, fontWeight: '600' }}>Abbrechen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={addContact} style={{ flex: 1, borderRadius: 8, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.primary }}>
                    <Text style={{ color: 'white', fontWeight: '600' }}>Hinzufügen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary }, saving && styles.submitButtonDisabled]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="white" /> : <Text style={styles.submitButtonText}>Änderungen speichern</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  section: { borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6, marginTop: 12 },
  input: { borderRadius: 8, padding: 12, fontSize: 16, borderWidth: 1 },
  textArea: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  submitButton: { borderRadius: 8, paddingVertical: 16, alignItems: 'center', marginVertical: 24 },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  labelError: { color: '#dc3545' },
  inputError: { borderColor: '#dc3545', borderWidth: 1.5 },
  errorText: { color: '#dc3545', fontSize: 12, marginTop: 4 },
});
