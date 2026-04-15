import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import apiService from '../../services/apiService';
import { parseCsv, generateCsvTemplate, CsvRow } from '../../utils/csvUtils';
import { useTheme } from '../../contexts/ThemeContext';

interface ImportResult {
  imported: number;
  errors: string[];
}

export default function ArticleImportPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<CsvRow[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<any>(null);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 16,
      gap: 12,
    },
    templateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    templateButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '500',
    },
    selectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    selectButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '500',
    },
    previewSection: {
      backgroundColor: colors.card,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    tableRow: {
      flexDirection: 'row',
    },
    tableRowAlt: {
      backgroundColor: colors.background,
    },
    tableHeaderCell: {
      width: 120,
      padding: 6,
      backgroundColor: colors.border,
      borderWidth: 0.5,
      borderColor: colors.border,
    },
    tableHeaderText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
    },
    tableCell: {
      width: 120,
      padding: 6,
      borderWidth: 0.5,
      borderColor: colors.border,
    },
    tableCellText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    importButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#34C759',
      borderRadius: 8,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    importButtonDisabled: {
      backgroundColor: '#a0a0a0',
    },
    importButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    resultSection: {
      backgroundColor: colors.card,
      borderRadius: 8,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    resultSuccess: {
      fontSize: 16,
      fontWeight: '600',
      color: '#34C759',
      marginBottom: 8,
    },
    errorsContainer: {
      marginTop: 8,
    },
    errorsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FF3B30',
      marginBottom: 4,
    },
    errorItem: {
      fontSize: 13,
      color: '#FF3B30',
      marginBottom: 2,
    },
  });

  const handleDownloadTemplate = () => {
    if (Platform.OS === 'web') {
      const template = generateCsvTemplate();
      const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'artikel-vorlage.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      Alert.alert('Hinweis', 'Im Browser verfügbar');
    }
  };

  const handleSelectFile = () => {
    if (Platform.OS === 'web') {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    } else {
      Alert.alert('Hinweis', 'Im Browser verfügbar');
    }
  };

  const handleFileChange = (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      setResult(null);
      const rows = parseCsv(content);
      if (rows.length > 0) {
        setPreviewHeaders(Object.keys(rows[0]));
        setPreviewRows(rows.slice(0, 5));
      } else {
        setPreviewHeaders([]);
        setPreviewRows([]);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvContent) {
      Alert.alert('Fehler', 'Bitte wählen Sie zuerst eine CSV-Datei aus.');
      return;
    }
    setImporting(true);
    setResult(null);
    try {
      const response = await apiService.post<ImportResult>('/api/articles/import', {
        csv_content: csvContent,
      });
      setResult(response);
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Import fehlgeschlagen');
    } finally {
      setImporting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Artikel importieren</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Hidden file input for web */}
        {Platform.OS === 'web' && (
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        )}

        {/* Action buttons */}
        <TouchableOpacity style={styles.templateButton} onPress={handleDownloadTemplate}>
          <Ionicons name="download-outline" size={20} color={colors.primary} />
          <Text style={styles.templateButtonText}>CSV-Vorlage herunterladen</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.selectButton} onPress={handleSelectFile}>
          <Ionicons name="folder-open-outline" size={20} color="white" />
          <Text style={styles.selectButtonText}>CSV-Datei auswählen</Text>
        </TouchableOpacity>

        {/* Preview table */}
        {previewRows.length > 0 && (
          <View style={styles.previewSection}>
            <Text style={styles.sectionTitle}>Vorschau (erste 5 Zeilen)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View>
                {/* Header row */}
                <View style={styles.tableRow}>
                  {previewHeaders.map((header) => (
                    <View key={header} style={styles.tableHeaderCell}>
                      <Text style={styles.tableHeaderText}>{header}</Text>
                    </View>
                  ))}
                </View>
                {/* Data rows */}
                {previewRows.map((row, rowIndex) => (
                  <View key={rowIndex} style={[styles.tableRow, rowIndex % 2 === 1 && styles.tableRowAlt]}>
                    {previewHeaders.map((header) => (
                      <View key={header} style={styles.tableCell}>
                        <Text style={styles.tableCellText} numberOfLines={1}>{row[header] ?? ''}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Import button */}
        {csvContent && (
          <TouchableOpacity
            style={[styles.importButton, importing && styles.importButtonDisabled]}
            onPress={handleImport}
            disabled={importing}
          >
            {importing ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Ionicons name="cloud-upload-outline" size={20} color="white" />
            )}
            <Text style={styles.importButtonText}>
              {importing ? 'Importiere...' : 'Importieren'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Result */}
        {result && (
          <View style={styles.resultSection}>
            <Text style={styles.resultSuccess}>
              {result.imported} Artikel importiert
            </Text>
            {result.errors.length > 0 && (
              <View style={styles.errorsContainer}>
                <Text style={styles.errorsTitle}>Fehler ({result.errors.length}):</Text>
                {result.errors.map((err, index) => (
                  <Text key={index} style={styles.errorItem}>• {err}</Text>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
