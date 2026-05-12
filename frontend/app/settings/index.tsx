import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch,
  Alert,
  TextInput,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useTheme } from '../../contexts/ThemeContext';
import apiService, { setBackendUrl, getBackendUrl, getToken } from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  isBiometricAvailable,
  isBiometricEnabled,
  setBiometricEnabled,
  getBiometricType,
} from '../../services/biometricService';

// ─── Types ───────────────────────────────────────────────────────────────────

interface NameFactorItem { name: string; factor: string; }
interface NameRateItem { name: string; rate_per_hour: string; }
interface NameDiscountItem { name: string; discount_percent: string; }
interface TaxClassItem { name: string; rate: string; }
interface LedgerItem { name: string; account_number: string; }
interface ImportantDateItem { name: string; date: string; }

interface CurrentUser {
  id: string;
  username: string;
  email?: string;
  role?: string;
  profile_image?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme, setFunctionalColors: setThemeFunctionalColors } = useTheme();

  // Current user
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Toggle state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  // Biometrics
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricType, setBiometricTypeState] = useState('Biometrie');

  // 2FA / TOTP
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpSetupVisible, setTotpSetupVisible] = useState(false);
  const [totpQrCode, setTotpQrCode] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpDisableCode, setTotpDisableCode] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);

  // Server URL section
  const [serverUrl, setServerUrlState] = useState('');
  const [serverUrlSaving, setServerUrlSaving] = useState(false);
  const [serverUrlSaved, setServerUrlSaved] = useState(false);
  const [serverUrlTesting, setServerUrlTesting] = useState(false);

  // Collapsible groups - all collapsed by default for cleaner UI
  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({
    account: false,
    einstellungen: false,
    kommunikation: false,
    finanzen: false,
    sicherheit: false,
    server: false,
    info: false,
  });

  // App settings from backend
  const [appSettings, setAppSettings] = useState<any>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // ── Version History ─────────────────────────────────────────────────────────
  const [showVersions, setShowVersions] = useState(false);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);

  // ── Branding (Admin only) ───────────────────────────────────────────────────
  const [showBranding, setShowBranding] = useState(false);
  const [branding, setBranding] = useState({
    app_display_name: 'Inventar Pro',
    app_logo_icon: 'cube',
    app_primary_color: '#488fe0',
    app_slogan: 'Professionelle Lagerverwaltung',
  });

  // 15 Page4-style Color Palettes (6 colors each)
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [selectedPaletteIndex, setSelectedPaletteIndex] = useState(0);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [functionalColors, setFunctionalColorsLocal] = useState({
    primary: '#488fe0',     // Hauptfarbe - CTAs, aktive Elemente
    secondary: '#97bde8',   // Akzentfarbe - Sekundäre Buttons, Filter
    success: '#34C759',     // Erfolg - Bestätigungen
    warning: '#FF9500',     // Warnung - Achtung-Hinweise
    danger: '#FF3B30',      // Fehler/Gefahr - Fehlermeldungen
    neutral: '#404040',     // Neutral - Text, Rahmen
  });

  // Custom color input states
  const [customColors, setCustomColors] = useState({
    primary: '#488fe0',
    secondary: '#97bde8',
    success: '#34C759',
    warning: '#FF9500',
    danger: '#FF3B30',
    neutral: '#404040',
  });

  // 15 Farbpaletten im Page4-Stil (jede mit 6 Farben)
  const colorPalettes = [
    { name: 'Klassisch Blau', colors: { primary: '#488fe0', secondary: '#97bde8', success: '#34C759', warning: '#FF9500', danger: '#FF3B30', neutral: '#404040' } },
    { name: 'Ocean', colors: { primary: '#0077B6', secondary: '#90E0EF', success: '#2A9D8F', warning: '#E9C46A', danger: '#E76F51', neutral: '#264653' } },
    { name: 'Forest', colors: { primary: '#2D6A4F', secondary: '#95D5B2', success: '#40916C', warning: '#B7E4C7', danger: '#1B4332', neutral: '#081C15' } },
    { name: 'Sunset', colors: { primary: '#E85D04', secondary: '#FFBA08', success: '#9D4EDD', warning: '#F48C06', danger: '#DC2F02', neutral: '#1A1A2E' } },
    { name: 'Lavender', colors: { primary: '#7B2CBF', secondary: '#C77DFF', success: '#57CC99', warning: '#FFD93D', danger: '#FF6B6B', neutral: '#240046' } },
    { name: 'Modern Gray', colors: { primary: '#4A5568', secondary: '#A0AEC0', success: '#48BB78', warning: '#ED8936', danger: '#F56565', neutral: '#1A202C' } },
    { name: 'Coral', colors: { primary: '#FF6B6B', secondary: '#FFA5A5', success: '#4ECDC4', warning: '#FFE66D', danger: '#C44569', neutral: '#2C2C54' } },
    { name: 'Emerald', colors: { primary: '#10B981', secondary: '#6EE7B7', success: '#059669', warning: '#F59E0B', danger: '#EF4444', neutral: '#064E3B' } },
    { name: 'Royal', colors: { primary: '#3B82F6', secondary: '#93C5FD', success: '#22C55E', warning: '#F97316', danger: '#EF4444', neutral: '#1E3A8A' } },
    { name: 'Warm Earth', colors: { primary: '#B45309', secondary: '#FCD34D', success: '#047857', warning: '#D97706', danger: '#B91C1C', neutral: '#78350F' } },
    { name: 'Cool Mint', colors: { primary: '#14B8A6', secondary: '#5EEAD4', success: '#22C55E', warning: '#FBBF24', danger: '#EF4444', neutral: '#134E4A' } },
    { name: 'Berry', colors: { primary: '#DB2777', secondary: '#F9A8D4', success: '#10B981', warning: '#F59E0B', danger: '#DC2626', neutral: '#831843' } },
    { name: 'Navy', colors: { primary: '#1E40AF', secondary: '#60A5FA', success: '#059669', warning: '#D97706', danger: '#B91C1C', neutral: '#0F172A' } },
    { name: 'Autumn', colors: { primary: '#C2410C', secondary: '#FB923C', success: '#65A30D', warning: '#FACC15', danger: '#B91C1C', neutral: '#451A03' } },
    { name: 'Minimal', colors: { primary: '#18181B', secondary: '#71717A', success: '#22C55E', warning: '#F59E0B', danger: '#EF4444', neutral: '#FAFAFA' } },
  ];

  const functionalColorLabels = {
    primary: { name: 'Primary', german: 'Hauptfarbe', description: 'CTAs, aktive Elemente, Navigation' },
    secondary: { name: 'Secondary', german: 'Akzentfarbe', description: 'Sekundäre Buttons, Filter, Highlights' },
    success: { name: 'Success', german: 'Erfolg', description: 'Bestätigungen, positive Aktionen' },
    warning: { name: 'Warning', german: 'Warnung', description: 'Achtung-Hinweise, wichtige Benachrichtigungen' },
    danger: { name: 'Danger', german: 'Gefahr', description: 'Fehlermeldungen, Löschen-Buttons' },
    neutral: { name: 'Neutral', german: 'Neutral', description: 'Hintergründe, Text, Rahmen' },
  };

  const applyPalette = (index: number) => {
    const palette = colorPalettes[index];
    setFunctionalColorsLocal(palette.colors);
    setSelectedPaletteIndex(index);
  };

  // ── Account ─────────────────────────────────────────────────────────────────
  const [showFirmendaten, setShowFirmendaten] = useState(false);
  const [firmendaten, setFirmendaten] = useState({
    company_name: '',
    company_logo: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    company_website: '',
  });

  // ── Einstellungen ───────────────────────────────────────────────────────────
  const [showNummernkreise, setShowNummernkreise] = useState(false);
  const [nummernkreise, setNummernkreise] = useState({
    invoice_prefix: 'INV',
    quote_prefix: 'QUO',
    event_prefix: 'EVT',
    customer_prefix: 'CUST',
  });

  const [showZeitOrt, setShowZeitOrt] = useState(false);
  const [timezone, setTimezone] = useState('Europe/Berlin');
  const [dateFormat, setDateFormat] = useState('DD.MM.YYYY');

  const [showWichtigeTage, setShowWichtigeTage] = useState(false);
  const [importantDates, setImportantDates] = useState<ImportantDateItem[]>([]);
  const [newImportantDateName, setNewImportantDateName] = useState('');
  const [newImportantDateDate, setNewImportantDateDate] = useState('');
  const [showAddImportantDate, setShowAddImportantDate] = useState(false);

  const [showProjekttypen, setShowProjekttypen] = useState(false);
  const [projekttypen, setProjekttypen] = useState<string[]>(['Konzert', 'Messe', 'Konferenz', 'Privat']);
  const [newProjekttyp, setNewProjekttyp] = useState('');
  const [showAddProjekttyp, setShowAddProjekttyp] = useState(false);

  const [showStundenerfassung, setShowStundenerfassung] = useState(false);
  const [overtimeTracking, setOvertimeTracking] = useState(false);
  const [absenceApprovalRequired, setAbsenceApprovalRequired] = useState(false);

  // ── Kommunikation ───────────────────────────────────────────────────────────
  const [showEmail, setShowEmail] = useState(false);
  const [smtpServer, setSmtpServer] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSender, setSmtpSender] = useState('');

  const [showAnrede, setShowAnrede] = useState(false);
  const [defaultSalutation, setDefaultSalutation] = useState('Sehr geehrte/r');

  const [showBriefpapier, setShowBriefpapier] = useState(false);
  const [letterheadLogoUrl, setLetterheadLogoUrl] = useState('');
  const [letterheadPrimaryColor, setLetterheadPrimaryColor] = useState('#FF9500');
  const [letterheadSlogan, setLetterheadSlogan] = useState('');
  const [letterheadFooterText, setLetterheadFooterText] = useState('');

  const [showOnlineAngebote, setShowOnlineAngebote] = useState(false);
  const [onlineQuotesEnabled, setOnlineQuotesEnabled] = useState(true);
  const [onlineQuotesExpiryDays, setOnlineQuotesExpiryDays] = useState('30');

  // ── Finanzen ────────────────────────────────────────────────────────────────
  const [showMwst, setShowMwst] = useState(false);
  const [taxRate, setTaxRate] = useState('19');

  const [showFaktorgruppen, setShowFaktorgruppen] = useState(false);
  const [faktorgruppen, setFaktorgruppen] = useState<NameFactorItem[]>([{ name: 'Standard', factor: '1.0' }]);
  const [newFaktorName, setNewFaktorName] = useState('');
  const [newFaktorValue, setNewFaktorValue] = useState('');
  const [showAddFaktor, setShowAddFaktor] = useState(false);

  const [showMitarbeitertarife, setShowMitarbeitertarife] = useState(false);
  const [mitarbeitertarife, setMitarbeitertarife] = useState<NameRateItem[]>([{ name: 'Techniker', rate_per_hour: '25.0' }]);
  const [newTarifName, setNewTarifName] = useState('');
  const [newTarifRate, setNewTarifRate] = useState('');
  const [showAddTarif, setShowAddTarif] = useState(false);

  const [showRabattgruppen, setShowRabattgruppen] = useState(false);
  const [rabattgruppen, setRabattgruppen] = useState<NameDiscountItem[]>([{ name: 'Stammkunde', discount_percent: '10' }]);
  const [newRabattName, setNewRabattName] = useState('');
  const [newRabattValue, setNewRabattValue] = useState('');
  const [showAddRabatt, setShowAddRabatt] = useState(false);

  const [showRechnungszeitpunkte, setShowRechnungszeitpunkte] = useState(false);
  const [invoiceTiming, setInvoiceTiming] = useState('Bei Buchung');

  const [showMwstKlassen, setShowMwstKlassen] = useState(false);
  const [taxClasses, setTaxClasses] = useState<TaxClassItem[]>([
    { name: 'Standard', rate: '19' },
    { name: 'Ermäßigt', rate: '7' },
    { name: 'Keine', rate: '0' },
  ]);
  const [newTaxClassName, setNewTaxClassName] = useState('');
  const [newTaxClassRate, setNewTaxClassRate] = useState('');
  const [showAddTaxClass, setShowAddTaxClass] = useState(false);

  const [showHauptbücher, setShowHauptbücher] = useState(false);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerItem[]>([]);
  const [newLedgerName, setNewLedgerName] = useState('');
  const [newLedgerNumber, setNewLedgerNumber] = useState('');
  const [showAddLedger, setShowAddLedger] = useState(false);

  const [showZusaetzlicheBedingungen, setShowZusaetzlicheBedingungen] = useState(false);
  const [additionalTerms, setAdditionalTerms] = useState('');

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadSettings();
    loadAppSettings();
    loadVersionHistory();
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const user = await apiService.get<CurrentUser>('/api/users/me', { showErrorAlert: false });
      setCurrentUser(user);
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const notif = await AsyncStorage.getItem('notifications_enabled');
      const sync = await AsyncStorage.getItem('auto_sync_enabled');
      setNotificationsEnabled(notif !== 'false');
      setAutoSyncEnabled(sync !== 'false');
      const savedServerUrl = await AsyncStorage.getItem('server_url');
      if (savedServerUrl) setServerUrlState(savedServerUrl);

      // Biometrics
      const avail = await isBiometricAvailable();
      setBiometricAvailable(avail);
      if (avail) {
        setBiometricEnabledState(await isBiometricEnabled());
        setBiometricTypeState(await getBiometricType());
      }

      // TOTP status
      try {
        const status = await apiService.get<any>('/api/users/totp/status', { showErrorAlert: false });
        setTotpEnabled(status?.totp_enabled ?? false);
      } catch {}
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadAppSettings = async () => {
    try {
      const s = await apiService.get<any>('/api/settings/app', { showErrorAlert: false });
      setAppSettings(s);

      // Firmendaten
      setFirmendaten({
        company_name: s.company_name || '',
        company_logo: s.company_logo || '',
        company_address: s.company_address || '',
        company_phone: s.company_phone || '',
        company_email: s.company_email || '',
        company_website: s.company_website || '',
      });

      // Branding
      setBranding({
        app_display_name: s.app_display_name || 'Inventar Pro',
        app_logo_icon: s.app_logo_icon || 'cube',
        app_primary_color: s.app_primary_color || '#488fe0',
        app_slogan: s.app_slogan || 'Professionelle Lagerverwaltung',
      });

      // Functional Colors
      const loadedColors = {
        primary: s.color_primary || '#488fe0',
        secondary: s.color_secondary || '#97bde8',
        success: s.color_success || '#34C759',
        warning: s.color_warning || '#FF9500',
        danger: s.color_danger || '#FF3B30',
        neutral: s.color_neutral || '#404040',
      };
      setFunctionalColorsLocal(loadedColors);
      setCustomColors(loadedColors);

      // Find matching palette index
      const paletteIndex = colorPalettes.findIndex(p =>
        p.colors.primary === loadedColors.primary &&
        p.colors.secondary === loadedColors.secondary &&
        p.colors.success === loadedColors.success
      );
      setSelectedPaletteIndex(paletteIndex >= 0 ? paletteIndex : -1);

      // Nummernkreise
      setNummernkreise({
        invoice_prefix: s.invoice_prefix || 'INV',
        quote_prefix: s.quote_prefix || 'QUO',
        event_prefix: s.event_prefix || 'EVT',
        customer_prefix: s.customer_prefix || 'CUST',
      });

      // Tax
      setTaxRate(String(s.tax_rate ?? 19));

      // Zeit und Ort
      setTimezone(s.timezone || 'Europe/Berlin');
      setDateFormat(s.date_format || 'DD.MM.YYYY');

      // Wichtige Tage
      if (s.important_dates) setImportantDates(s.important_dates.map((d: any) => ({ name: d.name, date: d.date })));

      // Projekttypen
      if (s.project_types && s.project_types.length > 0) setProjekttypen(s.project_types);

      // Stundenerfassung
      setOvertimeTracking(!!s.overtime_tracking);
      setAbsenceApprovalRequired(!!s.absence_approval_required);

      // SMTP
      setSmtpServer(s.smtp_server || '');
      setSmtpPort(String(s.smtp_port || 587));
      setSmtpSender(s.smtp_sender || '');

      // Anrede
      setDefaultSalutation(s.default_salutation || 'Sehr geehrte/r');

      // Briefpapier
      setLetterheadLogoUrl(s.letterhead_logo_url || '');
      setLetterheadPrimaryColor(s.letterhead_primary_color || '#FF9500');
      setLetterheadSlogan(s.letterhead_slogan || '');
      setLetterheadFooterText(s.letterhead_footer_text || '');

      // Online-Angebote
      setOnlineQuotesEnabled(s.online_quotes_enabled !== false);
      setOnlineQuotesExpiryDays(String(s.online_quotes_expiry_days ?? 30));

      // Faktorgruppen
      if (s.factor_groups && s.factor_groups.length > 0)
        setFaktorgruppen(s.factor_groups.map((g: any) => ({ name: g.name, factor: String(g.factor) })));

      // Mitarbeitertarife
      if (s.staff_rates && s.staff_rates.length > 0)
        setMitarbeitertarife(s.staff_rates.map((r: any) => ({ name: r.name, rate_per_hour: String(r.rate_per_hour) })));

      // Rabattgruppen
      if (s.discount_groups && s.discount_groups.length > 0)
        setRabattgruppen(s.discount_groups.map((g: any) => ({ name: g.name, discount_percent: String(g.discount_percent) })));

      // Rechnungszeitpunkte
      setInvoiceTiming(s.invoice_timing || 'Bei Buchung');

      // MwSt-Klassen
      if (s.tax_classes && s.tax_classes.length > 0)
        setTaxClasses(s.tax_classes.map((c: any) => ({ name: c.name, rate: String(c.rate) })));

      // Hauptbücher
      if (s.ledger_accounts && s.ledger_accounts.length > 0)
        setLedgerAccounts(s.ledger_accounts.map((l: any) => ({ name: l.name, account_number: l.account_number })));

      // Zusätzliche Bedingungen
      setAdditionalTerms(s.additional_terms || '');
    } catch (e) { /* use defaults */ }
  };

  const saveSettings = async (partial: object) => {
    setSavingSettings(true);
    try {
      const merged = { ...(appSettings || {}), ...partial };
      await apiService.put('/api/settings/app', merged);
      setAppSettings(merged);
      Alert.alert('Gespeichert', 'Einstellungen wurden gespeichert');
    } catch {
      Alert.alert('Fehler', 'Speichern fehlgeschlagen');
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleNotifications = async (value: boolean) => {
    try {
      await AsyncStorage.setItem('notifications_enabled', value.toString());
      setNotificationsEnabled(value);
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  };

  const toggleAutoSync = async (value: boolean) => {
    try {
      await AsyncStorage.setItem('auto_sync_enabled', value.toString());
      setAutoSyncEnabled(value);
    } catch (error) {
      console.error('Error saving sync settings:', error);
    }
  };

  const saveServerUrl = async () => {
    const url = serverUrl.trim().replace(/\/$/, '');
    if (!url) return;
    setServerUrlSaving(true);
    try {
      await AsyncStorage.setItem('server_url', url);
      setBackendUrl(url);
      // Electron: also save to electron settings
      if (typeof window !== 'undefined' && (window as any).__electronBridge) {
        await (window as any).__electronBridge.saveSettings({ serverUrl: url });
      }
      setServerUrlSaved(true);
      setTimeout(() => setServerUrlSaved(false), 2000);
      Alert.alert('Gespeichert', 'Server-URL wurde gespeichert. Bitte starte die App neu.');
    } catch (e) {
      Alert.alert('Fehler', 'Server-URL konnte nicht gespeichert werden.');
    } finally {
      setServerUrlSaving(false);
    }
  };

  const toggleBiometric = async (value: boolean) => {
    await setBiometricEnabled(value);
    setBiometricEnabledState(value);
  };

  const startTotpSetup = async () => {
    setTotpLoading(true);
    try {
      const data = await apiService.post<any>('/api/users/totp/setup');
      setTotpQrCode(data.qr_code);
      setTotpSecret(data.secret);
      setTotpCode('');
      setTotpSetupVisible(true);
    } catch {
      Alert.alert('Fehler', '2FA-Setup konnte nicht gestartet werden.');
    } finally {
      setTotpLoading(false);
    }
  };

  const confirmTotpSetup = async () => {
    if (totpCode.length !== 6) { Alert.alert('Fehler', 'Bitte 6-stelligen Code eingeben.'); return; }
    setTotpLoading(true);
    try {
      await apiService.post('/api/users/totp/confirm', { code: totpCode });
      setTotpEnabled(true);
      setTotpSetupVisible(false);
      Alert.alert('Aktiviert', '2-Faktor-Authentifizierung ist jetzt aktiv.');
    } catch {
      Alert.alert('Fehler', 'Ungültiger Code. Bitte erneut versuchen.');
    } finally {
      setTotpLoading(false);
    }
  };

  const disableTotp = async () => {
    Alert.prompt('2FA deaktivieren', 'Aktuellen 6-stelligen Code eingeben:', async (code) => {
      if (!code) return;
      try {
        await apiService.post('/api/users/totp/disable', { code });
        setTotpEnabled(false);
        Alert.alert('Deaktiviert', '2-Faktor-Authentifizierung wurde deaktiviert.');
      } catch {
        Alert.alert('Fehler', 'Ungültiger Code.');
      }
    }, 'plain-text', '', 'number-pad');
  };

  const testAndDetectUrl = async () => {
    setServerUrlTesting(true);
    const candidate = serverUrl.trim().replace(/\/$/, '') || getBackendUrl();
    try {
      const res = await fetch(`${candidate}/api/server-info`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        const detected = (data.url as string).replace(/\/$/, '');
        setServerUrlState(detected);
        await AsyncStorage.setItem('server_url', detected);
        setBackendUrl(detected);
        Alert.alert('Verbunden', `Server erreichbar.\nURL: ${detected}`);
      } else {
        Alert.alert('Fehler', `Server antwortet mit ${res.status}.`);
      }
    } catch {
      Alert.alert('Nicht erreichbar', `Kein Server gefunden unter:\n${candidate}\n\nPrüfe URL und ob der Tunnel läuft.`);
    } finally {
      setServerUrlTesting(false);
    }
  };

  // Load version history
  const loadVersionHistory = async () => {
    try {
      const versions = await apiService.get<any[]>('/api/settings/versions');
      setVersionHistory(versions || []);
    } catch (error) {
      console.error('Error loading version history:', error);
    }
  };

  // Restore a specific version
  const restoreVersion = async (version: number) => {
    Alert.alert(
      'Version wiederherstellen',
      `Möchten Sie die Einstellungen auf Version ${version} zurücksetzen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Wiederherstellen',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.post(`/api/settings/restore/${version}`, {});
              Alert.alert('Erfolg', 'Einstellungen wurden wiederhergestellt');
              loadSettings();
              loadVersionHistory();
            } catch (error) {
              Alert.alert('Fehler', 'Wiederherstellung fehlgeschlagen');
            }
          },
        },
      ]
    );
  };

  // ─── Helper renderers ────────────────────────────────────────────────────────

  const toggleGroup = (key: string) =>
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  const renderGroupHeader = (key: string, label: string, icon: string, description?: string) => (
    <TouchableOpacity
      style={[styles.groupHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
      onPress={() => toggleGroup(key)}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={[styles.groupIconBox, { backgroundColor: colors.primary + '18' }]}>
          <Ionicons name={icon as any} size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.groupHeaderText, { color: colors.text }]}>{label}</Text>
          {description && <Text style={[styles.groupDescription, { color: colors.textSecondary }]}>{description}</Text>}
        </View>
      </View>
      <Ionicons
        name={expandedGroups[key] ? 'chevron-up' : 'chevron-down'}
        size={18}
        color={colors.textSecondary}
      />
    </TouchableOpacity>
  );

  const renderNavItem = (icon: string, label: string, route: string, comingSoon?: boolean) => (
    <TouchableOpacity
      key={label}
      style={[styles.navItem, { borderBottomColor: colors.border }]}
      onPress={comingSoon
        ? () => Alert.alert('Demnächst', 'Dieses Feature kommt bald')
        : () => router.push(route as any)}
    >
      <Ionicons
        name={icon as any}
        size={20}
        color={comingSoon ? colors.border : colors.textSecondary}
        style={{ marginRight: 12 }}
      />
      <Text style={[styles.navItemLabel, { color: comingSoon ? colors.textSecondary : colors.text }]}>
        {label}
      </Text>
      {comingSoon ? (
        <View style={[styles.comingSoonBadge, { backgroundColor: colors.border }]}>
          <Text style={[styles.comingSoonText, { color: colors.textSecondary }]}>Demnächst</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.border} />
      )}
    </TouchableOpacity>
  );

  const renderSectionToggleRow = (
    icon: string,
    label: string,
    isOpen: boolean,
    onToggle: () => void,
    extra?: React.ReactNode,
  ) => (
    <TouchableOpacity
      style={[styles.navItem, { borderBottomColor: colors.border }]}
      onPress={onToggle}
    >
      <Ionicons name={icon as any} size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
      <Text style={[styles.navItemLabel, { color: colors.text }]}>{label}</Text>
      {extra}
      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.border} />
    </TouchableOpacity>
  );

  const renderSaveButton = (onPress: () => void) => (
    <TouchableOpacity
      style={[styles.saveButton, { backgroundColor: colors.primary }]}
      onPress={onPress}
      disabled={savingSettings}
    >
      {savingSettings
        ? <ActivityIndicator color="white" size="small" />
        : <Text style={styles.saveButtonText}>Speichern</Text>}
    </TouchableOpacity>
  );

  const renderChipSelector = (
    options: string[],
    selected: string,
    onSelect: (v: string) => void,
  ) => (
    <View style={styles.chipRow}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt}
          style={[
            styles.chip,
            {
              backgroundColor: selected === opt ? colors.primary : colors.background,
              borderColor: selected === opt ? colors.primary : colors.border,
            },
          ]}
          onPress={() => onSelect(opt)}
        >
          <Text style={{ color: selected === opt ? '#fff' : colors.text, fontSize: 13 }}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderReadOnlyChips = (items: string[]) => (
    <View style={styles.chipRow}>
      {items.map(item => (
        <View
          key={item}
          style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }]}
        >
          <Text style={{ color: colors.text, fontSize: 13 }}>{item}</Text>
        </View>
      ))}
    </View>
  );

  const renderRemovableChips = (items: string[], onRemove: (i: number) => void) => (
    <View style={styles.chipRow}>
      {items.map((item, idx) => (
        <View
          key={idx}
          style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 4 }]}
        >
          <Text style={{ color: colors.text, fontSize: 13 }}>{item}</Text>
          <TouchableOpacity onPress={() => onRemove(idx)}>
            <Ionicons name="close-circle" size={15} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: colors.background },
      ]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Einstellungen</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* User & Company Profile Card */}
      <View style={[styles.profileCard, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {/* Company Logo */}
        {firmendaten.company_logo ? (
          <Image source={{ uri: firmendaten.company_logo }} style={styles.companyLogo} />
        ) : (
          <View style={[styles.companyLogoPlaceholder, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="business" size={24} color={colors.primary} />
          </View>
        )}
        {/* Company & User Info */}
        <View style={styles.profileInfo}>
          <Text style={[styles.companyName, { color: colors.text }]}>
            {firmendaten.company_name || 'Firmenname'}
          </Text>
          <Text style={[styles.userName, { color: colors.textSecondary }]}>
            {currentUser?.username || 'Benutzer'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>

        {/* ===================================================================
            ACCOUNT
        =================================================================== */}
        {renderGroupHeader('account', 'Account', 'person-circle-outline', 'Firmendaten, Branding, Verwaltung')}
        {expandedGroups.account && (
          <View style={[styles.groupContent, { backgroundColor: colors.card }]}>

            {/* === Firma === */}
            <Text style={[styles.subSectionTitle, { color: colors.primary }]}>Firma</Text>
            {renderSectionToggleRow('business-outline', 'Firmendaten', showFirmendaten, () => setShowFirmendaten(!showFirmendaten))}
            {showFirmendaten && (
              <View style={[styles.inlineForm, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                {/* Firmenlogo */}
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Firmenlogo</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                  <TouchableOpacity
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      backgroundColor: colors.primary + '15',
                      borderWidth: 2,
                      borderColor: colors.primary + '40',
                      borderStyle: 'dashed',
                      justifyContent: 'center',
                      alignItems: 'center',
                      overflow: 'hidden',
                    }}
                    onPress={async () => {
                      try {
                        const result = await new Promise<{ cancelled: boolean; assets?: { base64?: string; uri: string }[] }>((resolve) => {
                          // Dynamically import expo-image-picker
                          import('expo-image-picker').then(({ launchImageLibraryAsync, MediaTypeOptions, requestMediaLibraryPermissionsAsync }) => {
                            requestMediaLibraryPermissionsAsync().then(({ status }) => {
                              if (status !== 'granted') {
                                Alert.alert('Berechtigung benötigt', 'Bitte erlauben Sie den Zugriff auf die Bilddatenbank');
                                resolve({ cancelled: true });
                                return;
                              }
                              launchImageLibraryAsync({
                                mediaTypes: MediaTypeOptions.Images,
                                allowsEditing: true,
                                aspect: [1, 1],
                                quality: 0.8,
                                base64: true,
                              }).then(resolve);
                            });
                          });
                        });
                        if (!result.cancelled && result.assets?.[0]) {
                          const asset = result.assets[0];
                          const base64Data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
                          setFirmendaten(p => ({ ...p, company_logo: base64Data }));
                        }
                      } catch (error) {
                        console.error('Image picker error:', error);
                        Alert.alert('Fehler', 'Bild konnte nicht geladen werden');
                      }
                    }}
                  >
                    {firmendaten.company_logo ? (
                      <Image source={{ uri: firmendaten.company_logo }} style={{ width: 76, height: 76, borderRadius: 38 }} />
                    ) : (
                      <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="business" size={32} color={colors.primary} />
                        <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 4 }}>Logo</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Rundes Firmenlogo</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Wird auf der Login-Seite angezeigt</Text>
                    {firmendaten.company_logo ? (
                      <TouchableOpacity
                        onPress={() => setFirmendaten(p => ({ ...p, company_logo: '' }))}
                        style={{ marginTop: 8 }}
                      >
                        <Text style={{ color: '#FF3B30', fontSize: 12 }}>Logo entfernen</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>

                {/* Textfelder */}
                {([
                  { key: 'company_name', label: 'Firmenname', keyboard: 'default' },
                  { key: 'company_address', label: 'Adresse', keyboard: 'default' },
                  { key: 'company_phone', label: 'Telefon', keyboard: 'phone-pad' },
                  { key: 'company_email', label: 'E-Mail', keyboard: 'email-address' },
                  { key: 'company_website', label: 'Website', keyboard: 'default' },
                ] as { key: keyof typeof firmendaten; label: string; keyboard: any }[]).map(({ key, label, keyboard }) => (
                  <TextInput
                    key={key}
                    style={[styles.formInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                    placeholder={label}
                    placeholderTextColor={colors.textSecondary}
                    keyboardType={keyboard}
                    autoCapitalize="none"
                    value={firmendaten[key]}
                    onChangeText={v => setFirmendaten(p => ({ ...p, [key]: v }))}
                  />
                ))}
                {renderSaveButton(() => saveSettings(firmendaten))}
              </View>
            )}

            {/* === Branding === */}
            <Text style={[styles.subSectionTitle, { color: colors.primary, marginTop: 16 }]}>Branding</Text>
            {renderSectionToggleRow('color-palette-outline', 'App-Branding', showBranding, () => setShowBranding(!showBranding))}
            {showBranding && (
              <View style={[styles.inlineForm, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>App-Name</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  placeholder="Inventar Pro"
                  placeholderTextColor={colors.textSecondary}
                  value={branding.app_display_name}
                  onChangeText={v => setBranding(p => ({ ...p, app_display_name: v }))}
                />
                <Text style={[styles.formLabel, { color: colors.textSecondary, marginTop: 12 }]}>Logo-Icon (Ionicons Name)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, flex: 1 }]}
                    placeholder="cube"
                    placeholderTextColor={colors.textSecondary}
                    value={branding.app_logo_icon}
                    onChangeText={v => setBranding(p => ({ ...p, app_logo_icon: v }))}
                  />
                  <View style={[styles.iconPreview, { backgroundColor: colors.primary + '20', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name={branding.app_logo_icon as any} size={24} color={colors.primary} />
                  </View>
                </View>
                <Text style={[styles.formLabel, { color: colors.textSecondary, marginTop: 12 }]}>Slogan</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  placeholder="Professionelle Lagerverwaltung"
                  placeholderTextColor={colors.textSecondary}
                  value={branding.app_slogan}
                  onChangeText={v => setBranding(p => ({ ...p, app_slogan: v }))}
                />

                {/* Farbpalette - 15 Paletten + Benutzerdefiniert */}
                <TouchableOpacity
                  style={[styles.navItem, { borderBottomColor: colors.border }]}
                  onPress={() => setShowColorPalette(!showColorPalette)}
                >
                  <Ionicons name="color-palette-outline" size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.navItemLabel, { color: colors.text }]}>Farbpalette</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>15 Vorlagen + Benutzerdefiniert</Text>
                  </View>
                  <Ionicons name={showColorPalette ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.border} />
                </TouchableOpacity>

                {showColorPalette && (
                  <View style={[styles.inlineForm, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                    {/* 15 Farbpaletten zur Auswahl */}
                    <Text style={[styles.formLabel, { color: colors.textSecondary, marginBottom: 12 }]}>Farbpaletten</Text>

                    {colorPalettes.map((palette, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.paletteRow,
                          { borderColor: selectedPaletteIndex === index && !showCustomPicker ? colors.primary : colors.border, backgroundColor: colors.card }
                        ]}
                        onPress={() => {
                          setShowCustomPicker(false);
                          applyPalette(index);
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.paletteName, { color: colors.text }]}>{palette.name}</Text>
                          <View style={styles.colorSwatchRow}>
                            <View style={[styles.colorSwatch, { backgroundColor: palette.colors.primary }]} />
                            <View style={[styles.colorSwatch, { backgroundColor: palette.colors.secondary }]} />
                            <View style={[styles.colorSwatch, { backgroundColor: palette.colors.success }]} />
                            <View style={[styles.colorSwatch, { backgroundColor: palette.colors.warning }]} />
                            <View style={[styles.colorSwatch, { backgroundColor: palette.colors.danger }]} />
                            <View style={[styles.colorSwatch, { backgroundColor: palette.colors.neutral }]} />
                          </View>
                        </View>
                        {selectedPaletteIndex === index && !showCustomPicker && (
                          <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))}

                    {/* Benutzerdefinierte Farbpalette */}
                    <Text style={[styles.formLabel, { color: colors.textSecondary, marginTop: 20, marginBottom: 12 }]}>Benutzerdefiniert</Text>
                    <TouchableOpacity
                      style={[
                        styles.paletteRow,
                        { borderColor: showCustomPicker ? colors.primary : colors.border, backgroundColor: colors.card }
                      ]}
                      onPress={() => setShowCustomPicker(!showCustomPicker)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.paletteName, { color: colors.text }]}>Eigene Farben</Text>
                        <View style={styles.colorSwatchRow}>
                          <View style={[styles.colorSwatch, { backgroundColor: customColors.primary }]} />
                          <View style={[styles.colorSwatch, { backgroundColor: customColors.secondary }]} />
                          <View style={[styles.colorSwatch, { backgroundColor: customColors.success }]} />
                          <View style={[styles.colorSwatch, { backgroundColor: customColors.warning }]} />
                          <View style={[styles.colorSwatch, { backgroundColor: customColors.danger }]} />
                          <View style={[styles.colorSwatch, { backgroundColor: customColors.neutral }]} />
                        </View>
                      </View>
                      <Ionicons name={showCustomPicker ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
                    </TouchableOpacity>

                    {/* Custom Color Picker */}
                    {showCustomPicker && (
                      <View style={{ marginTop: 12, gap: 12 }}>
                        {(['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const).map((colorKey) => (
                          <View key={colorKey} style={styles.customColorRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.formLabel, { color: colors.text, marginBottom: 4 }]}>
                                {functionalColorLabels[colorKey].german}
                              </Text>
                              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                                {functionalColorLabels[colorKey].description}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <View style={[styles.colorPreviewLarge, { backgroundColor: customColors[colorKey] }]} />
                              <TextInput
                                style={[styles.hexInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                                placeholder="#000000"
                                placeholderTextColor={colors.textSecondary}
                                value={customColors[colorKey]}
                                onChangeText={(v) => setCustomColors(p => ({ ...p, [colorKey]: v }))}
                                maxLength={7}
                              />
                            </View>
                          </View>
                        ))}
                        <TouchableOpacity
                          style={[styles.saveButton, { backgroundColor: colors.primary }]}
                          onPress={() => {
                            setFunctionalColorsLocal(customColors);
                            setShowCustomPicker(false);
                            setSelectedPaletteIndex(-1);
                          }}
                        >
                          <Text style={styles.saveButtonText}>Farben übernehmen</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Farbvorschau der aktiven Palette */}
                    <View style={[styles.activePalettePreview, { borderColor: colors.border, marginTop: 20 }]}>
                      <Text style={[styles.formLabel, { color: colors.textSecondary, marginBottom: 8 }]}>Aktive Palette - Vorschau</Text>
                      <View style={styles.colorSwatchRowLarge}>
                        <View style={[styles.colorSwatchLarge, { backgroundColor: functionalColors.primary }]}>
                          <Text style={styles.colorSwatchLabel}>Primary</Text>
                        </View>
                        <View style={[styles.colorSwatchLarge, { backgroundColor: functionalColors.secondary }]}>
                          <Text style={styles.colorSwatchLabel}>Secondary</Text>
                        </View>
                        <View style={[styles.colorSwatchLarge, { backgroundColor: functionalColors.success }]}>
                          <Text style={styles.colorSwatchLabel}>Success</Text>
                        </View>
                        <View style={[styles.colorSwatchLarge, { backgroundColor: functionalColors.warning }]}>
                          <Text style={styles.colorSwatchLabel}>Warning</Text>
                        </View>
                        <View style={[styles.colorSwatchLarge, { backgroundColor: functionalColors.danger }]}>
                          <Text style={styles.colorSwatchLabel}>Danger</Text>
                        </View>
                        <View style={[styles.colorSwatchLarge, { backgroundColor: functionalColors.neutral }]}>
                          <Text style={styles.colorSwatchLabel}>Neutral</Text>
                        </View>
                      </View>
                    </View>

                    {/* Save Button */}
                    {renderSaveButton(async () => {
                      await saveSettings({
                        ...branding,
                        color_primary: functionalColors.primary,
                        color_secondary: functionalColors.secondary,
                        color_success: functionalColors.success,
                        color_warning: functionalColors.warning,
                        color_danger: functionalColors.danger,
                        color_neutral: functionalColors.neutral,
                      });
                      setThemeFunctionalColors(functionalColors);
                    })}
                  </View>
                )}
              </View>
            )}

            {/* === Verwaltung === */}
            <Text style={[styles.subSectionTitle, { color: colors.primary, marginTop: 16 }]}>Verwaltung</Text>
            {renderNavItem('people-outline', 'Benutzerrollen', '/admin/users')}
            {renderNavItem('shield-checkmark-outline', 'Sicherheit', '/security')}
            {renderNavItem('archive-outline', 'Backups', '/admin/backup')}
            {renderNavItem('server-outline', 'Datenbank', '/admin/database')}
            {renderNavItem('extension-puzzle-outline', 'Integrationen', '/integrations')}

            {/* === System === */}
            <Text style={[styles.subSectionTitle, { color: colors.primary, marginTop: 16 }]}>System</Text>
            {renderSectionToggleRow('git-branch-outline', 'Einstellungs-Versionen', showVersions, () => setShowVersions(!showVersions))}
            {showVersions && (
              <View style={[styles.inlineForm, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                {versionHistory.length === 0 ? (
                  <Text style={[styles.formLabel, { color: colors.textSecondary, textAlign: 'center', padding: 16 }]}>
                    Keine Versionen vorhanden
                  </Text>
                ) : (
                  versionHistory.map((v: any) => (
                    <View key={v.version} style={[styles.versionItem, { borderBottomColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.navItemLabel, { color: colors.text }]}>Version {v.version}</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                          {new Date(v.changed_at).toLocaleDateString('de-DE')} · {v.changed_by}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.restoreButton, { backgroundColor: colors.primary }]}
                        onPress={() => restoreVersion(v.version)}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Wiederherstellen</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* === Lizenz === */}
            <TouchableOpacity
              style={[styles.navItem, { borderBottomColor: colors.border }]}
              onPress={() => Alert.alert('Lizenz', 'Lizenz: Professional\nGültig bis: 31.12.2026\nBenutzer: unbegrenzt')}
            >
              <Ionicons name="ribbon-outline" size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.navItemLabel, { color: colors.text }]}>Lizenz</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Professional · gültig bis 31.12.2026</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.border} />
            </TouchableOpacity>
          </View>
        )}

        {/* ===================================================================
            EINSTELLUNGEN
        =================================================================== */}
        {renderGroupHeader('einstellungen', 'Einstellungen', 'settings-outline', 'Nummernkreise, Zeit, Projekte')}
        {expandedGroups.einstellungen && (
          <View style={[styles.groupContent, { backgroundColor: colors.card }]}>

            {/* Dark Mode */}
            <View style={[styles.navItem, { borderBottomColor: colors.border }]}>
              <Ionicons name="moon-outline" size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
              <Text style={[styles.navItemLabel, { color: colors.text }]}>Dark Mode</Text>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            {/* Zeit und Ort */}
            {renderSectionToggleRow('location-outline', 'Zeit und Ort', showZeitOrt, () => setShowZeitOrt(!showZeitOrt))}
            {showZeitOrt && (
              <View style={[styles.inlineForm, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <Text style={styles.formLabel(colors)}>Zeitzone</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  placeholder="Europe/Berlin"
                  placeholderTextColor={colors.textSecondary}
                  value={timezone}
                  onChangeText={setTimezone}
                  autoCapitalize="none"
                />
                <Text style={styles.formLabel(colors)}>Datumsformat</Text>
                {renderChipSelector(['DD.MM.YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'], dateFormat, setDateFormat)}
                {renderSaveButton(() => saveSettings({ timezone, date_format: dateFormat }))}
              </View>
            )}

            {/* Wichtige Tage */}
            {renderSectionToggleRow('calendar-outline', 'Wichtige Tage', showWichtigeTage, () => setShowWichtigeTage(!showWichtigeTage))}
            {showWichtigeTage && (
              <View style={[styles.inlineForm, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                {importantDates.length === 0 && (
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>Keine wichtigen Tage eingetragen.</Text>
                )}
                {importantDates.map((d, idx) => (
                  <View key={idx} style={[styles.listRow, { borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 14 }}>{d.name}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{d.date}</Text>
                    </View>
                    <TouchableOpacity onPress={() => {
                      const updated = importantDates.filter((_, i) => i !== idx);
                      setImportantDates(updated);
                    }}>
                      <Ionicons name="trash-outline" size={18} color="#dc3545" />
                    </TouchableOpacity>
                  </View>
                ))}
                {showAddImportantDate ? (
                  <View style={styles.addRow}>
                    <TextInput
                      style={[styles.addInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, flex: 1 }]}
                      placeholder="Bezeichnung"
                      placeholderTextColor={colors.textSecondary}
                      value={newImportantDateName}
                      onChangeText={setNewImportantDateName}
                    />
                    <TextInput
                      style={[styles.addInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, flex: 1 }]}
                      placeholder="Datum (DD.MM.YYYY)"
                      placeholderTextColor={colors.textSecondary}
                      value={newImportantDateDate}
                      onChangeText={setNewImportantDateDate}
                    />
                    <TouchableOpacity
                      style={[styles.addConfirmBtn, { backgroundColor: colors.primary }]}
                      onPress={() => {
                        if (newImportantDateName.trim() && newImportantDateDate.trim()) {
                          setImportantDates(prev => [...prev, { name: newImportantDateName.trim(), date: newImportantDateDate.trim() }]);
                          setNewImportantDateName('');
                          setNewImportantDateDate('');
                          setShowAddImportantDate(false);
                        }
                      }}
                    >
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addChipBtn} onPress={() => setShowAddImportantDate(true)}>
                    <Ionicons name="add" size={16} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 14, marginLeft: 4 }}>Hinzufügen</Text>
                  </TouchableOpacity>
                )}
                {renderSaveButton(() => saveSettings({ important_dates: importantDates }))}
              </View>
            )}

            {/* Nummernkreise */}
            {renderSectionToggleRow('list-outline', 'Nummernkreise', showNummernkreise, () => setShowNummernkreise(!showNummernkreise))}
            {showNummernkreise && (
              <View style={[styles.inlineForm, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                {([
                  { key: 'invoice_prefix', label: 'Rechnungen (z.B. INV)' },
                  { key: 'quote_prefix', label: 'Angebote (z.B. QUO)' },
                  { key: 'event_prefix', label: 'Events (z.B. EVT)' },
                  { key: 'customer_prefix', label: 'Kunden (z.B. CUST)' },
                ] as { key: keyof typeof nummernkreise; label: string }[]).map(({ key, label }) => (
                  <View key={key} style={{ marginBottom: 8 }}>
                    <Text style={styles.formLabel(colors)}>{label}</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, marginBottom: 0 }]}
                      value={nummernkreise[key]}
                      onChangeText={v => setNummernkreise(p => ({ ...p, [key]: v }))}
                      autoCapitalize="characters"
                    />
                  </View>
                ))}
                {renderSaveButton(() => saveSettings(nummernkreise))}
              </View>
            )}

            {/* Projekttypen */}
            {renderSectionToggleRow('albums-outline', 'Projekttypen', showProjekttypen, () => setShowProjekttypen(!showProjekttypen))}
            {showProjekttypen && (
              <View style={[styles.inlineForm, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                {renderRemovableChips(projekttypen, (idx) => {
                  setProjekttypen(prev => prev.filter((_, i) => i !== idx));
                })}
                {showAddProjekttyp ? (
                  <View style={[styles.addRow, { marginTop: 8 }]}>
                    <TextInput
                      style={[styles.addInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, flex: 1 }]}
                      placeholder="Neuer Projekttyp"
                      placeholderTextColor={colors.textSecondary}
                      value={newProjekttyp}
                      onChangeText={setNewProjekttyp}
                    />
                    <TouchableOpacity
                      style={[styles.addConfirmBtn, { backgroundColor: colors.primary }]}
                      onPress={() => {
                        if (newProjekttyp.trim()) {
                          setProjekttypen(prev => [...prev, newProjekttyp.trim()]);
                          setNewProjekttyp('');
                          setShowAddProjekttyp(false);
                        }
                      }}
                    >
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addChipBtn} onPress={() => setShowAddProjekttyp(true)}>
                    <Ionicons name="add" size={16} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 14, marginLeft: 4 }}>Hinzufügen</Text>
                  </TouchableOpacity>
                )}
                {renderSaveButton(() => saveSettings({ project_types: projekttypen }))}
              </View>
            )}

            {renderNavItem('grid-outline', 'Projektvorlagen', '/project-templates')}
            {renderNavItem('checkmark-done-outline', 'Regelmäßige Prüfungen', '/inspections')}

            {/* Stundenerfassung und Abwesenheiten */}
            {renderSectionToggleRow('time-outline', 'Stundenerfassung und Abw.', showStundenerfassung, () => setShowStundenerfassung(!showStundenerfassung))}
            {showStundenerfassung && (
              <View style={[styles.inlineForm, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <View style={styles.toggleRow}>
                  <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>Überstunden erfassen</Text>
                  <Switch
                    value={overtimeTracking}
                    onValueChange={setOvertimeTracking}
                    trackColor={{ false: colors.border, true: colors.primary }}
                  />
                </View>
                <View style={[styles.toggleRow, { marginTop: 8 }]}>
                  <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>Abwesenheiten genehmigen müssen</Text>
                  <Switch
                    value={absenceApprovalRequired}
                    onValueChange={setAbsenceApprovalRequired}
                    trackColor={{ false: colors.border, true: colors.primary }}
                  />
                </View>
                {renderSaveButton(() => saveSettings({ overtime_tracking: overtimeTracking, absence_approval_required: absenceApprovalRequired }))}
              </View>
            )}

            {renderNavItem('add-circle-outline', 'Extra Eingabefelder', '/custom-fields')}

            {/* Lagerstatus — read-only predefined */}
            <TouchableOpacity
              style={[styles.navItem, { borderBottomColor: colors.border, flexDirection: 'column', alignItems: 'flex-start', paddingVertical: 12 }]}
              onPress={() => {}}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, width: '100%' }}>
                <Ionicons name="cube-outline" size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
                <Text style={[styles.navItemLabel, { color: colors.text }]}>Lagerstatus</Text>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, paddingLeft: 32 }}>Vordefinierte Status</Text>
              <View style={{ paddingLeft: 32 }}>
                {renderReadOnlyChips(['verfügbar', 'defekt', 'verloren', 'verschrottet'])}
              </View>
            </TouchableOpacity>

            {/* Notifications toggle */}
            <View style={[styles.navItem, { borderBottomColor: colors.border }]}>
              <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
              <Text style={[styles.navItemLabel, { color: colors.text }]}>Benachrichtigungen</Text>
              <Switch
                value={notificationsEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            {/* Auto Sync toggle */}
            <View style={[styles.navItem, { borderBottomColor: colors.border }]}>
              <Ionicons name="sync-outline" size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
              <Text style={[styles.navItemLabel, { color: colors.text }]}>Auto-Sync</Text>
              <Switch
                value={autoSyncEnabled}
                onValueChange={toggleAutoSync}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

          </View>
        )}

        {/* ===================================================================
            KOMMUNIKATION
        =================================================================== */}
        {renderGroupHeader('kommunikation', 'Kommunikation', 'chatbubble-outline', 'E-Mail, Benachrichtigungen')}
        {expandedGroups.kommunikation && (
          <View style={[styles.groupContent, { backgroundColor: colors.card }]}>

            {/* E-Mail SMTP */}
            {renderSectionToggleRow('mail-outline', 'E-Mail', showEmail, () => setShowEmail(!showEmail))}
            {showEmail && (
              <View style={[styles.inlineForm, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <Text style={styles.formLabel(colors)}>SMTP-Server</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  placeholder="mail.example.com"
                  placeholderTextColor={colors.textSecondary}
                  value={smtpServer}
                  onChangeText={setSmtpServer}
                  autoCapitalize="none"
                />
                <Text style={styles.formLabel(colors)}>SMTP-Port</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  placeholder="587"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  value={smtpPort}
                  onChangeText={setSmtpPort}
                />
                <Text style={styles.formLabel(colors)}>Absender-E-Mail</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  placeholder="noreply@example.com"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={smtpSender}
                  onChangeText={setSmtpSender}
                />
                {renderSaveButton(() => saveSettings({ smtp_server: smtpServer, smtp_port: parseInt(smtpPort) || 587, smtp_sender: smtpSender }))}
              </View>
            )}

            {renderNavItem('pencil-outline', 'Digitale Unterschrift', '/signature-settings')}
            {renderNavItem('paper-plane-outline', 'Einladungen', '/invitations')}
            {renderNavItem('download-outline', 'Dokumentvorlagen', '/exports')}
            {renderSectionToggleRow('document-text-outline', 'Briefpapier', showBriefpapier, () => setShowBriefpapier(!showBriefpapier))}
            {showBriefpapier && (
              <View style={[styles.inlineForm, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <Text style={styles.formLabel(colors)}>Firmenlogo-URL</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  value={letterheadLogoUrl}
                  onChangeText={setLetterheadLogoUrl}
                  placeholder="https://example.com/logo.png"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                {letterheadLogoUrl ? (
                  <Image source={{ uri: letterheadLogoUrl }} style={{ height: 48, width: '100%', marginBottom: 8, borderRadius: 6 }} resizeMode="contain" />
                ) : null}

                <Text style={styles.formLabel(colors)}>Primärfarbe (Hex)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                    value={letterheadPrimaryColor}
                    onChangeText={setLetterheadPrimaryColor}
                    placeholder="#FF9500"
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="none"
                  />
                  <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: letterheadPrimaryColor || '#FF9500', borderWidth: 1, borderColor: colors.border }} />
                </View>

                <Text style={styles.formLabel(colors)}>Slogan / Tagline</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  value={letterheadSlogan}
                  onChangeText={setLetterheadSlogan}
                  placeholder="Ihr Slogan hier…"
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={styles.formLabel(colors)}>Fußzeile (erscheint auf allen Dokumenten)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, minHeight: 64, textAlignVertical: 'top' }]}
                  value={letterheadFooterText}
                  onChangeText={setLetterheadFooterText}
                  placeholder="z.B. Bankverbindung, Steuernummer…"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={3}
                />
                {renderSaveButton(() => saveSettings({
                  letterhead_logo_url: letterheadLogoUrl,
                  letterhead_primary_color: letterheadPrimaryColor,
                  letterhead_slogan: letterheadSlogan,
                  letterhead_footer_text: letterheadFooterText,
                }))}
              </View>
            )}

            {renderSectionToggleRow('globe-outline', 'Online-Angebote', showOnlineAngebote, () => setShowOnlineAngebote(!showOnlineAngebote))}
            {showOnlineAngebote && (
              <View style={[styles.inlineForm, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ color: colors.text, fontSize: 14 }}>Online-Angebote aktiviert</Text>
                  <Switch
                    value={onlineQuotesEnabled}
                    onValueChange={v => { setOnlineQuotesEnabled(v); saveSettings({ online_quotes_enabled: v }); }}
                    trackColor={{ true: colors.primary }}
                  />
                </View>

                <Text style={styles.formLabel(colors)}>Link-Gültigkeit (Tage)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  value={onlineQuotesExpiryDays}
                  onChangeText={setOnlineQuotesExpiryDays}
                  keyboardType="number-pad"
                  placeholder="30"
                  placeholderTextColor={colors.textSecondary}
                />

                <View style={{ backgroundColor: colors.card, borderRadius: 8, padding: 12, marginTop: 4 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
                    Mit dem "Teilen"-Button in der Angebotsliste erzeugen Sie einen öffentlichen Link. Kunden können das Angebot ohne Login einsehen.
                  </Text>
                </View>
                {renderSaveButton(() => saveSettings({ online_quotes_expiry_days: parseInt(onlineQuotesExpiryDays) || 30, online_quotes_enabled: onlineQuotesEnabled }))}
              </View>
            )}

            {/* Anrede */}
            {renderSectionToggleRow('person-outline', 'Anrede', showAnrede, () => setShowAnrede(!showAnrede))}
            {showAnrede && (
              <View style={[styles.inlineForm, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <Text style={styles.formLabel(colors)}>Standard-Anrede</Text>
                {renderChipSelector(['Sehr geehrte/r', 'Hallo', 'Liebe/r'], defaultSalutation, setDefaultSalutation)}
                {renderSaveButton(() => saveSettings({ default_salutation: defaultSalutation }))}
              </View>
            )}
          </View>
        )}

        {/* ===================================================================
            FINANZEN
        =================================================================== */}
        {renderGroupHeader('finanzen', 'Finanzen', 'cash-outline', 'Mietfaktoren, Steuern, Zahlungen')}
        {expandedGroups.finanzen && (
          <View style={[styles.groupContent, { backgroundColor: colors.card }]}>

            {renderNavItem('stats-chart-outline', 'Finanzen', '/invoices')}
            {renderNavItem('receipt-outline', 'Digitale Rechnungsstellung', '/invoice-settings')}

            {/* Faktorgruppen */}
            {renderSectionToggleRow('layers-outline', 'Faktorgruppen', showFaktorgruppen, () => setShowFaktorgruppen(!showFaktorgruppen))}
            {showFaktorgruppen && (
              <View style={[styles.inlineForm, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                {faktorgruppen.map((item, idx) => (
                  <View key={idx} style={[styles.listRow, { borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 14 }}>{item.name}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Faktor: {item.factor}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setFaktorgruppen(prev => prev.filter((_, i) => i !== idx))}>
                      <Ionicons name="trash-outline" size={18} color="#dc3545" />
                    </TouchableOpacity>
                  </View>
                ))}
                {showAddFaktor ? (
                  <View style={styles.addRow}>
                    <TextInput
                      style={[styles.addInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, flex: 2 }]}
                      placeholder="Name"
                      placeholderTextColor={colors.textSecondary}
                      value={newFaktorName}
                      onChangeText={setNewFaktorName}
                    />
                    <TextInput
                      style={[styles.addInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, flex: 1 }]}
                      placeholder="Faktor"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="decimal-pad"
                      value={newFaktorValue}
                      onChangeText={setNewFaktorValue}
                    />
                    <TouchableOpacity
                      style={[styles.addConfirmBtn, { backgroundColor: colors.primary }]}
                      onPress={() => {
                        if (newFaktorName.trim() && newFaktorValue.trim()) {
                          setFaktorgruppen(prev => [...prev, { name: newFaktorName.trim(), factor: newFaktorValue.trim() }]);
                          setNewFaktorName(''); setNewFaktorValue(''); setShowAddFaktor(false);
                        }
                      }}
                    >
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addChipBtn} onPress={() => setShowAddFaktor(true)}>
                    <Ionicons name="add" size={16} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 14, marginLeft: 4 }}>Hinzufügen</Text>
                  </TouchableOpacity>
                )}
                {renderSaveButton(() => saveSettings({
                  factor_groups: faktorgruppen.map(g => ({ name: g.name, factor: parseFloat(g.factor) || 1.0 })),
                }))}
              </View>
            )}

            {/* Mitarbeitertarife */}
            {renderSectionToggleRow('people-outline', 'Mitarbeitertarife', showMitarbeitertarife, () => setShowMitarbeitertarife(!showMitarbeitertarife))}
            {showMitarbeitertarife && (
              <View style={[styles.inlineForm, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                {mitarbeitertarife.map((item, idx) => (
                  <View key={idx} style={[styles.listRow, { borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 14 }}>{item.name}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.rate_per_hour} €/Std.</Text>
                    </View>
                    <TouchableOpacity onPress={() => setMitarbeitertarife(prev => prev.filter((_, i) => i !== idx))}>
                      <Ionicons name="trash-outline" size={18} color="#dc3545" />
                    </TouchableOpacity>
                  </View>
                ))}
                {showAddTarif ? (
                  <View style={styles.addRow}>
                    <TextInput
                      style={[styles.addInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, flex: 2 }]}
                      placeholder="Bezeichnung"
                      placeholderTextColor={colors.textSecondary}
                      value={newTarifName}
                      onChangeText={setNewTarifName}
                    />
                    <TextInput
                      style={[styles.addInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, flex: 1 }]}
                      placeholder="€/Std."
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="decimal-pad"
                      value={newTarifRate}
                      onChangeText={setNewTarifRate}
                    />
                    <TouchableOpacity
                      style={[styles.addConfirmBtn, { backgroundColor: colors.primary }]}
                      onPress={() => {
                        if (newTarifName.trim() && newTarifRate.trim()) {
                          setMitarbeitertarife(prev => [...prev, { name: newTarifName.trim(), rate_per_hour: newTarifRate.trim() }]);
                          setNewTarifName(''); setNewTarifRate(''); setShowAddTarif(false);
                        }
                      }}
                    >
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addChipBtn} onPress={() => setShowAddTarif(true)}>
                    <Ionicons name="add" size={16} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 14, marginLeft: 4 }}>Hinzufügen</Text>
                  </TouchableOpacity>
                )}
                {renderSaveButton(() => saveSettings({
                  staff_rates: mitarbeitertarife.map(r => ({ name: r.name, rate_per_hour: parseFloat(r.rate_per_hour) || 0 })),
                }))}
              </View>
            )}

            {/* Rabattgruppen */}
            {renderSectionToggleRow('pricetag-outline', 'Rabattgruppen', showRabattgruppen, () => setShowRabattgruppen(!showRabattgruppen))}
            {showRabattgruppen && (
              <View style={[styles.inlineForm, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                {rabattgruppen.map((item, idx) => (
                  <View key={idx} style={[styles.listRow, { borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 14 }}>{item.name}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.discount_percent}% Rabatt</Text>
                    </View>
                    <TouchableOpacity onPress={() => setRabattgruppen(prev => prev.filter((_, i) => i !== idx))}>
                      <Ionicons name="trash-outline" size={18} color="#dc3545" />
                    </TouchableOpacity>
                  </View>
                ))}
                {showAddRabatt ? (
                  <View style={styles.addRow}>
                    <TextInput
                      style={[styles.addInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, flex: 2 }]}
                      placeholder="Bezeichnung"
                      placeholderTextColor={colors.textSecondary}
                      value={newRabattName}
                      onChangeText={setNewRabattName}
                    />
                    <TextInput
                      style={[styles.addInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, flex: 1 }]}
                      placeholder="% Rabatt"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="decimal-pad"
                      value={newRabattValue}
                      onChangeText={setNewRabattValue}
                    />
                    <TouchableOpacity
                      style={[styles.addConfirmBtn, { backgroundColor: colors.primary }]}
                      onPress={() => {
                        if (newRabattName.trim() && newRabattValue.trim()) {
                          setRabattgruppen(prev => [...prev, { name: newRabattName.trim(), discount_percent: newRabattValue.trim() }]);
                          setNewRabattName(''); setNewRabattValue(''); setShowAddRabatt(false);
                        }
                      }}
                    >
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addChipBtn} onPress={() => setShowAddRabatt(true)}>
                    <Ionicons name="add" size={16} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 14, marginLeft: 4 }}>Hinzufügen</Text>
                  </TouchableOpacity>
                )}
                {renderSaveButton(() => saveSettings({
                  discount_groups: rabattgruppen.map(g => ({ name: g.name, discount_percent: parseFloat(g.discount_percent) || 0 })),
                }))}
              </View>
            )}

            {/* Rechnungszeitpunkte */}
            {renderSectionToggleRow('calendar-number-outline', 'Rechnungszeitpunkte', showRechnungszeitpunkte, () => setShowRechnungszeitpunkte(!showRechnungszeitpunkte))}
            {showRechnungszeitpunkte && (
              <View style={[styles.inlineForm, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                {renderChipSelector(['Bei Buchung', 'Nach Veranstaltung', 'Manuell'], invoiceTiming, setInvoiceTiming)}
                {renderSaveButton(() => saveSettings({ invoice_timing: invoiceTiming }))}
              </View>
            )}

            {/* Zahlungskonditionen */}
            <View style={[styles.navItem, { borderBottomColor: colors.border, flexDirection: 'column', alignItems: 'flex-start', paddingVertical: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, width: '100%' }}>
                <Ionicons name="time-outline" size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
                <Text style={[styles.navItemLabel, { color: colors.text }]}>Zahlungskonditionen</Text>
              </View>
              <View style={{ paddingLeft: 32 }}>
                {renderReadOnlyChips(appSettings?.payment_terms || ['Sofort fällig', '14 Tage netto', '30 Tage netto'])}
              </View>
            </View>

            {/* MwSt Regelungen */}
            {renderSectionToggleRow(
              'receipt-outline',
              'MwSt Regelungen',
              showMwst,
              () => setShowMwst(!showMwst),
              <Text style={{ color: colors.primary, fontSize: 14, marginRight: 8 }}>{taxRate}%</Text>,
            )}
            {showMwst && (
              <View style={[styles.inlineForm, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <Text style={styles.formLabel(colors)}>Steuersatz (%)</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  value={taxRate}
                  onChangeText={setTaxRate}
                  keyboardType="decimal-pad"
                  placeholder="19"
                  placeholderTextColor={colors.textSecondary}
                />
                {renderSaveButton(() => saveSettings({ tax_rate: parseFloat(taxRate) || 19 }))}
              </View>
            )}

            {/* MwSt Klassen */}
            {renderSectionToggleRow('list-circle-outline', 'MwSt Klassen', showMwstKlassen, () => setShowMwstKlassen(!showMwstKlassen))}
            {showMwstKlassen && (
              <View style={[styles.inlineForm, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                {taxClasses.map((item, idx) => (
                  <View key={idx} style={[styles.listRow, { borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 14 }}>{item.name}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.rate}%</Text>
                    </View>
                    <TouchableOpacity onPress={() => setTaxClasses(prev => prev.filter((_, i) => i !== idx))}>
                      <Ionicons name="trash-outline" size={18} color="#dc3545" />
                    </TouchableOpacity>
                  </View>
                ))}
                {showAddTaxClass ? (
                  <View style={styles.addRow}>
                    <TextInput
                      style={[styles.addInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, flex: 2 }]}
                      placeholder="Bezeichnung"
                      placeholderTextColor={colors.textSecondary}
                      value={newTaxClassName}
                      onChangeText={setNewTaxClassName}
                    />
                    <TextInput
                      style={[styles.addInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, flex: 1 }]}
                      placeholder="Satz %"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="decimal-pad"
                      value={newTaxClassRate}
                      onChangeText={setNewTaxClassRate}
                    />
                    <TouchableOpacity
                      style={[styles.addConfirmBtn, { backgroundColor: colors.primary }]}
                      onPress={() => {
                        if (newTaxClassName.trim() && newTaxClassRate.trim()) {
                          setTaxClasses(prev => [...prev, { name: newTaxClassName.trim(), rate: newTaxClassRate.trim() }]);
                          setNewTaxClassName(''); setNewTaxClassRate(''); setShowAddTaxClass(false);
                        }
                      }}
                    >
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addChipBtn} onPress={() => setShowAddTaxClass(true)}>
                    <Ionicons name="add" size={16} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 14, marginLeft: 4 }}>Hinzufügen</Text>
                  </TouchableOpacity>
                )}
                {renderSaveButton(() => saveSettings({
                  tax_classes: taxClasses.map(c => ({ name: c.name, rate: parseFloat(c.rate) || 0 })),
                }))}
              </View>
            )}

            {/* Zahlungsmittel */}
            <View style={[styles.navItem, { borderBottomColor: colors.border, flexDirection: 'column', alignItems: 'flex-start', paddingVertical: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, width: '100%' }}>
                <Ionicons name="card-outline" size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
                <Text style={[styles.navItemLabel, { color: colors.text }]}>Zahlungsmittel</Text>
              </View>
              <View style={{ paddingLeft: 32 }}>
                {renderReadOnlyChips(appSettings?.payment_methods || ['Bar', 'Überweisung', 'PayPal'])}
              </View>
            </View>

            {/* Hauptbücher */}
            {renderSectionToggleRow('book-outline', 'Hauptbücher', showHauptbücher, () => setShowHauptbücher(!showHauptbücher))}
            {showHauptbücher && (
              <View style={[styles.inlineForm, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                {ledgerAccounts.length === 0 && (
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>Keine Hauptbücher eingetragen.</Text>
                )}
                {ledgerAccounts.map((item, idx) => (
                  <View key={idx} style={[styles.listRow, { borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 14 }}>{item.name}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Konto-Nr.: {item.account_number}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setLedgerAccounts(prev => prev.filter((_, i) => i !== idx))}>
                      <Ionicons name="trash-outline" size={18} color="#dc3545" />
                    </TouchableOpacity>
                  </View>
                ))}
                {showAddLedger ? (
                  <View style={styles.addRow}>
                    <TextInput
                      style={[styles.addInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, flex: 2 }]}
                      placeholder="Bezeichnung"
                      placeholderTextColor={colors.textSecondary}
                      value={newLedgerName}
                      onChangeText={setNewLedgerName}
                    />
                    <TextInput
                      style={[styles.addInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, flex: 1 }]}
                      placeholder="Konto-Nr."
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="number-pad"
                      value={newLedgerNumber}
                      onChangeText={setNewLedgerNumber}
                    />
                    <TouchableOpacity
                      style={[styles.addConfirmBtn, { backgroundColor: colors.primary }]}
                      onPress={() => {
                        if (newLedgerName.trim() && newLedgerNumber.trim()) {
                          setLedgerAccounts(prev => [...prev, { name: newLedgerName.trim(), account_number: newLedgerNumber.trim() }]);
                          setNewLedgerName(''); setNewLedgerNumber(''); setShowAddLedger(false);
                        }
                      }}
                    >
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addChipBtn} onPress={() => setShowAddLedger(true)}>
                    <Ionicons name="add" size={16} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 14, marginLeft: 4 }}>Hinzufügen</Text>
                  </TouchableOpacity>
                )}
                {renderSaveButton(() => saveSettings({ ledger_accounts: ledgerAccounts }))}
              </View>
            )}

            {/* Zusätzliche Bedingungen */}
            {renderSectionToggleRow('document-outline', 'Zusätzliche Bedingungen', showZusaetzlicheBedingungen, () => setShowZusaetzlicheBedingungen(!showZusaetzlicheBedingungen))}
            {showZusaetzlicheBedingungen && (
              <View style={[styles.inlineForm, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <Text style={styles.formLabel(colors)}>Vertragsbedingungen / AGB-Zusatz</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, height: 120, textAlignVertical: 'top' },
                  ]}
                  multiline
                  numberOfLines={5}
                  placeholder="Zusätzliche Vertrags- und Zahlungsbedingungen..."
                  placeholderTextColor={colors.textSecondary}
                  value={additionalTerms}
                  onChangeText={setAdditionalTerms}
                />
                {renderSaveButton(() => saveSettings({ additional_terms: additionalTerms }))}
              </View>
            )}
          </View>
        )}

        {/* ===================================================================
            SICHERHEIT (Biometrie + 2FA)
        =================================================================== */}
        {renderGroupHeader('sicherheit', 'Sicherheit', 'shield-checkmark-outline', 'Biometrie, 2-Faktor-Authentifizierung')}
        {expandedGroups.sicherheit && (
          <View style={[styles.groupContent, { backgroundColor: colors.card }]}>
            {/* Biometric toggle */}
            {biometricAvailable && (
              <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                <View style={styles.settingInfo}>
                  <Ionicons name="finger-print-outline" size={24} color={colors.text} style={styles.settingIcon} />
                  <View>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>{biometricType}</Text>
                    <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Schnell einloggen ohne Passwort</Text>
                  </View>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={toggleBiometric}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="white"
                />
              </View>
            )}

            {/* 2FA / TOTP */}
            <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
              <View style={styles.settingInfo}>
                <Ionicons name="lock-closed-outline" size={24} color={colors.text} style={styles.settingIcon} />
                <View>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>2-Faktor-Authentifizierung</Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    {totpEnabled ? 'Aktiv — Authenticator-App erforderlich' : 'Inaktiv — TOTP aktivieren'}
                  </Text>
                </View>
              </View>
              {totpLoading
                ? <ActivityIndicator color={colors.primary} />
                : <TouchableOpacity
                    onPress={totpEnabled ? disableTotp : startTotpSetup}
                    style={{ backgroundColor: totpEnabled ? colors.danger : colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 }}
                  >
                    <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>{totpEnabled ? 'Deaktivieren' : 'Aktivieren'}</Text>
                  </TouchableOpacity>
              }
            </View>
          </View>
        )}

        {/* TOTP Setup Modal */}
        <Modal visible={totpSetupVisible} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 }}>2FA einrichten</Text>
              <Text style={{ color: colors.textSecondary, marginBottom: 16, fontSize: 13 }}>
                Scanne diesen QR-Code mit Google Authenticator, Authy oder einer anderen TOTP-App.
              </Text>
              {totpQrCode ? (
                <Image
                  source={{ uri: `data:image/png;base64,${totpQrCode}` }}
                  style={{ width: 200, height: 200, alignSelf: 'center', marginBottom: 16 }}
                />
              ) : null}
              <Text style={{ color: colors.subText ?? colors.textSecondary, fontSize: 11, textAlign: 'center', marginBottom: 16 }}>
                Oder manuell: {totpSecret}
              </Text>
              <Text style={{ color: colors.text, marginBottom: 8 }}>Bestätigungscode eingeben:</Text>
              <TextInput
                value={totpCode}
                onChangeText={setTotpCode}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="123456"
                placeholderTextColor={colors.subText ?? colors.textSecondary}
                style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, color: colors.text, fontSize: 22, textAlign: 'center', letterSpacing: 8, marginBottom: 20 }}
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setTotpSetupVisible(false)}
                  style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: colors.text }}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmTotpSetup}
                  disabled={totpLoading}
                  style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 8, padding: 12, alignItems: 'center' }}
                >
                  {totpLoading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '600' }}>Bestätigen</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ===================================================================
            SERVER
        =================================================================== */}
        {renderGroupHeader('server', 'Server', 'server-outline', 'Verbindung, URL konfigurieren')}
        {expandedGroups.server && (
          <View style={[styles.groupContent, { backgroundColor: colors.card }]}>
            <View style={{ padding: 16 }}>
              <Text style={{ fontSize: 13, color: colors.subText ?? colors.textSecondary, marginBottom: 6 }}>
                Server-URL (LAN-IP oder Cloudflare/Tunnel-URL)
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    color: colors.text,
                    fontSize: 14,
                  }}
                  value={serverUrl}
                  onChangeText={setServerUrlState}
                  placeholder="https://xyz.trycloudflare.com"
                  placeholderTextColor={colors.subText ?? colors.textSecondary}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                {/* Test connection */}
                <TouchableOpacity
                  onPress={testAndDetectUrl}
                  disabled={serverUrlTesting}
                  style={{
                    backgroundColor: '#FF9500',
                    padding: 10,
                    borderRadius: 8,
                    width: 44,
                    alignItems: 'center',
                  }}
                >
                  {serverUrlTesting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="wifi-outline" size={20} color="#fff" />
                  }
                </TouchableOpacity>
                {/* Save */}
                <TouchableOpacity
                  onPress={saveServerUrl}
                  disabled={serverUrlSaving}
                  style={{
                    backgroundColor: serverUrlSaved ? '#34C759' : colors.primary,
                    padding: 10,
                    borderRadius: 8,
                    width: 44,
                    alignItems: 'center',
                  }}
                >
                  {serverUrlSaving
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name={serverUrlSaved ? 'checkmark' : 'save-outline'} size={20} color="#fff" />
                  }
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 11, color: colors.subText ?? colors.textSecondary, marginTop: 6 }}>
                {'\u{1F4F6}'} LAN: http://192.168.x.x:8002 {'  '}{'\u{1F310}'} Extern: https://xyz.trycloudflare.com{'\n'}
                Wifi-Button: Verbindung testen & URL automatisch erkennen
              </Text>
            </View>
          </View>
        )}

        {/* ===================================================================
            INFO
        =================================================================== */}
        {renderGroupHeader('info', 'Info', 'information-circle-outline', 'Version, App-Installation')}
        {expandedGroups.info && (
          <View style={[styles.groupContent, { backgroundColor: colors.card }]}>
            <TouchableOpacity
              style={[styles.settingRow, styles.settingButton, { borderBottomColor: colors.border }]}
              onPress={() => router.push('/install' as any)}
            >
              <View style={styles.settingInfo}>
                <Ionicons name="download-outline" size={24} color={colors.text} style={styles.settingIcon} />
                <View>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>App installieren</Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Android, iOS & Web</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
              <View style={styles.settingInfo}>
                <Ionicons name="information-circle-outline" size={24} color={colors.text} style={styles.settingIcon} />
                <View>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Version</Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    {Constants.expoConfig?.version || '1.0.2'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
              <View style={styles.settingInfo}>
                <Ionicons name="cube-outline" size={24} color={colors.text} style={styles.settingIcon} />
                <View>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>App Name</Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    {Constants.expoConfig?.name || 'Inventar Pro'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  content: {
    flex: 1,
  },

  // ─── Profile Card ──────────────────────────────────────────────────────────
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
  },
  companyLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
  },
  companyLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '700',
  },
  userName: {
    fontSize: 13,
    marginTop: 2,
  },

  // ─── Group styles ──────────────────────────────────────────────────────────
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    marginTop: 16,
  },
  groupIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupHeaderText: {
    fontSize: 17,
    fontWeight: '700',
  },
  groupDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  colorPaletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  colorPreviewLarge: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  functionalColorSection: {
    marginBottom: 16,
  },
  colorPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  colorPresetButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 8,
  },
  paletteName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  colorSwatchRow: {
    flexDirection: 'row',
    gap: 4,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  colorSwatchRowLarge: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  colorSwatchLarge: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 4,
  },
  colorSwatchLabel: {
    color: 'white',
    fontSize: 8,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  customColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hexInput: {
    width: 90,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  activePalettePreview: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  groupContent: {
    marginBottom: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  navItemLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  inlineForm: {
    padding: 18,
    borderBottomWidth: 0.5,
  },
  formInput: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 10,
  },
  formLabel: (colors: any) => ({
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  } as any),
  formHint: {
    fontSize: 11,
    marginTop: 4,
    marginBottom: 8,
  },
  iconPreview: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  comingSoonBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  comingSoonText: {
    fontSize: 11,
  },

  // ─── Chip styles ───────────────────────────────────────────────────────────
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  // ─── Inline list styles ────────────────────────────────────────────────────
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  addInput: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  addConfirmBtn: {
    borderRadius: 8,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },

  // ─── Toggle row ────────────────────────────────────────────────────────────
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // ─── Legacy section styles (password + info) ───────────────────────────────
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 4,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingButton: {
    borderTopWidth: 1,
    borderTopColor: '#f1f3f4',
    marginTop: 8,
    paddingTop: 16,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  settingDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  // Version History
  versionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  restoreButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
});
