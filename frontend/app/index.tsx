import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Dimensions,
  Modal,
  Image
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import apiService, { getToken } from '../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlobalSearch from '../components/GlobalSearch';
import { useTheme } from '../contexts/ThemeContext';
import { useWebSocket } from '../hooks/useWebSocket';


const { width } = Dimensions.get('window');

// M3: Validate JWT structure before parsing; L1: subtract 60 s clock-skew tolerance
const CLOCK_SKEW_MS = 60_000;
const getTokenExpiry = (token: string): number | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null; // not a valid JWT
    const payload = JSON.parse(atob(parts[1]));
    return payload.exp ? payload.exp * 1000 - CLOCK_SKEW_MS : null;
  } catch {
    return null;
  }
};

interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  is_active: boolean;
  profile_image?: string;
}

interface DashboardStats {
  total_articles: number;
  low_stock_articles: number;
  maintenance_due: number;
  movements_today: number;
  total_customers: number;
  total_events: number;
  active_events: number;
  events_this_month: number;
  total_inventory_value: number;
  movements_last_7_days: number;
  defective_articles: number;
  blocked_articles: number;
  overdue_maintenance: number;
  overdue_returns?: number;
  open_repairs?: number;
  ready_packlists?: number;
  top_rented_articles?: Array<{ id: string; name: string; booking_count: number }>;
  pending_invoices_count?: number;
  pending_invoices_total?: number;
}

