#!/usr/bin/env python3
"""
Focused Test for Storage Location PUT/DELETE Endpoints
Tests the two missing endpoints that were just implemented:
1. PUT /api/storage-locations/{id} - Update storage location
2. DELETE /api/storage-locations/{id} - Delete storage location
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://bundle-export-pro.preview.emergentagent.com/api"
TIMEOUT = 30
ADMIN_USERNAME = "Admin"
ADMIN_PASSWORD = "YNwJT56G"

class StorageLocationTestSuite:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.session.timeout = TIMEOUT
        self.auth_token = None
        self.test_zone_id = None
        self.test_location_id = None
        
        # Test results tracking
        self.results = {
            "total_tests": 0,
            "passed": 0,
            "failed": 0,
            "errors": []
        }

    def log_result(self, test_name: str, success: bool, message: str = ""):
        """Log test result"""
        self.results["total_tests"] += 1
        if success:
            self.results["passed"] += 1
            print(f"✅ {test_name}: {message}")
        else:
            self.results["failed"] += 1
            self.results["errors"].append(f"{test_name}: {message}")
            print(f"❌ {test_name}: {message}")

    def make_request(self, method: str, endpoint: str, data: dict = None) -> tuple:
        """Make HTTP request with proper error handling"""
        url = f"{self.base_url}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        
        try:
            if method == "GET":
                response = self.session.get(url, headers=headers)
            elif method == "POST":
                response = self.session.post(url, headers=headers, json=data)
            elif method == "PUT":
                response = self.session.put(url, headers=headers, json=data)
            elif method == "DELETE":
                response = self.session.delete(url, headers=headers)
            else:
                return False, f"Unsupported method: {method}", 0
            
            try:
                response_data = response.json()
            except:
                response_data = response.text
            
            return True, response_data, response.status_code
            
        except requests.exceptions.RequestException as e:
            return False, str(e), 0

    def authenticate(self):
        """Authenticate with admin credentials"""
        print("=== Authentication ===")
        
        login_data = {
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        }
        
        success, data, status = self.make_request("POST", "/login", login_data)
        
        if success and status == 200 and isinstance(data, dict):
            self.auth_token = data.get("access_token")
            if self.auth_token:
                self.log_result("Admin Login", True, f"Authenticated as {ADMIN_USERNAME}")
                return True
            else:
                self.log_result("Admin Login", False, "No access token in response")
                return False
        else:
            self.log_result("Admin Login", False, f"Status: {status}, Data: {data}")
            return False

    def setup_test_data(self):
        """Create test storage zone and location for testing"""
        print("\n=== Setting Up Test Data ===")
        
        # Create test storage zone
        zone_data = {
            "name": "Test-Zone-PUT-DELETE",
            "type": "Innenlager",
            "description": "Test zone for PUT/DELETE operations"
        }
        
        success, data, status = self.make_request("POST", "/storage-zones", zone_data)
        if success and status == 200:
            self.test_zone_id = data.get('id')
            self.log_result("Test Zone Creation", True, f"Zone created with ID: {self.test_zone_id}")
        else:
            self.log_result("Test Zone Creation", False, f"Status: {status}, Data: {data}")
            return False
        
        # Create test storage location
        location_data = {
            "zone_id": self.test_zone_id,
            "name": "Test-Location-Original",
            "type": "Regal",
            "capacity": 25
        }
        
        success, data, status = self.make_request("POST", "/storage-locations", location_data)
        if success and status == 200:
            self.test_location_id = data.get('id')
            self.log_result("Test Location Creation", True, f"Location created with ID: {self.test_location_id}")
            return True
        else:
            self.log_result("Test Location Creation", False, f"Status: {status}, Data: {data}")
            return False

    def test_put_storage_location(self):
        """Test PUT /api/storage-locations/{id} - Update storage location"""
        print("\n=== Testing PUT Storage Location ===")
        
        if not self.test_location_id:
            self.log_result("PUT Storage Location Setup", False, "No location ID available for testing")
            return False
        
        # Update storage location data
        updated_location_data = {
            "id": self.test_location_id,
            "zone_id": self.test_zone_id,
            "name": "Test-Location-Updated",
            "type": "Container",
            "capacity": 50,
            "image_base64": None,
            "images": [],
            "qr_code": f"LOC-{self.test_zone_id}-Test-Location-Updated",
            "created_at": datetime.utcnow().isoformat()
        }
        
        success, data, status = self.make_request("PUT", f"/storage-locations/{self.test_location_id}", updated_location_data)
        
        if success and status == 200:
            # Verify the update worked
            if isinstance(data, dict):
                updated_name = data.get('name')
                updated_type = data.get('type')
                updated_capacity = data.get('capacity')
                
                if (updated_name == "Test-Location-Updated" and 
                    updated_type == "Container" and 
                    updated_capacity == 50):
                    self.log_result("PUT Storage Location", True, 
                                  f"Successfully updated location: name={updated_name}, type={updated_type}, capacity={updated_capacity}")
                    return True
                else:
                    self.log_result("PUT Storage Location", False, 
                                  f"Update didn't apply correctly. Got: name={updated_name}, type={updated_type}, capacity={updated_capacity}")
                    return False
            else:
                self.log_result("PUT Storage Location", False, f"Invalid response format: {data}")
                return False
        else:
            self.log_result("PUT Storage Location", False, f"Status: {status}, Data: {data}")
            return False

    def test_delete_storage_location(self):
        """Test DELETE /api/storage-locations/{id} - Delete storage location"""
        print("\n=== Testing DELETE Storage Location ===")
        
        if not self.test_location_id:
            self.log_result("DELETE Storage Location Setup", False, "No location ID available for testing")
            return False
        
        # Delete the storage location
        success, data, status = self.make_request("DELETE", f"/storage-locations/{self.test_location_id}")
        
        if success and status == 200:
            # Verify deletion by trying to get the location (should return 404)
            success_verify, verify_data, verify_status = self.make_request("GET", f"/storage-locations")
            
            if success_verify and verify_status == 200 and isinstance(verify_data, list):
                # Check if our deleted location is still in the list
                deleted_location_found = any(loc.get('id') == self.test_location_id for loc in verify_data)
                
                if not deleted_location_found:
                    self.log_result("DELETE Storage Location", True, 
                                  f"Successfully deleted location {self.test_location_id} - not found in list")
                    return True
                else:
                    self.log_result("DELETE Storage Location", False, 
                                  f"Location {self.test_location_id} still exists after deletion")
                    return False
            else:
                self.log_result("DELETE Storage Location Verification", False, 
                              f"Could not verify deletion. Status: {verify_status}, Data: {verify_data}")
                return False
        else:
            self.log_result("DELETE Storage Location", False, f"Status: {status}, Data: {data}")
            return False

    def run_tests(self):
        """Run all storage location PUT/DELETE tests"""
        print("🧪 Starting Storage Location PUT/DELETE Endpoint Tests")
        print(f"🔗 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Step 1: Authenticate
        if not self.authenticate():
            print("\n❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Step 2: Setup test data
        if not self.setup_test_data():
            print("\n❌ Test data setup failed. Cannot proceed with tests.")
            return False
        
        # Step 3: Test PUT endpoint
        put_success = self.test_put_storage_location()
        
        # Step 4: Test DELETE endpoint
        delete_success = self.test_delete_storage_location()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {self.results['total_tests']}")
        print(f"✅ Passed: {self.results['passed']}")
        print(f"❌ Failed: {self.results['failed']}")
        
        if self.results['errors']:
            print("\n🚨 FAILED TESTS:")
            for error in self.results['errors']:
                print(f"   • {error}")
        
        success_rate = (self.results['passed'] / self.results['total_tests']) * 100 if self.results['total_tests'] > 0 else 0
        print(f"\n📈 Success Rate: {success_rate:.1f}%")
        
        if self.results['failed'] == 0:
            print("\n🎉 ALL TESTS PASSED! Storage Location PUT/DELETE endpoints are working correctly.")
            return True
        else:
            print(f"\n⚠️  {self.results['failed']} test(s) failed. Please check the issues above.")
            return False

def main():
    """Main test execution"""
    test_suite = StorageLocationTestSuite()
    success = test_suite.run_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()