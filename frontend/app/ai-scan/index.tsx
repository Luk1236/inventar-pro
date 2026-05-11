import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  ActivityIndicator, Alert, Image, TextInput
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';

interface DetectedArticle {
  name?: string;
  description?: string;
  category_hint?: string;
  serial_number?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  estimated_quantity?: number;
  condition?: string;
  confidence?: number;
  notes?: string;
}

export default function AIScanPage() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DetectedArticle | null>(null);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [aiInfo, setAiInfo] = useState<string>('');

  useEffect(() => {
    apiService.get('/ai/status').then(d => {
      setAiAvailable(!!d?.available);
      setAiInfo(d?.msg || d?.provider || '');
    }).catch(() => setAiAvailable(false));
  }, []);

  async function pickImage(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Berechtigung fehlt', 'Erlaube Kamera- bzw. Foto-Zugriff in den Einstellungen.');
      return;
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7, allowsEditing: true });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setImageUri(asset.uri);
    setImageBase64(asset.base64 || null);
    setResult(null);
  }

  async function analyze() {
    if (!imageBase64) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await apiService.post('/ai/detect-article', { image_base64: imageBase64 });
      if (r?.ok && r?.data) setResult(r.data);
      else Alert.alert('Fehler', r?.detail || 'Erkennung fehlgeschlagen');
    } catch (e: any) {
      Alert.alert('Fehler', e?.message || 'Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }

  function createArticle() {
    if (!result) return;
    router.push({
      pathname: '/articles/add',
      params: {
        name: result.name || '',
        description: result.description || '',
        serial_number: result.serial_number || '',
        prefill_image: imageBase64 || '',
      },
    });
  }

  const styles = makeStyles(colors);

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style={colors.text === '#fff' ? 'light' : 'dark'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>🤖 AI-Inventur</Text>
        <View style={{ width: 40 }} />
      </View>

      {aiAvailable === false && (
        <View style={[styles.banner, { backgroundColor: '#5c1f1f' }]}>
          <Text style={styles.bannerText}>
            ⚠ AI nicht verfügbar: {aiInfo}
            {'\n'}Setze ANTHROPIC_API_KEY oder OPENAI_API_KEY in der Backend-.env
          </Text>
        </View>
      )}
      {aiAvailable === true && (
        <View style={[styles.banner, { backgroundColor: '#0f3a1f' }]}>
          <Text style={[styles.bannerText, { color: '#3fb950' }]}>✓ AI bereit ({aiInfo})</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.preview} />
        ) : (
          <View style={[styles.preview, styles.previewEmpty]}>
            <Ionicons name="camera-outline" size={64} color={colors.muted} />
            <Text style={{ color: colors.muted, marginTop: 8 }}>Foto aufnehmen oder auswählen</Text>
          </View>
        )}

        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => pickImage(true)}>
            <Ionicons name="camera" size={18} color="#fff" />
            <Text style={styles.btnText}>Kamera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.border }]} onPress={() => pickImage(false)}>
            <Ionicons name="images" size={18} color={colors.text} />
            <Text style={[styles.btnText, { color: colors.text }]}>Galerie</Text>
          </TouchableOpacity>
        </View>

        {imageUri && (
          <TouchableOpacity
            style={[styles.btn, styles.btnFull, { backgroundColor: '#AF52DE', marginTop: 12 }]}
            onPress={analyze}
            disabled={loading || !aiAvailable}
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={styles.btnText}>Analysieren</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {result && (
          <View style={[styles.resultCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.resultTitle, { color: colors.text }]}>
              Erkennung {result.confidence != null && `(${Math.round((result.confidence || 0) * 100)}%)`}
            </Text>
            <Field label="Name" value={result.name} colors={colors} />
            <Field label="Beschreibung" value={result.description} colors={colors} />
            <Field label="Kategorie" value={result.category_hint} colors={colors} />
            <Field label="Hersteller" value={result.manufacturer} colors={colors} />
            <Field label="Modell" value={result.model} colors={colors} />
            <Field label="Seriennummer" value={result.serial_number} colors={colors} />
            <Field label="Zustand" value={result.condition} colors={colors} />
            <Field label="Anzahl" value={result.estimated_quantity?.toString()} colors={colors} />
            <Field label="Notizen" value={result.notes} colors={colors} />
            <TouchableOpacity
              style={[styles.btn, styles.btnFull, { backgroundColor: '#3fb950', marginTop: 16 }]}
              onPress={createArticle}
            >
              <Ionicons name="add-circle" size={18} color="#fff" />
              <Text style={styles.btnText}>Als neuen Artikel anlegen</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, colors }: { label: string; value: any; colors: any }) {
  if (value == null || value === '') return null;
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 2 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 14 }}>{String(value)}</Text>
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBtn: { padding: 8, width: 40 },
  title: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  banner: { padding: 12, marginHorizontal: 16, marginTop: 12, borderRadius: 8 },
  bannerText: { color: '#fff', fontSize: 12 },
  preview: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: colors.card },
  previewEmpty: { justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 8 },
  btnFull: { flex: undefined, width: '100%' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  resultCard: { marginTop: 16, padding: 16, borderRadius: 12, borderWidth: 1 },
  resultTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
});
