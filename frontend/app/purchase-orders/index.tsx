import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, Alert, ActivityIndicator, Modal, RefreshControl
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface OrderItem {
  article_name: string;
  quantity: string;
  unit_price: string;
}

interface PurchaseOrder {
  id: string;
  order_number: string;
  supplier_name: string;
  order_date: string;
  expected_delivery: string;
  status: string;
  items: { article_name: string; quantity: number; unit_price: number }[];
  notes: string;
  total_amount: number;
  created_at: string;
}

interface Supplier {
  id: string;
  name: string;
}

const STATUS_COLORS: Record<string, string> = {
  offen: '#8E8E93',
  bestellt: '#007AFF',
  teilweise_geliefert: '#FF9500',
  geliefert: '#34C759',
  storniert: '#FF3B30',
};

const STATUS_LABELS: Record<string, string> = {
  offen: 'Offen',
  bestellt: 'Bestellt',
  teilweise_geliefert: 'Teilw. geliefert',
  geliefert: 'Geliefert',
  storniert: 'Storniert',
};

const STATUSES = Object.keys(STATUS_COLORS);

const formatCurrency = (amount: number) => {
  return amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
};

const calcTotal = (items: OrderItem[]) => {
  return items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price) || 0;
    return sum + qty * price;
  }, 0);
};

