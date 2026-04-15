#!/usr/bin/env python3
"""
Comprehensive End-to-End Test for Inventory Management System
Following the German review request exactly
"""

import requests
import json
import sys
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class InventorySystemTester:
    def __init__(self):
        self.base_url = "https://bundle-export-pro.preview.emergentagent.com/api"
        self.token = None
        self.headers = {"Content-Type": "application/json"}
        self.test_results = []
        self.created_items = {}
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if response_data and not success:
            print(f"   Response: {response_data}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response": response_data if not success else None
        })
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{self.base_url}{endpoint}"
        headers = self.headers.copy()
        
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, headers=headers, json=data, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, headers=headers, json=data, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                return False, f"Unsupported method: {method}", 0
            
            try:
                response_data = response.json()
            except:
                response_data = response.text
            
            return response.status_code < 400, response_data, response.status_code
            
        except requests.exceptions.RequestException as e:
            return False, f"Request failed: {str(e)}", 0

    def test_1_authentication(self):
        """1. Authentifizierung - POST /api/auth/login"""
        print("🔐 1. AUTHENTIFIZIERUNG")
        print("=" * 50)
        
        # Test login with Admin credentials (actual working credentials)
        login_data = {
            "username": "Admin",
            "password": "YNwJT56G"
        }
        
        success, response, status_code = self.make_request("POST", "/login", login_data)
        
        if success and "access_token" in response:
            self.token = response["access_token"]
            self.headers["Authorization"] = f"Bearer {self.token}"
            self.log_test("POST /api/login", True, f"Login erfolgreich, Token erhalten")
            
            # Test /me endpoint (corrected from /users/me)
            success, response, status_code = self.make_request("GET", "/me")
            if success:
                self.log_test("GET /api/me", True, f"Benutzerinfo abgerufen: {response.get('username', 'N/A')}")
            else:
                self.log_test("GET /api/me", False, f"Fehler beim Abrufen der Benutzerinfo", response)
        else:
            self.log_test("POST /api/login", False, f"Login fehlgeschlagen (Status: {status_code})", response)
            return False
        
        return True

    def test_2_dashboard(self):
        """2. Dashboard - GET /api/dashboard/stats"""
        print("📊 2. DASHBOARD")
        print("=" * 50)
        
        success, response, status_code = self.make_request("GET", "/dashboard/stats")
        if success:
            stats = response
            required_fields = ["total_articles", "low_stock_articles", "maintenance_due", "movements_today"]
            missing_fields = [field for field in required_fields if field not in stats]
            
            if missing_fields:
                self.log_test("GET /api/dashboard/stats", False, f"Fehlende Felder: {missing_fields}", response)
            else:
                self.log_test("GET /api/dashboard/stats", True, f"Dashboard-Statistiken erfolgreich abgerufen")
        else:
            self.log_test("GET /api/dashboard/stats", False, f"Fehler (Status: {status_code})", response)

    def test_3_articles(self):
        """3. Artikel (Articles) - Alle CRUD-Operationen"""
        print("📦 3. ARTIKEL (ARTICLES)")
        print("=" * 50)
        
        # GET /api/articles - Alle Artikel laden
        success, response, status_code = self.make_request("GET", "/articles")
        if success:
            self.log_test("GET /api/articles", True, f"{len(response)} Artikel abgerufen")
        else:
            self.log_test("GET /api/articles", False, f"Fehler (Status: {status_code})", response)
        
        # POST /api/articles - Neuen Artikel erstellen
        article_data = {
            "name": "Test Mikrofon Shure SM58",
            "description": "Professionelles dynamisches Mikrofon für Live-Auftritte",
            "inventory_code": f"MIC-TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "base_unit": "Stück",
            "min_stock_level": 2,
            "price_per_unit": 150.00,
            "rental_price": 25.00
        }
        
        success, response, status_code = self.make_request("POST", "/articles", article_data)
        if success and "id" in response:
            article_id = response["id"]
            self.created_items["article"] = article_id
            self.log_test("POST /api/articles", True, f"Artikel erstellt mit ID: {article_id}")
            
            # PUT /api/articles/{id} - Artikel bearbeiten
            update_data = article_data.copy()
            update_data["name"] = "Test Mikrofon Shure SM58 - Aktualisiert"
            update_data["price_per_unit"] = 160.00
            
            success, response, status_code = self.make_request("PUT", f"/articles/{article_id}", update_data)
            if success:
                self.log_test("PUT /api/articles/{id}", True, "Artikel erfolgreich aktualisiert")
            else:
                self.log_test("PUT /api/articles/{id}", False, f"Fehler (Status: {status_code})", response)
            
            # DELETE /api/articles/{id} wird am Ende getestet
            
        else:
            self.log_test("POST /api/articles", False, f"Fehler (Status: {status_code})", response)

    def test_4_categories(self):
        """4. Kategorien - Alle CRUD-Operationen"""
        print("🏷️ 4. KATEGORIEN")
        print("=" * 50)
        
        # GET /api/categories
        success, response, status_code = self.make_request("GET", "/categories")
        if success:
            self.log_test("GET /api/categories", True, f"{len(response)} Kategorien abgerufen")
        else:
            self.log_test("GET /api/categories", False, f"Fehler (Status: {status_code})", response)
        
        # POST /api/categories
        category_data = {
            "name": "Test Audio Equipment",
            "description": "Test-Kategorie für Audio-Equipment"
        }
        
        success, response, status_code = self.make_request("POST", "/categories", category_data)
        if success and "id" in response:
            category_id = response["id"]
            self.created_items["category"] = category_id
            self.log_test("POST /api/categories", True, f"Kategorie erstellt mit ID: {category_id}")
            
            # PUT /api/categories/{id}
            update_data = category_data.copy()
            update_data["name"] = "Test Audio Equipment - Aktualisiert"
            
            success, response, status_code = self.make_request("PUT", f"/categories/{category_id}", update_data)
            if success:
                self.log_test("PUT /api/categories/{id}", True, "Kategorie erfolgreich aktualisiert")
            else:
                self.log_test("PUT /api/categories/{id}", False, f"Fehler (Status: {status_code})", response)
            
            # DELETE /api/categories/{id} wird am Ende getestet
            
        else:
            self.log_test("POST /api/categories", False, f"Fehler (Status: {status_code})", response)

    def test_5_suppliers(self):
        """5. Lieferanten - Alle CRUD-Operationen"""
        print("🏢 5. LIEFERANTEN")
        print("=" * 50)
        
        # GET /api/suppliers
        success, response, status_code = self.make_request("GET", "/suppliers")
        if success:
            self.log_test("GET /api/suppliers", True, f"{len(response)} Lieferanten abgerufen")
        else:
            self.log_test("GET /api/suppliers", False, f"Fehler (Status: {status_code})", response)
        
        # POST /api/suppliers
        supplier_data = {
            "name": "Test Audio GmbH",
            "contact_person": "Max Mustermann",
            "email": "max@testaudio.de",
            "phone": "+49 123 456789",
            "address": "Teststraße 123, 12345 Berlin",
            "website": "https://www.testaudio.de",
            "notes": "Zuverlässiger Lieferant für Audiotechnik"
        }
        
        success, response, status_code = self.make_request("POST", "/suppliers", supplier_data)
        if success and "id" in response:
            supplier_id = response["id"]
            self.created_items["supplier"] = supplier_id
            self.log_test("POST /api/suppliers", True, f"Lieferant erstellt mit ID: {supplier_id}")
            
            # PUT /api/suppliers/{id}
            update_data = supplier_data.copy()
            update_data["contact_person"] = "Maria Musterfrau"
            update_data["phone"] = "+49 123 456790"
            
            success, response, status_code = self.make_request("PUT", f"/suppliers/{supplier_id}", update_data)
            if success:
                self.log_test("PUT /api/suppliers/{id}", True, "Lieferant erfolgreich aktualisiert")
            else:
                self.log_test("PUT /api/suppliers/{id}", False, f"Fehler (Status: {status_code})", response)
            
            # DELETE /api/suppliers/{id} wird am Ende getestet
            
        else:
            self.log_test("POST /api/suppliers", False, f"Fehler (Status: {status_code})", response)

    def test_6_storage(self):
        """6. Lagerorte - Storage Zones und Locations"""
        print("🏪 6. LAGERORTE")
        print("=" * 50)
        
        # GET /api/storage-zones
        success, response, status_code = self.make_request("GET", "/storage-zones")
        if success:
            self.log_test("GET /api/storage-zones", True, f"{len(response)} Lagerzonen abgerufen")
        else:
            self.log_test("GET /api/storage-zones", False, f"Fehler (Status: {status_code})", response)
        
        # POST /api/storage-zones
        zone_data = {
            "name": "Test Lager A",
            "type": "Innenlager",
            "description": "Test Innenlager für Equipment"
        }
        
        success, response, status_code = self.make_request("POST", "/storage-zones", zone_data)
        if success and "id" in response:
            zone_id = response["id"]
            self.created_items["storage_zone"] = zone_id
            self.log_test("POST /api/storage-zones", True, f"Lagerzone erstellt mit ID: {zone_id}")
            
            # GET /api/storage-locations
            success, response, status_code = self.make_request("GET", "/storage-locations")
            if success:
                self.log_test("GET /api/storage-locations", True, f"{len(response)} Lagerorte abgerufen")
            else:
                self.log_test("GET /api/storage-locations", False, f"Fehler (Status: {status_code})", response)
            
            # POST /api/storage-locations
            location_data = {
                "zone_id": zone_id,
                "name": "Regal-1-A",
                "type": "Regal",
                "capacity": 50
            }
            
            success, response, status_code = self.make_request("POST", "/storage-locations", location_data)
            if success and "id" in response:
                location_id = response["id"]
                self.created_items["storage_location"] = location_id
                self.log_test("POST /api/storage-locations", True, f"Lagerort erstellt mit ID: {location_id}")
                
                # PUT /api/storage-locations/{id}
                update_data = location_data.copy()
                update_data["name"] = "Regal-1-A-Aktualisiert"
                update_data["capacity"] = 60
                
                success, response, status_code = self.make_request("PUT", f"/storage-locations/{location_id}", update_data)
                if success:
                    self.log_test("PUT /api/storage-locations/{id}", True, "Lagerort erfolgreich aktualisiert")
                else:
                    self.log_test("PUT /api/storage-locations/{id}", False, f"Fehler (Status: {status_code})", response)
                
                # DELETE /api/storage-locations/{id} wird am Ende getestet
                
            else:
                self.log_test("POST /api/storage-locations", False, f"Fehler (Status: {status_code})", response)
            
        else:
            self.log_test("POST /api/storage-zones", False, f"Fehler (Status: {status_code})", response)

    def test_7_customers(self):
        """7. Kunden"""
        print("👥 7. KUNDEN")
        print("=" * 50)
        
        # GET /api/customers
        success, response, status_code = self.make_request("GET", "/customers")
        if success:
            self.log_test("GET /api/customers", True, f"{len(response)} Kunden abgerufen")
        else:
            self.log_test("GET /api/customers", False, f"Fehler (Status: {status_code})", response)
        
        # POST /api/customers
        customer_data = {
            "company_name": "Test Event GmbH",
            "contact_person": "Anna Beispiel",
            "phone": "+49 987 654321",
            "email": "anna@testevent.de",
            "address_street": "Eventstraße 456",
            "address_zip": "54321",
            "address_city": "München",
            "address_country": "Deutschland",
            "payment_terms": "14 Tage netto",
            "notes": "Wichtiger Stammkunde"
        }
        
        success, response, status_code = self.make_request("POST", "/customers", customer_data)
        if success and "id" in response:
            customer_id = response["id"]
            self.created_items["customer"] = customer_id
            self.log_test("POST /api/customers", True, f"Kunde erstellt mit ID: {customer_id}")
        else:
            self.log_test("POST /api/customers", False, f"Fehler (Status: {status_code})", response)

    def test_8_teams(self):
        """8. Teams"""
        print("👨‍👩‍👧‍👦 8. TEAMS")
        print("=" * 50)
        
        # GET /api/teams
        success, response, status_code = self.make_request("GET", "/teams")
        if success:
            self.log_test("GET /api/teams", True, f"{len(response)} Teams abgerufen")
        else:
            self.log_test("GET /api/teams", False, f"Fehler (Status: {status_code})", response)
        
        # POST /api/teams
        team_data = {
            "name": "Test Audio Team",
            "description": "Team für Audiotechnik Events",
            "members": []
        }
        
        success, response, status_code = self.make_request("POST", "/teams", team_data)
        if success and "id" in response:
            team_id = response["id"]
            self.created_items["team"] = team_id
            self.log_test("POST /api/teams", True, f"Team erstellt mit ID: {team_id}")
        else:
            self.log_test("POST /api/teams", False, f"Fehler (Status: {status_code})", response)

    def test_9_invoices(self):
        """9. Rechnungen"""
        print("🧾 9. RECHNUNGEN")
        print("=" * 50)
        
        # GET /api/invoices
        success, response, status_code = self.make_request("GET", "/invoices")
        if success:
            self.log_test("GET /api/invoices", True, f"{len(response)} Rechnungen abgerufen")
        else:
            self.log_test("GET /api/invoices", False, f"Fehler (Status: {status_code})", response)

    def test_10_reports(self):
        """10. Reports"""
        print("📈 10. REPORTS")
        print("=" * 50)
        
        # GET /api/reports/inventory
        success, response, status_code = self.make_request("GET", "/reports/inventory")
        if success:
            self.log_test("GET /api/reports/inventory", True, "Inventar-Report erfolgreich abgerufen")
        else:
            self.log_test("GET /api/reports/inventory", False, f"Fehler (Status: {status_code})", response)
        
        # GET /api/reports/customers
        success, response, status_code = self.make_request("GET", "/reports/customers")
        if success:
            self.log_test("GET /api/reports/customers", True, "Kunden-Report erfolgreich abgerufen")
        else:
            self.log_test("GET /api/reports/customers", False, f"Fehler (Status: {status_code})", response)

    def test_11_backup(self):
        """11. BACKUP (WICHTIG - gründlich testen)"""
        print("💾 11. BACKUP (KRITISCH)")
        print("=" * 50)
        
        # POST /api/backup/create - Backup erstellen
        success, response, status_code = self.make_request("POST", "/backup/create")
        if success:
            self.log_test("POST /api/backup/create", True, "Backup erfolgreich erstellt")
        else:
            self.log_test("POST /api/backup/create", False, f"Fehler (Status: {status_code})", response)
        
        # GET /api/backup/list - Alle Backups auflisten
        success, response, status_code = self.make_request("GET", "/backup/list")
        if success:
            backup_count = len(response) if isinstance(response, list) else "N/A"
            self.log_test("GET /api/backup/list", True, f"Backup-Liste abgerufen mit {backup_count} Einträgen")
        else:
            self.log_test("GET /api/backup/list", False, f"Fehler (Status: {status_code})", response)

    def test_12_admin_functions(self):
        """12. Admin-Funktionen"""
        print("⚙️ 12. ADMIN-FUNKTIONEN")
        print("=" * 50)
        
        # GET /api/users - Benutzer laden (korrigierter Endpoint)
        success, response, status_code = self.make_request("GET", "/users/all")
        if success:
            self.log_test("GET /api/users", True, f"{len(response)} Benutzer abgerufen")
        else:
            self.log_test("GET /api/users", False, f"Fehler (Status: {status_code})", response)
        
        # POST /api/admin/reset-database - NUR PRÜFEN ob Endpoint existiert
        success, response, status_code = self.make_request("GET", "/admin/reset-database")
        if status_code == 405:  # Method not allowed bedeutet Endpoint existiert
            self.log_test("POST /api/admin/reset-database (Endpoint-Check)", True, "Endpoint existiert (nicht ausgeführt aus Sicherheitsgründen)")
        elif status_code == 404:
            self.log_test("POST /api/admin/reset-database (Endpoint-Check)", False, "Endpoint nicht gefunden", response)
        else:
            self.log_test("POST /api/admin/reset-database (Endpoint-Check)", True, f"Endpoint existiert (Status: {status_code})")

    def cleanup_created_items(self):
        """Aufräumen der erstellten Test-Items"""
        print("🧹 AUFRÄUMEN DER ERSTELLTEN TEST-ITEMS")
        print("=" * 50)
        
        # Löschen in umgekehrter Reihenfolge der Abhängigkeiten
        cleanup_order = ["storage_location", "storage_zone", "article", "category", "supplier", "customer", "team"]
        
        for item_type in cleanup_order:
            if item_type in self.created_items:
                item_id = self.created_items[item_type]
                endpoint_map = {
                    "article": "/articles",
                    "category": "/categories", 
                    "supplier": "/suppliers",
                    "storage_zone": "/storage-zones",
                    "storage_location": "/storage-locations",
                    "customer": "/customers",
                    "team": "/teams"
                }
                
                if item_type in endpoint_map:
                    success, response, status_code = self.make_request("DELETE", f"{endpoint_map[item_type]}/{item_id}")
                    if success:
                        self.log_test(f"DELETE {endpoint_map[item_type]}/{item_id}", True, f"{item_type} erfolgreich gelöscht")
                    else:
                        self.log_test(f"DELETE {endpoint_map[item_type]}/{item_id}", False, f"Fehler beim Löschen von {item_type}", response)

    def print_summary(self):
        """Test-Zusammenfassung drucken"""
        print("\n" + "=" * 80)
        print("🎯 TEST-ZUSAMMENFASSUNG")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Gesamte Tests: {total_tests}")
        print(f"✅ Bestanden: {passed_tests}")
        print(f"❌ Fehlgeschlagen: {failed_tests}")
        print(f"Erfolgsrate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print(f"\n🚨 FEHLGESCHLAGENE TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   ❌ {result['test']}: {result['details']}")
        
        print("\n" + "=" * 80)
        
        return failed_tests == 0

    def run_all_tests(self):
        """Alle Tests in der angegebenen Reihenfolge ausführen"""
        print("🚀 VOLLSTÄNDIGER END-TO-END-TEST DER INVENTAR-APP")
        print("=" * 80)
        print(f"Backend URL: {self.base_url}")
        print(f"Test-Zeit: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80)
        
        # Authentifizierung ist erforderlich
        if not self.test_1_authentication():
            print("❌ Authentifizierung fehlgeschlagen - kann nicht mit anderen Tests fortfahren")
            return False
        
        # Alle anderen Tests ausführen
        self.test_2_dashboard()
        self.test_3_articles()
        self.test_4_categories()
        self.test_5_suppliers()
        self.test_6_storage()
        self.test_7_customers()
        self.test_8_teams()
        self.test_9_invoices()
        self.test_10_reports()
        self.test_11_backup()
        self.test_12_admin_functions()
        
        # Aufräumen
        self.cleanup_created_items()
        
        # Zusammenfassung drucken
        return self.print_summary()

def main():
    """Hauptfunktion"""
    print("Starte vollständigen End-to-End-Test der Inventar-App...")
    
    # Tester erstellen und Tests ausführen
    tester = InventorySystemTester()
    success = tester.run_all_tests()
    
    # Mit entsprechendem Code beenden
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()