import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  Switch, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import apiService, { getBackendUrl } from '../../services/apiService';
import { useTheme } from '../../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BACKEND_URL = getBackendUrl();

export default function InvoiceSettingsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [paymentText, setPaymentText] = useState('');

  useEffect(() => {
    apiService.get<any>('/api/settings', { showErrorAlert: false })
      .then(s => {
        setEnabled(s.online_invoices_enabled ?? false);
        setPaymentText(s.online_invoices_payment_text ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiService.put('/api/settings', {
        online_invoices_enabled: enabled,
        online_invoices_payment_text: paymentText.trim() || null,
      });
      Alert.alert('Gespeichert', 'Einstellungen wurden gespeichert.');
    } catch {
      Alert.alert('Fehler', 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    card: { backgroundColor: colors.card, borderRadius: 12, marginHorizontal: 16, marginTop: 16, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginHorizontal: 16, marginTop: 20, marginBottom: 6, textTransform: 'uppercase' },
    input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text, marginHorizontal: 16, minHeight: 80, textAlignVertical: 'top' },
    saveBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', margin: 16, marginTop: 24 },
    infoBox: { backgroundColor: colors.primary + '15', borderRadius: 10, marginHorizontal: 16, marginTop: 12, padding: 14, flexDirection: 'row', gap: 10 },
  });

  if (loading) return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Digitale Rechnungsstellung</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView>
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={{ flex: 1, fontSize: 13, color: colors.primary, lineHeight: 18 }}>
            Wenn aktiviert, können Rechnungen per Link geteilt werden. Kunden sehen die Rechnung in einer öffentlichen Ansicht.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Einstellungen</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ fontSize: 15, color: colors.text }}>Online-Rechnungen aktivieren</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Rechnungen als öffentlichen Link teilen</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="white"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Zahlungstext</Text>
        <TextInput
          style={styles.input}
          value={paymentText}
          onChangeText={setPaymentText}
          placeholder="z.B. Bitte überweisen Sie den Betrag auf folgendes Konto: IBAN DE00 0000 0000 0000"
          placeholderTextColor={colors.textSecondary}
          multiline
          editable={enabled}
        />

        {enabled && (
          <View style={{ marginHorizontal: 16, marginTop: 16, padding: 14, backgroundColor: colors.card, borderRadius: 10 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 }}>Öffentliche URL (Beispiel)</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'monospace' }}>
              {BACKEND_URL}/api/invoices/public/[TOKEN]
            </Text>
          </View>
        )}

        <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.saveBtn, { opacity: saving ? 0.6 : 1 }]}>
          {saving
            ? <ActivityIndicator color="white" size="small" />
            : <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>Speichern</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
