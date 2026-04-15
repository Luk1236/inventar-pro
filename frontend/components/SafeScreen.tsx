import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useTheme } from '../contexts/ThemeContext';

interface SafeScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  backgroundColor?: string;
  statusBarStyle?: 'light' | 'dark' | 'auto';
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

/**
 * SafeScreen - Wrapper component that handles safe areas on all devices
 * Use this component to wrap all screen content
 */
export function SafeScreen({
  children,
  style,
  backgroundColor,
  statusBarStyle,
  edges = ['top', 'bottom']
}: SafeScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const resolvedBackground = backgroundColor ?? colors.background;
  const resolvedStatusBarStyle = statusBarStyle ?? (isDark ? 'light' : 'dark');

  const paddingStyle: ViewStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  return (
    <View style={[styles.container, { backgroundColor: resolvedBackground }, paddingStyle, style]}>
      <ExpoStatusBar style={resolvedStatusBarStyle} />
      {children}
    </View>
  );
}

/**
 * Hook to get safe area values for custom implementations
 */
export function useSafeArea() {
  const insets = useSafeAreaInsets();
  return {
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
    // Common padding values
    paddingTop: insets.top,
    paddingBottom: insets.bottom + 20, // Extra padding for scroll content
    contentContainerStyle: {
      paddingBottom: insets.bottom + 20,
    },
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default SafeScreen;
