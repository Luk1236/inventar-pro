import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  TextInput,
  Modal,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================
// TYPEN
// ============================================================

export interface WarehouseZone {
  id: string;
  name: string;
  type: 'shelf' | 'floor' | 'cold' | 'hazardous' | 'receiving' | 'shipping';
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export interface StorageLocation2D {
  id: string;
  zone_id: string;
  name: string;
  code: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fillPercent: number;
  articleCount: number;
  capacity: number;
  warning: boolean;
  article?: {
    name: string;
    inventory_code: string;
    stock: number;
  };
}

export interface Warehouse2DProps {
  zones: WarehouseZone[];
  locations: StorageLocation2D[];
  onZonePress?: (zone: WarehouseZone) => void;
  onLocationPress?: (location: StorageLocation2D) => void;
  onMultiSelect?: (locations: StorageLocation2D[]) => void;
  selectedLocationId?: string | null;
  showLabels?: boolean;
  showCapacity?: boolean;
  compact?: boolean;
  highlightArticleId?: string | null;
}

// ============================================================
// KONSTANTEN
// ============================================================

const TILE_SIZE = 55;
const ZONE_COLORS: Record<string, string> = {
  shelf: '#4CAF50',
  floor: '#2196F3',
  cold: '#00BCD4',
  hazardous: '#FF5722',
  receiving: '#FFC107',
  shipping: '#9C27B0',
};

const ZONE_ICONS: Record<string, string> = {
  shelf: 'layers',
  floor: 'square',
  cold: 'snow',
  hazardous: 'warning',
  receiving: 'download',
  shipping: 'upload',
};

// Accessible Farbschema mit unterschiedlichen Helligkeitswerten für Barrierefreiheit
// Jede Farbe hat einen unterschiedlichen Helligkeitswert, um für farbenblinde Personen unterscheidbar zu sein
const ACCESSIBLE_COLORS = {
  // Leer (sehr dunkel) - Helligkeit: ~25%
  empty: { bg: '#374151', text: '#9CA3AF', pattern: 'empty' },
  // Niedrig (grün) - Helligkeit: ~45%
  low: { bg: '#22C55E', text: '#FFFFFF', pattern: 'solid' },
  // Mittel (gelb-grün) - Helligkeit: ~65%
  medium: { bg: '#84CC16', text: '#1A1A1A', pattern: 'solid' },
  // Hoch (orange) - Helligkeit: ~75%
  high: { bg: '#F59E0B', text: '#1A1A1A', pattern: 'solid' },
  // Voll/Kritisch (rot) - Helligkeit: ~55%
  full: { bg: '#DC2626', text: '#FFFFFF', pattern: 'solid' },
  // Warnung (rot mit Muster)
  warning: { bg: '#EF4444', text: '#FFFFFF', pattern: 'warning' },
};

// Icons für Legende
const LEGEND_ICONS: Record<string, string> = {
  empty: 'cube-outline',
  low: 'checkmark-circle',
  medium: 'remove-circle',
  high: 'warning',
  full: 'close-circle',
  warning: 'alert-circle',
};

// ============================================================
// ANIMATED LOCATION COMPONENT
// ============================================================

interface AnimatedLocationProps {
  location: StorageLocation2D;
  isSelected: boolean;
  isHighlighted: boolean;
  isMultiSelected: boolean;
  zoomLevel: number;
  showLabels: boolean;
  showCapacity: boolean;
  compact: boolean;
  viewMode: 'normal' | 'heatmap';
  onPress: () => void;
  onLongPress: () => void;
  onHover: (id: string | null) => void;
}

function AnimatedLocation({
  location,
  isSelected,
  isHighlighted,
  isMultiSelected,
  zoomLevel,
  showLabels,
  showCapacity,
  compact,
  viewMode,
  onPress,
  onLongPress,
  onHover,
}: AnimatedLocationProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Pulsierender Glow für hervorgehobene Artikel
  useEffect(() => {
    if (isHighlighted) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(0);
    }
  }, [isHighlighted]);

