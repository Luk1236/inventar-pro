#!/usr/bin/env python3
"""
Focused Backend Testing for Recent Changes - Pre-deployment
Testing specific endpoints mentioned in the review request
"""

import requests
import json
import sys
from datetime import datetime, timedelta
import os

# Configuration
BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:8000/api")
ADMIN_USERNAME = os.environ.get("TEST_ADMIN_USER", "Admin")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "")

class FocusedTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []
        self.created_entities = {
            'categories': [],
            'suppliers': [],
            'storage_zones': [],
            'storage_locations': [],
            'articles': []
        }
    
    def log_result(self, test_name: str, success: bool, details: str = "", response_data: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if not success and response_data:
            print(f"   Response: {response_data}")
        
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details
        })
    
    def make_request(self, method: str, endpoint: str, data: dict = None) -> requests.Response:
        """Make authenticated API request"""
        url = f"{BASE_URL}{endpoint}"
        headers = {}
        
        if self.auth_token:
            headers['Authorization'] = f"Bearer {self.auth_token}"
        
        if data:
            headers['Content-Type'] = 'application/json'
            data = json.dumps(data)
        
        try:
            response = self.session.request(method, url, data=data, headers=headers, timeout=30)
            return response
        except Exception as e:
            print(f"Request failed: {e}")
            return None
    
    def authenticate(self):
        """Authenticate and get token"""
        print("🔐 AUTHENTICATING...")
        
        login_data = {
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        }
        
        response = self.make_request("POST", "/login", login_data)
        if response and response.status_code == 200:
            data = response.json()
            self.auth_token = data.get('access_token')
            self.log_result("Authentication", True, f"Logged in as {data.get('user', {}).get('username')}")
            return True
        else:
            error_msg = response.text if response else "No response"
            self.log_result("Authentication", False, f"Status: {response.status_code if response else 'None'}", error_msg)
            return False
    
    def test_authentication_endpoints(self):
        """Test authentication endpoints as specified in review"""
        print("\n🔐 TESTING AUTHENTICATION ENDPOINTS")
        
        # Test POST /api/login
        login_data = {
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        }
        
        response = self.make_request("POST", "/login", login_data)
        if response and response.status_code == 200:
            data = response.json()
            self.log_result("POST /api/login", True, f"Credentials work, token received")
        else:
            self.log_result("POST /api/login", False, f"Status: {response.status_code if response else 'None'}")
        
        # Test GET /api/me
        response = self.make_request("GET", "/me")
        if response and response.status_code == 200:
            user_data = response.json()
            self.log_result("GET /api/me", True, f"Token validation works, user: {user_data.get('username')}")
        else:
            self.log_result("GET /api/me", False, f"Status: {response.status_code if response else 'None'}")
    
    def test_categories_endpoints(self):
        """Test Categories endpoints - FOCUS ON PUT (recently fixed)"""
        print("\n📂 TESTING CATEGORIES (CRITICAL: PUT ENDPOINT)")
        
        # Test GET /api/categories
        response = self.make_request("GET", "/categories")
        if response and response.status_code == 200:
            categories = response.json()
            self.log_result("GET /api/categories", True, f"Retrieved {len(categories)} categories")
        else:
            self.log_result("GET /api/categories", False, f"Status: {response.status_code if response else 'None'}")
        
        # Test POST /api/categories
        category_data = {
            "name": "Test Category PUT Fix",
            "description": "Testing the recently fixed PUT endpoint"
        }
        
        response = self.make_request("POST", "/categories", category_data)
        if response and response.status_code == 200:
            created_category = response.json()
            category_id = created_category.get('id')
            self.created_entities['categories'].append(category_id)
            self.log_result("POST /api/categories", True, f"Created category ID: {category_id}")
            
            # Test PUT /api/categories/{id} - CRITICAL RECENTLY FIXED
            updated_data = {
                "id": category_id,
                "name": "Updated Test Category PUT Fix",
                "description": "Updated description - PUT endpoint working"
            }
            
            response = self.make_request("PUT", f"/categories/{category_id}", updated_data)
            if response and response.status_code == 200:
                updated_category = response.json()
                if updated_category.get('name') == updated_data['name']:
                    self.log_result("PUT /api/categories/{id} (CRITICAL FIX)", True, f"PUT endpoint works! Updated name: {updated_category.get('name')}")
                else:
                    self.log_result("PUT /api/categories/{id} (CRITICAL FIX)", False, "Update not applied correctly")
            else:
                error_msg = response.text if response else "No response"
                self.log_result("PUT /api/categories/{id} (CRITICAL FIX)", False, f"Status: {response.status_code if response else 'None'}")
            
            # Test DELETE /api/categories/{id}
            response = self.make_request("DELETE", f"/categories/{category_id}")
            if response and response.status_code == 200:
                self.log_result("DELETE /api/categories/{id}", True, "Category deleted successfully")
            else:
                self.log_result("DELETE /api/categories/{id}", False, f"Status: {response.status_code if response else 'None'}")
            
        else:
            self.log_result("POST /api/categories", False, f"Status: {response.status_code if response else 'None'}")
    
    def test_suppliers_endpoints(self):
        """Test Suppliers CRUD endpoints"""
        print("\n🏢 TESTING SUPPLIERS ENDPOINTS")
        
        # Test GET /api/suppliers
        response = self.make_request("GET", "/suppliers")
        if response and response.status_code == 200:
            suppliers = response.json()
            self.log_result("GET /api/suppliers", True, f"Retrieved {len(suppliers)} suppliers")
        else:
            self.log_result("GET /api/suppliers", False, f"Status: {response.status_code if response else 'None'}")
        
        # Test POST /api/suppliers
        supplier_data = {
            "name": "Test Supplier Deployment",
            "contact_person": "Test Contact",
            "email": "test@deployment.com",
            "phone": "+49123456789"
        }
        
        response = self.make_request("POST", "/suppliers", supplier_data)
        if response and response.status_code == 200:
            created_supplier = response.json()
            supplier_id = created_supplier.get('id')
            self.created_entities['suppliers'].append(supplier_id)
            self.log_result("POST /api/suppliers", True, f"Created supplier ID: {supplier_id}")
            
            # Test PUT /api/suppliers/{id}
            updated_data = {
                "name": "Updated Test Supplier Deployment",
                "contact_person": "Updated Contact",
                "email": "updated@deployment.com",
                "phone": "+49987654321"
            }
            
            response = self.make_request("PUT", f"/suppliers/{supplier_id}", updated_data)
            if response and response.status_code == 200:
                self.log_result("PUT /api/suppliers/{id}", True, "Supplier updated successfully")
            else:
                self.log_result("PUT /api/suppliers/{id}", False, f"Status: {response.status_code if response else 'None'}")
            
            # Test DELETE /api/suppliers/{id}
            response = self.make_request("DELETE", f"/suppliers/{supplier_id}")
            if response and response.status_code == 200:
                self.log_result("DELETE /api/suppliers/{id}", True, "Supplier deleted successfully")
            else:
                self.log_result("DELETE /api/suppliers/{id}", False, f"Status: {response.status_code if response else 'None'}")
            
        else:
            self.log_result("POST /api/suppliers", False, f"Status: {response.status_code if response else 'None'}")
    
    def test_storage_system_endpoints(self):
        """Test Storage System endpoints"""
        print("\n🏪 TESTING STORAGE SYSTEM ENDPOINTS")
        
        # Test GET /api/storage-zones
        response = self.make_request("GET", "/storage-zones")
        if response and response.status_code == 200:
            zones = response.json()
            self.log_result("GET /api/storage-zones", True, f"Retrieved {len(zones)} storage zones")
        else:
            self.log_result("GET /api/storage-zones", False, f"Status: {response.status_code if response else 'None'}")
        
        # Test POST /api/storage-zones
        zone_data = {
            "name": "Test Zone Deployment",
            "type": "Innenlager",
            "description": "Testing storage zone for deployment"
        }
        
        response = self.make_request("POST", "/storage-zones", zone_data)
        if response and response.status_code == 200:
            created_zone = response.json()
            zone_id = created_zone.get('id')
            self.created_entities['storage_zones'].append(zone_id)
            self.log_result("POST /api/storage-zones", True, f"Created zone ID: {zone_id}")
            
            # Test GET /api/storage-locations
            response = self.make_request("GET", "/storage-locations")
            if response and response.status_code == 200:
                locations = response.json()
                self.log_result("GET /api/storage-locations", True, f"Retrieved {len(locations)} storage locations")
            else:
                self.log_result("GET /api/storage-locations", False, f"Status: {response.status_code if response else 'None'}")
            
            # Test POST /api/storage-locations
            location_data = {
                "zone_id": zone_id,
                "name": "Test Location Deployment",
                "type": "Regal",
                "capacity": 100
            }
            
            response = self.make_request("POST", "/storage-locations", location_data)
            if response and response.status_code == 200:
                created_location = response.json()
                location_id = created_location.get('id')
                self.created_entities['storage_locations'].append(location_id)
                self.log_result("POST /api/storage-locations", True, f"Created location ID: {location_id}")
                
                # Test PUT /api/storage-locations/{id}
                updated_location_data = {
                    "zone_id": zone_id,
                    "name": "Updated Test Location Deployment",
                    "type": "Fach",
                    "capacity": 150
                }
                
                response = self.make_request("PUT", f"/storage-locations/{location_id}", updated_location_data)
                if response and response.status_code == 200:
                    self.log_result("PUT /api/storage-locations/{id}", True, "Storage location updated successfully")
                else:
                    self.log_result("PUT /api/storage-locations/{id}", False, f"Status: {response.status_code if response else 'None'}")
                
                # Test DELETE /api/storage-locations/{id}
                response = self.make_request("DELETE", f"/storage-locations/{location_id}")
                if response and response.status_code == 200:
                    self.log_result("DELETE /api/storage-locations/{id}", True, "Storage location deleted successfully")
                else:
                    self.log_result("DELETE /api/storage-locations/{id}", False, f"Status: {response.status_code if response else 'None'}")
                
            else:
                self.log_result("POST /api/storage-locations", False, f"Status: {response.status_code if response else 'None'}")
            
        else:
            self.log_result("POST /api/storage-zones", False, f"Status: {response.status_code if response else 'None'}")
    
    def test_articles_endpoints(self):
        """Test Articles CRUD endpoints"""
        print("\n📦 TESTING ARTICLES ENDPOINTS")
        
        # Test GET /api/articles
        response = self.make_request("GET", "/articles")
        if response and response.status_code == 200:
            articles = response.json()
            self.log_result("GET /api/articles", True, f"Retrieved {len(articles)} articles")
        else:
            self.log_result("GET /api/articles", False, f"Status: {response.status_code if response else 'None'}")
        
        # Test POST /api/articles
        article_data = {
            "name": "Test Article Deployment",
            "description": "Testing article for deployment",
            "inventory_code": f"TEST-DEPLOY-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "base_unit": "Stück",
            "min_stock_level": 5,
            "price_per_unit": 99.99,
            "rental_price": 19.99
        }
        
        response = self.make_request("POST", "/articles", article_data)
        if response and response.status_code == 200:
            created_article = response.json()
            article_id = created_article.get('id')
            self.created_entities['articles'].append(article_id)
            self.log_result("POST /api/articles", True, f"Created article ID: {article_id}")
            
            # Test PUT /api/articles/{id}
            updated_data = {
                "name": "Updated Test Article Deployment",
                "description": "Updated testing article for deployment",
                "inventory_code": article_data["inventory_code"],
                "base_unit": "Stück",
                "min_stock_level": 10,
                "price_per_unit": 149.99,
                "rental_price": 29.99
            }
            
            response = self.make_request("PUT", f"/articles/{article_id}", updated_data)
            if response and response.status_code == 200:
                self.log_result("PUT /api/articles/{id}", True, "Article updated successfully")
            else:
                self.log_result("PUT /api/articles/{id}", False, f"Status: {response.status_code if response else 'None'}")
            
            # Test DELETE /api/articles/{id}
            response = self.make_request("DELETE", f"/articles/{article_id}")
            if response and response.status_code == 200:
                self.log_result("DELETE /api/articles/{id}", True, "Article deleted successfully")
            else:
                self.log_result("DELETE /api/articles/{id}", False, f"Status: {response.status_code if response else 'None'}")
            
        else:
            self.log_result("POST /api/articles", False, f"Status: {response.status_code if response else 'None'}")
    
    def test_dashboard_endpoint(self):
        """Test Dashboard stats endpoint"""
        print("\n📊 TESTING DASHBOARD ENDPOINT")
        
        response = self.make_request("GET", "/dashboard/stats")
        if response and response.status_code == 200:
            stats = response.json()
            required_fields = ['total_articles', 'low_stock_articles', 'maintenance_due', 'overdue_maintenance', 'movements_today']
            missing_fields = [field for field in required_fields if field not in stats]
            
            if not missing_fields:
                self.log_result("GET /api/dashboard/stats", True, f"All required stats present: {len(stats)} metrics")
            else:
                self.log_result("GET /api/dashboard/stats", False, f"Missing fields: {missing_fields}")
        else:
            self.log_result("GET /api/dashboard/stats", False, f"Status: {response.status_code if response else 'None'}")
    
    def run_focused_tests(self):
        """Run focused tests for deployment readiness"""
        print("🚀 FOCUSED BACKEND TESTING FOR DEPLOYMENT")
        print(f"Backend URL: {BASE_URL}")
        print(f"Testing with credentials: {ADMIN_USERNAME}")
        
        if not self.authenticate():
            print("❌ Authentication failed - stopping tests")
            return False
        
        # Run focused test suites
        self.test_authentication_endpoints()
        self.test_categories_endpoints()
        self.test_suppliers_endpoints()
        self.test_storage_system_endpoints()
        self.test_articles_endpoints()
        self.test_dashboard_endpoint()
        
        # Summary
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"\n📋 FOCUSED TEST SUMMARY")
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   - {result['test']}: {result['details']}")
        else:
            print(f"\n🎉 ALL FOCUSED TESTS PASSED!")
        
        return failed_tests == 0

def main():
    """Main test execution"""
    tester = FocusedTester()
    success = tester.run_focused_tests()
    
    if success:
        print(f"\n✅ DEPLOYMENT READY: All critical endpoints working!")
        sys.exit(0)
    else:
        print(f"\n⚠️ DEPLOYMENT ISSUES: Review failed tests before deployment")
        sys.exit(1)

if __name__ == "__main__":
    main()