import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, RefreshControl
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface LogEntry {
  id: string;
  type: string;
  direction: string;
  subject?: string;
  body?: string;
  recipient?: string;
  sender?: string;
  customer_name?: string;
  event_name?: string;
  sent_at?: string;
  status?: string;
  created_at?: string;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

export default function ReceivedNotesPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [notes, setNotes] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await apiService.get<LogEntry[]>('/api/communication-log?type=note&direction=eingehend');
      setNotes(data || []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Erhaltene Notizen</Text>
        {/* Read-only: no add button */}
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView
          style={{ flex: 1, padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {notes.length === 0 && (
            <View style={styles.center}>
              <Ionicons name="chatbubble-outline" size={48} color={colors.border} />
              <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Keine erhaltenen Notizen</Text>
            </View>
          )}
          {notes.map(note => {
            const dateStr = formatDate(note.sent_at || note.created_at);

            return (
              <View
                key={note.id}
                style={[styles.card, { backgroundColor: colors.card }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View style={[styles.iconCircle, { backgroundColor: '#34C75920' }]}>
                    <Ionicons name="chatbubble-outline" size={20} color="#34C759" />
                  </View>
                  <View style={{ flex: 1 }}>
                    {/* Subject / Title */}
                    <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                      {note.subject || '(Keine Überschrift)'}
                    </Text>
                    {/* Sender */}
                    {note.sender ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                        Von: {note.sender}
                      </Text>
                    ) : null}
                    {/* Date */}
                    {dateStr ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{dateStr}</Text>
                    ) : null}
                    {/* Body preview */}
                    {note.body ? (
                      <Text
                        style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 18 }}
                        numberOfLines={3}
                      >
                        {note.body}
                      </Text>
                    ) : null}
                    {/* Customer / event */}
                    {(note.customer_name || note.event_name) ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }} numberOfLines={1}>
                        {[note.customer_name, note.event_name].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
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
  cardTitle: { fontSize: 15, fontWeight: '600' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
});