  // Scale animation on selection
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isSelected || isMultiSelected ? 1.1 : 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [isSelected, isMultiSelected]);

  // Glow animation
  useEffect(() => {
    Animated.timing(glowAnim, {
      toValue: isHighlighted ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isHighlighted]);

  // Accessible Farbschema basierend auf Füllstand
  const getColorScheme = () => {
    if (viewMode === 'heatmap') {
      // Heatmap-Modus mit unterschiedlicher Helligkeit
      if (location.warning) return ACCESSIBLE_COLORS.warning;
      if (location.fillPercent === 0) return { ...ACCESSIBLE_COLORS.empty, bg: '#1F2937' };
      if (location.fillPercent < 25) return { ...ACCESSIBLE_COLORS.low, bg: '#16A34A' };
      if (location.fillPercent < 50) return ACCESSIBLE_COLORS.medium;
      if (location.fillPercent < 75) return ACCESSIBLE_COLORS.high;
      return ACCESSIBLE_COLORS.full;
    }
    // Normaler Modus
    if (location.warning) return ACCESSIBLE_COLORS.warning;
    if (location.fillPercent === 0) return ACCESSIBLE_COLORS.empty;
    if (location.fillPercent < 30) return ACCESSIBLE_COLORS.low;
    if (location.fillPercent < 60) return ACCESSIBLE_COLORS.medium;
    if (location.fillPercent < 80) return ACCESSIBLE_COLORS.high;
    return ACCESSIBLE_COLORS.full;
  };

  const scaledSize = TILE_SIZE * zoomLevel;
  const colorScheme = getColorScheme();

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  // Zeige Details erst bei ausreichendem Zoom
  const showDetails = zoomLevel >= 0.75;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: location.x * scaledSize,
        top: location.y * scaledSize,
        width: location.width * scaledSize,
        height: location.height * scaledSize,
        transform: [{ scale: scaleAnim }, { scale: pulseScale }],
      }}
    >
      {/* Glow Effect */}
      {isHighlighted && (
        <Animated.View
          style={{
            position: 'absolute',
            left: -4,
            top: -4,
            right: -4,
            bottom: -4,
            borderRadius: 12,
            backgroundColor: '#3B82F6',
            opacity: glowOpacity,
          }}
        />
      )}

      <TouchableOpacity
        style={[
          styles.location,
          {
            width: '100%',
            height: '100%',
            backgroundColor: colorScheme.bg,
            borderColor: isSelected ? '#3B82F6' : isMultiSelected ? '#8B5CF6' : location.warning ? '#EF4444' : 'rgba(255,255,255,0.2)',
            borderWidth: isSelected || isMultiSelected ? 3 : location.warning ? 2 : 1,
          },
        ]}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => onHover(location.id)}
        onPressOut={() => onHover(null)}
        activeOpacity={0.7}
      >
        {showLabels && showDetails && (
          <View style={styles.locationContent}>
            <Text style={[styles.locationCode, { color: colorScheme.text }]} numberOfLines={1}>
              {location.code}
            </Text>
            {showCapacity && !compact && (
              <Text style={[styles.locationPercent, { color: colorScheme.text }]}>
                {location.fillPercent}%
              </Text>
            )}
          </View>
        )}
        {/* Warnungs-Icon */}
        {location.warning && (
          <View style={styles.warningBadge}>
            <Ionicons name="alert-circle" size={12} color="#fff" />
          </View>
        )}
        {/* Artikel-Indikator */}
        {location.article && (
          <View style={styles.articleIndicator}>
            <Ionicons name="cube" size={10} color={colorScheme.text} />
          </View>
        )}
        {/* Multi-Select Badge */}
        {isMultiSelected && (
          <View style={styles.multiSelectBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#fff" />
          </View>
        )}
        {/* Pattern Overlay für Warnungen */}
        {location.warning && viewMode !== 'heatmap' && (
          <View style={styles.warningPattern} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ============================================================
// HAUPTKOMPONENTE
// ============================================================

export default function WarehouseVisualizer2D({
  zones,
  locations,
  onZonePress,
  onLocationPress,
  onMultiSelect,
  selectedLocationId,
  showLabels = true,
  showCapacity = true,
  compact = false,
  highlightArticleId = null,
}: Warehouse2DProps) {
  const { colors, isDark } = useTheme();
  const [hoveredLocation, setHoveredLocation] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'empty' | 'filled' | 'warning'>('all');
  const [viewMode, setViewMode] = useState<'normal' | 'heatmap'>('normal');
  const [detailModal, setDetailModal] = useState<StorageLocation2D | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());
  const scrollViewRef = useRef<ScrollView>(null);

  // Berechne Grid-Größe
  const gridBounds = useMemo(() => {
    if (zones.length === 0) return { width: 5, height: 5 };
    const maxX = Math.max(...zones.map(z => z.x + z.width));
    const maxY = Math.max(...zones.map(z => z.y + z.height));
    return {
      width: Math.max(maxX + 1, 5),
      height: Math.max(maxY + 1, 5),
    };
  }, [zones]);

  // Gefilterte Locations mit Artikel-Hervorhebung
  const filteredLocations = useMemo(() => {
    let filtered = locations;

    // Suchfilter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(loc =>
        loc.code.toLowerCase().includes(query) ||
        loc.name.toLowerCase().includes(query) ||
        loc.article?.name?.toLowerCase().includes(query) ||
        loc.article?.inventory_code?.toLowerCase().includes(query)
      );
    }

    // Status-Filter
    switch (filterMode) {
      case 'empty':
        filtered = filtered.filter(loc => loc.fillPercent === 0);
        break;
      case 'filled':
        filtered = filtered.filter(loc => loc.fillPercent > 0);
        break;
      case 'warning':
        filtered = filtered.filter(loc => loc.warning);
        break;
    }

    return filtered;
  }, [locations, searchQuery, filterMode]);

  // Hervorgehobene Artikel finden
  const highlightedLocations = useMemo(() => {
    if (!highlightArticleId && !searchQuery) return new Set<string>();
    const query = highlightArticleId?.toLowerCase() || searchQuery.toLowerCase();
    if (!query) return new Set<string>();

    const highlighted = new Set<string>();
    locations.forEach(loc => {
      if (loc.article?.inventory_code?.toLowerCase().includes(query) ||
          loc.article?.name?.toLowerCase().includes(query)) {
        highlighted.add(loc.id);
      }
    });
    return highlighted;
  }, [locations, highlightArticleId, searchQuery]);

  // Statistiken
  const stats = useMemo(() => {
    const total = locations.length;
    const empty = locations.filter(l => l.fillPercent === 0).length;
    const filled = locations.filter(l => l.fillPercent > 0).length;
    const warnings = locations.filter(l => l.warning).length;
    const avgFill = total > 0
      ? Math.round(locations.reduce((sum, l) => sum + l.fillPercent, 0) / total)
      : 0;
    return { total, empty, filled, warnings, avgFill };
  }, [locations]);

  // Heatmap-Statistiken
  const heatmapStats = useMemo(() => ({
    empty: locations.filter(l => l.fillPercent === 0).length,
    low: locations.filter(l => l.fillPercent > 0 && l.fillPercent < 25).length,
    medium: locations.filter(l => l.fillPercent >= 25 && l.fillPercent < 50).length,
    high: locations.filter(l => l.fillPercent >= 50 && l.fillPercent < 75).length,
    critical: locations.filter(l => l.fillPercent >= 75).length,
  }), [locations]);

  // Zoom-Funktionen
  const zoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 2));
  const zoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  const resetZoom = () => setZoomLevel(1);

  // Multi-Select Funktionen
  const toggleMultiSelect = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMultiSelectMode(prev => !prev);
    if (multiSelectMode) {
      setSelectedLocations(new Set());
    }
  };

  const toggleLocationSelection = (location: StorageLocation2D) => {
    if (!multiSelectMode) return;

    setSelectedLocations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(location.id)) {
        newSet.delete(location.id);
      } else {
        newSet.add(location.id);
      }
      return newSet;
    });
  };

  const handleLocationPress = (location: StorageLocation2D) => {
    if (multiSelectMode) {
      toggleLocationSelection(location);
    } else {
      onLocationPress?.(location);
      setDetailModal(location);
    }
  };

  const handleLongPress = (location: StorageLocation2D) => {
    if (!multiSelectMode) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMultiSelectMode(true);
      toggleLocationSelection(location);
    }
  };

  const confirmMultiSelect = () => {
    const selected = locations.filter(l => selectedLocations.has(l.id));
    onMultiSelect?.(selected);
    setMultiSelectMode(false);
    setSelectedLocations(new Set());
  };

  // Render Zone
  const renderZone = (zone: WarehouseZone) => {
    const zoneColor = zone.color || ZONE_COLORS[zone.type] || '#607D8B';
    const scaledSize = TILE_SIZE * zoomLevel;
    const zoneWidth = zone.width * scaledSize;
    const zoneHeight = zone.height * scaledSize;
    const left = zone.x * scaledSize;
    const top = zone.y * scaledSize;

    return (
      <TouchableOpacity
        key={zone.id}
        style={[
          styles.zone,
          {
            left,
            top,
            width: zoneWidth,
            height: zoneHeight,
            backgroundColor: zoneColor + '15',
            borderColor: zoneColor,
          },
        ]}
        onPress={() => onZonePress?.(zone)}
        activeOpacity={0.8}
      >
        <View style={[styles.zoneHeader, { backgroundColor: zoneColor + 'E6' }]}>
          <Ionicons name={ZONE_ICONS[zone.type] as any || 'cube-outline'} size={14} color="#fff" />
          <Text style={styles.zoneName}>{zone.name}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Grid-Hintergrund
  const renderGrid = () => {
    const scaledSize = TILE_SIZE * zoomLevel;
    const gridLines = [];

    for (let i = 0; i <= gridBounds.width; i++) {
      gridLines.push(
        <View
          key={`v-${i}`}
          style={[
            styles.gridLine,
            {
              left: i * scaledSize,
              height: gridBounds.height * scaledSize,
              backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(0,0,0,0.05)',
            },
          ]}
        />
      );
    }
    for (let i = 0; i <= gridBounds.height; i++) {
      gridLines.push(
        <View
          key={`h-${i}`}
          style={[
            styles.gridLineH,
            {
              top: i * scaledSize,
              width: gridBounds.width * scaledSize,
              backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(0,0,0,0.05)',
            },
          ]}
        />
      );
    }
    return gridLines;
  };

  // Koordinatenachsen
  const renderAxes = () => {
    const scaledSize = TILE_SIZE * zoomLevel;
    const xLabels = [];
    const yLabels = [];

    for (let i = 0; i <= gridBounds.width; i++) {
      xLabels.push(
        <Text
          key={`x-${i}`}
          style={[styles.axisLabel, { left: i * scaledSize + scaledSize / 2 - 8, color: colors.textSecondary }]}
        >
          {String.fromCharCode(65 + i)}
        </Text>
      );
    }
    for (let i = 0; i <= gridBounds.height; i++) {
      yLabels.push(
        <Text
          key={`y-${i}`}
          style={[styles.axisLabel, { top: i * scaledSize + scaledSize / 2 - 8, color: colors.textSecondary }]}
        >
          {i + 1}
        </Text>
      );
    }

    return (
      <>
        <View style={styles.xAxis}>{xLabels}</View>
        <View style={styles.yAxis}>{yLabels}</View>
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9' }]}>
      {/* Toolbar */}
      <View style={[styles.toolbar, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderBottomColor: colors.border }]}>
        {/* Search */}
        <View style={[styles.searchBox, { backgroundColor: isDark ? '#334155' : '#F1F5F9', borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Artikel/Code suchen..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* View Mode Toggle */}
        <TouchableOpacity
          style={[styles.viewModeBtn, viewMode === 'heatmap' && { backgroundColor: '#F59E0B' }]}
          onPress={() => setViewMode(prev => prev === 'normal' ? 'heatmap' : 'normal')}
        >
          <Ionicons
            name={viewMode === 'heatmap' ? 'flame' : 'grid-outline'}
            size={16}
            color={viewMode === 'heatmap' ? '#fff' : colors.text}
          />
        </TouchableOpacity>

        {/* Multi-Select Toggle */}
        <TouchableOpacity
          style={[styles.multiSelectBtn, multiSelectMode && { backgroundColor: '#8B5CF6' }]}
          onPress={toggleMultiSelect}
        >
          <Ionicons
            name={multiSelectMode ? 'checkmark-done' : 'checkmark-done-outline'}
            size={16}
            color={multiSelectMode ? '#fff' : colors.text}
          />
        </TouchableOpacity>

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, filterMode === 'all' && styles.filterChipActive, { borderColor: colors.border }]}
            onPress={() => setFilterMode('all')}
          >
            <Text style={[styles.filterChipText, { color: filterMode === 'all' ? '#fff' : colors.text }]}>
              Alle ({stats.total})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filterMode === 'empty' && { backgroundColor: '#22C55E' }]}
            onPress={() => setFilterMode('empty')}
          >
            <Text style={[styles.filterChipText, { color: filterMode === 'empty' ? '#fff' : colors.text }]}>
              Frei ({stats.empty})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filterMode === 'filled' && { backgroundColor: '#F59E0B' }]}
            onPress={() => setFilterMode('filled')}
          >
            <Text style={[styles.filterChipText, { color: filterMode === 'filled' ? '#fff' : colors.text }]}>
              Belegt ({stats.filled})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filterMode === 'warning' && { backgroundColor: '#EF4444' }]}
            onPress={() => setFilterMode('warning')}
          >
            <Text style={[styles.filterChipText, { color: filterMode === 'warning' ? '#fff' : colors.text }]}>
              ⚠️ ({stats.warnings})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Stats Bar */}
      <View style={[styles.statsBar, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
        {viewMode === 'normal' ? (
          <>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{stats.total}</Text>
              <Text style={styles.statLabel}>Plätze</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#22C55E' }]}>{stats.empty}</Text>
              <Text style={styles.statLabel}>Frei</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#F59E0B' }]}>{stats.filled}</Text>
              <Text style={styles.statLabel}>Belegt</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#3B82F6' }]}>{stats.avgFill}%</Text>
              <Text style={styles.statLabel}>Ø Füllung</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#1F2937' }]}>{heatmapStats.empty}</Text>
              <Text style={styles.statLabel}>Leer</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#22C55E' }]}>{heatmapStats.low}</Text>
              <Text style={styles.statLabel}>Niedrig</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#84CC16' }]}>{heatmapStats.medium}</Text>
              <Text style={styles.statLabel}>Mittel</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#F59E0B' }]}>{heatmapStats.high}</Text>
              <Text style={styles.statLabel}>Hoch</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#EF4444' }]}>{heatmapStats.critical}</Text>
              <Text style={styles.statLabel}>Kritisch</Text>
            </View>
          </>
        )}
      </View>

      {/* Legend mit Icons für bessere Lesbarkeit */}
      <View style={[styles.legendBar, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
        {viewMode === 'normal' ? (
          <>
            <View style={styles.legendPill}>
              <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
              <Text style={[styles.legendPillText, { color: isDark ? '#94A3B8' : '#64748B' }]}>Niedrig</Text>
            </View>
            <View style={styles.legendPill}>
              <Ionicons name="remove-circle" size={14} color="#84CC16" />
              <Text style={[styles.legendPillText, { color: isDark ? '#94A3B8' : '#64748B' }]}>Mittel</Text>
            </View>
            <View style={styles.legendPill}>
              <Ionicons name="warning" size={14} color="#F59E0B" />
              <Text style={[styles.legendPillText, { color: isDark ? '#94A3B8' : '#64748B' }]}>Hoch</Text>
            </View>
            <View style={styles.legendPill}>
              <Ionicons name="close-circle" size={14} color="#EF4444" />
              <Text style={[styles.legendPillText, { color: isDark ? '#94A3B8' : '#64748B' }]}>Voll</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.legendPill}>
              <View style={[styles.legendDot, { backgroundColor: '#1F2937' }]} />
              <Text style={[styles.legendPillText, { color: isDark ? '#94A3B8' : '#64748B' }]}>0%</Text>
            </View>
            <View style={styles.legendPill}>
              <Ionicons name="speedometer-outline" size={12} color="#22C55E" />
              <Text style={[styles.legendPillText, { color: isDark ? '#94A3B8' : '#64748B' }]}>1-24%</Text>
            </View>
            <View style={styles.legendPill}>
              <Ionicons name="speedometer" size={12} color="#84CC16" />
              <Text style={[styles.legendPillText, { color: isDark ? '#94A3B8' : '#64748B' }]}>25-49%</Text>
            </View>
            <View style={styles.legendPill}>
              <Ionicons name="speedometer" size={12} color="#F59E0B" />
              <Text style={[styles.legendPillText, { color: isDark ? '#94A3B8' : '#64748B' }]}>50-74%</Text>
            </View>
            <View style={styles.legendPill}>
              <Ionicons name="alert-circle" size={12} color="#EF4444" />
              <Text style={[styles.legendPillText, { color: isDark ? '#94A3B8' : '#64748B' }]}>75%+</Text>
            </View>
          </>
        )}
      </View>

      {/* Hauptgrid */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View
            style={[
              styles.gridContainer,
              {
                width: (gridBounds.width + 1) * TILE_SIZE * zoomLevel + 60,
                height: (gridBounds.height + 1) * TILE_SIZE * zoomLevel + 60,
              },
            ]}
          >
            {/* Hintergrund-Grid */}
            <View style={styles.gridLayer}>{renderGrid()}</View>

            {/* Zonen */}
            <View style={styles.zonesLayer}>
              {zones.map(renderZone)}
            </View>

            {/* Lagerplätze */}
            <View style={styles.locationsLayer}>
              {filteredLocations.map(location => (
                <AnimatedLocation
                  key={location.id}
                  location={location}
                  isSelected={selectedLocationId === location.id}
                  isHighlighted={highlightedLocations.has(location.id)}
                  isMultiSelected={selectedLocations.has(location.id)}
                  zoomLevel={zoomLevel}
                  showLabels={showLabels}
                  showCapacity={showCapacity}
                  compact={compact}
                  viewMode={viewMode}
                  onPress={() => handleLocationPress(location)}
                  onLongPress={() => handleLongPress(location)}
                  onHover={setHoveredLocation}
                />
              ))}
            </View>

            {/* Koordinaten */}
            {renderAxes()}
          </View>
        </ScrollView>
      </ScrollView>

      {/* Zoom Controls */}
      <View style={styles.zoomControls}>
        <TouchableOpacity style={[styles.zoomBtn, { backgroundColor: colors.card }]} onPress={zoomIn}>
          <Ionicons name="add" size={20} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.zoomBtn, { backgroundColor: colors.card }]} onPress={resetZoom}>
          <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>{Math.round(zoomLevel * 100)}%</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.zoomBtn, { backgroundColor: colors.card }]} onPress={zoomOut}>
          <Ionicons name="remove" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Multi-Select Action Bar */}
      {multiSelectMode && (
        <View style={[styles.multiSelectBar, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
          <Text style={[styles.multiSelectText, { color: colors.text }]}>
            {selectedLocations.size} ausgewählt
          </Text>
          <TouchableOpacity
            style={[styles.multiSelectAction, { backgroundColor: '#8B5CF6' }]}
            onPress={confirmMultiSelect}
          >
            <Ionicons name="checkmark" size={16} color="#fff" />
            <Text style={styles.multiSelectActionText}>Bestätigen</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.multiSelectAction, { backgroundColor: '#EF4444' }]}
            onPress={() => { setMultiSelectMode(false); setSelectedLocations(new Set()); }}
          >
            <Ionicons name="close" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Detail Modal */}
      <Modal
        visible={!!detailModal && !multiSelectMode}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailModal(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDetailModal(null)}>
          <Pressable style={[styles.detailModal, { backgroundColor: colors.card }]} onPress={() => {}}>
            {detailModal && (
              <>
                <View style={styles.detailHeader}>
                  <View style={[styles.detailIcon, { backgroundColor: detailModal.fillPercent > 50 ? '#F59E0B' : '#22C55E' }]}>
                    <Ionicons name="location" size={24} color="#fff" />
                  </View>
                  <View style={styles.detailHeaderText}>
                    <Text style={[styles.detailTitle, { color: colors.text }]}>{detailModal.code}</Text>
                    <Text style={[styles.detailSubtitle, { color: colors.textSecondary }]}>{detailModal.name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setDetailModal(null)}>
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.detailContent}>
                  {/* Fill Bar */}
                  <View style={styles.fillBarRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Füllstand</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{detailModal.fillPercent}%</Text>
                  </View>
                  <View style={[styles.fillBarBg, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
                    <View
                      style={[
                        styles.fillBarFill,
                        {
                          width: `${detailModal.fillPercent}%`,
                          backgroundColor: detailModal.fillPercent > 80 ? '#EF4444' : detailModal.fillPercent > 50 ? '#F59E0B' : '#22C55E'
                        }
                      ]}
                    />
                  </View>

                  {/* Capacity */}
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Kapazität</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{detailModal.capacity}</Text>
                  </View>

                  {/* Article Count */}
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Artikel</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{detailModal.articleCount}</Text>
                  </View>

                  {/* Article Info */}
                  {detailModal.article && (
                    <View style={[styles.articleCard, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}>
                      <Ionicons name="cube" size={20} color={colors.primary} />
                      <View style={styles.articleInfo}>
                        <Text style={[styles.articleName, { color: colors.text }]}>{detailModal.article.name}</Text>
                        <Text style={[styles.articleCode, { color: colors.textSecondary }]}>
                          {detailModal.article.inventory_code} · {detailModal.article.stock} Stk.
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Warning */}
                  {detailModal.warning && (
                    <View style={styles.warningCard}>
                      <Ionicons name="warning" size={20} color="#F59E0B" />
                      <Text style={styles.warningCardText}>Warnung aktiv für diesen Lagerplatz</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    maxWidth: 160,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  viewModeBtn: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  multiSelectBtn: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  filterScroll: {
    flex: 1,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 6,
  },
  filterChipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Stats
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Legend
  legendBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  legendPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // Grid
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 10,
  },
  gridContainer: {
    position: 'relative',
  },
  gridLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLine: {
    position: 'absolute',
    width: 1,
  },
  gridLineH: {
    position: 'absolute',
    height: 1,
  },

  // Zonen
  zonesLayer: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
  },
  zone: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  zoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 6,
  },
  zoneName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },

  // Locations
  locationsLayer: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
  },
  location: {
    borderRadius: 8,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationCode: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  locationPercent: {
    fontSize: 9,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.9,
  },
  warningBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EF4444',
    borderRadius: 6,
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  articleIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    opacity: 0.8,
  },
  multiSelectBadge: {
    position: 'absolute',
    top: 2,
    left: 2,
  },
  warningPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderRadius: 8,
    borderStyle: 'dashed',
  },

  // Achsen
  xAxis: {
    position: 'absolute',
    top: 0,
    left: 20,
    flexDirection: 'row',
  },
  yAxis: {
    position: 'absolute',
    top: 20,
    left: 0,
  },
  axisLabel: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: '600',
  },

  // Zoom Controls
  zoomControls: {
    position: 'absolute',
    right: 12,
    bottom: 20,
    flexDirection: 'column',
    gap: 4,
  },
  zoomBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },

  // Multi-Select Bar
  multiSelectBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  multiSelectText: {
    fontSize: 14,
    fontWeight: '600',
  },
  multiSelectAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  multiSelectActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  detailModal: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    overflow: 'hidden',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  detailIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeaderText: {
    flex: 1,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  detailSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  detailContent: {
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fillBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  fillBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fillBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  articleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  articleInfo: {
    flex: 1,
  },
  articleName: {
    fontSize: 14,
    fontWeight: '600',
  },
  articleCode: {
    fontSize: 12,
    marginTop: 2,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.15)',
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  warningCardText: {
    fontSize: 13,
    color: '#F59E0B',
    fontWeight: '500',
  },
});