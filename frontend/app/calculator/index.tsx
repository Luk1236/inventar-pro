import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Article {
  id: string;
  name: string;
  inventory_code: string;
  current_stock: number;
  weight_kg?: number;
  power_watt?: number;
  power_type?: string;
  rental_price?: number;
}

interface CalculationResult {
  power?: {
    total_watt: number;
    power_230v: number;
    power_400v: number;
    ampere_230v: number;
    ampere_400v: number;
    warnings: string[];
    recommendations: {
      schuko_16a_needed: number;
      cee_32a_needed: number;
    };
  };
  weight?: {
    total_weight_kg: number;
    warnings: string[];
    recommendations: {
      vehicle_type: string;
    };
  };
  rental?: {
    base_price: number;
    factor_applied: number;
    final_price: number;
    days: number;
    breakdown?: Array<{
      article_id: string;
      name: string;
      quantity: number;
      daily_rate: number;
      weekend_rate: number;
      week_rate: number;
      subtotal: number;
    }>;
    rates_summary?: {
      daily_total: number;
      weekend_total: number;
      week_total: number;
    };
  };
}

export default function CalculatorPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<string[]>([]);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [rentalDays, setRentalDays] = useState(1);
  const [isWeekend, setIsWeekend] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        router.replace('/');
        return;
      }

      const data = await apiService.get<Article[]>('/api/articles', { showErrorAlert: false });
      setArticles(data);
    } catch (error) {
      console.error('Error loading articles:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const toggleArticleSelection = (articleId: string) => {
    setSelectedArticles(prev => 
      prev.includes(articleId) 
        ? prev.filter(id => id !== articleId)
        : [...prev, articleId]
    );
    setResult(null);
  };

  const selectAll = () => {
    setSelectedArticles(articles.map(a => a.id));
    setResult(null);
  };

  const clearSelection = () => {
    setSelectedArticles([]);
    setResult(null);
  };

  const calculatePower = async () => {
    if (selectedArticles.length === 0) {
      Alert.alert('Fehler', 'Bitte wählen Sie mindestens einen Artikel aus');
      return;
    }

    setCalculating(true);
    try {
      const powerResult = await apiService.post('/api/calculate/power', selectedArticles) as CalculationResult['power'];
      setResult(prev => ({ ...prev, power: powerResult }));
    } catch {
      Alert.alert('Fehler', 'Berechnung fehlgeschlagen');
    } finally {
      setCalculating(false);
    }
  };

  const calculateWeight = async () => {
    if (selectedArticles.length === 0) {
      Alert.alert('Fehler', 'Bitte wählen Sie mindestens einen Artikel aus');
      return;
    }

    setCalculating(true);
    try {
      const weightResult = await apiService.post('/api/calculate/weight', selectedArticles) as CalculationResult['weight'];
      setResult(prev => ({ ...prev, weight: weightResult }));
    } catch {
      Alert.alert('Fehler', 'Berechnung fehlgeschlagen');
    } finally {
      setCalculating(false);
    }
  };

  const calculateRental = async () => {
    if (selectedArticles.length === 0) {
      Alert.alert('Fehler', 'Bitte wählen Sie mindestens einen Artikel aus');
      return;
    }

    setCalculating(true);
    try {
      const rentalResult = await apiService.post(
        `/api/calculate/rental-price?days=${rentalDays}&is_weekend=${isWeekend}`,
        { article_ids: selectedArticles, quantities: {} }
      );
      setResult(prev => ({ ...prev, rental: rentalResult as CalculationResult['rental'] }));
    } catch {
      Alert.alert('Fehler', 'Berechnung fehlgeschlagen');
    } finally {
      setCalculating(false);
    }
  };

  const calculateAll = async () => {
    await calculatePower();
    await calculateWeight();
    await calculateRental();
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Lade Artikel...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Kalkulator</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadArticles(); }} />
        }
      >
        {/* Selection Info */}
        <View style={[styles.selectionInfo, { backgroundColor: colors.card }]}>
          <Text style={[styles.selectionText, { color: colors.text }]}>
            {selectedArticles.length} von {articles.length} Artikel ausgewählt
          </Text>
          <View style={styles.selectionButtons}>
            <TouchableOpacity style={styles.selectionBtn} onPress={selectAll}>
              <Text style={styles.selectionBtnText}>Alle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.selectionBtn, { backgroundColor: '#ff6b6b' }]} onPress={clearSelection}>
              <Text style={styles.selectionBtnText}>Keine</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Article List */}
        <View style={styles.articleList}>
          {articles.filter(a => a.power_watt || a.weight_kg).map(article => (
            <TouchableOpacity
              key={article.id}
              style={[
                styles.articleItem,
                { backgroundColor: colors.card, borderColor: colors.border },
                selectedArticles.includes(article.id) && styles.articleItemSelected
              ]}
              onPress={() => toggleArticleSelection(article.id)}
            >
              <View style={styles.articleCheckbox}>
                <Ionicons
                  name={selectedArticles.includes(article.id) ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={selectedArticles.includes(article.id) ? colors.primary : colors.textSecondary}
                />
              </View>
              <View style={styles.articleInfo}>
                <Text style={[styles.articleName, { color: colors.text }]}>{article.name}</Text>
                <View style={styles.articleSpecs}>
                  {article.power_watt && (
                    <Text style={[styles.specBadge, { backgroundColor: '#fff3cd', color: '#856404' }]}>
                      ⚡ {article.power_watt}W
                    </Text>
                  )}
                  {article.weight_kg && (
                    <Text style={[styles.specBadge, { backgroundColor: '#d4edda', color: '#155724' }]}>
                      ⚖️ {article.weight_kg}kg
                    </Text>
                  )}
                  {article.rental_price && (
                    <Text style={[styles.specBadge, { backgroundColor: '#cce5ff', color: '#004085' }]}>
                      💶 {article.rental_price}€/Tag
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {articles.filter(a => a.power_watt || a.weight_kg).length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="calculator-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Keine Artikel mit Gewicht/Leistungsdaten
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Fügen Sie Gewicht und Watt bei Artikeln hinzu
              </Text>
            </View>
          )}
        </View>

        {/* Rental Options */}
        <View style={[styles.rentalOptions, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Mietoptionen</Text>
          <View style={styles.daysSelector}>
            {[1, 2, 3, 5, 7].map(days => (
              <TouchableOpacity
                key={days}
                style={[
                  styles.dayButton,
                  rentalDays === days && { backgroundColor: colors.primary }
                ]}
                onPress={() => setRentalDays(days)}
              >
                <Text style={[
                  styles.dayButtonText,
                  { color: rentalDays === days ? 'white' : colors.text }
                ]}>
                  {days}T
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.weekendToggle, isWeekend && { backgroundColor: colors.primary }]}
            onPress={() => setIsWeekend(!isWeekend)}
          >
            <Text style={[styles.weekendText, { color: isWeekend ? 'white' : colors.text }]}>
              🗓️ Wochenende
            </Text>
          </TouchableOpacity>
        </View>

        {/* Calculate Buttons */}
        <View style={styles.calculateButtons}>
          <TouchableOpacity
            style={[styles.calcButton, { backgroundColor: '#ffc107' }]}
            onPress={calculatePower}
            disabled={calculating}
          >
            <Ionicons name="flash" size={20} color="white" />
            <Text style={styles.calcButtonText}>Strom</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.calcButton, { backgroundColor: '#28a745' }]}
            onPress={calculateWeight}
            disabled={calculating}
          >
            <Ionicons name="scale" size={20} color="white" />
            <Text style={styles.calcButtonText}>Gewicht</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.calcButton, { backgroundColor: '#007bff' }]}
            onPress={calculateRental}
            disabled={calculating}
          >
            <Ionicons name="cash" size={20} color="white" />
            <Text style={styles.calcButtonText}>Preis</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.calcAllButton, calculating && { opacity: 0.6 }]}
          onPress={calculateAll}
          disabled={calculating}
        >
          {calculating ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="calculator" size={24} color="white" />
              <Text style={styles.calcAllButtonText}>Alle berechnen</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Results */}
        {result && (
          <View style={styles.resultsContainer}>
            {/* Power Result */}
            {result.power && (
              <View style={[styles.resultCard, { backgroundColor: '#fff3cd', borderColor: '#ffc107' }]}>
                <Text style={styles.resultTitle}>⚡ Strombedarf</Text>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Gesamt:</Text>
                  <Text style={styles.resultValue}>{result.power.total_watt} W</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>230V:</Text>
                  <Text style={styles.resultValue}>{result.power.power_230v} W ({result.power.ampere_230v} A)</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>400V:</Text>
                  <Text style={styles.resultValue}>{result.power.power_400v} W ({result.power.ampere_400v} A)</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Schuko 16A benötigt:</Text>
                  <Text style={styles.resultValue}>{result.power.recommendations.schuko_16a_needed}x</Text>
                </View>
                {result.power.warnings.map((w, i) => (
                  <Text key={i} style={styles.warningText}>{w}</Text>
                ))}
              </View>
            )}

            {/* Weight Result */}
            {result.weight && (
              <View style={[styles.resultCard, { backgroundColor: '#d4edda', borderColor: '#28a745' }]}>
                <Text style={styles.resultTitle}>⚖️ Gewicht</Text>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Gesamt:</Text>
                  <Text style={styles.resultValue}>{result.weight.total_weight_kg} kg</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Empfehlung:</Text>
                  <Text style={styles.resultValue}>{result.weight.recommendations.vehicle_type}</Text>
                </View>
                {result.weight.warnings.map((w, i) => (
                  <Text key={i} style={styles.warningText}>{w}</Text>
                ))}
              </View>
            )}

            {/* Rental Result */}
            {result.rental && (
              <View style={[styles.resultCard, { backgroundColor: '#cce5ff', borderColor: '#007bff' }]}>
                <Text style={styles.resultTitle}>💶 Mietpreis ({result.rental.days} Tage)</Text>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Basispreis:</Text>
                  <Text style={styles.resultValue}>{result.rental.base_price} €</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Faktor:</Text>
                  <Text style={styles.resultValue}>x{result.rental.factor_applied}</Text>
                </View>
                <View style={[styles.resultRow, styles.resultTotal]}>
                  <Text style={styles.resultLabelBold}>Endpreis:</Text>
                  <Text style={styles.resultValueBold}>{result.rental.final_price} €</Text>
                </View>
                {result.rental?.breakdown && result.rental.breakdown.length > 0 && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={[styles.resultLabel, { marginBottom: 4, fontWeight: 'bold' }]}>
                      Preisübersicht pro Artikel:
                    </Text>
                    <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                      <Text style={[styles.resultLabel, { flex: 2 }]}>Artikel</Text>
                      <Text style={[styles.resultLabel, { flex: 1, textAlign: 'right' }]}>Tägl.</Text>
                      <Text style={[styles.resultLabel, { flex: 1, textAlign: 'right' }]}>WE</Text>
                      <Text style={[styles.resultLabel, { flex: 1, textAlign: 'right' }]}>Woche</Text>
                    </View>
                    {result.rental.breakdown.map((item, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={[styles.resultLabel, { flex: 2 }]} numberOfLines={1}>
                          {item.name} ×{item.quantity}
                        </Text>
                        <Text style={[styles.resultValue, { flex: 1, textAlign: 'right', fontSize: 12 }]}>
                          {item.daily_rate.toFixed(2)}€
                        </Text>
                        <Text style={[styles.resultValue, { flex: 1, textAlign: 'right', fontSize: 12 }]}>
                          {item.weekend_rate.toFixed(2)}€
                        </Text>
                        <Text style={[styles.resultValue, { flex: 1, textAlign: 'right', fontSize: 12 }]}>
                          {item.week_rate.toFixed(2)}€
                        </Text>
                      </View>
                    ))}
                    {result.rental.rates_summary && (
                      <View style={{ flexDirection: 'row', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#007bff' }}>
                        <Text style={[styles.resultLabel, { flex: 2, fontWeight: 'bold' }]}>Gesamt</Text>
                        <Text style={[styles.resultValue, { flex: 1, textAlign: 'right', fontSize: 12, fontWeight: 'bold' }]}>
                          {result.rental.rates_summary.daily_total.toFixed(2)}€
                        </Text>
                        <Text style={[styles.resultValue, { flex: 1, textAlign: 'right', fontSize: 12, fontWeight: 'bold' }]}>
                          {result.rental.rates_summary.weekend_total.toFixed(2)}€
                        </Text>
                        <Text style={[styles.resultValue, { flex: 1, textAlign: 'right', fontSize: 12, fontWeight: 'bold' }]}>
                          {result.rental.rates_summary.week_total.toFixed(2)}€
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  selectionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  selectionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  selectionBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  selectionBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  articleList: {
    paddingHorizontal: 16,
  },
  articleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  articleItemSelected: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  articleCheckbox: {
    marginRight: 12,
  },
  articleInfo: {
    flex: 1,
  },
  articleName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  articleSpecs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  specBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 12,
    marginTop: 4,
  },
  rentalOptions: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  daysSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  dayButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f1f3f4',
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  weekendToggle: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f1f3f4',
  },
  weekendText: {
    fontSize: 14,
    fontWeight: '600',
  },
  calculateButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  calcButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  calcButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  calcAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6f42c1',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  calcAllButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    padding: 16,
  },
  resultCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  resultLabel: {
    fontSize: 14,
    color: '#555',
  },
  resultValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  resultTotal: {
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    paddingTop: 8,
    marginTop: 6,
  },
  resultLabelBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  resultValueBold: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  warningText: {
    fontSize: 12,
    color: '#856404',
    backgroundColor: '#fff3cd',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
  },
});
