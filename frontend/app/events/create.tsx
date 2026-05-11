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
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { getToken } from '../../services/apiService';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

/** Konvertiert TT.MM.JJJJ → YYYY-MM-DD für API-Calls */
const toISO = (d: string) => {
  if (!d) return '';
  const [dd, mm, yyyy] = d.split('.');
  return `${yyyy}-${mm}-${dd}`;
};

const EVENT_TYPES = [
  'Konzert',
  'Messe',
  'Hochzeit',
  'Firmenevent',
  'Theater',
  'Festival',
  'Privates Event',
  'Sonstiges',
];

const LOCATION_TYPES = ['Indoor', 'Outdoor', 'Hybrid'];

interface Customer {
  id: string;
  customer_number: string;
  company_name: string;
}

export default function CreateEventPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showLocationTypePicker, setShowLocationTypePicker] = useState(false);

  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [touched, setTouched] = useState<{[key: string]: boolean}>({});

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [eventName, setEventName] = useState('');
  const [eventType, setEventType] = useState('Konzert');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [locationType, setLocationType] = useState('Indoor');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [setupDate, setSetupDate] = useState('');
  const [teardownDate, setTeardownDate] = useState('');
  const [notes, setNotes] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatePickerVisible, setTemplatePickerVisible] = useState(false);

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
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: 6,
      marginTop: 12,
    },
    labelError: {
      color: '#dc3545',
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
    inputError: {
      borderColor: '#dc3545',
      borderWidth: 1.5,
      backgroundColor: '#fff5f5',
    },
    errorText: {
      color: '#dc3545',
      fontSize: 12,
      marginTop: 4,
      marginLeft: 4,
      fontWeight: '500',
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    pickerButton: {
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    pickerButtonText: {
      fontSize: 16,
      color: colors.text,
    },
    placeholderText: {
      color: colors.textSecondary,
    },
    pickerContainer: {
      marginTop: 8,
      backgroundColor: colors.card,
      borderRadius: 8,
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
      fontSize: 16,
      color: colors.text,
    },
    pickerItemSubtext: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 16,
      alignItems: 'center',
      marginVertical: 24,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: colors.card,
      fontSize: 16,
      fontWeight: '600',
    },
  });

  useEffect(() => {
    loadCustomers();
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${BACKEND_URL}/api/project-templates`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) setTemplates(await response.json());
    } catch { }
  };

  const loadCustomers = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${BACKEND_URL}/api/customers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setCustomersLoading(false);
    }
  };

  const updateField = (field: string, setter: (v: string) => void) => (value: string) => {
    setter(value);
    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field);
  };

  const validateField = (field: string) => {
    let error = '';

    switch(field) {
      case 'customer':
        if (!selectedCustomer) error = 'Kunde ist erforderlich';
        break;
      case 'eventName':
        if (!eventName.trim()) error = 'Veranstaltungsname ist erforderlich';
        else if (eventName.trim().length < 3) error = 'Mindestens 3 Zeichen';
        break;
      case 'location':
        if (!location.trim()) error = 'Veranstaltungsort ist erforderlich';
        break;
      case 'startDate':
        if (!startDate) error = 'Startdatum ist erforderlich';
        else if (!/^\d{2}\.\d{2}\.\d{4}$/.test(startDate)) error = 'Format: TT.MM.JJJJ';
        break;
      case 'endDate':
        if (!endDate) error = 'Enddatum ist erforderlich';
        else if (!/^\d{2}\.\d{2}\.\d{4}$/.test(endDate)) error = 'Format: TT.MM.JJJJ';
        else if (startDate && toISO(endDate) < toISO(startDate)) error = 'Enddatum muss nach Startdatum liegen';
        break;
    }

    setErrors(prev => ({ ...prev, [field]: error }));
    return error === '';
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!selectedCustomer) {
      newErrors.customer = 'Bitte wählen Sie einen Kunden aus';
    }
    if (!eventName.trim()) {
      newErrors.eventName = 'Bitte geben Sie einen Veranstaltungsnamen ein';
    }
    if (!location.trim()) {
      newErrors.location = 'Bitte geben Sie einen Veranstaltungsort ein';
    }
    if (!startDate) {
      newErrors.startDate = 'Bitte geben Sie ein Startdatum ein';
    } else if (!/^\d{2}\.\d{2}\.\d{4}$/.test(startDate)) {
      newErrors.startDate = 'Ungültiges Datumsformat (TT.MM.JJJJ)';
    }
    if (!endDate) {
      newErrors.endDate = 'Bitte geben Sie ein Enddatum ein';
    } else if (!/^\d{2}\.\d{2}\.\d{4}$/.test(endDate)) {
      newErrors.endDate = 'Ungültiges Datumsformat (TT.MM.JJJJ)';
    } else if (startDate && toISO(endDate) < toISO(startDate)) {
      newErrors.endDate = 'Enddatum muss nach Startdatum liegen';
    }

    setErrors(newErrors);
    setTouched({
      customer: true,
      eventName: true,
      location: true,
      startDate: true,
      endDate: true,
    });

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Fehler', 'Bitte füllen Sie alle Pflichtfelder korrekt aus');
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();

      if (!token) {
        Alert.alert('Fehler', 'Nicht angemeldet. Bitte melden Sie sich erneut an.');
        router.replace('/');
        return;
      }

      const eventData: any = {
        customer_id: selectedCustomer!.id,
        event_name: eventName.trim(),
        event_type: eventType,
        description: description.trim() || undefined,
        location: location.trim(),
        location_type: locationType,
        start_date: new Date(toISO(startDate)).toISOString(),
        end_date: new Date(toISO(endDate)).toISOString(),
        notes: notes.trim() || undefined,
      };

      if (setupDate) {
        eventData.setup_date = new Date(toISO(setupDate)).toISOString();
      }
      if (teardownDate) {
        eventData.teardown_date = new Date(toISO(teardownDate)).toISOString();
      }

      const response = await fetch(`${BACKEND_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      if (response.ok) {
        router.back();
      } else if (response.status === 401) {
        Alert.alert('Fehler', 'Sitzung abgelaufen. Bitte melden Sie sich erneut an.');
        router.replace('/');
      } else {
        const error = await response.json();
        const msg = Array.isArray(error.detail)
          ? error.detail.map((e: any) => e.msg).join('\n')
          : error.detail || 'Fehler beim Erstellen der Veranstaltung';
        Alert.alert('Fehler', msg);
      }
    } catch (error) {
      console.error('Error creating event:', error);
      Alert.alert('Fehler', 'Netzwerkfehler beim Erstellen der Veranstaltung');
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
          <Text style={styles.headerTitle}>Neue Veranstaltung</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>

          {/* Vorlage laden */}
          {templates.length > 0 && (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}
              onPress={() => setTemplatePickerVisible(true)}
            >
              <Ionicons name="copy-outline" size={18} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 15 }}>Aus Vorlage laden</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          )}

          {/* Customer Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kunde</Text>

            <Text style={[styles.label, errors.customer && touched.customer && styles.labelError]}>
              Kunde auswählen *
            </Text>
            <TouchableOpacity
              style={[
                styles.pickerButton,
                errors.customer && touched.customer && styles.inputError
              ]}
              onPress={() => {
                setShowCustomerPicker(!showCustomerPicker);
                if (!showCustomerPicker) {
                  setTouched(prev => ({ ...prev, customer: true }));
                }
              }}
            >
              <Text style={[styles.pickerButtonText, !selectedCustomer && styles.placeholderText]}>
                {selectedCustomer ? `${selectedCustomer.company_name} (${selectedCustomer.customer_number})` : 'Kunde auswählen...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            {errors.customer && touched.customer && (
              <Text style={styles.errorText}>⚠️ {errors.customer}</Text>
            )}

            {showCustomerPicker && (
              <View style={styles.pickerContainer}>
                <ScrollView style={styles.pickerScroll}>
                  {customers.map((customer) => (
                    <TouchableOpacity
                      key={customer.id}
                      style={styles.pickerItem}
                      onPress={() => {
                        setSelectedCustomer(customer);
                        setShowCustomerPicker(false);
                        if (errors.customer) {
                          setErrors(prev => ({ ...prev, customer: '' }));
                        }
                      }}
                    >
                      <Text style={styles.pickerItemText}>{customer.company_name}</Text>
                      <Text style={styles.pickerItemSubtext}>{customer.customer_number}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Event Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Veranstaltungsdetails</Text>

            <Text style={[styles.label, errors.eventName && touched.eventName && styles.labelError]}>
              Veranstaltungsname *
            </Text>
            <TextInput
              style={[
                styles.input,
                errors.eventName && touched.eventName && styles.inputError
              ]}
              placeholder="z.B. Sommerfest 2025"
              placeholderTextColor={colors.textSecondary}
              value={eventName}
              onChangeText={updateField('eventName', setEventName)}
              onBlur={() => handleBlur('eventName')}
            />
            {errors.eventName && touched.eventName && (
              <Text style={styles.errorText}>⚠️ {errors.eventName}</Text>
            )}

            <Text style={styles.label}>Veranstaltungstyp *</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowTypePicker(!showTypePicker)}
            >
              <Text style={styles.pickerButtonText}>{eventType}</Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {showTypePicker && (
              <View style={styles.pickerContainer}>
                {EVENT_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={styles.pickerItem}
                    onPress={() => {
                      setEventType(type);
                      setShowTypePicker(false);
                    }}
                  >
                    <Text style={styles.pickerItemText}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.label}>Beschreibung</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Details zur Veranstaltung..."
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Veranstaltungsort</Text>

            <Text style={[styles.label, errors.location && touched.location && styles.labelError]}>
              Ort *
            </Text>
            <TextInput
              style={[
                styles.input,
                errors.location && touched.location && styles.inputError
              ]}
              placeholder="z.B. Olympiastadion München"
              placeholderTextColor={colors.textSecondary}
              value={location}
              onChangeText={updateField('location', setLocation)}
              onBlur={() => handleBlur('location')}
            />
            {errors.location && touched.location && (
              <Text style={styles.errorText}>⚠️ {errors.location}</Text>
            )}

            <Text style={styles.label}>Ort-Typ</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowLocationTypePicker(!showLocationTypePicker)}
            >
              <Text style={styles.pickerButtonText}>{locationType}</Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {showLocationTypePicker && (
              <View style={styles.pickerContainer}>
                {LOCATION_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={styles.pickerItem}
                    onPress={() => {
                      setLocationType(type);
                      setShowLocationTypePicker(false);
                    }}
                  >
                    <Text style={styles.pickerItemText}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Dates */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Termine</Text>

            <Text style={[styles.label, errors.startDate && touched.startDate && styles.labelError]}>
              Startdatum * (TT.MM.JJJJ)
            </Text>
            <TextInput
              style={[
                styles.input,
                errors.startDate && touched.startDate && styles.inputError
              ]}
              placeholder="15.06.2025"
              placeholderTextColor={colors.textSecondary}
              value={startDate}
              onChangeText={updateField('startDate', setStartDate)}
              onBlur={() => handleBlur('startDate')}
            />
            {errors.startDate && touched.startDate && (
              <Text style={styles.errorText}>⚠️ {errors.startDate}</Text>
            )}

            <Text style={[styles.label, errors.endDate && touched.endDate && styles.labelError]}>
              Enddatum * (TT.MM.JJJJ)
            </Text>
            <TextInput
              style={[
                styles.input,
                errors.endDate && touched.endDate && styles.inputError
              ]}
              placeholder="17.06.2025"
              placeholderTextColor={colors.textSecondary}
              value={endDate}
              onChangeText={updateField('endDate', setEndDate)}
              onBlur={() => handleBlur('endDate')}
            />
            {errors.endDate && touched.endDate && (
              <Text style={styles.errorText}>⚠️ {errors.endDate}</Text>
            )}

            <Text style={styles.label}>Aufbaudatum (TT.MM.JJJJ)</Text>
            <TextInput
              style={styles.input}
              placeholder="14.06.2025"
              placeholderTextColor={colors.textSecondary}
              value={setupDate}
              onChangeText={setSetupDate}
            />

            <Text style={styles.label}>Abbaudatum (TT.MM.JJJJ)</Text>
            <TextInput
              style={styles.input}
              placeholder="18.06.2025"
              placeholderTextColor={colors.textSecondary}
              value={teardownDate}
              onChangeText={setTeardownDate}
            />
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notizen (Optional)</Text>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Zusätzliche Informationen..."
              placeholderTextColor={colors.textSecondary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.submitButtonText}>Veranstaltung erstellen</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Template Picker Modal */}
      <Modal visible={templatePickerVisible} animationType="slide" transparent onRequestClose={() => setTemplatePickerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 16 }}>Vorlage auswählen</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {templates.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={{ padding: 14, borderRadius: 10, backgroundColor: colors.background, marginBottom: 8 }}
                  onPress={() => {
                    if (t.event_type) setEventType(t.event_type);
                    if (t.location_type) setLocationType(t.location_type);
                    if (t.notes_template) setNotes(t.notes_template);
                    setTemplatePickerVisible(false);
                  }}
                >
                  <Text style={{ fontWeight: '600', color: colors.text, fontSize: 15 }}>{t.name}</Text>
                  {t.description ? <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{t.description}</Text> : null}
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {t.event_type ? <View style={{ backgroundColor: colors.primary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}><Text style={{ color: colors.primary, fontSize: 12 }}>{t.event_type}</Text></View> : null}
                    {t.location_type ? <View style={{ backgroundColor: colors.border, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}><Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t.location_type}</Text></View> : null}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setTemplatePickerVisible(false)} style={{ padding: 14, alignItems: 'center', marginTop: 8 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
