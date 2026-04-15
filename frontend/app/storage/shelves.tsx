import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
  Dimensions,
} from 'react-native';
import ShelfVisualizer3D from '../../components/warehouse/ShelfVisualizer3D';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/apiService';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: screenWidth } = Dimensions.get('window');

interface Shelf {
  id: string;
  name: string;
  zone_id: string;
  rows: number;
  levels: number;
  positions_per_level: number;
  description?: string;
}

interface StorageZone {
  id: string;
  name: string;
}

interface StorageLocation {
  id: string;
  zone_id: string;
  name: string;
  type: string;
  current_stock?: number;
  capacity?: number;
}

interface Article {
  id: string;
  name: string;
  inventory_code: string;
  location?: string;
  current_stock: number;
}

export default function ShelvesManagementPage() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [zones, setZones] = useState<StorageZone[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showShelfView, setShowShelfView] = useState(false);
  const [selectedShelf, setSelectedShelf] = useState<Shelf | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<{row: number, level: number, position: number} | null>(null);
  const [showPositionDetail, setShowPositionDetail] = useState(false);
  
  // Article Assignment states
  const [showArticleSelector, setShowArticleSelector] = useState(false);
  const [articleSearchQuery, setArticleSearchQuery] = useState('');
  const [assigningArticle, setAssigningArticle] = useState(false);
  const [_selectedArticleForAssign, setSelectedArticleForAssign] = useState<Article | null>(null);
  
  // Form states
  const [shelfName, setShelfName] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [rows, setRows] = useState('1');
  const [levels, setLevels] = useState('3');
  const [positionsPerLevel, setPositionsPerLevel] = useState('4');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        router.replace('/');
        return;
      }

      // Load zones, locations, and articles with apiService
      const [zonesData, locationsData, articlesData] = await Promise.all([
        apiService.get<StorageZone[]>('/api/storage-zones', { showErrorAlert: false }),
        apiService.get<StorageLocation[]>('/api/storage-locations', { showErrorAlert: false }),
        apiService.get<Article[]>('/api/articles', { showErrorAlert: false }),
      ]);

      setZones(zonesData);
      setLocations(locationsData);
      setArticles(articlesData);
      
      // Load shelves from localStorage
      const storedShelves = await AsyncStorage.getItem('shelves_config');
      if (storedShelves) {
        setShelves(JSON.parse(storedShelves));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Fehler', 'Netzwerkfehler');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openAddModal = () => {
    setShelfName('');
    setSelectedZoneId(zones[0]?.id || '');
    setRows('1');
    setLevels('3');
    setPositionsPerLevel('4');
    setDescription('');
    setShowAddModal(true);
  };

  const closeModals = () => {
    setShowAddModal(false);
    setShowShelfView(false);
    setSelectedShelf(null);
    setShowPositionDetail(false);
    setSelectedPosition(null);
    setShowArticleSelector(false);
    setArticleSearchQuery('');
    setSelectedArticleForAssign(null);
  };

  // Artikel Zuweisung Funktionen
  const openArticleSelector = () => {
    setShowPositionDetail(false);
    setShowArticleSelector(true);
    setArticleSearchQuery('');
  };

  const filteredArticles = articles.filter(article => 
    article.name.toLowerCase().includes(articleSearchQuery.toLowerCase()) ||
    article.inventory_code.toLowerCase().includes(articleSearchQuery.toLowerCase())
  );

  const handleAssignArticle = async (article: Article) => {
    if (!selectedShelf || !selectedPosition) return;
    
    const locationName = `${selectedShelf.name}-${String(selectedPosition.row).padStart(2, '0')}-${String(selectedPosition.level).padStart(2, '0')}-${String(selectedPosition.position).padStart(2, '0')}`;
    
    Alert.alert(
      'Artikel zuweisen',
      `Möchten Sie "${article.name}" dem Lagerort "${locationName}" zuweisen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Zuweisen',
          onPress: async () => {
            setAssigningArticle(true);
            try {
              // Update article with new location
              await apiService.put(`/api/articles/${article.id}`, {
                ...article,
                location: locationName,
              });
              
              Alert.alert('✅ Erfolg', `"${article.name}" wurde ${locationName} zugewiesen`);
              setShowArticleSelector(false);
              setSelectedArticleForAssign(null);
              loadData();
            } catch (error) {
              console.error('Error assigning article:', error);
              Alert.alert('Fehler', 'Artikel konnte nicht zugewiesen werden');
            } finally {
              setAssigningArticle(false);
            }
          },
        },
      ]
    );
  };

  const handleRemoveArticleFromLocation = async (article: Article) => {
    Alert.alert(
      'Artikel entfernen',
      `Möchten Sie "${article.name}" von diesem Lagerort entfernen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.put(`/api/articles/${article.id}`, {
                ...article,
                location: '',
              });
              
              Alert.alert('✅ Erfolg', `"${article.name}" wurde entfernt`);
              setShowPositionDetail(false);
              loadData();
            } catch (error) {
              console.error('Error removing article:', error);
              Alert.alert('Fehler', 'Artikel konnte nicht entfernt werden');
            }
          },
        },
      ]
    );
  };

  const validateForm = () => {
    if (!shelfName.trim()) {
      Alert.alert('Fehler', 'Bitte geben Sie einen Regalnamen ein');
      return false;
    }
    if (!selectedZoneId) {
      Alert.alert('Fehler', 'Bitte wählen Sie eine Zone aus');
      return false;
    }
    if (parseInt(rows) < 1 || parseInt(levels) < 1 || parseInt(positionsPerLevel) < 1) {
      Alert.alert('Fehler', 'Alle Dimensionen müssen mindestens 1 sein');
      return false;
    }
    return true;
  };

  const handleCreateShelf = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const newShelf: Shelf = {
        id: Date.now().toString(),
        name: shelfName.trim(),
        zone_id: selectedZoneId,
        rows: parseInt(rows),
        levels: parseInt(levels),
        positions_per_level: parseInt(positionsPerLevel),
        description: description.trim(),
      };

      // Save shelf config
      const updatedShelves = [...shelves, newShelf];
      setShelves(updatedShelves);
      await AsyncStorage.setItem('shelves_config', JSON.stringify(updatedShelves));

      // Create all locations for this shelf
      await createShelfLocations(newShelf);

      Alert.alert('✅ Erfolg', 'Regal wurde erstellt');
      closeModals();
      loadData();
    } catch (error) {
      console.error('Error creating shelf:', error);
      Alert.alert('Fehler', 'Fehler beim Erstellen des Regals');
    } finally {
      setSaving(false);
    }
  };

  const createShelfLocations = async (shelf: Shelf) => {
    const token = await AsyncStorage.getItem('auth_token');
    
    if (!token) {
      console.error('No auth token found');
      return;
    }
    
    for (let row = 1; row <= shelf.rows; row++) {
      for (let level = 1; level <= shelf.levels; level++) {
        for (let pos = 1; pos <= shelf.positions_per_level; pos++) {
          const locationName = `${shelf.name}-${String(row).padStart(2, '0')}-${String(level).padStart(2, '0')}-${String(pos).padStart(2, '0')}`;
          
          const locationData = {
            zone_id: shelf.zone_id,
            name: locationName,
            type: 'shelf',
            capacity: 1,
          };

          try {
            await apiService.post('/api/storage-locations', locationData, { showErrorAlert: false });
          } catch (error) {
            console.error(`Error creating location ${locationName}:`, error);
          }
        }
      }
    }
  };

  const handleDeleteShelf = async (shelfId: string, shelfName: string) => {
    Alert.alert(
      'Regal löschen',
      `Möchten Sie das Regal "${shelfName}" wirklich löschen? Alle zugehörigen Lagerorte werden ebenfalls gelöscht.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedShelves = shelves.filter(s => s.id !== shelfId);
              setShelves(updatedShelves);
              await AsyncStorage.setItem('shelves_config', JSON.stringify(updatedShelves));
              
              // Delete all locations for this shelf using apiService
              const shelfLocations = locations.filter(loc => loc.name.startsWith(shelfName + '-'));
              
              for (const location of shelfLocations) {
                try {
                  await apiService.delete(`/api/storage-locations/${location.id}`, { showErrorAlert: false });
                } catch (error) {
                  console.error(`Failed to delete location ${location.name}:`, error);
                }
              }

              Alert.alert('✅ Erfolg', 'Regal gelöscht');
              loadData();
            } catch {
              Alert.alert('Fehler', 'Fehler beim Löschen');
            }
          },
        },
      ]
    );
  };

  const openShelfView = (shelf: Shelf) => {
    setSelectedShelf(shelf);
    setShowShelfView(true);
  };

  const getZoneName = (zoneId: string) => {
    return zones.find(z => z.id === zoneId)?.name || 'Unbekannte Zone';
  };

  const getLocationInfo = (shelf: Shelf, row: number, level: number, position: number) => {
    const locationName = `${shelf.name}-${String(row).padStart(2, '0')}-${String(level).padStart(2, '0')}-${String(position).padStart(2, '0')}`;
    const location = locations.find(loc => loc.name === locationName);
    
    // Find articles at this location
    const articlesAtLocation = articles.filter(a => 
      a.location?.toLowerCase() === locationName.toLowerCase()
    );
    
    return {
      location,
      occupied: articlesAtLocation.length > 0 || (location?.current_stock || 0) > 0,
      articles: articlesAtLocation,
      stock: location?.current_stock || articlesAtLocation.length,
      locationName,
    };
  };

  const handlePositionPress = (shelf: Shelf, row: number, level: number, position: number) => {
    setSelectedPosition({ row, level, position });
    setShowPositionDetail(true);
  };

  const getOccupancyColor = (occupied: boolean, stock: number) => {
    if (!occupied || stock === 0) return { bg: '#E8F5E9', border: '#4CAF50', text: '#2E7D32' }; // Frei - Grün
    if (stock === 1) return { bg: '#FFF3E0', border: '#FF9800', text: '#E65100' }; // Belegt - Orange
    return { bg: '#FFEBEE', border: '#F44336', text: '#C62828' }; // Voll - Rot
  };

  // Render 3D Shelf Visual
  const render3DShelfVisual = (shelf: Shelf) => {
    const cellWidth = Math.min(70, (screenWidth - 120) / shelf.positions_per_level);
    
    return (
      <View style={styles.shelf3DContainer}>
        {/* Shelf Header */}
        <View style={styles.shelfHeaderBar}>
          <Text style={styles.shelfHeaderText}>{shelf.name}</Text>
          <Text style={styles.shelfSubHeader}>{getZoneName(shelf.zone_id)}</Text>
        </View>

        {/* Legend */}
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' }]} />
            <Text style={styles.legendText}>Frei</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, { backgroundColor: '#FFF3E0', borderColor: '#FF9800' }]} />
            <Text style={styles.legendText}>Belegt</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, { backgroundColor: '#FFEBEE', borderColor: '#F44336' }]} />
            <Text style={styles.legendText}>Voll</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.shelfStats}>
          {(() => {
            let total = 0, occupied = 0;
            for (let r = 1; r <= shelf.rows; r++) {
              for (let l = 1; l <= shelf.levels; l++) {
                for (let p = 1; p <= shelf.positions_per_level; p++) {
                  total++;
                  const info = getLocationInfo(shelf, r, l, p);
                  if (info.occupied) occupied++;
                }
              }
            }
            const percentage = Math.round((occupied / total) * 100);
            return (
              <>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{total}</Text>
                  <Text style={styles.statLabel}>Plätze</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: '#4CAF50' }]}>{total - occupied}</Text>
                  <Text style={styles.statLabel}>Frei</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: '#FF9800' }]}>{occupied}</Text>
                  <Text style={styles.statLabel}>Belegt</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: percentage > 80 ? '#F44336' : '#007AFF' }]}>{percentage}%</Text>
                  <Text style={styles.statLabel}>Auslastung</Text>
                </View>
              </>
            );
          })()}
        </View>

        {/* 3D Shelf Rows */}
        {[...Array(shelf.rows)].map((_, rowIndex) => {
          const row = rowIndex + 1;
          
          return (
            <View key={row} style={styles.shelfRowContainer}>
              {/* Row Label */}
              <View style={styles.rowLabelSide}>
                <Text style={styles.rowLabelText}>R{String(row).padStart(2, '0')}</Text>
              </View>

              <View style={styles.shelf3DWrapper}>
                {/* Side Panel Left - 3D Effect */}
                <View style={styles.sidePanelLeft} />
                
                {/* Main Shelf Content */}
                <View style={styles.shelfMainContent}>
                  {/* Render levels from top to bottom */}
                  {[...Array(shelf.levels)].map((_, levelIndex) => {
                    const level = shelf.levels - levelIndex;
                    
                    return (
                      <View key={level} style={styles.level3DContainer}>
                        {/* Level Label */}
                        <View style={styles.levelLabelBox}>
                          <Text style={styles.levelLabelText}>E{level}</Text>
                        </View>
                        
                        {/* Positions */}
                        <View style={styles.positions3DRow}>
                          {[...Array(shelf.positions_per_level)].map((_, posIndex) => {
                            const position = posIndex + 1;
                            const info = getLocationInfo(shelf, row, level, position);
                            const colorScheme = getOccupancyColor(info.occupied, info.stock);
                            
                            return (
                              <TouchableOpacity
                                key={position}
                                style={[
                                  styles.position3DBox,
                                  { 
                                    width: cellWidth,
                                    backgroundColor: colorScheme.bg,
                                    borderColor: colorScheme.border,
                                  }
                                ]}
                                onPress={() => handlePositionPress(shelf, row, level, position)}
                                activeOpacity={0.7}
                              >
                                {/* 3D Top Effect */}
                                <View style={[styles.position3DTop, { backgroundColor: colorScheme.border }]} />
                                
                                {/* Position Content */}
                                <View style={styles.positionContent}>
                                  <Text style={[styles.positionNumber, { color: colorScheme.text }]}>
                                    {String(position).padStart(2, '0')}
                                  </Text>
                                  
                                  {info.occupied && (
                                    <View style={styles.articleIndicator}>
                                      <Ionicons name="cube" size={16} color={colorScheme.text} />
                                      {info.stock > 1 && (
                                        <Text style={[styles.stockCount, { color: colorScheme.text }]}>
                                          {info.stock}
                                        </Text>
                                      )}
                                    </View>
                                  )}
                                </View>
                                
                                {/* 3D Shadow Effect */}
                                <View style={styles.position3DShadow} />
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        
                        {/* Shelf Beam with 3D effect */}
                        <View style={styles.shelfBeam3D}>
                          <View style={styles.beamTop} />
                          <View style={styles.beamFront} />
                        </View>
                      </View>
                    );
                  })}
                  
                  {/* Base */}
                  <View style={styles.shelfBase3D}>
                    <View style={styles.baseTop} />
                    <View style={styles.baseFront} />
                  </View>
                </View>
                
                {/* Side Panel Right - 3D Effect */}
                <View style={styles.sidePanelRight} />
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  // Render Position Detail Modal
  const renderPositionDetail = () => {
    if (!selectedShelf || !selectedPosition) return null;
    
    const info = getLocationInfo(
      selectedShelf, 
      selectedPosition.row, 
      selectedPosition.level, 
      selectedPosition.position
    );
    
    return (
      <Modal
        visible={showPositionDetail}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPositionDetail(false)}
      >
        <TouchableOpacity 
          style={styles.detailOverlay}
          activeOpacity={1}
          onPress={() => setShowPositionDetail(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.detailModal}>
            <View style={styles.detailHeader}>
              <View style={styles.detailTitleRow}>
                <Ionicons name="location" size={24} color="#007AFF" />
                <Text style={styles.detailTitle}>{info.locationName}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPositionDetail(false)}>
                <Ionicons name="close-circle" size={28} color="#999" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.detailContent} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status:</Text>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: info.occupied ? '#FFF3E0' : '#E8F5E9' }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: info.occupied ? '#E65100' : '#2E7D32' }
                  ]}>
                    {info.occupied ? 'Belegt' : 'Frei'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Position:</Text>
                <Text style={styles.detailValue}>
                  Reihe {selectedPosition.row}, Ebene {selectedPosition.level}, Platz {selectedPosition.position}
                </Text>
              </View>
              
              {info.articles.length > 0 && (
                <View style={styles.articlesSection}>
                  <Text style={styles.articlesSectionTitle}>
                    📦 Artikel an diesem Platz:
                  </Text>
                  {info.articles.map((article) => (
                    <View key={article.id} style={styles.articleItemContainer}>
                      <TouchableOpacity
                        style={styles.articleItem}
                        onPress={() => {
                          setShowPositionDetail(false);
                          setShowShelfView(false);
                          router.push(`/articles/${article.id}`);
                        }}
                      >
                        <View style={styles.articleInfo}>
                          <Text style={styles.articleName}>{article.name}</Text>
                          <Text style={styles.articleCode}>{article.inventory_code}</Text>
                        </View>
                        <View style={styles.articleStock}>
                          <Text style={styles.articleStockValue}>{article.current_stock}</Text>
                          <Text style={styles.articleStockLabel}>Stk.</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#999" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeArticleButton}
                        onPress={() => handleRemoveArticleFromLocation(article)}
                      >
                        <Ionicons name="remove-circle" size={20} color="#FF3B30" />
                        <Text style={styles.removeArticleText}>Entfernen</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              
              {!info.occupied && (
                <View style={styles.emptySlotInfo}>
                  <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
                  <Text style={styles.emptySlotText}>Dieser Platz ist frei</Text>
                  <Text style={styles.emptySlotSubtext}>
                    Artikel können hier eingelagert werden
                  </Text>
                </View>
              )}

              {/* Assign Article Button */}
              <TouchableOpacity
                style={styles.assignArticleButton}
                onPress={openArticleSelector}
              >
                <Ionicons name="add-circle" size={24} color="white" />
                <Text style={styles.assignArticleButtonText}>
                  Artikel zuweisen
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

  // Render Article Selector Modal
  const renderArticleSelector = () => {
    if (!selectedShelf || !selectedPosition) return null;
    
    const locationName = `${selectedShelf.name}-${String(selectedPosition.row).padStart(2, '0')}-${String(selectedPosition.level).padStart(2, '0')}-${String(selectedPosition.position).padStart(2, '0')}`;
    
    // Filter out articles that already have this location
    const availableArticles = filteredArticles.filter(a => 
      !a.location || a.location.toLowerCase() !== locationName.toLowerCase()
    );
    
    return (
      <Modal
        visible={showArticleSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowArticleSelector(false)}
      >
        <View style={styles.articleSelectorOverlay}>
          <View style={styles.articleSelectorModal}>
            <View style={styles.articleSelectorHeader}>
              <View>
                <Text style={styles.articleSelectorTitle}>Artikel zuweisen</Text>
                <Text style={styles.articleSelectorSubtitle}>
                  Zu: {locationName}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowArticleSelector(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {/* Search */}
            <View style={styles.articleSearchContainer}>
              <Ionicons name="search" size={20} color="#999" />
              <TextInput
                style={styles.articleSearchInput}
                value={articleSearchQuery}
                onChangeText={setArticleSearchQuery}
                placeholder="Artikel suchen..."
                autoFocus
              />
              {articleSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setArticleSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Articles List */}
            <ScrollView style={styles.articlesList}>
              {availableArticles.length === 0 ? (
                <View style={styles.noArticlesContainer}>
                  <Ionicons name="cube-outline" size={48} color="#ccc" />
                  <Text style={styles.noArticlesText}>
                    {articleSearchQuery ? 'Keine Artikel gefunden' : 'Keine verfügbaren Artikel'}
                  </Text>
                </View>
              ) : (
                availableArticles.map(article => (
                  <TouchableOpacity
                    key={article.id}
                    style={styles.articleSelectItem}
                    onPress={() => handleAssignArticle(article)}
                    disabled={assigningArticle}
                  >
                    <View style={styles.articleSelectIcon}>
                      <Ionicons name="cube" size={24} color="#007AFF" />
                    </View>
                    <View style={styles.articleSelectInfo}>
                      <Text style={styles.articleSelectName}>{article.name}</Text>
                      <Text style={styles.articleSelectCode}>{article.inventory_code}</Text>
                      {article.location && (
                        <Text style={styles.articleSelectLocation}>
                          📍 Aktuell: {article.location}
                        </Text>
                      )}
                    </View>
                    <View style={styles.articleSelectStock}>
                      <Text style={styles.articleSelectStockValue}>{article.current_stock}</Text>
                      <Text style={styles.articleSelectStockLabel}>Stk.</Text>
                    </View>
                    <Ionicons name="add-circle" size={24} color="#4CAF50" />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Lade Regale...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Regale</Text>
        <TouchableOpacity onPress={openAddModal}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="cube-outline" size={24} color="#007AFF" />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>3D Regalvisualisierung</Text>
            <Text style={styles.infoText}>
              Tippen Sie auf einen Platz, um Details und Artikel anzuzeigen
            </Text>
          </View>
        </View>

        {/* Shelves List */}
        {shelves.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="grid-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>Keine Regale vorhanden</Text>
            <Text style={styles.emptyText}>
              Erstellen Sie Ihr erstes Regal
            </Text>
            <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
              <Text style={styles.addButtonText}>Regal hinzufügen</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.shelvesList}>
            {shelves.map(shelf => (
              <View key={shelf.id} style={styles.shelfCard}>
                <TouchableOpacity
                  style={styles.shelfCardContent}
                  onPress={() => openShelfView(shelf)}
                  activeOpacity={0.7}
                >
                  <View style={styles.shelfCardHeader}>
                    <View style={styles.shelfIconContainer}>
                      <Ionicons name="grid" size={28} color="white" />
                    </View>
                    <View style={styles.shelfCardInfo}>
                      <Text style={styles.shelfCardName}>{shelf.name}</Text>
                      <Text style={styles.shelfCardZone}>{getZoneName(shelf.zone_id)}</Text>
                      <View style={styles.shelfDimensions}>
                        <View style={styles.dimensionBadge}>
                          <Text style={styles.dimensionText}>{shelf.rows} Reihen</Text>
                        </View>
                        <View style={styles.dimensionBadge}>
                          <Text style={styles.dimensionText}>{shelf.levels} Ebenen</Text>
                        </View>
                        <View style={styles.dimensionBadge}>
                          <Text style={styles.dimensionText}>{shelf.positions_per_level} Plätze</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
                
                <View style={styles.shelfCardActions}>
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() => openShelfView(shelf)}
                  >
                    <Ionicons name="eye-outline" size={18} color="white" />
                    <Text style={styles.viewButtonText}>3D Ansicht</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteShelf(shelf.id, shelf.name)}
                  >
                    <Ionicons name="trash-outline" size={18} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Shelf Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={closeModals}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Neues Regal erstellen</Text>
              <TouchableOpacity onPress={closeModals}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Regalname *</Text>
                <TextInput
                  style={styles.input}
                  value={shelfName}
                  onChangeText={setShelfName}
                  placeholder="z.B. Regal-A, Main-Shelf-1"
                />
              </View>

              {/* Zone */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Zone *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipContainer}>
                    {zones.map(zone => (
                      <TouchableOpacity
                        key={zone.id}
                        style={[styles.chip, selectedZoneId === zone.id && styles.selectedChip]}
                        onPress={() => setSelectedZoneId(zone.id)}
                      >
                        <Text style={[styles.chipText, selectedZoneId === zone.id && styles.selectedChipText]}>
                          {zone.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Dimensions */}
              <View style={styles.dimensionsContainer}>
                <Text style={styles.sectionTitle}>Regal-Dimensionen</Text>
                
                <View style={styles.dimensionInputRow}>
                  <View style={styles.dimensionInput}>
                    <Text style={styles.label}>Reihen</Text>
                    <TextInput
                      style={styles.input}
                      value={rows}
                      onChangeText={setRows}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                  
                  <View style={styles.dimensionInput}>
                    <Text style={styles.label}>Ebenen</Text>
                    <TextInput
                      style={styles.input}
                      value={levels}
                      onChangeText={setLevels}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                  
                  <View style={styles.dimensionInput}>
                    <Text style={styles.label}>Plätze/Ebene</Text>
                    <TextInput
                      style={styles.input}
                      value={positionsPerLevel}
                      onChangeText={setPositionsPerLevel}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                </View>
                
                {/* Preview */}
                {rows && levels && positionsPerLevel && (
                  <View style={styles.previewContainer}>
                    <Text style={styles.previewLabel}>
                      Gesamt: {parseInt(rows || '0') * parseInt(levels || '0') * parseInt(positionsPerLevel || '0')} Lagerorte
                    </Text>
                  </View>
                )}
              </View>

              {/* Description */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Beschreibung (optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Zusätzliche Informationen"
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleCreateShelf}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>Regal erstellen</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Shelf 3D View Modal */}
      <Modal
        visible={showShelfView}
        transparent={false}
        animationType="slide"
        onRequestClose={closeModals}
      >
        <View style={{ flex: 1, backgroundColor: '#111a26' }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a101c', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(33,150,243,0.25)' }}>
            <TouchableOpacity onPress={closeModals} style={{ marginRight: 12 }}>
              <Ionicons name="close" size={24} color="#64b5f6" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#e8edf5', fontSize: 18, fontWeight: '700', letterSpacing: 0.5 }}>
                {selectedShelf?.name}
              </Text>
              <Text style={{ color: '#6a80a0', fontSize: 12, marginTop: 1 }}>
                {selectedShelf ? `${selectedShelf.rows} Blöcke · ${selectedShelf.levels} Etagen · ${selectedShelf.positions_per_level} Plätze` : ''}
              </Text>
            </View>
          </View>

          {/* 3D Visualizer */}
          {selectedShelf && (() => {
            const pad = (n: number) => String(n).padStart(2, '0');
            const fillData: Record<string, number> = {};
            for (let r = 1; r <= selectedShelf.rows; r++) {
              for (let l = 1; l <= selectedShelf.levels; l++) {
                for (let p = 1; p <= selectedShelf.positions_per_level; p++) {
                  const info = getLocationInfo(selectedShelf, r, l, p);
                  const key = `${pad(r)}-${pad(l)}-${pad(p)}`;
                  fillData[key] = info.occupied ? (info.stock > 1 ? 85 : 65) : 0;
                }
              }
            }
            return (
              <ShelfVisualizer3D
                blocks={selectedShelf.rows}
                levels={selectedShelf.levels}
                spots={selectedShelf.positions_per_level}
                fillData={fillData}
                onSpotPress={(block, level, spot) => {
                  setSelectedPosition({ row: block, level, position: spot });
                  setShowPositionDetail(true);
                }}
              />
            );
          })()}
        </View>
      </Modal>

      {/* Position Detail Modal */}
      {renderPositionDetail()}

      {/* Article Selector Modal */}
      {renderArticleSelector()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  infoTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  addButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 24,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  shelvesList: {
    padding: 16,
  },
  shelfCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  shelfCardContent: {
    padding: 16,
  },
  shelfCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  shelfIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shelfCardInfo: {
    marginLeft: 16,
    flex: 1,
  },
  shelfCardName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  shelfCardZone: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 12,
  },
  shelfDimensions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dimensionBadge: {
    backgroundColor: '#f1f3f4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dimensionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  shelfCardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f3f4',
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#007AFF',
    gap: 8,
  },
  viewButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
  },
  
  // 3D Shelf Styles
  shelf3DContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  shelfHeaderBar: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  shelfHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  shelfSubHeader: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  shelfStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  shelfRowContainer: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  rowLabelSide: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowLabelText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#007AFF',
    transform: [{ rotate: '-90deg' }],
  },
  shelf3DWrapper: {
    flex: 1,
    flexDirection: 'row',
  },
  sidePanelLeft: {
    width: 8,
    backgroundColor: '#5D4037',
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  sidePanelRight: {
    width: 8,
    backgroundColor: '#4E342E',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  shelfMainContent: {
    flex: 1,
    backgroundColor: '#8D6E63',
    padding: 8,
  },
  level3DContainer: {
    marginBottom: 4,
  },
  levelLabelBox: {
    backgroundColor: '#5D4037',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  levelLabelText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  positions3DRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  position3DBox: {
    height: 60,
    borderRadius: 6,
    borderWidth: 2,
    marginHorizontal: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  position3DTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    opacity: 0.5,
  },
  positionContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionNumber: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  articleIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  stockCount: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  position3DShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  shelfBeam3D: {
    marginTop: 4,
  },
  beamTop: {
    height: 4,
    backgroundColor: '#6D4C41',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  beamFront: {
    height: 8,
    backgroundColor: '#5D4037',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  shelfBase3D: {
    marginTop: 8,
  },
  baseTop: {
    height: 6,
    backgroundColor: '#4E342E',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  baseFront: {
    height: 12,
    backgroundColor: '#3E2723',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  
  // Position Detail Modal
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  detailModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  detailContent: {
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  articlesSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 16,
  },
  articlesSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  articleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  articleInfo: {
    flex: 1,
  },
  articleName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  articleCode: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  articleStock: {
    alignItems: 'center',
    marginRight: 8,
  },
  articleStockValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  articleStockLabel: {
    fontSize: 10,
    color: '#999',
  },
  emptySlotInfo: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptySlotText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginTop: 12,
  },
  emptySlotSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalContent: {
    padding: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: 'white',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  chipContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f3f4',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  selectedChip: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  chipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedChipText: {
    color: 'white',
  },
  dimensionsContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  dimensionInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dimensionInput: {
    flex: 1,
  },
  previewContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Article Assignment Styles
  articleItemContainer: {
    marginBottom: 8,
  },
  removeArticleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 8,
    paddingRight: 12,
    gap: 4,
  },
  removeArticleText: {
    fontSize: 12,
    color: '#FF3B30',
  },
  assignArticleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 14,
    marginTop: 16,
    gap: 8,
  },
  assignArticleButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Article Selector Modal Styles
  articleSelectorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  articleSelectorModal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  articleSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  articleSelectorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  articleSelectorSubtitle: {
    fontSize: 13,
    color: '#007AFF',
    marginTop: 4,
  },
  articleSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f3f4',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
  },
  articleSearchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  articlesList: {
    maxHeight: 400,
    paddingHorizontal: 16,
  },
  noArticlesContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  noArticlesText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  articleSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  articleSelectIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  articleSelectInfo: {
    flex: 1,
  },
  articleSelectName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  articleSelectCode: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  articleSelectLocation: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  articleSelectStock: {
    alignItems: 'center',
  },
  articleSelectStockValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  articleSelectStockLabel: {
    fontSize: 10,
    color: '#999',
  },
});
