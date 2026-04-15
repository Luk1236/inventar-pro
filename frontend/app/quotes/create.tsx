import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, TextInput, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import apiService from '../../services/apiService';
import { useTheme } from '../../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const toISO = (d: string) => { if (!d || !d.includes('.')) return d; const [dd, mm, yyyy] = d.split('.'); return `${yyyy}-${mm}-${dd}`; };

export default function CreateQuotePage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showArticlePicker, setShowArticlePicker] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState('0');
  const [items, setItems] = useState<{article_id: string; article_name: string; quantity: number; unit_price: number; days: number; total: number}[]>([]);
  const [articleSearch, setArticleSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [c, a] = await Promise.all([
          apiService.get<any[]>('/api/customers', { showErrorAlert: false }),
          apiService.get<any[]>('/api/articles', { showErrorAlert: false }),
        ]);
        setCustomers(c);
        setArticles(a);
      } catch {}
    };
    load();
  }, []);

  const addArticle = (article: any) => {
    setItems(prev => [...prev, {
      article_id: article.id,
      article_name: article.name,
      quantity: 1,
      unit_price: article.rental_price || article.price_per_unit || 0,
      days: 1,
      total: article.rental_price || article.price_per_unit || 0,
    }]);
    setShowArticlePicker(false);
    setArticleSearch('');
  };

  const updateItem = (i: number, field: string, value: string) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: field === 'article_name' ? value : Number(value) || 0 };
      updated.total = updated.unit_price * updated.quantity * updated.days;
      return updated;
    }));
  };

  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const totalNet = (() => {
    const sub = items.reduce((s, item) => s + item.total, 0);
    const disc = parseFloat(discount) || 0;
    return sub * (1 - disc / 100);
  })();

  const handleSave = async () => {
    if (!customerName.trim()) { Alert.alert('Fehler', 'Kundenname ist erforderlich'); return; }
    if (!eventName.trim()) { Alert.alert('Fehler', 'Projektname ist erforderlich'); return; }
    setLoading(true);
    try {
      await apiService.post('/api/quotes', {
        customer_id: customerId || null,
        customer_name: customerName,
        event_name: eventName,
        event_date: eventDate ? toISO(eventDate) : null,
        valid_until: validUntil ? toISO(validUntil) : null,
        items,
        notes: notes || null,
        discount_percent: parseFloat(discount) || 0,
      });
      router.back();
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Speichern fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = [styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }];
  const filteredArticles = articles.filter(a => a.name?.toLowerCase().includes(articleSearch.toLowerCase()));

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Neues Angebot</Text>
          <TouchableOpacity onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>Speichern</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          {/* Customer section */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Kunde</Text>
            <TouchableOpacity style={[inputStyle, { justifyContent: 'center' }]} onPress={() => setShowCustomerPicker(true)}>
              <Text style={{ color: customerName ? colors.text : colors.textSecondary }}>
                {customerName || 'Kunde auswählen oder eingeben...'}
              </Text>
            </TouchableOpacity>
            {customerName ? (
              <TextInput style={[inputStyle, { marginTop: 8 }]} value={customerName} onChangeText={setCustomerName} placeholder="Kundenname" placeholderTextColor={colors.textSecondary} />
            ) : null}
          </View>

          {/* Event info */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Projektinfo</Text>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Projektname *</Text>
            <TextInput style={inputStyle} value={eventName} onChangeText={setEventName} placeholder="z.B. Konzert Berlin" placeholderTextColor={colors.textSecondary} />
            <Text style={[styles.label, { color: colors.textSecondary }]}>Datum (optional)</Text>
            <TextInput style={inputStyle} value={eventDate} onChangeText={setEventDate} placeholder="z.B. 15.05.2026" placeholderTextColor={colors.textSecondary} />
            <Text style={[styles.label, { color: colors.textSecondary }]}>Gültig bis</Text>
            <TextInput style={inputStyle} value={validUntil} onChangeText={setValidUntil} placeholder="z.B. 01.04.2026" placeholderTextColor={colors.textSecondary} />
          </View>

          {/* Items */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Positionen</Text>
              <TouchableOpacity onPress={() => setShowArticlePicker(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Artikel</Text>
              </TouchableOpacity>
            </View>
            {items.length === 0 ? (
              <Text style={{ color: colors.textSecondary, fontStyle: 'italic', fontSize: 13 }}>Noch keine Artikel hinzugefügt</Text>
            ) : (
              items.map((item, i) => (
                <View key={i} style={{ backgroundColor: colors.background, borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ color: colors.text, fontWeight: '600', flex: 1 }}>{item.article_name}</Text>
                    <TouchableOpacity onPress={() => removeItem(i)}>
                      <Ionicons name="close-circle" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 3 }}>Menge</Text>
                      <TextInput style={[inputStyle, { padding: 8, fontSize: 14 }]} value={String(item.quantity)} onChangeText={v => updateItem(i, 'quantity', v)} keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 3 }}>Tage</Text>
                      <TextInput style={[inputStyle, { padding: 8, fontSize: 14 }]} value={String(item.days)} onChangeText={v => updateItem(i, 'days', v)} keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 3 }}>Preis/Tag €</Text>
                      <TextInput style={[inputStyle, { padding: 8, fontSize: 14 }]} value={String(item.unit_price)} onChangeText={v => updateItem(i, 'unit_price', v)} keyboardType="decimal-pad" />
                    </View>
                  </View>
                  <Text style={{ color: colors.primary, fontWeight: '700', textAlign: 'right', marginTop: 4 }}>€{item.total.toFixed(2)}</Text>
                </View>
              ))
            )}
            {items.length > 0 && (
              <View>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Rabatt %</Text>
                <TextInput style={inputStyle} value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textSecondary} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Netto Gesamt:</Text>
                  <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '700' }}>€{totalNet.toFixed(2)}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Notes */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Notizen</Text>
            <TextInput style={[inputStyle, { height: 80, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} multiline placeholder="Zusätzliche Bemerkungen..." placeholderTextColor={colors.textSecondary} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Customer picker modal */}
      <Modal visible={showCustomerPicker} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '70%' }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Kunde auswählen</Text>
            <ScrollView>
              {customers.map(c => (
                <TouchableOpacity key={c.id} onPress={() => { setCustomerName(c.company_name); setCustomerId(c.id); setShowCustomerPicker(false); }}
                  style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{c.company_name}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{c.contact_person}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setShowCustomerPicker(false)} style={{ marginTop: 16, alignItems: 'center' }}>
                <Text style={{ color: '#FF3B30', fontWeight: '600' }}>Abbrechen</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Article picker modal */}
      <Modal visible={showArticlePicker} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '75%' }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Artikel auswählen</Text>
            <TextInput style={[inputStyle, { marginBottom: 12 }]} value={articleSearch} onChangeText={setArticleSearch} placeholder="Suchen..." placeholderTextColor={colors.textSecondary} />
            <ScrollView>
              {filteredArticles.map(a => (
                <TouchableOpacity key={a.id} onPress={() => addArticle(a)}
                  style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{a.name}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                    {a.inventory_code} · €{(a.rental_price || a.price_per_unit || 0).toFixed(2)}/Tag
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => { setShowArticlePicker(false); setArticleSearch(''); }} style={{ marginTop: 16, alignItems: 'center' }}>
                <Text style={{ color: '#FF3B30', fontWeight: '600' }}>Abbrechen</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6, marginTop: 8 },
  input: { borderRadius: 8, padding: 12, fontSize: 15, borderWidth: 1 },
});
