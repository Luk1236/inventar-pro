import 'react-native-gesture-handler';
import React from 'react';
import { View, Platform, StatusBar } from 'react-native';
import { Stack } from 'expo-router';
import { ThemeProvider } from '../contexts/ThemeContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from '../components/ErrorBoundary';

export default function RootLayout() {
  return (
    <ErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <View style={{
            flex: 1,
            paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
          }}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="articles/index" />
              <Stack.Screen name="articles/add" />
              <Stack.Screen name="articles/import" />
              <Stack.Screen name="articles/edit/[id]" />
              <Stack.Screen name="categories/index" />
              <Stack.Screen name="suppliers/index" />
              <Stack.Screen name="customers/index" />
              <Stack.Screen name="events/index" />
              <Stack.Screen name="bookings/index" />
              <Stack.Screen name="invoices/index" />
              <Stack.Screen name="storage/index" />
              <Stack.Screen name="storage/create" />
              <Stack.Screen name="storage/locations" />
              <Stack.Screen name="storage/shelves" />
              <Stack.Screen name="maintenance/index" />
              <Stack.Screen name="scanner/index" />
              <Stack.Screen name="qr-generator/index" />
              <Stack.Screen name="reports/index" />
              <Stack.Screen name="settings/index" />
              <Stack.Screen name="profile/index" />
              <Stack.Screen name="teams/index" />
              <Stack.Screen name="audit-log/index" />
              <Stack.Screen name="error-logs/index" />
              <Stack.Screen name="admin/users" />
              <Stack.Screen name="admin/backup" />
              <Stack.Screen name="admin/database" />
              <Stack.Screen name="install/index" />
              <Stack.Screen name="timeline/index" options={{ headerShown: false }} />
              <Stack.Screen name="crew-planning/index" />
              <Stack.Screen name="delivery/[id]" />
              <Stack.Screen name="security/index" />
              <Stack.Screen name="exports/index" />
              <Stack.Screen name="bundles/index" />
              <Stack.Screen name="conflicts/index" />
              <Stack.Screen name="quotes/index" />
              <Stack.Screen name="quotes/create" />
              <Stack.Screen name="quotes/public/[token]" options={{ headerShown: false }} />
              <Stack.Screen name="time-tracking/index" />
              <Stack.Screen name="time-tracking/create" />
              <Stack.Screen name="warehouse/index" options={{ headerShown: true, title: 'Lager 3D' }} />
              <Stack.Screen name="warehouse-3d/index" options={{ headerShown: false }} />
              <Stack.Screen name="vehicles/index" />
              <Stack.Screen name="tasks/index" />
              <Stack.Screen name="tasks/create" />
              <Stack.Screen name="absences/index" />
              <Stack.Screen name="absences/create" />
              <Stack.Screen name="stock-counts/index" />
              <Stack.Screen name="inspections/index" />
              <Stack.Screen name="serial-numbers/index" />
              <Stack.Screen name="customers/edit/[id]" />
              <Stack.Screen name="customers/create" />
              <Stack.Screen name="purchase-orders/index" />
              <Stack.Screen name="billing-queue/index" />
              <Stack.Screen name="job-board/index" />
              <Stack.Screen name="cross-docking/index" />
              <Stack.Screen name="tracking-log/index" />
              <Stack.Screen name="aktivitaeten/index" />
              <Stack.Screen name="communication-log/index" />
              <Stack.Screen name="sent-emails/index" />
              <Stack.Screen name="received-notes/index" />
              <Stack.Screen name="inspection-due/index" />
              <Stack.Screen name="lost-items/index" />
              <Stack.Screen name="archived-articles/index" />
              <Stack.Screen name="archived-locations/index" />
              <Stack.Screen name="crew-members/index" />
              <Stack.Screen name="rental-requests/index" />
              <Stack.Screen name="project-templates/index" />
              <Stack.Screen name="signature-settings/index" />
              <Stack.Screen name="custom-fields/index" />
              <Stack.Screen name="invitations/index" />
              <Stack.Screen name="invoice-settings/index" />
              <Stack.Screen name="invoices/public/[token]" options={{ headerShown: false }} />
              <Stack.Screen name="integrations/index" />
              <Stack.Screen name="articles/[id]" />
              <Stack.Screen name="events/create" />
              <Stack.Screen name="events/detail/[id]" />
              <Stack.Screen name="categories/create" />
              <Stack.Screen name="bom/index" />
              <Stack.Screen name="bom/create" />
              <Stack.Screen name="bom/detail/[id]" />
              <Stack.Screen name="messages/index" />
              <Stack.Screen name="messages/new" />
              <Stack.Screen name="messages/chat/[id]" />
              <Stack.Screen name="availability/index" />
              <Stack.Screen name="calendar/index" />
              <Stack.Screen name="movements/index" />
              <Stack.Screen name="movements/create" />
              <Stack.Screen name="packing-list/index" />
              <Stack.Screen name="rental-contracts/index" />
              <Stack.Screen name="sub-rentals/index" />
              <Stack.Screen name="repair-tickets/index" />
              <Stack.Screen name="search/index" />
              <Stack.Screen name="calculator/index" />
              <Stack.Screen name="catalog/index" />
              <Stack.Screen name="maintenance/create" />
              <Stack.Screen name="maintenance/checklists" />
              <Stack.Screen name="maintenance/records" />
              <Stack.Screen name="maintenance/task/[id]" />
              <Stack.Screen name="storage/movement/new" />
            </Stack>
          </View>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
