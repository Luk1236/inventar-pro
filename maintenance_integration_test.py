#!/usr/bin/env python3
"""
Focused Maintenance Management API Integration Test
Testing maintenance APIs after frontend completion
"""

import requests
import json
import sys
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://bundle-export-pro.preview.emergentagent.com/api"
TEST_USER = {
    "username": "test_user_maintenance",
    "password": "test_pass_123",
    "email": "test_maintenance@example.com",
    "role": "admin"
}

class MaintenanceIntegrationTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.headers = {"Content-Type": "application/json"}
        self.test_data = {}
        self.results = []
        
    def log_result(self, test_name: str, success: bool, message: str, details: Any = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def setup_authentication(self) -> bool:
        """Setup authentication for testing"""
        try:
            # Try to register test user (might already exist)
            register_data = {
                "username": TEST_USER["username"],
                "password": TEST_USER["password"],
                "email": TEST_USER["email"],
                "role": TEST_USER["role"]
            }
            
            register_response = requests.post(
                f"{self.base_url}/register",
                json=register_data,
                headers=self.headers
            )
            
            # Login to get token
            login_data = {
                "username": TEST_USER["username"],
                "password": TEST_USER["password"]
            }
            
            login_response = requests.post(
                f"{self.base_url}/login",
                json=login_data,
                headers=self.headers
            )
            
            if login_response.status_code == 200:
                token_data = login_response.json()
                self.token = token_data["access_token"]
                self.headers["Authorization"] = f"Bearer {self.token}"
                self.test_data["user_id"] = token_data["user"]["id"]
                self.log_result("Authentication Setup", True, "Successfully authenticated test user")
                return True
            else:
                self.log_result("Authentication Setup", False, f"Login failed: {login_response.status_code}", login_response.text)
                return False
                
        except Exception as e:
            self.log_result("Authentication Setup", False, f"Authentication error: {str(e)}")
            return False
    
    def setup_test_data(self) -> bool:
        """Create test data needed for maintenance testing"""
        try:
            # Get existing categories
            categories_response = requests.get(f"{self.base_url}/categories", headers=self.headers)
            if categories_response.status_code == 200:
                categories = categories_response.json()
                if categories:
                    self.test_data["category_id"] = categories[0]["id"]
                else:
                    # Create test category
                    category_data = {
                        "name": "Audio Equipment Test",
                        "description": "Test category for maintenance testing"
                    }
                    
                    category_response = requests.post(
                        f"{self.base_url}/categories",
                        json=category_data,
                        headers=self.headers
                    )
                    
                    if category_response.status_code == 200:
                        self.test_data["category_id"] = category_response.json()["id"]
                    else:
                        self.log_result("Test Data Setup", False, f"Failed to create test category: {category_response.status_code}")
                        return False
            
            # Create test article
            article_data = {
                "name": "Test Microphone System",
                "description": "Professional microphone system for maintenance testing",
                "category_id": self.test_data["category_id"],
                "inventory_code": f"MIC-TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "base_unit": "Stück",
                "min_stock_level": 1,
                "price_per_unit": 299.99,
                "maintenance_interval_days": 90
            }
            
            article_response = requests.post(
                f"{self.base_url}/articles",
                json=article_data,
                headers=self.headers
            )
            
            if article_response.status_code == 200:
                self.test_data["article_id"] = article_response.json()["id"]
                self.log_result("Test Data Setup", True, "Successfully created test data (category and article)")
                return True
            else:
                self.log_result("Test Data Setup", False, f"Failed to create test article: {article_response.status_code}", article_response.text)
                return False
                
        except Exception as e:
            self.log_result("Test Data Setup", False, f"Test data setup error: {str(e)}")
            return False
    
    def test_maintenance_tasks_api(self) -> bool:
        """Test all maintenance tasks endpoints"""
        try:
            # 1. POST /api/maintenance/tasks (create new task)
            task_data = {
                "article_id": self.test_data["article_id"],
                "title": "Routine Microphone Maintenance",
                "description": "Check cables, clean components, test audio quality",
                "task_type": "routine",
                "priority": "high",
                "due_date": (datetime.utcnow() + timedelta(days=7)).isoformat(),
                "estimated_duration": 60
            }
            
            create_response = requests.post(
                f"{self.base_url}/maintenance/tasks",
                json=task_data,
                headers=self.headers
            )
            
            if create_response.status_code != 200:
                self.log_result("Maintenance Tasks API - CREATE", False, f"Create failed: {create_response.status_code}", create_response.text)
                return False
            
            task = create_response.json()
            self.test_data["task_id"] = task["id"]
            
            # 2. GET /api/maintenance/tasks (list all tasks)
            list_response = requests.get(
                f"{self.base_url}/maintenance/tasks",
                headers=self.headers
            )
            
            if list_response.status_code != 200:
                self.log_result("Maintenance Tasks API - LIST", False, f"List failed: {list_response.status_code}")
                return False
            
            tasks = list_response.json()
            if not isinstance(tasks, list):
                self.log_result("Maintenance Tasks API - LIST", False, "Response is not a list")
                return False
            
            # 3. GET /api/maintenance/tasks/{id} (get task details)
            detail_response = requests.get(
                f"{self.base_url}/maintenance/tasks/{self.test_data['task_id']}",
                headers=self.headers
            )
            
            if detail_response.status_code != 200:
                self.log_result("Maintenance Tasks API - DETAIL", False, f"Detail failed: {detail_response.status_code}")
                return False
            
            task_detail = detail_response.json()
            if task_detail["id"] != self.test_data["task_id"]:
                self.log_result("Maintenance Tasks API - DETAIL", False, "Task ID mismatch")
                return False
            
            # 4. PUT /api/maintenance/tasks/{id}/complete (complete a task)
            complete_response = requests.put(
                f"{self.base_url}/maintenance/tasks/{self.test_data['task_id']}/complete",
                headers=self.headers
            )
            
            if complete_response.status_code != 200:
                self.log_result("Maintenance Tasks API - COMPLETE", False, f"Complete failed: {complete_response.status_code}")
                return False
            
            # Verify task was completed
            verify_response = requests.get(
                f"{self.base_url}/maintenance/tasks/{self.test_data['task_id']}",
                headers=self.headers
            )
            
            if verify_response.status_code == 200:
                completed_task = verify_response.json()
                if completed_task["status"] != "completed":
                    self.log_result("Maintenance Tasks API - COMPLETE", False, f"Task status not updated: {completed_task['status']}")
                    return False
            
            self.log_result("Maintenance Tasks API", True, f"All endpoints working: CREATE, LIST ({len(tasks)} tasks), DETAIL, COMPLETE")
            return True
            
        except Exception as e:
            self.log_result("Maintenance Tasks API", False, f"Exception: {str(e)}")
            return False
    
    def test_maintenance_records_api(self) -> bool:
        """Test maintenance records endpoints"""
        try:
            # POST /api/maintenance/records (create new record)
            record_data = {
                "task_id": self.test_data["task_id"],
                "article_id": self.test_data["article_id"],
                "work_description": "Performed routine maintenance: cleaned components, checked connections, tested audio quality",
                "parts_used": [
                    {"name": "Cleaning Kit", "quantity": 1, "cost": 15.99},
                    {"name": "Cable Ties", "quantity": 3, "cost": 2.50}
                ],
                "cost": 18.49,
                "status_after": "OK",
                "notes": "Equipment in excellent condition after maintenance"
            }
            
            create_response = requests.post(
                f"{self.base_url}/maintenance/records",
                json=record_data,
                headers=self.headers
            )
            
            if create_response.status_code != 200:
                self.log_result("Maintenance Records API - CREATE", False, f"Create failed: {create_response.status_code}", create_response.text)
                return False
            
            record = create_response.json()
            self.test_data["record_id"] = record["id"]
            
            # GET /api/maintenance/records?limit=50 (list records with limit)
            list_response = requests.get(
                f"{self.base_url}/maintenance/records?limit=50",
                headers=self.headers
            )
            
            if list_response.status_code != 200:
                self.log_result("Maintenance Records API - LIST", False, f"List failed: {list_response.status_code}")
                return False
            
            records = list_response.json()
            if not isinstance(records, list):
                self.log_result("Maintenance Records API - LIST", False, "Response is not a list")
                return False
            
            # Verify our record is in the list
            record_found = any(r.get("id") == self.test_data["record_id"] for r in records)
            if not record_found:
                self.log_result("Maintenance Records API - LIST", False, "Created record not found in list")
                return False
            
            self.log_result("Maintenance Records API", True, f"All endpoints working: CREATE, LIST ({len(records)} records with limit=50)")
            return True
            
        except Exception as e:
            self.log_result("Maintenance Records API", False, f"Exception: {str(e)}")
            return False
    
    def test_maintenance_checklists_api(self) -> bool:
        """Test maintenance checklists endpoints"""
        try:
            # First create a test checklist
            checklist_data = {
                "name": "Audio Equipment Inspection Checklist",
                "description": "Standard checklist for audio equipment maintenance",
                "category_ids": [self.test_data["category_id"]],
                "items": [
                    {"title": "Check power cables", "required": True, "type": "checkbox"},
                    {"title": "Test audio output", "required": True, "type": "checkbox"},
                    {"title": "Clean exterior", "required": False, "type": "checkbox"},
                    {"title": "Record signal level", "required": True, "type": "measurement"}
                ],
                "is_template": True
            }
            
            create_response = requests.post(
                f"{self.base_url}/maintenance/checklists",
                json=checklist_data,
                headers=self.headers
            )
            
            # GET /api/maintenance/checklists (list all checklists)
            list_response = requests.get(
                f"{self.base_url}/maintenance/checklists",
                headers=self.headers
            )
            
            if list_response.status_code != 200:
                self.log_result("Maintenance Checklists API", False, f"List failed: {list_response.status_code}")
                return False
            
            checklists = list_response.json()
            if not isinstance(checklists, list):
                self.log_result("Maintenance Checklists API", False, "Response is not a list")
                return False
            
            # Verify checklist structure
            if checklists:
                checklist = checklists[0]
                required_fields = ["id", "name", "items", "created_by"]
                missing_fields = [field for field in required_fields if field not in checklist]
                
                if missing_fields:
                    self.log_result("Maintenance Checklists API", False, f"Missing required fields: {missing_fields}")
                    return False
            
            self.log_result("Maintenance Checklists API", True, f"Successfully retrieved {len(checklists)} checklists")
            return True
            
        except Exception as e:
            self.log_result("Maintenance Checklists API", False, f"Exception: {str(e)}")
            return False
    
    def test_maintenance_alerts_api(self) -> bool:
        """Test maintenance alerts endpoint"""
        try:
            # GET /api/maintenance/alerts (overdue and upcoming tasks)
            response = requests.get(
                f"{self.base_url}/maintenance/alerts",
                headers=self.headers
            )
            
            if response.status_code != 200:
                self.log_result("Maintenance Alerts API", False, f"HTTP {response.status_code}", response.text)
                return False
            
            alerts = response.json()
            
            # Verify alert structure
            required_keys = ["overdue", "upcoming"]
            missing_keys = [key for key in required_keys if key not in alerts]
            
            if missing_keys:
                self.log_result("Maintenance Alerts API", False, f"Missing required keys: {missing_keys}")
                return False
            
            if not isinstance(alerts["overdue"], list) or not isinstance(alerts["upcoming"], list):
                self.log_result("Maintenance Alerts API", False, "Overdue and upcoming should be lists")
                return False
            
            overdue_count = len(alerts["overdue"])
            upcoming_count = len(alerts["upcoming"])
            
            self.log_result("Maintenance Alerts API", True, f"Successfully retrieved alerts: {overdue_count} overdue, {upcoming_count} upcoming")
            return True
            
        except Exception as e:
            self.log_result("Maintenance Alerts API", False, f"Exception: {str(e)}")
            return False
    
    def test_dashboard_integration(self) -> bool:
        """Test dashboard stats with maintenance counters"""
        try:
            # GET /api/dashboard/stats (verify maintenance counters)
            response = requests.get(
                f"{self.base_url}/dashboard/stats",
                headers=self.headers
            )
            
            if response.status_code != 200:
                self.log_result("Dashboard Integration", False, f"HTTP {response.status_code}", response.text)
                return False
            
            stats = response.json()
            
            # Verify maintenance-related stats are present
            required_maintenance_fields = ["maintenance_due", "overdue_maintenance"]
            missing_fields = [field for field in required_maintenance_fields if field not in stats]
            
            if missing_fields:
                self.log_result("Dashboard Integration", False, f"Missing maintenance fields: {missing_fields}")
                return False
            
            # Verify all expected dashboard fields
            expected_fields = ["total_articles", "low_stock_articles", "maintenance_due", 
                             "overdue_maintenance", "movements_today", "defective_articles", "blocked_articles"]
            missing_all_fields = [field for field in expected_fields if field not in stats]
            
            if missing_all_fields:
                self.log_result("Dashboard Integration", False, f"Missing dashboard fields: {missing_all_fields}")
                return False
            
            # Verify data types
            for field in expected_fields:
                if not isinstance(stats[field], int):
                    self.log_result("Dashboard Integration", False, f"Field '{field}' should be integer, got {type(stats[field])}")
                    return False
            
            self.log_result("Dashboard Integration", True, f"Dashboard stats working: {stats['maintenance_due']} due, {stats['overdue_maintenance']} overdue")
            return True
            
        except Exception as e:
            self.log_result("Dashboard Integration", False, f"Exception: {str(e)}")
            return False
    
    def run_maintenance_integration_tests(self):
        """Run focused maintenance integration tests"""
        print("🔧 MAINTENANCE MANAGEMENT API INTEGRATION TESTING")
        print(f"📡 Testing against: {self.base_url}")
        print("🎯 Focus: Verifying maintenance APIs after frontend completion")
        print("=" * 70)
        
        # Setup
        if not self.setup_authentication():
            print("❌ Authentication failed - cannot continue with tests")
            return False
        
        if not self.setup_test_data():
            print("❌ Test data setup failed - cannot continue with tests")
            return False
        
        # Run focused maintenance API tests
        tests = [
            ("Maintenance Tasks API", self.test_maintenance_tasks_api),
            ("Maintenance Records API", self.test_maintenance_records_api),
            ("Maintenance Checklists API", self.test_maintenance_checklists_api),
            ("Maintenance Alerts API", self.test_maintenance_alerts_api),
            ("Dashboard Integration", self.test_dashboard_integration)
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            print(f"\n🧪 Testing {test_name}...")
            if test_func():
                passed += 1
        
        print("\n" + "=" * 70)
        print(f"📊 MAINTENANCE INTEGRATION TEST RESULTS: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL MAINTENANCE INTEGRATION TESTS PASSED!")
            print("✅ Frontend-Backend integration is working correctly")
            return True
        else:
            print(f"⚠️  {total - passed} tests failed")
            print("❌ Integration issues detected")
            return False
    
    def get_summary(self) -> Dict[str, Any]:
        """Get test summary"""
        passed = sum(1 for result in self.results if result["success"])
        total = len(self.results)
        
        return {
            "total_tests": total,
            "passed": passed,
            "failed": total - passed,
            "success_rate": (passed / total * 100) if total > 0 else 0,
            "results": self.results
        }

def main():
    """Main test execution"""
    tester = MaintenanceIntegrationTester()
    
    try:
        success = tester.run_maintenance_integration_tests()
        summary = tester.get_summary()
        
        print("\n" + "=" * 70)
        print("📋 FINAL INTEGRATION TEST SUMMARY")
        print("=" * 70)
        print(f"Total Tests: {summary['total_tests']}")
        print(f"Passed: {summary['passed']}")
        print(f"Failed: {summary['failed']}")
        print(f"Success Rate: {summary['success_rate']:.1f}%")
        
        if not success:
            print("\n❌ FAILED TESTS:")
            for result in summary['results']:
                if not result['success']:
                    print(f"  • {result['test']}: {result['message']}")
        else:
            print("\n✅ MAINTENANCE MANAGEMENT INTEGRATION VERIFIED")
            print("🔗 All maintenance APIs working correctly after frontend completion")
        
        return success
        
    except Exception as e:
        print(f"❌ Test execution failed: {str(e)}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)