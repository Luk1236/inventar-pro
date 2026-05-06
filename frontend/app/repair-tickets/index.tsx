import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface RepairTicket {
  id: string;
  ticket_number: string;
  article_id: string;
  title: string;
  description: string;
  defect_type: string;
  severity: string;
  status: string;
  reported_by: string;
  assigned_to?: string;
  defect_images: string[];
  repair_images: string[];
  repair_notes?: string;
  repair_cost?: number;
  repair_time_minutes?: number;
  warranty_claim: boolean;
  created_at: string;
  closed_at?: string;
}

interface Article {
  id: string;
  name: string;
  inventory_code: string;
}

export default function RepairTicketsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesMap, setArticlesMap] = useState<Record<string, Article>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'open' | 'in_progress' | 'closed'>('open');
  
  // Form state
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [defectType, setDefectType] = useState('other');
  const [severity, setSeverity] = useState('medium');
  const [defectImages, setDefectImages] = useState<string[]>([]);
  const [warrantyCheck, setWarrantyCheck] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ticketsData, articlesData] = await Promise.all([
        apiService.get<RepairTicket[]>('/api/repair-tickets', { showErrorAlert: false }),
        apiService.get<Article[]>('/api/articles', { showErrorAlert: false }),
      ]);

      setTickets(ticketsData || []);
      setArticles(articlesData || []);

      const aMap: Record<string, Article> = {};
      (articlesData || []).forEach(a => aMap[a.id] = a);
      setArticlesMap(aMap);

    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setDefectImages([...defectImages, `data:image/jpeg;base64,${result.assets[0].base64}`]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Fehler', 'Kamerazugriff wurde verweigert');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setDefectImages([...defectImages, `data:image/jpeg;base64,${result.assets[0].base64}`]);
    }
  };

  const removeImage = (index: number) => {
    setDefectImages(defectImages.filter((_, i) => i !== index));
  };

  const handleCreateTicket = async () => {
    if (!selectedArticleId || !title || !description) {
      Alert.alert('Fehler', 'Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    setSubmitting(true);
    try {
      await apiService.post('/api/repair-tickets', {
        article_id: selectedArticleId,
        title,
        description,
        defect_type: defectType,
        severity,
        defect_images: defectImages,
        warranty_claim: warrantyCheck,
      });

      Alert.alert('Erfolg', 'Reparatur-Ticket wurde erstellt');
      setModalVisible(false);
      resetForm();
      loadData();
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Ticket konnte nicht erstellt werden');
    } finally {
      setSubmitting(false);
    }
  };

  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      await apiService.put(`/api/repair-tickets/${ticketId}?status=${newStatus}`, {});
      Alert.alert('Erfolg', `Status geändert zu: ${getStatusText(newStatus)}`);
      loadData();
    } catch (error) {
      Alert.alert('Fehler', 'Status konnte nicht geändert werden');
    }
  };

  const resetForm = () => {
    setSelectedArticleId('');
    setTitle('');
    setDescription('');
    setDefectType('other');
    setSeverity('medium');
    setDefectImages([]);
    setWarrantyCheck(false);
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'critical': return '#FF3B30';
      case 'high': return '#FF9500';
      case 'medium': return '#FFCC00';
      case 'low': return '#34C759';
      default: return '#666';
    }
  };

  const getSeverityText = (sev: string) => {
    switch (sev) {
      case 'critical': return 'Kritisch';
      case 'high': return 'Hoch';
      case 'medium': return 'Mittel';
      case 'low': return 'Niedrig';
      default: return sev;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return '#FF3B30';
      case 'in_progress': return '#FF9500';
      case 'waiting_parts': return '#FFCC00';
      case 'repaired': return '#34C759';
      case 'closed': return '#8E8E93';
      case 'unrepairable': return '#333';
      default: return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'open': return 'Offen';
      case 'in_progress': return 'In Bearbeitung';
      case 'waiting_parts': return 'Wartet auf Teile';
      case 'repaired': return 'Repariert';
      case 'closed': return 'Geschlossen';
      case 'unrepairable': return 'Nicht reparierbar';
      default: return status;
    }
  };

  const getDefectTypeText = (type: string) => {
    switch (type) {
      case 'electrical': return '⚡ Elektrisch';
      case 'mechanical': return '⚙️ Mechanisch';
      case 'optical': return '👁️ Optisch';
      case 'software': return '💻 Software';
      case 'other': return '📋 Sonstiges';
      default: return type;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const filteredTickets = useMemo(() => tickets.filter(t => {
    if (activeTab === 'open') return t.status === 'open';
    if (activeTab === 'in_progress') return ['in_progress', 'waiting_parts'].includes(t.status);
    if (activeTab === 'closed') return ['repaired', 'closed', 'unrepairable'].includes(t.status);
    return true;
  }), [tickets, activeTab]);

  const openCount = useMemo(() => tickets.filter(t => t.status === 'open').length, [tickets]);
  const inProgressCount = useMemo(() => tickets.filter(t => ['in_progress', 'waiting_parts'].includes(t.status)).length, [tickets]);
  const criticalCount = useMemo(() => tickets.filter(t => t.severity === 'critical' && t.status === 'open').length, [tickets]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Lade Reparatur-Tickets...
          </Text>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Reparatur-Tickets</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={[styles.statsContainer, { backgroundColor: colors.card }]}>
        <View style={styles.statItem}>
          <Ionicons name="alert-circle" size={24} color="#FF3B30" />
          <Text style={[styles.statNumber, { color: colors.text }]}>{openCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Offen</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="construct" size={24} color="#FF9500" />
          <Text style={[styles.statNumber, { color: colors.text }]}>{inProgressCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>In Arbeit</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="warning" size={24} color="#FF3B30" />
          <Text style={[styles.statNumber, { color: colors.text }]}>{criticalCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Kritisch</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'open' && { borderBottomColor: '#FF3B30', borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('open')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'open' ? '#FF3B30' : colors.textSecondary }]}>
            Offen ({openCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'in_progress' && { borderBottomColor: '#FF9500', borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('in_progress')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'in_progress' ? '#FF9500' : colors.textSecondary }]}>
            In Arbeit ({inProgressCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'closed' && { borderBottomColor: '#34C759', borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('closed')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'closed' ? '#34C759' : colors.textSecondary }]}>
            Erledigt
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        style={styles.content}
        data={filteredTickets}
        keyExtractor={(item) => item.id}
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={6}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
        ListFooterComponent={<View style={{ height: 40 }} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {activeTab === 'open' ? 'Keine offenen Tickets' :
               activeTab === 'in_progress' ? 'Keine Tickets in Bearbeitung' :
               'Keine erledigten Tickets'}
            </Text>
          </View>
        }
        renderItem={({ item: ticket }) => (
            <View style={[styles.ticketCard, { backgroundColor: colors.card }]}>
              <View style={styles.ticketHeader}>
                <View style={styles.ticketInfo}>
                  <View style={styles.ticketNumberRow}>
                    <Text style={[styles.ticketNumber, { color: colors.primary }]}>
                      {ticket.ticket_number}
                    </Text>
                    {ticket.warranty_claim && (
                      <View style={[styles.warrantyBadge]}>
                        <Text style={styles.warrantyText}>Garantie</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.ticketTitle, { color: colors.text }]}>{ticket.title}</Text>
                  <Text style={[styles.articleName, { color: colors.textSecondary }]}>
                    {articlesMap[ticket.article_id]?.name || 'Artikel nicht gefunden'}
                  </Text>
                </View>
                <View style={styles.badges}>
                  <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(ticket.severity) + '20' }]}>
                    <Text style={[styles.badgeText, { color: getSeverityColor(ticket.severity) }]}>
                      {getSeverityText(ticket.severity)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ticket.status) + '20' }]}>
                    <Text style={[styles.badgeText, { color: getStatusColor(ticket.status) }]}>
                      {getStatusText(ticket.status)}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={[styles.ticketDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                {ticket.description}
              </Text>

              <View style={styles.ticketMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="pricetag-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                    {getDefectTypeText(ticket.defect_type)}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                    {formatDate(ticket.created_at)}
                  </Text>
                </View>
                {ticket.defect_images?.length > 0 && (
                  <View style={styles.metaItem}>
                    <Ionicons name="camera-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                      {ticket.defect_images.length} Fotos
                    </Text>
                  </View>
                )}
              </View>

              {/* Images preview */}
              {ticket.defect_images?.length > 0 && (
                <ScrollView horizontal style={styles.imagesPreview} showsHorizontalScrollIndicator={false}>
                  {ticket.defect_images.slice(0, 3).map((img, idx) => (
                    <Image key={idx} source={{ uri: img }} style={styles.previewImage} />
                  ))}
                </ScrollView>
              )}

              {/* Actions */}
              <View style={styles.ticketActions}>
                {ticket.status === 'open' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#FF950020' }]}
                    onPress={() => updateTicketStatus(ticket.id, 'in_progress')}
                  >
                    <Ionicons name="construct-outline" size={16} color="#FF9500" />
                    <Text style={[styles.actionBtnText, { color: '#FF9500' }]}>Starten</Text>
                  </TouchableOpacity>
                )}
                {ticket.status === 'in_progress' && (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#FFCC0020' }]}
                      onPress={() => updateTicketStatus(ticket.id, 'waiting_parts')}
                    >
                      <Ionicons name="time-outline" size={16} color="#FFCC00" />
                      <Text style={[styles.actionBtnText, { color: '#856404' }]}>Warte Teile</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#34C75920' }]}
                      onPress={() => updateTicketStatus(ticket.id, 'repaired')}
                    >
                      <Ionicons name="checkmark-outline" size={16} color="#34C759" />
                      <Text style={[styles.actionBtnText, { color: '#34C759' }]}>Repariert</Text>
                    </TouchableOpacity>
                  </>
                )}
                {ticket.status === 'waiting_parts' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#FF950020' }]}
                    onPress={() => updateTicketStatus(ticket.id, 'in_progress')}
                  >
                    <Ionicons name="play-outline" size={16} color="#FF9500" />
                    <Text style={[styles.actionBtnText, { color: '#FF9500' }]}>Fortsetzen</Text>
                  </TouchableOpacity>
                )}
                {ticket.status === 'repaired' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#8E8E9320' }]}
                    onPress={() => updateTicketStatus(ticket.id, 'closed')}
                  >
                    <Ionicons name="archive-outline" size={16} color="#8E8E93" />
                    <Text style={[styles.actionBtnText, { color: '#8E8E93' }]}>Schließen</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
        )}
      />

      {/* Create Ticket Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>📸 Neues Reparatur-Ticket</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
              {/* Article Selection */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Artikel *</Text>
              <View style={[styles.pickerContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Picker
                  selectedValue={selectedArticleId}
                  onValueChange={setSelectedArticleId}
                  style={{ color: colors.text }}
                >
                  <Picker.Item label="Artikel wählen..." value="" />
                  {articles.map(article => (
                    <Picker.Item
                      key={article.id}
                      label={`${article.name} (${article.inventory_code})`}
                      value={article.id}
                    />
                  ))}
                </Picker>
              </View>

              {/* Title */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Titel / Defektbeschreibung *</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={title}
                onChangeText={setTitle}
                placeholder="z.B. Display zeigt Streifen"
                placeholderTextColor={colors.textSecondary}
              />

              {/* Description */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Detaillierte Beschreibung *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Wann ist der Defekt aufgetreten? Unter welchen Umständen?..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
              />

              {/* Defect Type */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Defektart</Text>
              <View style={[styles.pickerContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Picker
                  selectedValue={defectType}
                  onValueChange={setDefectType}
                  style={{ color: colors.text }}
                >
                  <Picker.Item label="⚡ Elektrisch" value="electrical" />
                  <Picker.Item label="⚙️ Mechanisch" value="mechanical" />
                  <Picker.Item label="👁️ Optisch" value="optical" />
                  <Picker.Item label="💻 Software" value="software" />
                  <Picker.Item label="📋 Sonstiges" value="other" />
                </Picker>
              </View>

              {/* Severity */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Dringlichkeit</Text>
              <View style={styles.severityButtons}>
                {['low', 'medium', 'high', 'critical'].map(sev => (
                  <TouchableOpacity
                    key={sev}
                    style={[
                      styles.severityBtn,
                      { borderColor: getSeverityColor(sev) },
                      severity === sev && { backgroundColor: getSeverityColor(sev) }
                    ]}
                    onPress={() => setSeverity(sev)}
                  >
                    <Text style={[
                      styles.severityBtnText,
                      { color: severity === sev ? 'white' : getSeverityColor(sev) }
                    ]}>
                      {getSeverityText(sev)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Defect Images */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>📸 Fotos vom Defekt</Text>
              <View style={styles.imageButtons}>
                <TouchableOpacity style={[styles.imageBtn, { backgroundColor: colors.background }]} onPress={takePhoto}>
                  <Ionicons name="camera" size={24} color={colors.primary} />
                  <Text style={[styles.imageBtnText, { color: colors.text }]}>Kamera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.imageBtn, { backgroundColor: colors.background }]} onPress={pickImage}>
                  <Ionicons name="images" size={24} color={colors.primary} />
                  <Text style={[styles.imageBtnText, { color: colors.text }]}>Galerie</Text>
                </TouchableOpacity>
              </View>

              {defectImages.length > 0 && (
                <ScrollView horizontal style={styles.selectedImages} showsHorizontalScrollIndicator={false}>
                  {defectImages.map((img, idx) => (
                    <View key={idx} style={styles.selectedImageContainer}>
                      <Image source={{ uri: img }} style={styles.selectedImage} />
                      <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeImage(idx)}>
                        <Ionicons name="close-circle" size={24} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Warranty Claim */}
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setWarrantyCheck(!warrantyCheck)}
              >
                <Ionicons
                  name={warrantyCheck ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={colors.primary}
                />
                <Text style={[styles.checkboxLabel, { color: colors.text }]}>Garantiefall</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, submitting && { opacity: 0.6 }]}
                onPress={handleCreateTicket}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="white" />
                    <Text style={styles.submitButtonText}>Ticket erstellen</Text>
                  </>
                )}
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: '#ddd' },
  statNumber: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  statLabel: { fontSize: 11, marginTop: 2 },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabText: { fontSize: 14, fontWeight: '600' },
  content: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  ticketCard: { borderRadius: 12, padding: 16, marginBottom: 12 },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  ticketInfo: { flex: 1 },
  ticketNumberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticketNumber: { fontSize: 14, fontWeight: '700' },
  warrantyBadge: { backgroundColor: '#34C75920', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  warrantyText: { fontSize: 10, color: '#34C759', fontWeight: '600' },
  ticketTitle: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  articleName: { fontSize: 12, marginTop: 2 },
  badges: { gap: 4 },
  severityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  ticketDescription: { marginTop: 12, fontSize: 13, lineHeight: 18 },
  ticketMeta: { flexDirection: 'row', marginTop: 12, gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12 },
  imagesPreview: { marginTop: 12 },
  previewImage: { width: 60, height: 60, borderRadius: 8, marginRight: 8 },
  ticketActions: { flexDirection: 'row', marginTop: 12, gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 4 },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  modalBody: { padding: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  pickerContainer: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  textInput: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 16 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  severityButtons: { flexDirection: 'row', gap: 8 },
  severityBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 2, alignItems: 'center' },
  severityBtnText: { fontSize: 12, fontWeight: '600' },
  imageButtons: { flexDirection: 'row', gap: 12 },
  imageBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 10, gap: 8 },
  imageBtnText: { fontSize: 14, fontWeight: '500' },
  selectedImages: { marginTop: 12 },
  selectedImageContainer: { position: 'relative', marginRight: 8 },
  selectedImage: { width: 80, height: 80, borderRadius: 8 },
  removeImageBtn: { position: 'absolute', top: -8, right: -8 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 8 },
  checkboxLabel: { fontSize: 14 },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF3B30', paddingVertical: 14, borderRadius: 10, marginTop: 24, marginBottom: 20, gap: 8 },
  submitButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