export default function PurchaseOrdersPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editOrder, setEditOrder] = useState<PurchaseOrder | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    supplier_name: '',
    order_date: '',
    expected_delivery: '',
    status: 'offen',
    notes: '',
  });
  const [items, setItems] = useState<OrderItem[]>([]);
  const [newItem, setNewItem] = useState<OrderItem>({ article_name: '', quantity: '', unit_price: '' });
  const [showNewItemRow, setShowNewItemRow] = useState(false);

  const load = async () => {
    try {
      const data = await apiService.get<PurchaseOrder[]>('/api/purchase-orders');
      setOrders(data || []);
    } catch { }
    setLoading(false);
  };

  const loadSuppliers = async () => {
    try {
      const data = await apiService.get<Supplier[]>('/api/suppliers');
      setSuppliers(data || []);
    } catch { }
  };

  useEffect(() => {
    load();
    loadSuppliers();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const resetForm = () => {
    setForm({ supplier_name: '', order_date: '', expected_delivery: '', status: 'offen', notes: '' });
    setItems([]);
    setNewItem({ article_name: '', quantity: '', unit_price: '' });
    setShowNewItemRow(false);
  };

  const openCreate = () => {
    setEditOrder(null);
    resetForm();
    setShowModal(true);
  };

  const openEdit = (order: PurchaseOrder) => {
    setEditOrder(order);
    setForm({
      supplier_name: order.supplier_name || '',
      order_date: order.order_date || '',
      expected_delivery: order.expected_delivery || '',
      status: order.status || 'offen',
      notes: order.notes || '',
    });
    setItems(
      (order.items || []).map(i => ({
        article_name: i.article_name,
        quantity: String(i.quantity),
        unit_price: String(i.unit_price),
      }))
    );
    setNewItem({ article_name: '', quantity: '', unit_price: '' });
    setShowNewItemRow(false);
    setShowModal(true);
  };

  const addItem = () => {
    if (!newItem.article_name.trim()) {
      Alert.alert('Fehler', 'Artikelname ist erforderlich');
      return;
    }
    setItems(prev => [...prev, { ...newItem }]);
    setNewItem({ article_name: '', quantity: '', unit_price: '' });
    setShowNewItemRow(false);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    if (!form.supplier_name.trim()) {
      Alert.alert('Fehler', 'Bitte einen Lieferanten auswählen');
      return;
    }
    setSaving(true);
    try {
      const total = calcTotal(items);
      const payload = {
        ...form,
        items: items.map(i => ({
          article_name: i.article_name,
          quantity: parseFloat(i.quantity) || 0,
          unit_price: parseFloat(i.unit_price) || 0,
        })),
        total_amount: total,
      };
      if (editOrder) {
        await apiService.put(`/api/purchase-orders/${editOrder.id}`, payload);
      } else {
        await apiService.post('/api/purchase-orders', payload);
      }
      setShowModal(false);
      await load();
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Speichern fehlgeschlagen');
    }
    setSaving(false);
  };

  const deleteOrder = (order: PurchaseOrder) => {
    Alert.alert('Bestellung löschen', `Bestellung "${order.order_number}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          try {
            await apiService.delete(`/api/purchase-orders/${order.id}`);
            await load();
          } catch (e: any) {
            Alert.alert('Fehler', e.message || 'Löschen fehlgeschlagen');
          }
        }
      },
    ]);
  };

  const inputStyle = [styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }];
  const total = calcTotal(items);

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Bestellungen</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1, padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {orders.length === 0 && (
            <View style={styles.center}>
              <Ionicons name="cart-outline" size={48} color={colors.border} />
              <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Keine Bestellungen vorhanden</Text>
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={openCreate}>
                <Text style={{ color: 'white', fontWeight: '600' }}>Bestellung erstellen</Text>
              </TouchableOpacity>
            </View>
          )}
          {orders.map(order => (
            <TouchableOpacity
              key={order.id}
              style={[styles.card, { backgroundColor: colors.card }]}
              onPress={() => openEdit(order)}
              onLongPress={() => deleteOrder(order)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={[styles.iconCircle, { backgroundColor: (STATUS_COLORS[order.status] || '#8E8E93') + '20' }]}>
                  <Ionicons name="receipt-outline" size={22} color={STATUS_COLORS[order.status] || '#8E8E93'} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{order.order_number || 'Bestellung'}</Text>
                    <View style={[styles.badge, { backgroundColor: STATUS_COLORS[order.status] || '#8E8E93' }]}>
                      <Text style={styles.badgeText}>{STATUS_LABELS[order.status] || order.status}</Text>
                    </View>
                  </View>
                  {order.supplier_name ? (
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600', marginTop: 2 }}>
                      {order.supplier_name}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                    {order.expected_delivery ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                        Lieferung: {order.expected_delivery}
                      </Text>
                    ) : null}
                    {order.items && order.items.length > 0 ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                        {order.items.length} {order.items.length === 1 ? 'Artikel' : 'Artikel'}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 4 }}>
                    {formatCurrency(order.total_amount || 0)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => deleteOrder(order)} style={{ padding: 8 }}>
                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Create / Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editOrder ? 'Bestellung bearbeiten' : 'Neue Bestellung'}
              </Text>

              {/* Lieferant */}
              <Text style={[styles.label, { color: colors.textSecondary }]}>Lieferant</Text>
              <TouchableOpacity
                style={[inputStyle, { justifyContent: 'center', flexDirection: 'row', alignItems: 'center' }]}
                onPress={() => setShowSupplierModal(true)}
              >
                <Text style={{ flex: 1, color: form.supplier_name ? colors.text : colors.textSecondary, fontSize: 15 }}>
                  {form.supplier_name || 'Lieferant auswählen...'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Bestelldatum */}
              <Text style={[styles.label, { color: colors.textSecondary }]}>Bestelldatum (JJJJ-MM-TT)</Text>
              <TextInput
                style={inputStyle}
                value={form.order_date}
                onChangeText={v => setForm(p => ({ ...p, order_date: v }))}
                placeholder="2024-01-15"
                placeholderTextColor={colors.textSecondary}
              />

              {/* Erwartete Lieferung */}
              <Text style={[styles.label, { color: colors.textSecondary }]}>Erwartete Lieferung (JJJJ-MM-TT)</Text>
              <TextInput
                style={inputStyle}
                value={form.expected_delivery}
                onChangeText={v => setForm(p => ({ ...p, expected_delivery: v }))}
                placeholder="2024-01-22"
                placeholderTextColor={colors.textSecondary}
              />

              {/* Status */}
              <Text style={[styles.label, { color: colors.textSecondary }]}>Status</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {STATUSES.map(s => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setForm(p => ({ ...p, status: s }))}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: form.status === s ? STATUS_COLORS[s] : colors.background,
                          borderColor: form.status === s ? STATUS_COLORS[s] : colors.border,
                        },
                      ]}
                    >
                      <Text style={{ color: form.status === s ? 'white' : colors.text, fontSize: 13 }}>
                        {STATUS_LABELS[s]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Artikel */}
              <Text style={[styles.label, { color: colors.textSecondary }]}>Artikel</Text>
              {items.map((item, index) => (
                <View
                  key={index}
                  style={[styles.itemRow, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{item.article_name}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      Menge: {item.quantity} · Preis: {item.unit_price} €
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => removeItem(index)} style={{ padding: 6 }}>
                    <Ionicons name="close-circle-outline" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))}

              {showNewItemRow && (
                <View style={[styles.newItemBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <TextInput
                    style={[inputStyle, { marginBottom: 6 }]}
                    value={newItem.article_name}
                    onChangeText={v => setNewItem(p => ({ ...p, article_name: v }))}
                    placeholder="Artikelname"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      style={[inputStyle, { flex: 1 }]}
                      value={newItem.quantity}
                      onChangeText={v => setNewItem(p => ({ ...p, quantity: v }))}
                      placeholder="Menge"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="decimal-pad"
                    />
                    <TextInput
                      style={[inputStyle, { flex: 1 }]}
                      value={newItem.unit_price}
                      onChangeText={v => setNewItem(p => ({ ...p, unit_price: v }))}
                      placeholder="Einzelpreis €"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                    <TouchableOpacity
                      style={[styles.btn, { borderWidth: 1, borderColor: colors.border, flex: 1 }]}
                      onPress={() => setShowNewItemRow(false)}
                    >
                      <Text style={{ color: colors.text, fontSize: 13 }}>Abbrechen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btn, { backgroundColor: colors.primary, flex: 1 }]}
                      onPress={addItem}
                    >
                      <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Hinzufügen</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {!showNewItemRow && (
                <TouchableOpacity
                  style={[styles.addItemBtn, { borderColor: colors.primary }]}
                  onPress={() => setShowNewItemRow(true)}
                >
                  <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 14, marginLeft: 6 }}>Artikel hinzufügen</Text>
                </TouchableOpacity>
              )}

              {/* Gesamt */}
              <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Gesamt (berechnet)</Text>
                <Text style={[styles.totalValue, { color: colors.text }]}>{formatCurrency(total)}</Text>
              </View>

              {/* Notizen */}
              <Text style={[styles.label, { color: colors.textSecondary }]}>Notizen</Text>
              <TextInput
                style={[inputStyle, { height: 70, textAlignVertical: 'top' }]}
                value={form.notes}
                onChangeText={v => setForm(p => ({ ...p, notes: v }))}
                multiline
                placeholder="Zusätzliche Informationen..."
                placeholderTextColor={colors.textSecondary}
              />

              {/* Buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={[styles.btn, { borderWidth: 1, borderColor: colors.border, flex: 1 }]}
                  onPress={() => setShowModal(false)}
                >
                  <Text style={{ color: colors.text, fontWeight: '600' }}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: colors.primary, flex: 1 }]}
                  onPress={save}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color="white" size="small" />
                    : <Text style={{ color: 'white', fontWeight: '600' }}>{editOrder ? 'Speichern' : 'Erstellen'}</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Supplier Picker Modal */}
      <Modal visible={showSupplierModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Lieferant auswählen</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Kein Lieferant option */}
              <TouchableOpacity
                style={[styles.supplierRow, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setForm(p => ({ ...p, supplier_name: '' }));
                  setShowSupplierModal(false);
                }}
              >
                <Ionicons name="close-circle-outline" size={20} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: 15, marginLeft: 10 }}>Kein Lieferant</Text>
              </TouchableOpacity>
              {suppliers.map(supplier => (
                <TouchableOpacity
                  key={supplier.id}
                  style={[styles.supplierRow, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setForm(p => ({ ...p, supplier_name: supplier.name }));
                    setShowSupplierModal(false);
                  }}
                >
                  <Ionicons name="business-outline" size={20} color={colors.primary} />
                  <Text style={{ color: colors.text, fontSize: 15, marginLeft: 10 }}>{supplier.name}</Text>
                  {form.supplier_name === supplier.name && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              ))}
              {suppliers.length === 0 && (
                <Text style={{ color: colors.textSecondary, textAlign: 'center', paddingVertical: 20 }}>
                  Keine Lieferanten gefunden
                </Text>
              )}
              <TouchableOpacity
                style={[styles.btn, { borderWidth: 1, borderColor: colors.border, marginTop: 16 }]}
                onPress={() => setShowSupplierModal(false)}
              >
                <Text style={{ color: colors.text, fontWeight: '600' }}>Abbrechen</Text>
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
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  card: {
    borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: 'white', fontSize: 11, fontWeight: '600' },
  addBtn: { marginTop: 16, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20 },
  label: { fontSize: 13, fontWeight: '500', marginTop: 10, marginBottom: 4 },
  input: { borderRadius: 8, borderWidth: 1, padding: 11, fontSize: 15, marginBottom: 4 },
  chip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  btn: { borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 8, borderWidth: 1,
    padding: 10, marginBottom: 6,
  },
  newItemBox: {
    borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 8,
  },
  addItemBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderStyle: 'dashed', borderRadius: 8,
    paddingVertical: 10, marginBottom: 4,
  },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, paddingTop: 12, marginTop: 8, marginBottom: 4,
  },
  totalLabel: { fontSize: 14, fontWeight: '500' },
  totalValue: { fontSize: 18, fontWeight: '700' },
  supplierRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1,
  },
});
