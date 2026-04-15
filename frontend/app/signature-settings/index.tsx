import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  Switch, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import apiService from '../../services/apiService';
import { useTheme } from '../../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SignatureSettingsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [requireQuotes, setRequireQuotes] = useState(false);
  const [requireDelivery, setRequireDelivery] = useState(false);
  const [footerText, setFooterText] = useState('');

  useEffect(() => {
    apiService.get<any>('/api/settings', { showErrorAlert: false })
      .then(s => {
        setRequireQuotes(s.signature_require_quotes ?? false);
        setRequireDelivery(s.signature_require_delivery ?? false);
        setFooterText(s.signature_footer_text ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiService.put('/api/settings', {
        signature_require_quotes: requireQuotes,
        signature_require_delivery: requireDelivery,
        signature_footer_text: footerText.trim() || null,
      });
      Alert.alert('Gespeichert', 'Unterschrift-Einstellungen wurden gespeichert.');
    } catch {
      Alert.alert('Fehler', 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 20, paddingVertical: 16,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    card: {
      backgroundColor: colors.card, borderRadius: 12, marginHorizontal: 16,
      marginTop: 16, overflow: 'hidden',
    },
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    rowLast: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14,
    },
    rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
    label: { fontSize: 15, color: colors.text, flex: 1 },
    sublabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginHorizontal: 16, marginTop: 20, marginBottom: 6, textTransform: 'uppercase' },
    input: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 10, padding: 12, fontSize: 15, color: colors.text,
      marginHorizontal: 16, minHeight: 80, textAlignVertical: 'top',
    },
    saveBtn: {
      backgroundColor: colors.primary, borderRadius: 12, padding: 15,
      alignItems: 'center', margin: 16, marginTop: 24,
    },
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
        <Text style={styles.headerTitle}>Digitale Unterschrift</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView>
        <Text style={styles.sectionTitle}>Unterschrift erforderlich</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View>
                <Text style={styles.label}>Angebote</Text>
                <Text style={styles.sublabel}>Kundenunterschrift beim Akzeptieren</Text>
              </View>
            </View>
            <Switch
              value={requireQuotes}
              onValueChange={setRequireQuotes}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="white"
            />
          </View>
          <View style={styles.rowLast}>
            <View style={styles.rowLeft}>
              <View>
                <Text style={styles.label}>Lieferbestätigung</Text>
                <Text style={styles.sublabel}>Unterschrift bei Übergabe/Rückgabe</Text>
              </View>
            </View>
            <Switch
              value={requireDelivery}
              onValueChange={setRequireDelivery}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="white"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Unterschrift-Text</Text>
        <TextInput
          style={styles.input}
          value={footerText}
          onChangeText={setFooterText}
          placeholder="z.B. Ich bestätige die Richtigkeit der Angaben und akzeptiere die AGB."
          placeholderTextColor={colors.textSecondary}
          multiline
        />

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
