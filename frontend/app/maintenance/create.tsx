import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const toISO = (d: string) => { if (!d || !d.includes('.')) return d; const [dd, mm, yyyy] = d.split('.'); return `${yyyy}-${mm}-${dd}`; };

interface Article {
  id: string;
  name: string;
  inventory_code: string;
  status: string;
}

export default function CreateMaintenanceTask() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [articles, setArticles] = useState<Article[]>([]);
  const [showArticlePicker, setShowArticlePicker] = useState(false);

  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [touched, setTouched] = useState<{[key: string]: boolean}>({});

  // Form states
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState<'routine' | 'repair' | 'inspection'>('routine');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('');

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 16,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    content: {
      flex: 1,
      padding: 24,
    },
    section: {
      marginBottom: 24,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    labelError: {
      color: '#dc3545',
    },
    input: {
      backgroundColor: colors.card,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
    },
    inputError: {
      borderColor: '#dc3545',
      borderWidth: 1.5,
      backgroundColor: '#fff5f5',
    },
    errorText: {
      color: '#dc3545',
      fontSize: 12,
      marginTop: 4,
      marginLeft: 4,
      fontWeight: '500',
    },
    textArea: {
      height: 100,
      textAlignVertical: 'top',
    },
    pickerButton: {
      backgroundColor: colors.card,
      borderRadius: 8,
      padding: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    pickerButtonText: {
      fontSize: 16,
      color: colors.text,
    },
    placeholderText: {
      color: colors.textSecondary,
    },
    pickerContainer: {
      marginTop: 8,
      backgroundColor: colors.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 200,
    },
    pickerScroll: {
      maxHeight: 200,
    },
    pickerItem: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    pickerItemText: {
      fontSize: 16,
      color: colors.text,
    },
    pickerItemSubtext: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    optionRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    optionButton: {
      flex: 1,
      minWidth: '30%',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: colors.border,
      alignItems: 'center',
    },
    optionButtonActive: {
      backgroundColor: colors.primary,
    },
    optionButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    optionButtonTextActive: {
      color: colors.card,
    },
    priorityButton: {
      flex: 1,
      minWidth: '22%',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: colors.border,
      alignItems: 'center',
    },
    priorityButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    priorityButtonTextActive: {
      color: 'white',
    },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 16,
      marginBottom: 32,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
  });

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

      const response = await fetch(`${BACKEND_URL}/api/articles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setArticles(data);
      }
    } catch (error) {
      console.error('Error loading articles:', error);
    } finally {
      setArticlesLoading(false);
    }
  };

  const updateField = (field: string, setter: (v: any) => void) => (value: any) => {
    setter(value);
    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field);
  };

  const validateField = (field: string) => {
    let error = '';

    switch(field) {
      case 'article':
        if (!selectedArticle) error = 'Artikel ist erforderlich';
        break;
      case 'title':
        if (!title.trim()) error = 'Titel ist erforderlich';
        else if (title.trim().length < 3) error = 'Mindestens 3 Zeichen';
        break;
    }

    setErrors(prev => ({ ...prev, [field]: error }));
    return error === '';
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!selectedArticle) {
      newErrors.article = 'Bitte wählen Sie einen Artikel aus';
    }
    if (!title.trim()) {
      newErrors.title = 'Bitte geben Sie einen Titel ein';
    }

    setErrors(newErrors);
    setTouched({
      article: true,
      title: true,
    });

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Fehler', 'Bitte füllen Sie alle Pflichtfelder korrekt aus');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');

      if (!token) {
        Alert.alert('Fehler', 'Nicht angemeldet. Bitte melden Sie sich erneut an.');
        router.replace('/');
        return;
      }

      const taskData: any = {
        article_id: selectedArticle!.id,
        title: title.trim(),
        description: description.trim() || undefined,
        task_type: taskType,
        priority,
      };

      if (dueDate) {
        taskData.due_date = new Date(toISO(dueDate)).toISOString();
      }

      if (estimatedDuration) {
        taskData.estimated_duration = parseInt(estimatedDuration);
      }

      const response = await fetch(`${BACKEND_URL}/api/maintenance/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });

      if (response.ok) {
        const task = await response.json();
        router.back();
      } else if (response.status === 401) {
        Alert.alert('Fehler', 'Sitzung abgelaufen. Bitte melden Sie sich erneut an.');
        router.replace('/');
      } else {
        const error = await response.json();
        Alert.alert('Fehler', Array.isArray(error.detail) ? error.detail.map((e: any) => e.msg).join('\n') : error.detail || 'Fehler beim Erstellen der Aufgabe');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      Alert.alert('Fehler', 'Netzwerkfehler beim Erstellen der Aufgabe');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'critical': return '#FF3B30';
      case 'high': return '#FF9500';
      case 'medium': return '#007AFF';
      case 'low': return '#34C759';
      default: return colors.textSecondary;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Neue Wartungsaufgabe</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          {/* Article Selection */}
          <View style={styles.section}>
            <Text style={[styles.label, errors.article && touched.article && styles.labelError]}>
              Artikel auswählen *
            </Text>
            <TouchableOpacity
              style={[
                styles.pickerButton,
                errors.article && touched.article && styles.inputError
              ]}
              onPress={() => {
                setShowArticlePicker(!showArticlePicker);
                if (!showArticlePicker) {
                  setTouched(prev => ({ ...prev, article: true }));
                }
              }}
            >
              <Text style={[styles.pickerButtonText, !selectedArticle && styles.placeholderText]}>
                {selectedArticle ? `${selectedArticle.name} (${selectedArticle.inventory_code})` : 'Artikel auswählen...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            {errors.article && touched.article && (
              <Text style={styles.errorText}>⚠️ {errors.article}</Text>
            )}

            {showArticlePicker && (
              <View style={styles.pickerContainer}>
                <ScrollView style={styles.pickerScroll}>
                  {articles.map((article) => (
                    <TouchableOpacity
                      key={article.id}
                      style={styles.pickerItem}
                      onPress={() => {
                        setSelectedArticle(article);
                        setShowArticlePicker(false);
                        if (errors.article) {
                          setErrors(prev => ({ ...prev, article: '' }));
                        }
                      }}
                    >
                      <Text style={styles.pickerItemText}>{article.name}</Text>
                      <Text style={styles.pickerItemSubtext}>{article.inventory_code}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Title */}
          <View style={styles.section}>
            <Text style={[styles.label, errors.title && touched.title && styles.labelError]}>
              Titel *
            </Text>
            <TextInput
              style={[
                styles.input,
                errors.title && touched.title && styles.inputError
              ]}
              placeholder="z.B. Jährliche Inspektion"
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={updateField('title', setTitle)}
              onBlur={() => handleBlur('title')}
            />
            {errors.title && touched.title && (
              <Text style={styles.errorText}>⚠️ {errors.title}</Text>
            )}
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.label}>Beschreibung (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Details zur Wartungsaufgabe..."
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Task Type */}
          <View style={styles.section}>
            <Text style={styles.label}>Aufgabentyp</Text>
            <View style={styles.optionRow}>
              {(['routine', 'repair', 'inspection'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.optionButton, taskType === type && styles.optionButtonActive]}
                  onPress={() => setTaskType(type)}
                >
                  <Text style={[styles.optionButtonText, taskType === type && styles.optionButtonTextActive]}>
                    {type === 'routine' ? 'Routine' : type === 'repair' ? 'Reparatur' : 'Inspektion'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Priority */}
          <View style={styles.section}>
            <Text style={styles.label}>Priorität</Text>
            <View style={styles.optionRow}>
              {(['low', 'medium', 'high', 'critical'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityButton,
                    priority === p && { backgroundColor: getPriorityColor(p) }
                  ]}
                  onPress={() => setPriority(p)}
                >
                  <Text style={[
                    styles.priorityButtonText,
                    priority === p && styles.priorityButtonTextActive
                  ]}>
                    {p === 'low' ? 'Niedrig' : p === 'medium' ? 'Mittel' : p === 'high' ? 'Hoch' : 'Kritisch'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Due Date */}
          <View style={styles.section}>
            <Text style={styles.label}>Fälligkeitsdatum (TT.MM.JJJJ)</Text>
            <TextInput
              style={styles.input}
              placeholder="30.06.2025"
              placeholderTextColor={colors.textSecondary}
              value={dueDate}
              onChangeText={setDueDate}
            />
          </View>

          {/* Estimated Duration */}
          <View style={styles.section}>
            <Text style={styles.label}>Geschätzte Dauer (Minuten)</Text>
            <TextInput
              style={styles.input}
              placeholder="z.B. 60"
              placeholderTextColor={colors.textSecondary}
              value={estimatedDuration}
              onChangeText={setEstimatedDuration}
              keyboardType="numeric"
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.submitButtonText}>Aufgabe erstellen</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
