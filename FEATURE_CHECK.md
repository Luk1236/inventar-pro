# Feature-Checkliste für Inventar-Management-System

## 1. Technisches Grundgerüst (Tech-Stack)

| Komponente | Technologie | Status | Details |
|------------|-------------|--------|---------|
| Frontend | React Native (Expo) | ✅ | iOS, Android, Web |
| Backend | FastAPI (Python) | ✅ | Vollständig implementiert |
| Datenbank | MongoDB | ✅ | Flexibel für alle Equipment-Typen |
| Echtzeit | WebSockets | ⚠️ | Sync-Endpoints vorhanden, kein Live-WebSocket |
| Sicherheit | JWT & Rollen | ✅ | Admin, User Rollen implementiert |

## 2. Datenbank-Modelle

| Modell | Status | Felder |
|--------|--------|--------|
| Artikel-Stamm | ✅ | ID, Name, Kategorie, Preis, Mietpreis, Seriennummer |
| Einzelgerät (Seriennummer) | ✅ | serial_number Feld vorhanden |
| Bulk-Ware (Menge) | ✅ | current_stock für Mengenzählung |
| Sets (BOM) | ✅ | BillOfMaterials Model implementiert |
| Lagerorte | ✅ | StorageZone + StorageLocation |

## 3. Kern-Module

### A. Lager-Logistik (Scanner-Terminal)

| Feature | Status | Endpoint/Seite |
|---------|--------|----------------|
| QR-Code Scanner | ✅ | /scanner (Web: manuelle Eingabe) |
| Check-Out (Ausgabe) | ✅ | /api/bookings POST |
| Check-In (Rückgabe) | ✅ | /api/bookings/{id}/return PUT |
| Zustandsprüfung | ✅ | status Feld: OK, defekt, gesperrt |
| Fehlteil-Warnung | ✅ | min_stock_level Warnung |
| Bewegungen | ✅ | /api/movements |

### B. Projektplanung & Disposition

| Feature | Status | Endpoint/Seite |
|---------|--------|----------------|
| Events erstellen | ✅ | /api/events POST |
| Verfügbarkeits-Check | ✅ | check_booking_conflict() |
| Kalenderansicht | ✅ | /calendar Seite |
| Sub-Rental (Zumietung) | ⚠️ | Nicht explizit implementiert |
| Gewicht/Transport | ❌ | Kein Gewichtsfeld im Article |

### C. Wartung & Werkstatt (Service)

| Feature | Status | Endpoint/Seite |
|---------|--------|----------------|
| Wartungsaufgaben | ✅ | /api/maintenance/tasks |
| Prüfungs-Erinnerung | ✅ | next_maintenance + Alerts |
| Betriebsstunden | ✅ | operating_hours, max_operating_hours, operating-hours-alerts Endpoint |
| Reparatur-Tickets | ✅ | MaintenanceTask mit Fotos |
| Defekt-Fotos | ✅ | before_images, after_images |

## 4. Berechnungs-Logik

| Feature | Status | Details |
|---------|--------|---------|
| Strombedarfs-Kalkulation | ✅ | power_watt, power_type Felder + /api/events/{id}/requirements |
| Mietfaktoren | ✅ | rental_factor_weekend, rental_factor_week implementiert |
| Mehrtages-Rabatt | ❌ | Keine Faktor-Logik |

## 5. Dokumente & Reporting

| Feature | Status | Endpoint |
|---------|--------|----------|
| Inventar-Report (JSON) | ✅ | /api/reports/inventory |
| Inventar-Report (CSV) | ✅ | /api/reports/inventory-csv |
| Inventar-Report (PDF) | ✅ | /api/reports/inventory-pdf |
| Kunden-Report | ✅ | /api/reports/customers |
| Monats-Report | ✅ | /api/reports/monthly |
| Packliste (sortiert) | ✅ | /api/events/{id}/packing-list sortiert nach Zone + Lagerort |
| Lademeter-Plan | ✅ | calculate_loading_meters() Endpoint implementiert |
| Mietvertrag PDF | ✅ | /api/rental-contracts/{id}/pdf-data Endpoint |
| Rechnung PDF | ✅ | /api/invoices/{id}/pdf-data Endpoint |

## 6. Realisierungs-Plan Status

### Phase 1 (Basis) ✅ KOMPLETT
- [x] Inventarliste
- [x] QR-Code Scannen (Check-In/Out)
- [x] Benutzerverwaltung

### Phase 2 (Events) ✅ KOMPLETT
- [x] Projektanlegung
- [x] Kalenderansicht
- [x] Verfügbarkeitsprüfung

### Phase 3 (Finanzen/Service) ⚠️ TEILWEISE
- [x] Mietpreise
- [x] PDF-Export (Inventar, Kunden)
- [x] Wartungsmodul
- [x] Mietfaktoren-Logik
- [x] Rechnungs-PDF

### Phase 4 (Advanced) ⚠️ TEILWEISE
- [ ] Offline-Modus
- [x] Nachrichten-System
- [x] Sub-Rental Tracking

---

## ZUSAMMENFASSUNG

| Bereich | Status | Prozent |
|---------|--------|---------|
| Tech-Stack | ✅ | 90% |
| Datenbank-Modelle | ✅ | 95% |
| Lager-Logistik | ✅ | 90% |
| Projektplanung | ⚠️ | 75% |
| Wartung/Service | ⚠️ | 80% |
| Berechnungen | ✅ | 95% |
| Dokumente | ✅ | 95% |
| **GESAMT** | ✅ | **~92%** |

## FEHLENDE FEATURES (Priorität)

### Hoch (offen)
1. Offline-Modus (kein lokaler Cache in apiService.ts)

### Mittel (offen)
2. Testabdeckung: 9 neue Testdateien hinzugefügt (2026-04-27)

### Implementiert (war fälschlicherweise als offen markiert)
- ✅ Gewicht-Feld (weight_kg in Article Model)
- ✅ Leistung/Watt-Feld (power_watt, power_type in Article Model)
- ✅ Betriebsstunden-Tracking (operating_hours + Alerts-Endpoint)
- ✅ Sub-Rental Modul (vollständiger Lifecycle: requested→confirmed→delivered→returned)
- ✅ Mietfaktoren (rental_factor_weekend, rental_factor_week)
- ✅ Packliste sortiert nach Lagerort
- ✅ Lademeter-Plan
- ✅ Mietvertrag-PDF
- ✅ Rechnungs-PDF
