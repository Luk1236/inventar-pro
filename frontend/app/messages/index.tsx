import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Conversation {
  user_id: string;
  username: string;
  last_message: string | null;
  last_message_time: string | null;
  unread_count: number;
}

export default function MessagesPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    loadConversations();
    loadUnreadCount();
    
    const interval = setInterval(() => {
      loadConversations();
      loadUnreadCount();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const loadConversations = async () => {
    try {
      const data = await apiService.get<Conversation[]>('/api/messages/conversations', { showErrorAlert: false });
      setConversations(data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const data = await apiService.get<{ unread_count: number }>('/api/messages/unread/count', { showErrorAlert: false });
      setTotalUnread(data?.unread_count || 0);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadConversations();
    loadUnreadCount();
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Jetzt';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  };

  const renderConversationCard = useCallback(({ item: conversation }: { item: Conversation }) => (
    <TouchableOpacity
      style={[styles.conversationCard, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
      onPress={() => router.push(`/messages/chat/${conversation.user_id}?username=${conversation.username}`)}
    >
      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{conversation.username.charAt(0).toUpperCase()}</Text>
        </View>
        {conversation.unread_count > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{conversation.unread_count}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.conversationInfo}>
        <View style={styles.conversationHeader}>
          <Text style={[styles.username, { color: colors.text }]}>{conversation.username}</Text>
          <Text style={[styles.time, { color: colors.textSecondary }]}>{formatTime(conversation.last_message_time)}</Text>
        </View>
        <Text style={[
          styles.lastMessage,
          { color: colors.textSecondary },
          conversation.unread_count > 0 && { fontWeight: '600', color: colors.text }
        ]} numberOfLines={1}>
          {conversation.last_message || 'Keine Nachrichten'}
        </Text>
      </View>
      
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  ), [colors, isDark, formatTime]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Lade Nachrichten...</Text>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Nachrichten</Text>
        <TouchableOpacity onPress={() => router.push('/messages/new')}>
          <Ionicons name="create-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {totalUnread > 0 && (
        <View style={[styles.unreadBanner, { backgroundColor: isDark ? '#1a3a5c' : '#f0f6ff' }]}>
          <Ionicons name="mail" size={20} color={colors.primary} />
          <Text style={[styles.unreadBannerText, { color: colors.primary }]}>{totalUnread} ungelesene Nachricht{totalUnread !== 1 ? 'en' : ''}</Text>
        </View>
      )}

      <FlatList
        style={styles.content}
        data={conversations}
        keyExtractor={(item) => item.user_id}
        renderItem={renderConversationCard}
        removeClippedSubviews
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={8}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Keine Unterhaltungen</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Starten Sie eine neue Unterhaltung mit Ihren Kollegen
            </Text>
            <TouchableOpacity
              style={[styles.startChatButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/messages/new')}
            >
              <Text style={styles.startChatButtonText}>Neue Nachricht</Text>
            </TouchableOpacity>
          </View>
        }
      />
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
  unreadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  unreadBannerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  conversationsList: {
    paddingVertical: 8,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
  },
  time: {
    fontSize: 13,
  },
  lastMessage: {
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  startChatButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  startChatButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
