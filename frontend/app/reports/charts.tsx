import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect, Line, Text as SvgText, Polyline, Circle, G } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';

interface CategoryData { category: string; count: number; stock: number; value: number }
interface StatusData { label: string; value: number; color: string }
interface TimelineData { date: string; count: number }
interface TopData { name: string; value: number; stock: number }

const screenWidth = Dimensions.get('window').width;
const chartW = Math.min(screenWidth - 40, 600);

export default function ChartsPage() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [byCategory, setByCategory] = useState<CategoryData[]>([]);
  const [stockStatus, setStockStatus] = useState<StatusData[]>([]);
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [topArticles, setTopArticles] = useState<TopData[]>([]);
  const [days, setDays] = useState(30);

  useEffect(() => { load(); }, [days]);

  async function load() {
    setLoading(true);
    try {
      const [c, s, t, top] = await Promise.all([
        apiService.get('/reports/charts/inventory-by-category'),
        apiService.get('/reports/charts/stock-status'),
        apiService.get(`/reports/charts/timeline?days=${days}`),
        apiService.get('/reports/charts/top-articles?limit=10'),
      ]);
      setByCategory(c?.data || []);
      setStockStatus(s?.data || []);
      setTimeline(t?.data || []);
      setTopArticles(top?.data || []);
    } catch (e) {
      console.error('Charts laden fehlgeschlagen', e);
    } finally { setLoading(false); }
  }

  const styles = makeStyles(colors);

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style={colors.text === '#fff' ? 'light' : 'dark'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Charts & Analytics</Text>
        <TouchableOpacity onPress={load} style={styles.backBtn}>
          <Ionicons name="refresh" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
          <ChartCard title="Bestandsstatus" colors={colors}>
            <PieChart data={stockStatus} colors={colors} />
          </ChartCard>

          <ChartCard title={`Neue Artikel (letzte ${days} Tage)`} colors={colors}>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
              {[7, 30, 90].map(d => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setDays(d)}
                  style={[styles.tab, days === d && { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.tabText, days === d && { color: '#fff' }]}>{d}T</Text>
                </TouchableOpacity>
              ))}
            </View>
            <LineChart data={timeline} colors={colors} />
          </ChartCard>

          <ChartCard title="Top 10 Artikel nach Wert" colors={colors}>
            <BarChart
              data={topArticles.map(a => ({ label: a.name, value: a.value }))}
              colors={colors}
              formatValue={v => `€${v.toFixed(0)}`}
            />
          </ChartCard>

          <ChartCard title="Bestand nach Kategorie" colors={colors}>
            <BarChart
              data={byCategory.map(c => ({ label: c.category, value: c.value }))}
              colors={colors}
              formatValue={v => `€${v.toFixed(0)}`}
            />
          </ChartCard>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ChartCard({ title, colors, children }: any) {
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 12 }}>{title}</Text>
      {children}
    </View>
  );
}

function PieChart({ data, colors }: { data: StatusData[]; colors: any }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = 70, cx = chartW / 2, cy = 90;
  let acc = 0;
  return (
    <View>
      <Svg width={chartW} height={200}>
        {data.map((d, i) => {
          const start = (acc / total) * 2 * Math.PI - Math.PI / 2;
          acc += d.value;
          const end = (acc / total) * 2 * Math.PI - Math.PI / 2;
          const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
          const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
          const large = end - start > Math.PI ? 1 : 0;
          const path = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`;
          return <Svg.Path key={i} d={path} fill={d.color} />;
        })}
      </Svg>
      <View style={{ marginTop: 8 }}>
        {data.map((d, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <View style={{ width: 12, height: 12, backgroundColor: d.color, borderRadius: 2, marginRight: 8 }} />
            <Text style={{ color: colors.text, fontSize: 12, flex: 1 }}>{d.label}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{d.value} ({((d.value / total) * 100).toFixed(0)}%)</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function BarChart({ data, colors, formatValue }: { data: { label: string; value: number }[]; colors: any; formatValue: (v: number) => string }) {
  if (!data.length) return <Text style={{ color: colors.muted }}>Keine Daten</Text>;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <View>
      {data.slice(0, 10).map((d, i) => (
        <View key={i} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
            <Text style={{ color: colors.text, fontSize: 11, flex: 1 }} numberOfLines={1}>{d.label}</Text>
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600' }}>{formatValue(d.value)}</Text>
          </View>
          <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' }}>
            <View style={{ height: 6, width: `${(d.value / max) * 100}%`, backgroundColor: colors.primary }} />
          </View>
        </View>
      ))}
    </View>
  );
}

function LineChart({ data, colors }: { data: TimelineData[]; colors: any }) {
  if (data.length < 2) return <Text style={{ color: colors.muted }}>Keine Daten</Text>;
  const w = chartW, h = 150, pad = 24;
  const max = Math.max(...data.map(d => d.count), 1);
  const stepX = (w - pad * 2) / (data.length - 1);
  const points = data.map((d, i) => `${pad + i * stepX},${h - pad - (d.count / max) * (h - pad * 2)}`).join(' ');
  return (
    <Svg width={w} height={h}>
      <Line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke={colors.border} strokeWidth={1} />
      <Line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke={colors.border} strokeWidth={1} />
      <Polyline points={points} fill="none" stroke={colors.primary} strokeWidth={2} />
      {data.map((d, i) => (
        <Circle key={i} cx={pad + i * stepX} cy={h - pad - (d.count / max) * (h - pad * 2)} r={2} fill={colors.primary} />
      ))}
      <SvgText x={pad} y={pad - 4} fill={colors.muted} fontSize={10}>Max: {max}</SvgText>
    </Svg>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: 8 },
  title: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: colors.border },
  tabText: { color: colors.text, fontSize: 12, fontWeight: '500' },
});
