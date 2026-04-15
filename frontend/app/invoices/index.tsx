import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import apiService from '../../services/apiService';
import { useTheme } from '../../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Invoice {
  id: string;
  invoice_number: string;
  event_id: string;
  customer_id: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  payment_status?: string;
  notes?: string;
}

export default function InvoicesPage() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [events, setEvents] = useState<any>({});
  const [customers, setCustomers] = useState<any>({});

  const loadInvoices = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        router.replace('/');
        return;
      }

      const data = await apiService.get<Invoice[]>('/api/invoices', { showErrorAlert: false });
      setInvoices(data);
      
      const eventIds = [...new Set(data.map((i: Invoice) => i.event_id))];
      const customerIds = [...new Set(data.map((i: Invoice) => i.customer_id))];
      
      await loadRelatedData(eventIds, customerIds);
    } catch (error) {
      console.error('Error loading invoices:', error);
      Alert.alert('Fehler', 'Rechnungen konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const loadRelatedData = async (eventIds: string[], customerIds: string[]) => {
    try {
      const [eventsData, customersData] = await Promise.all([
        apiService.get<any[]>('/api/events', { showErrorAlert: false }),
        apiService.get<any[]>('/api/customers', { showErrorAlert: false }),
      ]);
      
      const eventsMap: any = {};
      eventsData.forEach((e: any) => eventsMap[e.id] = e);
      setEvents(eventsMap);
      
      const customersMap: any = {};
      customersData.forEach((c: any) => customersMap[c.id] = c);
      setCustomers(customersMap);
    } catch (error) {
      console.error('Error loading related data:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return '#666';
      case 'sent': return '#007AFF';
      case 'paid': return '#34C759';
      case 'overdue': return '#FF3B30';
      case 'cancelled': return '#999';
      default: return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return 'Entwurf';
      case 'sent': return 'Versendet';
      case 'paid': return 'Bezahlt';
      case 'overdue': return 'Überfällig';
      case 'cancelled': return 'Storniert';
      default: return status;
    }
  };

  const getPaymentStatusColor = (ps: string) => {
    switch (ps) {
      case 'bezahlt': return '#34C759';
      case 'teilweise': return '#FF9500';
      case 'überfällig': return '#FF3B30';
      default: return '#FF3B30'; // offen
    }
  };

  const getPaymentStatusText = (ps: string) => {
    switch (ps) {
      case 'bezahlt': return 'Bezahlt';
      case 'teilweise': return 'Teilweise';
      case 'überfällig': return 'Überfällig';
      default: return 'Offen';
    }
  };

  const generateInvoicePDF = async (invoice: Invoice) => {
    try {
      const event = events[invoice.event_id];
      const customer = customers[invoice.customer_id];
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: 'Helvetica', 'Arial', sans-serif;
              padding: 40px;
              color: #333;
            }
            .header {
              display: flex;
              justify-content: space-between;
              margin-bottom: 40px;
              border-bottom: 3px solid #007AFF;
              padding-bottom: 20px;
            }
            .company {
              font-size: 24px;
              font-weight: bold;
              color: #007AFF;
            }
            .invoice-number {
              font-size: 20px;
              color: #666;
            }
            .customer-info {
              margin-bottom: 30px;
            }
            .customer-info h3 {
              color: #007AFF;
              margin-bottom: 10px;
            }
            .invoice-details {
              margin-bottom: 30px;
              background: #f8f9fa;
              padding: 15px;
              border-radius: 8px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            th {
              background: #007AFF;
              color: white;
              padding: 12px;
              text-align: left;
            }
            td {
              padding: 12px;
              border-bottom: 1px solid #e9ecef;
            }
            .totals {
              text-align: right;
              margin-top: 20px;
            }
            .totals-row {
              display: flex;
              justify-content: flex-end;
              padding: 8px 0;
            }
            .totals-label {
              width: 150px;
              font-weight: bold;
            }
            .totals-value {
              width: 120px;
              text-align: right;
            }
            .total-final {
              font-size: 18px;
              color: #007AFF;
              border-top: 2px solid #007AFF;
              padding-top: 10px;
              margin-top: 10px;
            }
            .footer {
              margin-top: 50px;
              padding-top: 20px;
              border-top: 1px solid #e9ecef;
              font-size: 12px;
              color: #666;
              text-align: center;
            }
            .status {
              display: inline-block;
              padding: 6px 12px;
              border-radius: 4px;
              font-weight: bold;
              font-size: 12px;
            }
            .status-paid { background: #d4edda; color: #155724; }
            .status-pending { background: #fff3cd; color: #856404; }
            .status-overdue { background: #f8d7da; color: #721c24; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="company">Ihr Firmenname</div>
              <div>Ihre Adresse</div>
              <div>Ihre Stadt, PLZ</div>
              <div>Tel: Ihre Telefonnummer</div>
            </div>
            <div>
              <div class="invoice-number">Rechnung ${invoice.invoice_number}</div>
              <div>Datum: ${new Date(invoice.issue_date).toLocaleDateString('de-DE')}</div>
              <div>Fällig: ${new Date(invoice.due_date).toLocaleDateString('de-DE')}</div>
              <div>
                <span class="status status-${invoice.status === 'paid' ? 'paid' : invoice.status === 'pending' ? 'pending' : 'overdue'}">
                  ${invoice.status === 'paid' ? 'Bezahlt' : invoice.status === 'pending' ? 'Ausstehend' : 'Überfällig'}
                </span>
              </div>
            </div>
          </div>

          <div class="customer-info">
            <h3>Rechnungsempfänger</h3>
            <div><strong>${customer?.name || 'Kunde nicht gefunden'}</strong></div>
            ${customer?.company ? `<div>${customer.company}</div>` : ''}
            ${customer?.address ? `<div>${customer.address}</div>` : ''}
            ${customer?.email ? `<div>E-Mail: ${customer.email}</div>` : ''}
            ${customer?.phone ? `<div>Tel: ${customer.phone}</div>` : ''}
          </div>

          <div class="invoice-details">
            <strong>Event:</strong> ${event?.title || 'Event nicht gefunden'}<br>
            ${event?.start_date ? `<strong>Datum:</strong> ${new Date(event.start_date).toLocaleDateString('de-DE')}` : ''}
            ${event?.location ? ` | <strong>Ort:</strong> ${event.location}` : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th>Beschreibung</th>
                <th>Menge</th>
                <th>Einzelpreis</th>
                <th>Gesamt</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Verleih Equipment für Event</td>
                <td>1</td>
                <td>€${invoice.subtotal.toFixed(2)}</td>
                <td>€${invoice.subtotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row">
              <div class="totals-label">Zwischensumme:</div>
              <div class="totals-value">€${invoice.subtotal.toFixed(2)}</div>
            </div>
            <div class="totals-row">
              <div class="totals-label">MwSt (${invoice.tax_rate}%):</div>
              <div class="totals-value">€${invoice.tax_amount.toFixed(2)}</div>
            </div>
            <div class="totals-row total-final">
              <div class="totals-label">Gesamtbetrag:</div>
              <div class="totals-value">€${invoice.total_amount.toFixed(2)}</div>
            </div>
          </div>

          ${invoice.notes ? `
            <div style="margin-top: 30px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
              <strong>Anmerkungen:</strong><br>
              ${invoice.notes}
            </div>
          ` : ''}

          <div class="footer">
            <p>Vielen Dank für Ihr Vertrauen!</p>
            <p>Zahlungsziel: ${new Date(invoice.due_date).toLocaleDateString('de-DE')}</p>
            <p>Bei Fragen kontaktieren Sie uns bitte unter: info@beispiel.de</p>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Rechnung ${invoice.invoice_number}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Erfolg', 'PDF wurde erstellt');
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      Alert.alert('Fehler', 'PDF konnte nicht erstellt werden');
    }
  };

  const handleDownload = (invoice: Invoice) => {
    Alert.alert(
      'PDF herunterladen',
      `Rechnung ${invoice.invoice_number} als PDF herunterladen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Download',
          onPress: () => generateInvoicePDF(invoice),
        },
      ]
    );
  };

  const updatePaymentStatus = async (invoice: Invoice) => {
    const options = ['offen', 'teilweise', 'bezahlt', 'überfällig'];
    const labels = ['Offen', 'Teilweise bezahlt', 'Bezahlt', 'Überfällig'];
    Alert.alert(
      'Zahlungsstatus ändern',
      `Aktuell: ${getPaymentStatusText(invoice.payment_status || 'offen')}`,
      [
        ...options.map((opt, i) => ({
          text: labels[i],
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('auth_token');
              await apiService.put(`/api/invoices/${invoice.id}/payment-status`, { payment_status: opt });
              setInvoices(prev => prev.map(inv => inv.id === invoice.id ? { ...inv, payment_status: opt } : inv));
            } catch (e) {
              Alert.alert('Fehler', 'Status konnte nicht aktualisiert werden');
            }
          },
        })),
        { text: 'Abbrechen', style: 'cancel' },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Lade Rechnungen...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rechnungen ({invoices.length})</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {invoices.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>Keine Rechnungen</Text>
            <Text style={styles.emptyText}>Es gibt noch keine Rechnungen</Text>
          </View>
        ) : (
          invoices.map((invoice) => {
            const event = events[invoice.event_id];
            const customer = customers[invoice.customer_id];
            const isOverdue = invoice.status === 'sent' && new Date(invoice.due_date) < new Date();
            
            return (
              <View key={invoice.id} style={styles.invoiceCard}>
                <View style={styles.invoiceHeader}>
                  <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(isOverdue ? 'overdue' : invoice.status) }]}>
                    <Text style={styles.statusText}>{isOverdue ? 'Überfällig' : getStatusText(invoice.status)}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.paymentBadge, { backgroundColor: getPaymentStatusColor(invoice.payment_status || 'offen') }]}
                  onPress={() => updatePaymentStatus(invoice)}
                >
                  <Ionicons name="card-outline" size={12} color="white" style={{ marginRight: 4 }} />
                  <Text style={styles.statusText}>Zahlung: {getPaymentStatusText(invoice.payment_status || 'offen')}</Text>
                </TouchableOpacity>

                <Text style={styles.customerName}>
                  {customer ? customer.company_name : 'Kunde wird geladen...'}
                </Text>
                <Text style={styles.eventName}>
                  📅 {event ? event.event_name : 'Event wird geladen...'}
                </Text>

                <View style={styles.amountSection}>
                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>Netto:</Text>
                    <Text style={styles.amountValue}>€{invoice.subtotal.toFixed(2)}</Text>
                  </View>
                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>MwSt ({invoice.tax_rate}%):</Text>
                    <Text style={styles.amountValue}>€{invoice.tax_amount.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.amountRow, styles.totalRow]}>
                    <Text style={styles.totalLabel}>Gesamt:</Text>
                    <Text style={styles.totalValue}>€{invoice.total_amount.toFixed(2)}</Text>
                  </View>
                </View>

                <View style={styles.datesRow}>
                  <View style={styles.dateItem}>
                    <Text style={styles.dateLabel}>Ausgestellt:</Text>
                    <Text style={styles.dateValue}>
                      {new Date(invoice.issue_date).toLocaleDateString('de-DE')}
                    </Text>
                  </View>
                  <View style={styles.dateItem}>
                    <Text style={styles.dateLabel}>Fällig:</Text>
                    <Text style={[styles.dateValue, isOverdue && styles.overdueDate]}>
                      {new Date(invoice.due_date).toLocaleDateString('de-DE')}
                    </Text>
                  </View>
                </View>

                {invoice.notes && (
                  <Text style={styles.notes}>📝 {invoice.notes}</Text>
                )}

                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={() => handleDownload(invoice)}
                >
                  <Ionicons name="download-outline" size={16} color="#007AFF" />
                  <Text style={styles.downloadButtonText}>PDF herunterladen</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
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
  invoiceCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  statusText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  eventName: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  amountSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  amountLabel: {
    fontSize: 13,
    color: '#666',
  },
  amountValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  overdueDate: {
    color: '#FF3B30',
  },
  notes: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 8,
  },
  downloadButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
});