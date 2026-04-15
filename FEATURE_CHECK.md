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
| Betriebsstunden | ❌ | Kein operating_hours Feld |
| Reparatur-Tickets | ✅ | MaintenanceTask mit Fotos |
| Defekt-Fotos | ✅ | before_images, after_images |

## 4. Berechnungs-Logik

| Feature | Status | Details |
|---------|--------|---------|
| Strombedarfs-Kalkulation | ❌ | Kein wattage Feld |
| Mietfaktoren | ⚠️ | Basis rental_price vorhanden |
| Mehrtages-Rabatt | ❌ | Keine Faktor-Logik |

## 5. Dokumente & Reporting

| Feature | Status | Endpoint |
|---------|--------|----------|
| Inventar-Report (JSON) | ✅ | /api/reports/inventory |
| Inventar-Report (CSV) | ✅ | /api/reports/inventory-csv |
| Inventar-Report (PDF) | ✅ | /api/reports/inventory-pdf |
| Kunden-Report | ✅ | /api/reports/customers |
| Monats-Report | ✅ | /api/reports/monthly |
| Packliste (sortiert) | ❌ | Nicht implementiert |
| Lademeter-Plan | ❌ | Nicht implementiert |
| Mietvertrag PDF | ❌ | Nicht implementiert |
| Rechnung PDF | ⚠️ | Invoice Model vorhanden |

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
- [ ] Mietfaktoren-Logik
- [ ] Rechnungs-PDF

### Phase 4 (Advanced) ⚠️ TEILWEISE
- [ ] Offline-Modus
- [x] Nachrichten-System
- [ ] Sub-Rental Tracking

---

## ZUSAMMENFASSUNG

| Bereich | Status | Prozent |
|---------|--------|---------|
| Tech-Stack | ✅ | 90% |
| Datenbank-Modelle | ✅ | 95% |
| Lager-Logistik | ✅ | 90% |
| Projektplanung | ⚠️ | 75% |
| Wartung/Service | ⚠️ | 80% |
| Berechnungen | ❌ | 30% |
| Dokumente | ⚠️ | 60% |
| **GESAMT** | ⚠️ | **~75%** |

## FEHLENDE FEATURES (Priorität)

### Hoch
1. Gewicht-Feld für Artikel (für Transport-Berechnung)
2. Leistung (Watt) Feld für Stromberechnung
3. Betriebsstunden-Tracking

### Mittel
4. Sub-Rental Modul
5. Mietfaktoren (Tagesfaktoren)
6. Packliste sortiert nach Lagerort

### Niedrig
7. Lademeter-Plan
8. Offline-Modus
9. Mietvertrag-PDF
