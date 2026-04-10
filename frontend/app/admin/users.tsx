import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, StyleSheet, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import apiService from '../../services/apiService';
import { useTheme } from '../../contexts/ThemeContext';

interface UserItem {
  id: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  is_approved: boolean;
  created_at: string;
}

export default function UserManagement() {
  const { colors } = useTheme();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'all' | 'pending'>('pending');

  const load = async () => {
    try {
      const [all, pending] = await Promise.all([
        apiService.get<UserItem[]>('/api/users/all'),
        apiService.get<UserItem[]>('/api/admin/pending-users'),
      ]);
      setUsers(Array.isArray(all) ? all : []);
      setPendingUsers(Array.isArray(pending) ? pending : []);
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Laden fehlgeschlagen');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (userId: string, username: string) => {
    Alert.alert('Bestätigen', `Benutzer "${username}" freischalten?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Freischalten', onPress: async () => {
          try {
            await apiService.put(`/api/admin/approve-user/${userId}`);
            load();
          } catch (e: any) {
            Alert.alert('Fehler', e.message);
          }
        }
      }
    ]);
  };

  const reject = async (userId: string, username: string) => {
    Alert.alert('Ablehnen', `Benutzer "${username}" ablehnen und löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Ablehnen', style: 'destructive', onPress: async () => {
          try {
            await apiService.delete(`/api/admin/reject-user/${userId}`);
            load();
          } catch (e: any) {
            Alert.alert('Fehler', e.message);
          }
        }
      }
    ]);
  };

  const displayList = tab === 'pending' ? pendingUsers : users;

  if (loading) return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Benutzerverwaltung</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.tabRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'pending' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setTab('pending')}
        >
          <Text style={{ color: tab === 'pending' ? colors.primary : colors.textSecondary, fontWeight: '600' }}>
            {`Ausstehend${pendingUsers.length > 0 ? ` (${pendingUsers.length})` : ''}`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'all' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setTab('all')}
        >
          <Text style={{ color: tab === 'all' ? colors.primary : colors.textSecondary, fontWeight: '600' }}>
            {`Alle Benutzer (${users.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        contentContainerStyle={{ padding: 16 }}
      >
        {displayList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, marginTop: 12 }}>
              {tab === 'pending' ? 'Keine ausstehenden Anfragen' : 'Keine Benutzer'}
            </Text>
          </View>
        ) : (
          displayList.map(user => (
            <View key={user.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardRow}>
                <View style={[styles.avatar, { backgroundColor: (colors.primary as string) + '20' }]}>
                  <Ionicons name="person" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.username, { color: colors.text }]}>{user.username}</Text>
                  <Text style={[styles.emailText, { color: colors.textSecondary }]}>{user.email}</Text>
                  <View style={styles.badges}>
                    <View style={[styles.badge, { backgroundColor: (colors.primary as string) + '20' }]}>
                      <Text style={{ color: colors.primary, fontSize: 11 }}>{user.role}</Text>
                    </View>
                    {!user.is_approved && (
                      <View style={[styles.badge, { backgroundColor: '#FF950020' }]}>
                        <Text style={{ color: '#FF9500', fontSize: 11 }}>Ausstehend</Text>
                      </View>
                    )}
                    {!user.is_active && (
                      <View style={[styles.badge, { backgroundColor: '#FF3B3020' }]}>
                        <Text style={{ color: '#FF3B30', fontSize: 11 }}>Inaktiv</Text>
                      </View>
                    )}
                  </View>
                </View>
                {tab === 'pending' && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#34C759' }]}
                      onPress={() => approve(user.id, user.username)}
                    >
                      <Ionicons name="checkmark" size={16} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#FF3B30', marginLeft: 8 }]}
                      onPress={() => reject(user.id, user.username)}
                    >
                      <Ionicons name="close" size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, alignItems: 'center', padding: 12 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  username: { fontSize: 15, fontWeight: '600' },
  emailText: { fontSize: 13, marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  actions: { flexDirection: 'row' },
  actionBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
});
