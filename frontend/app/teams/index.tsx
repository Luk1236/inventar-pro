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
  Modal,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Team {
  id: string;
  name: string;
  description?: string;
  members: string[];
  created_by: string;
  created_at: string;
}

export default function TeamsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    members: [] as string[],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [teamsData, usersData] = await Promise.all([
        apiService.get<Team[]>('/api/teams', { showErrorAlert: false }),
        apiService.get<any[]>('/api/users', { showErrorAlert: false }),
      ]);
      
      setTeams(teamsData || []);
      setUsers(usersData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Fehler', 'Name ist erforderlich');
      return;
    }

    try {
      if (editingTeam) {
        await apiService.put(`/api/teams/${editingTeam.id}`, formData);
      } else {
        await apiService.post('/api/teams', formData);
      }

      Alert.alert('✅ Erfolg', editingTeam ? 'Team aktualisiert' : 'Team erstellt');
      setShowModal(false);
      setFormData({ name: '', description: '', members: [] });
      setEditingTeam(null);
      loadData();
    } catch (error) {
      console.error('Error saving team:', error);
      Alert.alert('Fehler', 'Netzwerkfehler');
    }
  };

  const handleDelete = async (teamId: string, teamName: string) => {
    if (!(window as any).confirm(`"${teamName}" wirklich löschen?`)) return;
    try { await apiService.delete(`/api/teams/${teamId}`); loadData(); }
    catch (error) { Alert.alert('Fehler', 'Löschen fehlgeschlagen'); }
  };

  const toggleMember = (username: string) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.includes(username)
        ? prev.members.filter(m => m !== username)
        : [...prev.members, username],
    }));
  };

  const openEditModal = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      description: team.description || '',
      members: team.members,
    });
    setShowModal(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Teams</Text>
        <TouchableOpacity onPress={() => { setShowModal(true); setEditingTeam(null); setFormData({ name: '', description: '', members: [] }); }}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {teams.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Noch keine Teams</Text>
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowModal(true)}
            >
              <Text style={styles.emptyButtonText}>Erstes Team erstellen</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.teamsList}>
            {teams.map((team) => (
              <View key={team.id} style={[styles.teamCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.teamHeader}>
                  <View style={[styles.teamIcon, { backgroundColor: isDark ? '#1a3a5c' : '#f0f8ff' }]}>
                    <Ionicons name="people" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.teamInfo}>
                    <Text style={[styles.teamName, { color: colors.text }]}>{team.name}</Text>
                    {team.description && (
                      <Text style={[styles.teamDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                        {team.description}
                      </Text>
                    )}
                    <Text style={[styles.teamMembers, { color: colors.primary }]}>
                      {team.members.length} Mitglied{team.members.length !== 1 ? 'er' : ''}
                    </Text>
                  </View>
                </View>

                <View style={[styles.teamActions, { borderTopColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.background }]}
                    onPress={() => openEditModal(team)}
                  >
                    <Ionicons name="create-outline" size={20} color={colors.primary} />
                    <Text style={[styles.actionButtonText, { color: colors.primary }]}>Bearbeiten</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.background }]}
                    onPress={() => handleDelete(team.id, team.name)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                    <Text style={[styles.actionButtonText, { color: '#FF3B30' }]}>Löschen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingTeam ? 'Team bearbeiten' : 'Team erstellen'}
              </Text>
              <TouchableOpacity onPress={() => { setShowModal(false); setEditingTeam(null); }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={[styles.label, { color: colors.text }]}>Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="z.B. Eventteam, Technik-Team..."
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.label, { color: colors.text }]}>Beschreibung</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Zusätzliche Informationen..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />

              <Text style={[styles.label, { color: colors.text }]}>Mitglieder ({formData.members.length})</Text>
              <View style={styles.membersList}>
                {users.map((user) => (
                  <TouchableOpacity
                    key={user.username}
                    style={[
                      styles.memberItem,
                      { backgroundColor: colors.background, borderColor: colors.border },
                      formData.members.includes(user.username) && { backgroundColor: isDark ? '#1a3a5c' : '#f0f8ff', borderColor: colors.primary },
                    ]}
                    onPress={() => toggleMember(user.username)}
                  >
                    <View style={styles.memberInfo}>
                      <Text style={[styles.memberName, { color: colors.text }]}>{user.username}</Text>
                      <Text style={[styles.memberRole, { color: colors.textSecondary }]}>{user.role}</Text>
                    </View>
                    {formData.members.includes(user.username) && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.background }]}
                onPress={() => { setShowModal(false); setEditingTeam(null); }}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleSave}
              >
                <Text style={styles.saveButtonText}>Speichern</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  teamsList: {
    padding: 16,
    gap: 12,
  },
  teamCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  teamHeader: {
    flexDirection: 'row',
    padding: 16,
  },
  teamIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
  },
  teamDescription: {
    fontSize: 13,
    marginTop: 4,
  },
  teamMembers: {
    fontSize: 12,
    marginTop: 6,
  },
  teamActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 16,
    maxHeight: 400,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  membersList: {
    gap: 8,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
  },
  memberRole: {
    fontSize: 12,
    marginTop: 2,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});
