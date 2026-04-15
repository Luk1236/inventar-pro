#!/usr/bin/env python3
"""
Comprehensive Backend Health Check for Deployment Readiness
Inventory Management System - German Health Check
"""

import requests
import json
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import uuid
import os

# Configuration
BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:8000/api")
LOGIN_CREDENTIALS = {
    "username": os.environ.get("TEST_ADMIN_USER", "Admin"),
    "password": os.environ.get("TEST_ADMIN_PASSWORD", "")
}

class HealthChecker:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []
        self.deployment_ready = True
        self.critical_issues = []
        
    def log_result(self, endpoint: str, method: str, status: str, details: str = "", response_time: float = 0):
        """Log test result"""
        result = {
            "endpoint": endpoint,
            "method": method,
            "status": status,
            "details": details,
            "response_time": f"{response_time:.3f}s" if response_time else "N/A",
            "timestamp": datetime.now().strftime("%H:%M:%S")
        }
        self.test_results.append(result)
        
        if status == "❌ FEHLER":
            self.deployment_ready = False
            self.critical_issues.append(f"{method} {endpoint}: {details}")
            
        print(f"{status} {method} {endpoint} - {details} ({result['response_time']})")

    def authenticate(self) -> bool:
        """Authenticate and get JWT token"""
        print("🔐 AUTHENTIFIZIERUNG STARTEN...")
        try:
            start_time = datetime.now()
            response = self.session.post(
                f"{self.base_url}/login",
                json=LOGIN_CREDENTIALS,
                timeout=10
            )
            response_time = (datetime.now() - start_time).total_seconds()
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("access_token")
                if self.auth_token:
                    self.session.headers.update({
                        "Authorization": f"Bearer {self.auth_token}"
                    })
                    self.log_result("/login", "POST", "✅ OK", f"Token erhalten, Benutzer: {data.get('user', {}).get('username', 'Unknown')}", response_time)
                    return True
                else:
                    self.log_result("/login", "POST", "❌ FEHLER", "Kein Access Token in Antwort", response_time)
                    return False
            else:
                self.log_result("/login", "POST", "❌ FEHLER", f"HTTP {response.status_code}: {response.text[:100]}", response_time)
                return False
                
        except Exception as e:
            self.log_result("/login", "POST", "❌ FEHLER", f"Verbindungsfehler: {str(e)}", 0)
            return False

    def test_get_endpoint(self, endpoint: str, expected_fields: List[str] = None) -> bool:
        """Test GET endpoint"""
        try:
            start_time = datetime.now()
            response = self.session.get(f"{self.base_url}{endpoint}", timeout=10)
            response_time = (datetime.now() - start_time).total_seconds()
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if expected_fields:
                        missing_fields = [field for field in expected_fields if field not in data]
                        if missing_fields:
                            self.log_result(endpoint, "GET", "⚠️ WARNUNG", f"Fehlende Felder: {missing_fields}", response_time)
                            return True
                    
                    # Check if it's a list or dict and get count
                    if isinstance(data, list):
                        self.log_result(endpoint, "GET", "✅ OK", f"{len(data)} Einträge", response_time)
                    elif isinstance(data, dict):
                        self.log_result(endpoint, "GET", "✅ OK", f"Daten erhalten ({len(data)} Felder)", response_time)
                    else:
                        self.log_result(endpoint, "GET", "✅ OK", "Daten erhalten", response_time)
                    return True
                except json.JSONDecodeError:
                    self.log_result(endpoint, "GET", "❌ FEHLER", "Ungültige JSON-Antwort", response_time)
                    return False
            else:
                self.log_result(endpoint, "GET", "❌ FEHLER", f"HTTP {response.status_code}: {response.text[:100]}", response_time)
                return False
                
        except Exception as e:
            self.log_result(endpoint, "GET", "❌ FEHLER", f"Verbindungsfehler: {str(e)}", 0)
            return False

    def test_post_endpoint(self, endpoint: str, data: dict, expected_status: int = 200) -> Tuple[bool, dict]:
        """Test POST endpoint"""
        try:
            start_time = datetime.now()
            response = self.session.post(f"{self.base_url}{endpoint}", json=data, timeout=10)
            response_time = (datetime.now() - start_time).total_seconds()
            
            if response.status_code == expected_status:
                try:
                    response_data = response.json()
                    self.log_result(endpoint, "POST", "✅ OK", f"Erstellt: {response_data.get('id', 'ID nicht gefunden')}", response_time)
                    return True, response_data
                except json.JSONDecodeError:
                    self.log_result(endpoint, "POST", "✅ OK", "Erfolgreich erstellt", response_time)
                    return True, {}
            else:
                self.log_result(endpoint, "POST", "❌ FEHLER", f"HTTP {response.status_code}: {response.text[:100]}", response_time)
                return False, {}
                
        except Exception as e:
            self.log_result(endpoint, "POST", "❌ FEHLER", f"Verbindungsfehler: {str(e)}", 0)
            return False, {}

    def test_put_endpoint(self, endpoint: str, data: dict) -> bool:
        """Test PUT endpoint"""
        try:
            start_time = datetime.now()
            response = self.session.put(f"{self.base_url}{endpoint}", json=data, timeout=10)
            response_time = (datetime.now() - start_time).total_seconds()
            
            if response.status_code == 200:
                self.log_result(endpoint, "PUT", "✅ OK", "Erfolgreich aktualisiert", response_time)
                return True
            else:
                self.log_result(endpoint, "PUT", "❌ FEHLER", f"HTTP {response.status_code}: {response.text[:100]}", response_time)
                return False
                
        except Exception as e:
            self.log_result(endpoint, "PUT", "❌ FEHLER", f"Verbindungsfehler: {str(e)}", 0)
            return False

    def test_delete_endpoint(self, endpoint: str) -> bool:
        """Test DELETE endpoint"""
        try:
            start_time = datetime.now()
            response = self.session.delete(f"{self.base_url}{endpoint}", timeout=10)
            response_time = (datetime.now() - start_time).total_seconds()
            
            if response.status_code == 200:
                self.log_result(endpoint, "DELETE", "✅ OK", "Erfolgreich gelöscht", response_time)
                return True
            else:
                self.log_result(endpoint, "DELETE", "❌ FEHLER", f"HTTP {response.status_code}: {response.text[:100]}", response_time)
                return False
                
        except Exception as e:
            self.log_result(endpoint, "DELETE", "❌ FEHLER", f"Verbindungsfehler: {str(e)}", 0)
            return False

    def test_critical_get_endpoints(self):
        """Test all critical GET endpoints"""
        print("\n📊 KRITISCHE GET ENDPOINTS TESTEN...")
        
        endpoints = [
            ("/dashboard/stats", ["total_articles", "low_stock_articles", "maintenance_due"]),
            ("/articles", None),
            ("/categories", None),
            ("/suppliers", None),
            ("/storage-zones", None),
            ("/storage-locations", None),
            ("/customers", None),
            ("/teams", None),
            ("/invoices", None),
            ("/reports/inventory", None),
            ("/reports/customers", None),
        ]
        
        for endpoint, expected_fields in endpoints:
            self.test_get_endpoint(endpoint, expected_fields)

    def test_backup_system(self):
        """Test backup system"""
        print("\n💾 BACKUP-SYSTEM TESTEN...")
        
        # Test backup info
        self.test_get_endpoint("/admin/backup/info")
        
        # Test backup creation
        backup_success, backup_data = self.test_post_endpoint("/admin/backup/create", {})
        
        # Test backup list (alternative endpoint)
        self.test_get_endpoint("/backup/list")

    def test_article_crud(self):
        """Test complete CRUD operations for articles"""
        print("\n📦 ARTIKEL CRUD TESTEN...")
        
        # Create test article
        test_article = {
            "name": f"Test Artikel {datetime.now().strftime('%H%M%S')}",
            "description": "Test Artikel für Health Check",
            "inventory_code": f"TEST-{uuid.uuid4().hex[:8].upper()}",
            "base_unit": "Stück",
            "min_stock_level": 5,
            "price_per_unit": 99.99,
            "rental_price": 19.99
        }
        
        # CREATE
        create_success, article_data = self.test_post_endpoint("/articles", test_article, 200)
        
        if create_success and article_data.get("id"):
            article_id = article_data["id"]
            
            # UPDATE
            update_data = {
                **test_article,
                "name": f"Updated {test_article['name']}",
                "price_per_unit": 149.99
            }
            self.test_put_endpoint(f"/articles/{article_id}", update_data)
            
            # DELETE
            self.test_delete_endpoint(f"/articles/{article_id}")
        else:
            self.log_result("/articles/{id}", "PUT", "⏭️ ÜBERSPRUNGEN", "Artikel-Erstellung fehlgeschlagen", 0)
            self.log_result("/articles/{id}", "DELETE", "⏭️ ÜBERSPRUNGEN", "Artikel-Erstellung fehlgeschlagen", 0)

    def test_additional_endpoints(self):
        """Test additional important endpoints"""
        print("\n🔍 ZUSÄTZLICHE ENDPOINTS TESTEN...")
        
        # Test CSV endpoint separately (returns CSV, not JSON)
        try:
            start_time = datetime.now()
            response = self.session.get(f"{self.base_url}/reports/inventory-csv", timeout=10)
            response_time = (datetime.now() - start_time).total_seconds()
            
            if response.status_code == 200 and "Name,Inventory Code" in response.text:
                self.log_result("/reports/inventory-csv", "GET", "✅ OK", f"CSV-Export funktioniert ({len(response.text)} Zeichen)", response_time)
            else:
                self.log_result("/reports/inventory-csv", "GET", "❌ FEHLER", f"HTTP {response.status_code}: Ungültiger CSV-Inhalt", response_time)
        except Exception as e:
            self.log_result("/reports/inventory-csv", "GET", "❌ FEHLER", f"Verbindungsfehler: {str(e)}", 0)
        
        # Test other JSON endpoints
        json_endpoints = [
            "/maintenance/alerts",
            "/me",  # User profile
        ]
        
        for endpoint in json_endpoints:
            self.test_get_endpoint(endpoint)

    def run_health_check(self):
        """Run complete health check"""
        print("🏥 DEPLOYMENT HEALTH CHECK GESTARTET")
        print("=" * 60)
        print(f"Backend URL: {self.base_url}")
        print(f"Zeitpunkt: {datetime.now().strftime('%d.%m.%Y %H:%M:%S')}")
        print("=" * 60)
        
        # 1. Authentication
        if not self.authenticate():
            print("\n❌ KRITISCHER FEHLER: Authentifizierung fehlgeschlagen!")
            print("Deployment NICHT bereit!")
            return False
        
        # 2. Critical GET endpoints
        self.test_critical_get_endpoints()
        
        # 3. Backup system
        self.test_backup_system()
        
        # 4. Article CRUD
        self.test_article_crud()
        
        # 5. Additional endpoints
        self.test_additional_endpoints()
        
        return True

    def print_summary(self):
        """Print comprehensive summary"""
        print("\n" + "=" * 80)
        print("📋 DEPLOYMENT HEALTH CHECK ZUSAMMENFASSUNG")
        print("=" * 80)
        
        # Count results
        total_tests = len(self.test_results)
        successful_tests = len([r for r in self.test_results if r["status"] == "✅ OK"])
        warning_tests = len([r for r in self.test_results if r["status"] == "⚠️ WARNUNG"])
        failed_tests = len([r for r in self.test_results if r["status"] == "❌ FEHLER"])
        skipped_tests = len([r for r in self.test_results if r["status"] == "⏭️ ÜBERSPRUNGEN"])
        
        print(f"Gesamt Tests: {total_tests}")
        print(f"✅ Erfolgreich: {successful_tests}")
        print(f"⚠️ Warnungen: {warning_tests}")
        print(f"❌ Fehler: {failed_tests}")
        print(f"⏭️ Übersprungen: {skipped_tests}")
        
        # Detailed table
        print("\n📊 DETAILLIERTE ERGEBNISSE:")
        print("-" * 80)
        print(f"{'ENDPOINT':<35} {'METHOD':<8} {'STATUS':<12} {'DETAILS':<20}")
        print("-" * 80)
        
        for result in self.test_results:
            endpoint = result["endpoint"][:34]
            method = result["method"]
            status = result["status"]
            details = result["details"][:19] if result["details"] else ""
            print(f"{endpoint:<35} {method:<8} {status:<12} {details:<20}")
        
        # Deployment readiness
        print("\n" + "=" * 80)
        if self.deployment_ready:
            print("🟢 DEPLOYMENT-BEREITSCHAFT: JA")
            print("✅ System ist bereit für Deployment")
        else:
            print("🔴 DEPLOYMENT-BEREITSCHAFT: NEIN")
            print("❌ Kritische Probleme müssen behoben werden:")
            for issue in self.critical_issues:
                print(f"   • {issue}")
        
        print("=" * 80)
        
        # Success rate
        if total_tests > 0:
            success_rate = (successful_tests / total_tests) * 100
            print(f"📈 Erfolgsrate: {success_rate:.1f}%")
        
        print(f"🕐 Test abgeschlossen: {datetime.now().strftime('%d.%m.%Y %H:%M:%S')}")

def main():
    """Main function"""
    checker = HealthChecker()
    
    try:
        checker.run_health_check()
    except KeyboardInterrupt:
        print("\n⏹️ Health Check abgebrochen")
    except Exception as e:
        print(f"\n💥 Unerwarteter Fehler: {str(e)}")
        checker.deployment_ready = False
    finally:
        checker.print_summary()
    
    # Exit with appropriate code
    sys.exit(0 if checker.deployment_ready else 1)

if __name__ == "__main__":
    main()