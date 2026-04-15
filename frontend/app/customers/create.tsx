import React, { useState } from 'react';
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
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Modal } from 'react-native';

export default function CreateCustomerPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [touched, setTouched] = useState<{[key: string]: boolean}>({});
  const [formData, setFormData] = useState({
    company_name: '',
    contact_person: '',
    phone: '',
    email: '',
    address_street: '',
    address_zip: '',
    address_city: '',
    address_country: 'Deutschland',
    payment_terms: '',
    contract_info: '',
    notes: '',
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

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, formData[field as keyof typeof formData]);
  };

  const validateField = (field: string, value: string) => {
    let error = '';
    switch(field) {
      case 'company_name':
        if (!value.trim()) error = 'Firmenname ist erforderlich';
        else if (value.trim().length < 2) error = 'Mindestens 2 Zeichen';
        break;
      case 'contact_person':
        if (!value.trim()) error = 'Kontaktperson ist erforderlich';
        break;
      case 'phone':
        if (!value.trim()) error = 'Telefonnummer ist erforderlich';
        break;
      case 'email':
        if (!value.trim()) error = 'E-Mail ist erforderlich';
        else if (!/\S+@\S+\.\S+/.test(value)) error = 'Ungültige E-Mail-Adresse';
        break;
    }
    setErrors(prev => ({ ...prev, [field]: error }));
    return error === '';
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

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Fehler', 'Bitte füllen Sie alle Pflichtfelder korrekt aus');
      return;
    }
    setLoading(true);
    try {
      await apiService.post<any>('/api/customers', { ...formData, contact_persons: contactPersons });
      router.back();
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Fehler beim Erstellen des Kunden');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = [styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }];

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Neuer Kunde</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Grundinformationen</Text>
            
            <Text style={[styles.label, { color: colors.textSecondary }, errors.company_name && touched.company_name && styles.labelError]}>Firmenname *</Text>
            <TextInput style={[inputStyle, errors.company_name && touched.company_name && styles.inputError]} placeholder="z.B. Eventfirma GmbH" placeholderTextColor={colors.textSecondary} value={formData.company_name} onChangeText={(v) => updateField('company_name', v)} onBlur={() => handleBlur('company_name')} />
            {errors.company_name && touched.company_name && <Text style={styles.errorText}>⚠️ {errors.company_name}</Text>}

            <Text style={[styles.label, { color: colors.textSecondary }, errors.contact_person && touched.contact_person && styles.labelError]}>Kontaktperson *</Text>
            <TextInput style={[inputStyle, errors.contact_person && touched.contact_person && styles.inputError]} placeholder="z.B. Max Mustermann" placeholderTextColor={colors.textSecondary} value={formData.contact_person} onChangeText={(v) => updateField('contact_person', v)} onBlur={() => handleBlur('contact_person')} />
            {errors.contact_person && touched.contact_person && <Text style={styles.errorText}>⚠️ {errors.contact_person}</Text>}

            <Text style={[styles.label, { color: colors.textSecondary }, errors.phone && touched.phone && styles.labelError]}>Telefon *</Text>
            <TextInput style={[inputStyle, errors.phone && touched.phone && styles.inputError]} placeholder="z.B. +49 123 456789" placeholderTextColor={colors.textSecondary} value={formData.phone} onChangeText={(v) => updateField('phone', v)} onBlur={() => handleBlur('phone')} keyboardType="phone-pad" />
            {errors.phone && touched.phone && <Text style={styles.errorText}>⚠️ {errors.phone}</Text>}

            <Text style={[styles.label, { color: colors.textSecondary }, errors.email && touched.email && styles.labelError]}>E-Mail *</Text>
            <TextInput style={[inputStyle, errors.email && touched.email && styles.inputError]} placeholder="z.B. kontakt@firma.de" placeholderTextColor={colors.textSecondary} value={formData.email} onChangeText={(v) => updateField('email', v)} onBlur={() => handleBlur('email')} keyboardType="email-address" autoCapitalize="none" />
            {errors.email && touched.email && <Text style={styles.errorText}>⚠️ {errors.email}</Text>}
          </View>

          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Adresse (Optional)</Text>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Straße</Text>
            <TextInput style={inputStyle} placeholder="z.B. Hauptstraße 123" placeholderTextColor={colors.textSecondary} value={formData.address_street} onChangeText={(v) => updateField('address_street', v)} />
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>PLZ</Text>
                <TextInput style={inputStyle} placeholder="12345" placeholderTextColor={colors.textSecondary} value={formData.address_zip} onChangeText={(v) => updateField('address_zip', v)} keyboardType="numeric" />
              </View>
              <View style={styles.halfField}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Stadt</Text>
                <TextInput style={inputStyle} placeholder="München" placeholderTextColor={colors.textSecondary} value={formData.address_city} onChangeText={(v) => updateField('address_city', v)} />
              </View>
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Weitere Informationen</Text>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Notizen</Text>
            <TextInput style={[inputStyle, styles.textArea]} placeholder="Zusätzliche Bemerkungen..." placeholderTextColor={colors.textSecondary} value={formData.notes} onChangeText={(v) => updateField('notes', v)} multiline numberOfLines={3} />
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

          <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary }, loading && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.submitButtonText}>Kunde erstellen</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
