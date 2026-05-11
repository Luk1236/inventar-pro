import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView,
  ActivityIndicator, Alert, TextInput, Modal, ScrollView
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';

interface Warehouse {
  id: string;
  name: string;
  address?: string;
  city?: string;
  postal_code?: string;
  contact_person?: string;
  phone?: string;
  notes?: string;
  is_default?: boolean;
  archived?: boolean;
}

export default function WarehousesPage() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [items, setItems] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiService.get('/warehouses');
      setItems(Array.isArray(r) ? r : []);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function deleteItem(w: Warehouse) {
    Alert.alert('Lager löschen', `"${w.name}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          try {
            await apiService.delete(`/warehouses/${w.id}`);
            load();
          } catch (e: any) {
            Alert.alert('Fehler', e?.message || 'Konnte nicht löschen');
          }
        }
      }
    ]);
  }

  const styles = makeStyles(colors);

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style={colors.text === '#fff' ? 'light' : 'dark'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>📍 Lager / Standorte</Text>
        <TouchableOpacity onPress={() => { setEditing(null); setShowForm(true); }} style={styles.iconBtn}>
          <Ionicons name="add" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="business-outline" size={64} color={colors.muted} />
          <Text style={{ color: colors.muted, marginTop: 12, textAlign: 'center', paddingHorizontal: 40 }}>
            Noch keine Lager angelegt.{'\n'}Tippe oben auf + um eines zu erstellen.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                {item.is_default && <Text style={styles.badge}>Standard</Text>}
                {item.archived && <Text style={styles.badgeArchived}>Archiviert</Text>}
              </View>
              {item.address && <Text style={[styles.itemSub, { color: colors.muted }]}>{item.address}</Text>}
              {(item.postal_code || item.city) && (
                <Text style={[styles.itemSub, { color: colors.muted }]}>
                  {item.postal_code} {item.city}
                </Text>
              )}
              {item.contact_person && (
                <Text style={[styles.itemSub, { color: colors.muted }]}>👤 {item.contact_person}</Text>
              )}
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => { setEditing(item); setShowForm(true); }}>
                  <Ionicons name="create-outline" size={22} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteItem(item)}>
                  <Ionicons name="trash-outline" size={22} color="#f85149" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <WarehouseForm
        visible={showForm}
        editing={editing}
        colors={colors}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); load(); }}
      />
    </SafeAreaView>
  );
}

function WarehouseForm({ visible, editing, colors, onClose, onSaved }: any) {
  const [data, setData] = useState<Partial<Warehouse>>({});

  useEffect(() => {
    setData(editing || { country: 'DE' });
  }, [editing, visible]);

  async function save() {
    if (!data.name?.trim()) {
      Alert.alert('Fehler', 'Name ist erforderlich');
      return;
    }
    try {
      if (editing?.id) await apiService.put(`/warehouses/${editing.id}`, data);
      else await apiService.post('/warehouses', data);
      onSaved();
    } catch (e: any) {
      Alert.alert('Fehler', e?.message || 'Speichern fehlgeschlagen');
    }
  }

  const styles = makeStyles(colors);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{editing ? 'Lager bearbeiten' : 'Neues Lager'}</Text>
          <TouchableOpacity onPress={save} style={styles.iconBtn}>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>Speichern</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {(['name', 'address', 'postal_code', 'city', 'country', 'contact_person', 'phone', 'notes'] as const).map(field => (
            <View key={field} style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>
                {labelMap[field]}{field === 'name' && ' *'}
              </Text>
              <TextInput
                value={(data as any)[field] || ''}
                onChangeText={t => setData({ ...data, [field]: t })}
                placeholder={labelMap[field]}
                placeholderTextColor={colors.muted}
                multiline={field === 'notes'}
                style={{
                  backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1,
                  borderRadius: 8, padding: 12, color: colors.text,
                  minHeight: field === 'notes' ? 80 : undefined,
                }}
              />
            </View>
          ))}
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }}
            onPress={() => setData({ ...data, is_default: !data.is_default })}
          >
            <Ionicons
              name={data.is_default ? 'checkbox' : 'square-outline'}
              size={24}
              color={data.is_default ? colors.primary : colors.muted}
            />
            <Text style={{ color: colors.text }}>Als Standard-Lager markieren</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const labelMap: Record<string, string> = {
  name: 'Name', address: 'Adresse', postal_code: 'PLZ', city: 'Stadt',
  country: 'Land', contact_person: 'Ansprechpartner', phone: 'Telefon', notes: 'Notizen',
};

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBtn: { padding: 8, minWidth: 40 },
  title: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  itemName: { fontSize: 16, fontWeight: '600', flex: 1 },
  itemSub: { fontSize: 12, marginTop: 2 },
  badge: { backgroundColor: '#3fb950', color: '#fff', fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 },
  badgeArchived: { backgroundColor: '#8b949e', color: '#fff', fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 10, justifyContent: 'flex-end' },
});