export default function Index() {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [overbookingCount, setOverbookingCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null); // L1: surface API errors

  // Login states
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [forgotPasswordVisible, setForgotPasswordVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [role, _setRole] = useState('lager');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const [financialStats, setFinancialStats] = useState<any>(null);

  // Branding from settings
  const [branding, setBranding] = useState({
    app_display_name: 'Inventar Pro',
    app_logo_icon: 'cube' as const,
    app_slogan: 'Professionelle Lagerverwaltung',
    company_name: '',
    company_logo: '',
  });

  // Widget customization
  const [widgetCustomizeVisible, setWidgetCustomizeVisible] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState({
    rechnungen: true,
    reparaturen: true,
    packlisten: true,
    engpaesse: true,
    konflikte: true,
    artikel: true,
    events: true,
    financial: true,
  });

  const toggleWidget = useCallback((key: keyof typeof visibleWidgets) => {
    setVisibleWidgets(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const [sessionWarningVisible, setSessionWarningVisible] = useState(false);
  const sessionTimerRef = useRef<any>(null);

  const [notifications, setNotifications] = useState<{title: string, body: string, type: string}[]>([]);
  const [notifModalVisible, setNotifModalVisible] = useState(false);

  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({
    lager: false,
    projekte: false,
    personalplaner: false,
    kalender: false,
    mangel: false,
    finanzen: false,
    kontakte: false,
    werkstatt: false,
    statistik: false,
    fahrzeuge: false,
    aufgaben: false,
    kommunikation: false,
  });

  const toggleSection = useCallback((key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const renderSectionHeader = useCallback((key: string, icon: string, label: string, badgeCount?: number, badgeColor?: string) => (
    <TouchableOpacity
      style={[styles.sectionHeader, { backgroundColor: colors.card }]}
      onPress={() => toggleSection(key)}
      accessibilityLabel={`${label} Bereich ${expandedSections[key] ? 'zuklappen' : 'aufklappen'}`}
      accessibilityRole="button"
    >
      <View style={styles.sectionHeaderLeft}>
        <View style={[styles.subIconBox, { backgroundColor: colors.primary + '18', width: 34, height: 34, borderRadius: 10 }]}>
          <Ionicons name={icon as any} size={18} color={colors.primary} />
        </View>
        <Text style={[styles.sectionHeaderLabel, { color: colors.text }]}>{label}</Text>
      </View>
      <View style={styles.sectionHeaderRight}>
        {badgeCount !== undefined && badgeCount > 0 && (
          <View style={[styles.sectionBadge, { backgroundColor: badgeColor || colors.primary }]}>
            <Text style={styles.sectionBadgeText}>{badgeCount}</Text>
          </View>
        )}
        <Ionicons
          name={expandedSections[key] ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
      </View>
    </TouchableOpacity>
  ), [colors, expandedSections, toggleSection]);

  const renderSubItem = useCallback((icon: string, label: string, route: string | null, badgeCount?: number, badgeColor?: string, onPress?: () => void) => (
    <TouchableOpacity
      style={[styles.subItem, { borderBottomColor: colors.border }]}
      onPress={onPress ?? (route ? () => router.push(route as any) : undefined)}
      activeOpacity={0.65}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <View style={[styles.subIconBox, { backgroundColor: (badgeColor || colors.primary) + '18' }]}>
        <Ionicons name={icon as any} size={16} color={badgeColor || colors.primary} />
      </View>
      <Text style={[styles.subItemLabel, { color: colors.text }]}>{label}</Text>
      {badgeCount !== undefined && badgeCount > 0 && (
        <View style={[styles.subBadge, { backgroundColor: badgeColor || colors.primary }]}>
          <Text style={styles.subBadgeText}>{badgeCount}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={13} color={colors.border} />
    </TouchableOpacity>
  ), [colors]);

  // M4 — Memoize styles so StyleSheet.create() runs only when theme changes
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Login Styles - Modern Clean
    loginContainer: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 28,
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: 40,
    },
    logoCircle: {
      width: 100,
      height: 100,
      borderRadius: 28,
      backgroundColor: isDark ? 'rgba(10,132,255,0.12)' : 'rgba(0,122,255,0.08)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(10,132,255,0.2)' : 'rgba(0,122,255,0.15)',
    },
    appTitle: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: 0.5,
    },
    appSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 6,
      fontWeight: '400',
      letterSpacing: 0.2,
    },
    loginCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 28,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.25 : 0.08,
      shadowRadius: 16,
      elevation: 5,
      borderWidth: 1,
      borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.03)',
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderRadius: 14,
      padding: 4,
      marginBottom: 28,
    },
    tab: {
      flex: 1,
      paddingVertical: 14,
      alignItems: 'center',
      borderRadius: 12,
    },
    activeTab: {
      backgroundColor: colors.card,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    tabText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
      letterSpacing: 0.2,
    },
    activeTabText: {
      color: colors.primary,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: 14,
      padding: 18,
      fontSize: 16,
      marginBottom: 18,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      padding: 18,
      alignItems: 'center',
      marginTop: 8,
    },
    primaryButtonText: {
      color: 'white',
      fontSize: 17,
      fontWeight: '600',
    },
    // Dashboard Styles - Modern Clean Design
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 20,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    greeting: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: 0.3,
    },
    subGreeting: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
      fontWeight: '400',
    },
    profileButton: {
      padding: 4,
    },
    profileImage: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    profileImagePlaceholder: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    companyLogoSmall: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.background,
    },
    companyLogoPlaceholderSmall: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    companyNameSmall: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      letterSpacing: 0.2,
    },
    logoutButton: {
      padding: 8,
      borderRadius: 20,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 16,
      paddingHorizontal: 18,
      paddingVertical: 16,
      marginBottom: 24,
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.15 : 0.04,
      shadowRadius: 12,
      elevation: 3,
      borderWidth: 1,
      borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.04)',
    },
    searchPlaceholder: {
      fontSize: 16,
      color: colors.textSecondary,
      fontWeight: '400',
    },
    // Widgets - Modern Cards
    widgetRow: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 16,
    },
    widget: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.15 : 0.03,
      shadowRadius: 12,
      elevation: 3,
      borderWidth: 1,
      borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.03)',
    },
    widgetRed: {
      borderLeftWidth: 0,
      borderTopWidth: 3,
      borderTopColor: '#FF3B30',
    },
    widgetOrange: {
      borderLeftWidth: 0,
      borderTopWidth: 3,
      borderTopColor: '#FF9500',
    },
    widgetGreen: {
      borderLeftWidth: 0,
      borderTopWidth: 3,
      borderTopColor: '#34C759',
    },
    widgetBlue: {
      borderLeftWidth: 0,
      borderTopWidth: 3,
      borderTopColor: colors.primary,
    },
    widgetPurple: {
      borderLeftWidth: 0,
      borderTopWidth: 3,
      borderTopColor: '#5856D6',
    },
    widgetNumber: {
      fontSize: 36,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -1,
    },
    widgetLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 6,
      fontWeight: '500',
      letterSpacing: 0.2,
    },
    widgetIcon: {
      position: 'absolute',
      top: 16,
      right: 16,
      width: 44,
      height: 44,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Sections - Modern Headers
    sectionTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginTop: 28,
      marginBottom: 14,
      marginLeft: 4,
      letterSpacing: 0.3,
    },
    // Quick Grid - Modern Icons
    quickGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
    },
    quickCard: {
      width: (width - 76) / 4,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 12,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.12 : 0.03,
      shadowRadius: 10,
      elevation: 2,
      borderWidth: 1,
      borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.02)',
    },
    quickIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
    },
    quickLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      letterSpacing: 0.1,
    },
    badge: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 3,
      marginRight: 8,
    },
    badgeText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '600',
    },
    // Accordion styles - Modern Clean
    sectionHeader: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 18,
      paddingVertical: 16,
    },
    sectionHeaderLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
    sectionHeaderLabel: { fontSize: 15, fontWeight: '600' as const, letterSpacing: 0.2 },
    sectionHeaderRight: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
    sectionBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
    sectionBadgeText: { color: 'white', fontSize: 11, fontWeight: '700' as const },
    subItem: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingVertical: 14,
      paddingLeft: 18,
      paddingRight: 16,
      borderBottomWidth: 0.5,
      gap: 14,
    },
    subIconBox: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    subItemLabel: { flex: 1, fontSize: 15, fontWeight: '500' as const, letterSpacing: 0.1 },
    subBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
    subBadgeText: { color: 'white', fontSize: 11, fontWeight: '600' as const },
    accordionContainer: {
      backgroundColor: colors.card,
      borderRadius: 18,
      overflow: 'hidden' as const,
      marginBottom: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.12 : 0.03,
      shadowRadius: 10,
      elevation: 2,
      borderWidth: 1,
      borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.02)',
    },
    financialWidget: {
      borderRadius: 18,
      padding: 20,
      marginBottom: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.12 : 0.03,
      shadowRadius: 10,
      elevation: 2,
      borderWidth: 1,
      borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.02)',
    },
    financialWidgetHalf: {
      flex: 1,
      borderRadius: 18,
      padding: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.12 : 0.03,
      shadowRadius: 10,
      elevation: 2,
      borderWidth: 1,
      borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.02)',
    },
    financialTitle: {
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 10,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    financialTotal: {
      fontSize: 28,
      fontWeight: '800',
      marginBottom: 12,
      letterSpacing: -0.5,
    },
    progressBar: {
      height: 10,
      borderRadius: 5,
      flexDirection: 'row',
      overflow: 'hidden',
      backgroundColor: colors.border,
      marginBottom: 14,
      gap: 2,
    },
    financialLegend: {
      gap: 8,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendLabel: {
      fontSize: 13,
      flex: 1,
    },
    // ===== KPI Widget Styles =====
    widgetRow: {
      flexDirection: 'row' as const,
      gap: 12,
      marginBottom: 12,
    },
    widget: {
      flex: 1,
      borderRadius: 18,
      padding: 18,
      position: 'relative' as const,
      overflow: 'hidden' as const,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.15 : 0.06,
      shadowRadius: 10,
      elevation: 3,
      backgroundColor: colors.card,
    },
    widgetBlue: { backgroundColor: isDark ? '#1a2744' : '#EFF6FF' },
    widgetRed: { backgroundColor: isDark ? '#3d1515' : '#FFF1F0' },
    widgetGreen: { backgroundColor: isDark ? '#14321a' : '#F0FFF4' },
    widgetOrange: { backgroundColor: isDark ? '#3d2800' : '#FFFBEB' },
    widgetNumber: {
      fontSize: 36,
      fontWeight: '800' as const,
      color: colors.text,
      letterSpacing: -1,
    },
    widgetLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500' as const,
      marginTop: 2,
    },
    widgetIcon: {
      position: 'absolute' as const,
      top: 14,
      right: 14,
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    subGroupLabel: {
      paddingHorizontal: 16,
      paddingVertical: 6,
    },
    subGroupText: {
      fontSize: 11,
      fontWeight: '700' as const,
      letterSpacing: 0.8,
    },
    // Bottom Navigation
    bottomNav: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderTopWidth: 0.5,
      borderTopColor: colors.border,
      paddingTop: 8,
      paddingHorizontal: 8,
      justifyContent: 'space-around',
      alignItems: 'center',
    },
    navItem: {
      alignItems: 'center',
      paddingVertical: 4,
      flex: 1,
    },
    navLabel: {
      fontSize: 10,
      color: colors.textSecondary,
      marginTop: 2,
    },
    scannerButton: {
      marginTop: -30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scannerButtonInner: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
    },
  }), [colors, isDark]);

  useEffect(() => {
    checkAuthStatus();
    return () => {
      // Cleanup session timer on unmount to prevent memory leaks
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      loadAllStats();
      loadFinancialStats();
      loadNotifications();
      loadBranding();
    }
  }, [isLoggedIn]);

  // Reload user data when returning to this screen (e.g., from profile page)
  useFocusEffect(
    useCallback(() => {
      if (isLoggedIn) {
        reloadUserData();
      }
    }, [isLoggedIn])
  );

  // P2-T1: Auto-refresh dashboard when articles/bookings/events change via WebSocket
  useWebSocket((msg) => {
    if ([
      'article_created', 'article_updated', 'article_deleted',
      'booking_created', 'booking_cancelled',
      'event_created', 'event_updated',
    ].includes(msg.type)) {
      loadDashboardStats();
    }
  });

  const reloadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      if (__DEV__) console.warn('[Auth] reloadUserData failed:', error);
    }
  };

  const checkAuthStatus = async () => {
    try {
      // K2 — Use apiService.getToken() which reads from SecureStore (not raw AsyncStorage)
      const token = await apiService.getToken();
      const userData = await AsyncStorage.getItem('user');
      if (token && userData) {
        const parsedUser = JSON.parse(userData);
        // Validate minimum required fields before trusting stored data
        if (!parsedUser?.id || !parsedUser?.username) {
          await apiService.clearAuth();
          return;
        }
        setUser(parsedUser);
        setIsLoggedIn(true);
      }
    } catch (error) {
      if (__DEV__) console.warn('[Auth] checkAuthStatus failed:', error);
      await apiService.clearAuth();
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadDashboardStats(), loadOverbookingAlerts(), loadConflictCount(), loadFinancialStats(), loadNotifications()]);
    setRefreshing(false);
  };

  const loadAllStats = async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      await Promise.all([loadDashboardStats(), loadOverbookingAlerts(), loadConflictCount()]);
    } catch (e: any) {
      // L1: Propagate error so UI can show retry instead of infinite spinner
      setStatsError(e?.message ?? 'Verbindung zum Server fehlgeschlagen');
    } finally {
      setStatsLoading(false);
    }
  };

  const loadFinancialStats = async () => {
    try {
      const data = await apiService.get<any>('/api/dashboard/financial', { showErrorAlert: false });
      setFinancialStats(data);
    } catch (error) {
      if (__DEV__) console.warn('[Dashboard] loadFinancialStats failed:', error);
      setFinancialStats(null);
    }
  };

  const loadBranding = async () => {
    try {
      const settings = await apiService.get<any>('/api/settings/app', { showErrorAlert: false });
      if (settings) {
        setBranding({
          app_display_name: settings.app_display_name || 'Inventar Pro',
          app_logo_icon: settings.app_logo_icon || 'cube',
          app_slogan: settings.app_slogan || 'Professionelle Lagerverwaltung',
          company_name: settings.company_name || '',
          company_logo: settings.company_logo || '',
        });
      }
    } catch (error) {
      if (__DEV__) console.warn('[Dashboard] loadBranding failed:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      const [tasks, inspections] = await Promise.all([
        apiService.get<any[]>('/api/tasks', { showErrorAlert: false }),
        apiService.get<any[]>('/api/inspections', { showErrorAlert: false }),
      ]);
      const today = new Date().toISOString().split('T')[0];
      const notifs: {title: string, body: string, type: string}[] = [];
      // Überfällige Aufgaben
      (tasks || []).filter(t => t.status !== 'erledigt' && t.due_date && t.due_date < today).forEach(t => {
        notifs.push({ title: `Aufgabe überfällig`, body: t.title, type: 'task' });
      });
      // Überfällige Prüfungen
      (inspections || []).filter(i => i.result === 'ausstehend' && i.due_date && i.due_date < today).forEach(i => {
        notifs.push({ title: `Prüfung überfällig`, body: i.article_name || i.inspection_type, type: 'inspection' });
      });
      setNotifications(notifs);
    } catch (error) {
      if (__DEV__) console.warn('[Dashboard] loadNotifications failed:', error);
      setNotifications([]);
    }
  };

  const loadDashboardStats = async () => {
    try {
      const stats = await apiService.get<DashboardStats>('/api/dashboard/stats', { showErrorAlert: false });
      setDashboardStats(stats);
    } catch (error) {
      if (__DEV__) console.warn('[Dashboard] loadDashboardStats failed:', error);
    }
  };

  const loadOverbookingAlerts = async () => {
    try {
      const alerts = await apiService.get<{ total_alerts: number }>('/api/overbooking-alerts?days_ahead=14', { showErrorAlert: false });
      setOverbookingCount(alerts?.total_alerts || 0);
    } catch (error) {
      if (__DEV__) console.warn('[Dashboard] loadOverbookingAlerts failed:', error);
    }
  };

  const loadConflictCount = async () => {
    try {
      const [ac, cc] = await Promise.all([
        apiService.get<any[]>('/api/conflicts', { showErrorAlert: false }),
        apiService.get<any[]>('/api/conflicts/crew', { showErrorAlert: false }),
      ]);
      setConflictCount((ac?.length || 0) + (cc?.length || 0));
    } catch (error) {
      if (__DEV__) console.warn('[Dashboard] loadConflictCount failed:', error);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      Alert.alert('Fehler', 'Bitte E-Mail-Adresse eingeben');
      return;
    }
    setForgotLoading(true);
    try {
      await apiService.post('/api/auth/forgot-password', { email: forgotEmail }, { skipAuth: true, showErrorAlert: false });
      Alert.alert('Erfolg', 'Falls diese E-Mail existiert, wurde ein Reset-Link gesendet.');
      setForgotPasswordVisible(false);
      setForgotEmail('');
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Fehler beim Senden');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!username?.trim() || !password?.trim()) {
      setAuthError('Bitte Benutzername und Passwort eingeben');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      const response = await apiService.login(username.trim(), password);
      setAuthSuccess('Anmeldung erfolgreich!');
      setUser(response.user);
      setIsLoggedIn(true);
      startSessionTimer();
      setUsername('');
      setPassword('');
    } catch (error: any) {
      const msg = error.message || 'Anmeldung fehlgeschlagen';
      if (msg === 'NO_INTERNET' || msg === 'TIMEOUT') {
        setAuthError('Backend nicht erreichbar. Läuft der Server auf Port 8002?');
      } else {
        setAuthError(msg);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!username?.trim() || !password?.trim() || !email?.trim()) {
      Alert.alert('Fehler', 'Bitte füllen Sie alle Felder aus');
      return;
    }
    setAuthLoading(true);
    try {
      await apiService.post('/api/register', { username, password, email, role }, { skipAuth: true });
      Alert.alert('Erfolg', 'Registrierung erfolgreich. Warten Sie auf Admin-Freigabe.');
      setIsLogin(true);
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Registrierung fehlgeschlagen');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    await apiService.logout();
    setIsLoggedIn(false);
    setUser(null);
  };

  const startSessionTimer = async () => {
    // K2 — Use apiService.getToken() which reads from SecureStore
    const token = await apiService.getToken();
    if (!token) return;
    const expiry = getTokenExpiry(token);
    if (!expiry) return;

    const now = Date.now();
    const warningTime = expiry - now - 2 * 60 * 1000; // 2 min vor Ablauf

    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);

    if (warningTime > 0) {
      sessionTimerRef.current = setTimeout(() => {
        setSessionWarningVisible(true);
      }, warningTime);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ===========================================
  // LOGIN SCREEN
  // ===========================================
  if (!isLoggedIn) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ScrollView contentContainerStyle={styles.loginContainer}>
          <View style={styles.logoContainer}>
            {/* Company Logo or Default Icon */}
            {branding.company_logo ? (
              <View style={[styles.logoCircle, { overflow: 'hidden', padding: 0 }]}>
                <Image
                  source={{ uri: branding.company_logo }}
                  style={{ width: 96, height: 96, borderRadius: 48 }}
                  resizeMode="cover"
                />
              </View>
            ) : (
              <View style={styles.logoCircle}>
                <Ionicons name={branding.app_logo_icon as any} size={48} color={colors.primary} />
              </View>
            )}
            {/* Company Name or App Name */}
            <Text style={styles.appTitle}>{branding.company_name || branding.app_display_name}</Text>
            <Text style={styles.appSubtitle}>{branding.app_slogan}</Text>
          </View>

          <View style={styles.loginCard}>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, isLogin && styles.activeTab]}
                onPress={() => setIsLogin(true)}
              >
                <Text style={[styles.tabText, isLogin && styles.activeTabText]}>Anmelden</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, !isLogin && styles.activeTab]}
                onPress={() => setIsLogin(false)}
              >
                <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>Registrieren</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Benutzername"
              placeholderTextColor={colors.textSecondary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            {!isLogin && (
              <TextInput
                style={styles.input}
                placeholder="E-Mail"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            )}
            <TextInput
              style={styles.input}
              placeholder="Passwort"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            {isLogin && (
              <TouchableOpacity
                style={{ alignSelf: 'flex-end', marginBottom: 8, marginTop: -2 }}
                onPress={() => setForgotPasswordVisible(true)}
              >
                <Text style={{ color: colors.primary, fontSize: 13 }}>Passwort vergessen?</Text>
              </TouchableOpacity>
            )}

            {authError && (
              <View style={{ backgroundColor: isDark ? '#3D0000' : '#FFE5E5', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                <Text style={{ color: isDark ? '#FF6B6B' : '#CC0000', fontSize: 14 }}>❌ {authError}</Text>
              </View>
            )}
            {authSuccess && (
              <View style={{ backgroundColor: isDark ? '#003D00' : '#E5FFE5', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                <Text style={{ color: isDark ? '#6BFF6B' : '#006600', fontSize: 14 }}>✅ {authSuccess}</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={isLogin ? handleLogin : handleRegister}
              disabled={authLoading}
            >
              {authLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isLogin ? 'Anmelden' : 'Registrieren'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
        <Modal visible={forgotPasswordVisible} transparent animationType="fade" onRequestClose={() => setForgotPasswordVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
            <View style={[styles.loginCard, { backgroundColor: colors.card }]}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Passwort zurücksetzen</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="E-Mail-Adresse"
                placeholderTextColor={colors.textSecondary}
                value={forgotEmail}
                onChangeText={setForgotEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 12 }]}
                onPress={handleForgotPassword}
                disabled={forgotLoading}
              >
                {forgotLoading
                  ? <ActivityIndicator color="white" />
                  : <Text style={{ color: 'white', fontWeight: '600' }}>Reset-Link senden</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setForgotPasswordVisible(false)}>
                <Text style={{ color: colors.textSecondary }}>Abbrechen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    );
  }

  // ===========================================
  // DASHBOARD - COCKPIT VIEW
  // ===========================================
  const stats = dashboardStats;
  const todayEvents = stats?.active_events || 0;
  const overdueReturns = stats?.overdue_returns || stats?.blocked_articles || 0;
  const openRepairs = stats?.open_repairs || stats?.maintenance_due || 0;
  const readyPacklists = stats?.ready_packlists || stats?.events_this_month || 0;

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <GlobalSearch visible={searchVisible} onClose={() => setSearchVisible(false)} />

      {/* Header with Company Logo & User Info */}
      <View style={styles.header}>
        {/* Left: Company Logo + User Greeting */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          {/* Company Logo */}
          {branding.company_logo ? (
            <Image source={{ uri: branding.company_logo }} style={styles.companyLogoSmall} />
          ) : (
            <View style={[styles.companyLogoPlaceholderSmall, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="business" size={18} color={colors.primary} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.companyNameSmall} numberOfLines={1}>
              {branding.company_name || branding.app_display_name}
            </Text>
            <Text style={styles.greeting}>Hallo, {user?.username}! 👋</Text>
          </View>
        </View>

        {/* Right: Action Buttons */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {/* Theme Toggle */}
          <TouchableOpacity
            style={{ padding: 6 }}
            onPress={toggleTheme}
            accessibilityLabel={isDark ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}
          >
            <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={22} color={colors.primary} />
          </TouchableOpacity>

          {/* Notifications */}
          <TouchableOpacity
            style={{ padding: 6, position: 'relative' }}
            onPress={() => setNotifModalVisible(true)}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.primary} />
            {notifications.length > 0 && (
              <View style={{
                position: 'absolute', top: 2, right: 2,
                backgroundColor: '#FF3B30', borderRadius: 10,
                minWidth: 16, height: 16,
                justifyContent: 'center', alignItems: 'center',
                paddingHorizontal: 2,
              }}>
                <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>
                  {notifications.length > 99 ? '99+' : notifications.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Settings Button */}
          <TouchableOpacity
            style={{ padding: 6 }}
            onPress={() => router.push('/settings')}
            accessibilityLabel="Einstellungen öffnen"
          >
            <Ionicons name="settings-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* User Avatar */}
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/profile')}
            accessibilityLabel="Profil öffnen"
          >
            {user?.profile_image ? (
              <Image source={{ uri: user.profile_image }} style={styles.profileImage} />
            ) : (
              <View style={[styles.profileImagePlaceholder, { backgroundColor: colors.primary }]}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                  {(user?.username || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Logout */}
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: isDark ? '#3a2723' : '#fee2e2' }]}
            onPress={handleLogout}
            accessibilityLabel="Abmelden"
          >
            <Ionicons name="log-out-outline" size={20} color={isDark ? '#f87171' : '#dc2626'} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 150 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Search Bar */}
        <TouchableOpacity style={styles.searchBar} onPress={() => setSearchVisible(true)}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <Text style={[styles.searchPlaceholder, { flex: 1 }]}>Artikel, Kunden, Events suchen...</Text>
          <TouchableOpacity onPress={() => setWidgetCustomizeVisible(true)} style={{ paddingLeft: 8 }}>
            <Ionicons name="options-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Financial Widgets - Only for Admin/Manager */}
        {visibleWidgets.financial && financialStats && (user?.role === 'admin' || user?.role === 'manager') && (
          <>
            {/* Offenstehende Rechnungen */}
            <TouchableOpacity
              style={[styles.financialWidget, { backgroundColor: colors.card }]}
              onPress={() => router.push('/invoices')}
            >
              <Text style={[styles.financialTitle, { color: colors.textSecondary }]}>Offenstehende Rechnungen</Text>
              <Text style={[styles.financialTotal, { color: colors.text }]}>
                {(financialStats.outstanding_total || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
              </Text>
              {(financialStats.outstanding_total || 0) > 0 && (
                <View style={styles.progressBar}>
                  {(financialStats.outstanding_offen || 0) > 0 && (
                    <View style={{ flex: financialStats.outstanding_offen, backgroundColor: '#007AFF', height: '100%', borderRadius: 2 }} />
                  )}
                  {(financialStats.outstanding_ueberfaellig || 0) > 0 && (
                    <View style={{ flex: financialStats.outstanding_ueberfaellig, backgroundColor: '#FF3B30', height: '100%', borderRadius: 2 }} />
                  )}
                  {(financialStats.outstanding_bezahlt || 0) > 0 && (
                    <View style={{ flex: financialStats.outstanding_bezahlt, backgroundColor: '#34C759', height: '100%', borderRadius: 2 }} />
                  )}
                </View>
              )}
              <View style={styles.financialLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#007AFF' }]} />
                  <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>Offen: {(financialStats.outstanding_offen || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#FF3B30' }]} />
                  <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>Überfällig: {(financialStats.outstanding_ueberfaellig || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
                  <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>Bezahlt: {(financialStats.outstanding_bezahlt || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Umsatz + Offene Angebote row */}
            <View style={styles.widgetRow}>
              <View style={[styles.financialWidgetHalf, { backgroundColor: colors.card }]}>
                <Text style={[styles.financialTitle, { color: colors.textSecondary, fontSize: 12 }]}>Umsatz</Text>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
                  <Text style={[styles.legendLabel, { color: colors.textSecondary, fontSize: 11 }]}>
                    Best.: {(financialStats.revenue_confirmed || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} €
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#007AFF' }]} />
                  <Text style={[styles.legendLabel, { color: colors.textSecondary, fontSize: 11 }]}>
                    Option: {(financialStats.revenue_option || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} €
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#FF3B30' }]} />
                  <Text style={[styles.legendLabel, { color: colors.textSecondary, fontSize: 11 }]}>
                    Storn.: {(financialStats.revenue_cancelled || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} €
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.financialWidgetHalf, { backgroundColor: colors.card }]}
                onPress={() => router.push('/quotes')}
              >
                <Text style={[styles.financialTitle, { color: colors.textSecondary, fontSize: 12 }]}>Offene Angebote</Text>
                <Text style={[styles.financialTotal, { color: colors.text, fontSize: 28 }]}>
                  {financialStats.open_quotes_count || 0}
                </Text>
                <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>
                  {(financialStats.open_quotes_total || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                </Text>
                <Text style={{ color: colors.primary, fontSize: 12, marginTop: 8 }}>Alle anzeigen →</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Loading indicator while dashboard stats are fetching */}
        {statsLoading && !dashboardStats && (
          <View style={{ paddingVertical: 12, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}

        {/* L1: Show error + retry button when API is unreachable */}
        {!statsLoading && statsError && !dashboardStats && (
          <View style={{ paddingVertical: 16, alignItems: 'center', gap: 8 }}>
            <Text style={{ color: colors.danger, fontSize: 14 }}>{statsError}</Text>
            <TouchableOpacity onPress={loadAllStats} style={{ backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Erneut versuchen</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Actions - Essential Shortcuts */}
        <Text style={styles.sectionTitle}>Schnellzugriff</Text>
        <View style={[styles.quickGrid, { justifyContent: 'flex-start', marginBottom: 20 }]}>
          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/articles')}>
            <View style={[styles.quickIcon, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="cube-outline" size={26} color={colors.primary} />
            </View>
            <Text style={styles.quickLabel}>Artikel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/events')}>
            <View style={[styles.quickIcon, { backgroundColor: '#5856D615' }]}>
              <Ionicons name="calendar-outline" size={26} color="#5856D6" />
            </View>
            <Text style={styles.quickLabel}>Events</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/bookings')}>
            <View style={[styles.quickIcon, { backgroundColor: '#34C75915' }]}>
              <Ionicons name="bookmark-outline" size={26} color="#34C759" />
            </View>
            <Text style={styles.quickLabel}>Buchungen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/customers')}>
            <View style={[styles.quickIcon, { backgroundColor: '#FF950015' }]}>
              <Ionicons name="people-outline" size={26} color="#FF9500" />
            </View>
            <Text style={styles.quickLabel}>Kunden</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/maintenance')}>
            <View style={[styles.quickIcon, { backgroundColor: '#FF3B3015' }]}>
              <Ionicons name="construct-outline" size={26} color="#FF3B30" />
            </View>
            <Text style={styles.quickLabel}>Wartung</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/storage')}>
            <View style={[styles.quickIcon, { backgroundColor: '#00C7BE15' }]}>
              <Ionicons name="location-outline" size={26} color="#00C7BE" />
            </View>
            <Text style={styles.quickLabel}>Lager</Text>
          </TouchableOpacity>
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/invoices')}>
              <View style={[styles.quickIcon, { backgroundColor: '#AF52DE15' }]}>
                <Ionicons name="receipt-outline" size={26} color="#AF52DE" />
              </View>
              <Text style={styles.quickLabel}>Rechnungen</Text>
            </TouchableOpacity>
          )}
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/sub-rentals')}>
              <View style={[styles.quickIcon, { backgroundColor: '#FF6B0015' }]}>
                <Ionicons name="git-compare-outline" size={26} color="#FF6B00" />
              </View>
              <Text style={styles.quickLabel}>Zumietung</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/packing-list')}>
            <View style={[styles.quickIcon, { backgroundColor: '#00897B15' }]}>
              <Ionicons name="list-outline" size={26} color="#00897B" />
            </View>
            <Text style={styles.quickLabel}>Packliste</Text>
          </TouchableOpacity>
        </View>

        {/* ===== WAREHOUSE METRICS (Available for all) ===== */}
        <View style={styles.widgetRow}>
          <TouchableOpacity style={[styles.widget, styles.widgetBlue]} onPress={() => router.push('/events')}>
            <Text style={styles.widgetNumber}>{todayEvents}</Text>
            <Text style={styles.widgetLabel}>Aktive Events</Text>
            <View style={[styles.widgetIcon, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="calendar" size={24} color={colors.primary} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.widget, styles.widgetRed]} onPress={() => router.push('/maintenance')}>
            <Text style={styles.widgetNumber}>{openRepairs}</Text>
            <Text style={styles.widgetLabel}>Defekte Artikel</Text>
            <View style={[styles.widgetIcon, { backgroundColor: '#FF3B3015' }]}>
              <Ionicons name="warning" size={24} color="#FF3B30" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.widgetRow}>
          <TouchableOpacity style={[styles.widget, styles.widgetGreen]} onPress={() => router.push('/packing-list')}>
            <Text style={styles.widgetNumber}>{readyPacklists}</Text>
            <Text style={styles.widgetLabel}>Packlisten</Text>
            <View style={[styles.widgetIcon, { backgroundColor: '#34C75915' }]}>
              <Ionicons name="list" size={24} color="#34C759" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.widget, styles.widgetOrange]} onPress={() => router.push('/storage')}>
            <Text style={styles.widgetNumber}>{overdueReturns}</Text>
            <Text style={styles.widgetLabel}>Rückläufer</Text>
            <View style={[styles.widgetIcon, { backgroundColor: '#FF950015' }]}>
              <Ionicons name="return-down-back" size={24} color="#FF9500" />
            </View>
          </TouchableOpacity>
        </View>

        {/* ===== DASHBOARD STATS WIDGETS ===== */}

        {/* Inventory Value - Only Admin/Manager */}
        {(user?.role === 'admin' || user?.role === 'manager') && stats?.total_inventory_value !== undefined && (
          <View style={[{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0.12 : 0.04, shadowRadius: 8, elevation: 2 }]}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>
              {`€ ${(stats.total_inventory_value ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>Inventarwert</Text>
          </View>
        )}

        {/* Pending Invoices - Only Admin/Manager */}
        {(user?.role === 'admin' || user?.role === 'manager') && stats?.pending_invoices_count !== undefined && (
          <View style={[{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0.12 : 0.04, shadowRadius: 8, elevation: 2 }]}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>
              {stats.pending_invoices_count ?? 0}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
              {`Offene Rechnungen${stats.pending_invoices_total ? ` (€ ${(stats.pending_invoices_total).toLocaleString('de-DE', { minimumFractionDigits: 2 })})` : ''}`}
            </Text>
          </View>
        )}

        {/* Top 10 rented articles */}
        {stats?.top_rented_articles && stats.top_rented_articles.length > 0 && (
          <View style={[{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0.12 : 0.04, shadowRadius: 8, elevation: 2 }]}>
            <Text style={[styles.sectionTitle, { marginTop: 0, marginLeft: 0, marginBottom: 10 }]}>Top 10 meist-gebuchte Artikel</Text>
            {stats.top_rented_articles.map((item, index) => (
              <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }}>
                <Text style={{ width: 24, color: colors.textSecondary, fontSize: 13 }}>{index + 1}.</Text>
                <Text style={{ flex: 1, color: colors.text, fontSize: 14 }} numberOfLines={1}>{item.name}</Text>
                <Text style={{ color: '#007AFF', fontSize: 14, fontWeight: '600' }}>{item.booking_count}x</Text>
              </View>
            ))}
          </View>
        )}

        {/* ===== ACCORDION NAVIGATION ===== */}

        {/* Kalender */}
        <View style={styles.accordionContainer}>
          {renderSectionHeader('kalender', 'calendar-outline', 'Kalender')}
          {expandedSections.kalender && (
            <>
              {renderSubItem('briefcase-outline', 'Aufgabentafel', '/job-board')}
              {renderSubItem('time-outline', 'Zeiterfassung', '/time-tracking')}
            </>
          )}
        </View>

        {/* Lager */}
        <View style={styles.accordionContainer}>
          {renderSectionHeader('lager', 'cube-outline', 'Lager', stats?.total_articles)}
          {expandedSections.lager && (
            <>
              {renderSubItem('cube-outline', 'Artikel', '/articles', stats?.total_articles)}
              {renderSubItem('folder-outline', 'Kategorien', '/categories')}
              {renderSubItem('location-outline', 'Lagerorte', '/storage/locations')}
              {renderSubItem('business-outline', 'Lager', '/lager')}
              {renderSubItem('cube-outline', 'Lager-Planer', '/lager-planer')}
              {renderSubItem('git-merge-outline', 'Kombinationen', '/bundles')}
              {renderSubItem('swap-horizontal-outline', 'Cross-Docking', '/cross-docking')}
              {renderSubItem('list-circle-outline', 'Lager-Tracking-Log', '/tracking-log')}

            </>
          )}
        </View>

        {/* Projekte */}
        <View style={styles.accordionContainer}>
          {renderSectionHeader('projekte', 'briefcase-outline', 'Projekte', stats?.active_events, '#5856D6')}
          {expandedSections.projekte && (
            <>
              {renderSubItem('calendar-outline', 'Events', '/events', stats?.active_events, '#5856D6')}
              {renderSubItem('bookmark-outline', 'Buchungen', '/bookings')}
              {renderSubItem('document-text-outline', 'Angebote', '/quotes')}
              {renderSubItem('clipboard-outline', 'Packlisten', '/packing-list')}
              {renderSubItem('mail-open-outline', 'Vermietungsanfragen', '/rental-requests')}
            </>
          )}
        </View>

        {/* Personalplaner */}
        <View style={styles.accordionContainer}>
          {renderSectionHeader('personalplaner', 'people-outline', 'Personalplaner')}
          {expandedSections.personalplaner && (
            <>
              {renderSubItem('people-circle-outline', 'Crew-Planung', '/crew-planning')}
              {renderSubItem('shield-outline', 'Teams', '/teams')}
              {renderSubItem('time-outline', 'Stundenerfassung', '/time-tracking')}
              {renderSubItem('flash-outline', 'Aktivitäten', '/aktivitaeten')}
              {renderSubItem('calendar-clear-outline', 'Abwesenheitsanträge', '/absences')}
            </>
          )}
        </View>

        {/* Mangel */}
        <View style={styles.accordionContainer}>
          {renderSectionHeader('mangel', 'warning-outline', 'Mangel', conflictCount + overbookingCount, '#FF3B30')}
          {expandedSections.mangel && (
            <>
              {renderSubItem('git-compare-outline', 'Konflikte', '/conflicts', conflictCount, '#FF3B30')}
              {renderSubItem('alert-circle-outline', 'Material-Engpässe', null, overbookingCount, '#FF9500',
                () => Alert.alert('Material-Engpässe',
                  overbookingCount > 0
                    ? `${overbookingCount} Engpässe in 14 Tagen erkannt`
                    : 'Keine Engpässe erkannt ✓'))}
            </>
          )}
        </View>

        {/* Finanzen */}
        <View style={styles.accordionContainer}>
          {renderSectionHeader('finanzen', 'cash-outline', 'Finanzen')}
          {expandedSections.finanzen && (
            <>
              {renderSubItem('receipt-outline', 'Rechnungen', '/invoices')}
              {renderSubItem('trending-up-outline', 'Zu fakturieren', '/billing-queue')}
              {renderSubItem('cart-outline', 'Bestellungen', '/purchase-orders')}
            </>
          )}
        </View>

        {/* Kontakte */}
        <View style={styles.accordionContainer}>
          {renderSectionHeader('kontakte', 'person-outline', 'Kontakte')}
          {expandedSections.kontakte && (
            <>
              {renderSubItem('people-outline', 'Kunden', '/customers')}
              {renderSubItem('person-outline', 'Mitarbeiter', '/crew-members')}
            </>
          )}
        </View>

        {/* Fahrzeuge */}
        <View style={styles.accordionContainer}>
          {renderSectionHeader('fahrzeuge', 'car-outline', 'Fahrzeuge')}
          {expandedSections.fahrzeuge && (
            <>
              {renderSubItem('car-outline', 'Fahrzeuge', '/vehicles')}
            </>
          )}
        </View>

        {/* Aufgaben */}
        <View style={styles.accordionContainer}>
          {renderSectionHeader('aufgaben', 'checkbox-outline', 'Aufgaben')}
          {expandedSections.aufgaben && (
            <>
              {renderSubItem('list-outline', 'Aufgaben', '/tasks')}
            </>
          )}
        </View>

        {/* Werkstatt */}
        <View style={styles.accordionContainer}>
          {renderSectionHeader('werkstatt', 'construct-outline', 'Werkstatt', stats?.open_repairs || stats?.maintenance_due || 0, '#FF9500')}
          {expandedSections.werkstatt && (
            <>
              {renderSubItem('build-outline', 'Reparaturen', '/maintenance')}
              {renderSubItem('shield-checkmark-outline', 'Prüfungen', '/inspections')}
              {renderSubItem('alert-circle-outline', 'Zu prüfende Materialien', '/inspection-due')}
              {renderSubItem('search-outline', 'Verlorene Materialien', '/lost-items')}
              {renderSubItem('calculator-outline', 'Bestandszählungen', '/stock-counts')}
            </>
          )}
        </View>

        {/* Statistik */}
        <View style={styles.accordionContainer}>
          {renderSectionHeader('statistik', 'bar-chart-outline', 'Statistik')}
          {expandedSections.statistik && (
            <>
              {renderSubItem('stats-chart-outline', 'Berichte', '/reports')}
              {renderSubItem('download-outline', 'Exporte & PDF', '/exports')}
            </>
          )}
        </View>

        {/* Kommunikation */}
        <View style={styles.accordionContainer}>
          {renderSectionHeader('kommunikation', 'mail-outline', 'Kommunikation')}
          {expandedSections.kommunikation && (
            <>
              {renderSubItem('chatbubbles-outline', 'Kommunikations-Log', '/communication-log')}
              {renderSubItem('send-outline', 'Gesendete E-Mails', '/sent-emails')}
              {renderSubItem('mail-unread-outline', 'Erhaltene Notizen', '/received-notes')}
            </>
          )}
        </View>

      </ScrollView>

      {/* Widget Customization Modal */}
      <Modal visible={widgetCustomizeVisible} animationType="slide" transparent onRequestClose={() => setWidgetCustomizeVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>Widgets anpassen</Text>
              <TouchableOpacity onPress={() => setWidgetCustomizeVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {([
              { key: 'financial', label: 'Finanz-Übersicht' },
              { key: 'rechnungen', label: 'Überfällige Rückgaben' },
              { key: 'reparaturen', label: 'Offene Reparaturen' },
              { key: 'packlisten', label: 'Packlisten bereit' },
              { key: 'engpaesse', label: 'Material-Engpässe' },
              { key: 'konflikte', label: 'Buchungskonflikte' },
              { key: 'artikel', label: 'Artikel im Lager' },
              { key: 'events', label: 'Aktive Events' },
            ] as { key: keyof typeof visibleWidgets; label: string }[]).map(item => (
              <View key={item.key} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
                <Text style={{ color: colors.text, fontSize: 15 }}>{item.label}</Text>
                <TouchableOpacity
                  onPress={() => toggleWidget(item.key)}
                  style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: visibleWidgets[item.key] ? colors.primary : colors.border, justifyContent: 'center', paddingHorizontal: 2 }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'white', alignSelf: visibleWidgets[item.key] ? 'flex-end' : 'flex-start' }} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      </Modal>

      {/* Notification Modal */}
      <Modal visible={notifModalVisible} animationType="slide" transparent onRequestClose={() => setNotifModalVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>Benachrichtigungen</Text>
              <TouchableOpacity onPress={() => setNotifModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {notifications.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="checkmark-circle-outline" size={48} color="#34C759" />
                <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 16 }}>Keine Benachrichtigungen</Text>
              </View>
            ) : (
              <ScrollView>
                {notifications.map((n, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border, gap: 12 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: n.type === 'task' ? '#FF950020' : '#FF3B3020', justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name={n.type === 'task' ? 'checkbox-outline' : 'shield-checkmark-outline'} size={18} color={n.type === 'task' ? '#FF9500' : '#FF3B30'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{n.title}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{n.body}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Session Warning Modal */}
      <Modal visible={sessionWarningVisible} animationType="fade" transparent onRequestClose={() => setSessionWarningVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 24 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 24, width: '100%', maxWidth: 340 }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FF950020', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="time-outline" size={28} color="#FF9500" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, textAlign: 'center' }}>Sitzung läuft ab</Text>
              <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 8, fontSize: 14 }}>
                Ihre Sitzung läuft in 2 Minuten ab. Möchten Sie angemeldet bleiben?
              </Text>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 10 }}
              onPress={async () => {
                setSessionWarningVisible(false);
                // Token erneuern
                try {
                  const token = await getToken();
                  if (token) startSessionTimer();
                  else handleLogout(); // Token gone — force logout
                } catch (error) {
                  if (__DEV__) console.warn('[Session] Failed to renew session timer:', error);
                  handleLogout();
                }
              }}
            >
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Angemeldet bleiben</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
              onPress={() => { setSessionWarningVisible(false); handleLogout(); }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Abmelden</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom || 16 }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/')}>
          <Ionicons name="home" size={24} color={colors.primary} />
          <Text style={[styles.navLabel, { color: colors.primary }]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/packing-list')}>
          <Ionicons name="clipboard-outline" size={24} color={colors.textSecondary} />
          <Text style={styles.navLabel}>Packlisten</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.scannerButton} onPress={() => router.push('/scanner')}>
          <View style={styles.scannerButtonInner}>
            <Ionicons name="scan" size={28} color="white" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/events')}>
          <Ionicons name="calendar-outline" size={24} color={colors.textSecondary} />
          <Text style={styles.navLabel}>Events</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setSearchVisible(true)}>
          <Ionicons name="search-outline" size={24} color={colors.textSecondary} />
          <Text style={styles.navLabel}>Suche</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
