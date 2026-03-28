#!/usr/bin/env python3
"""
AI Screenshot-to-UI Backend API Testing
Tests all authentication, upload, generation, project CRUD, and admin endpoints
"""
import requests
import sys
import json
import base64
import tempfile
from datetime import datetime
from pathlib import Path
import os

class UIGenAPITester:
    def __init__(self, base_url="https://design-to-ui.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.admin_token = None
        self.test_user_id = None
        self.admin_user_id = None
        self.image_id = None
        self.project_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.critical_failures = []

    def log_test(self, name, success, response_code=None, error_msg=None):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED (Code: {response_code}) - {error_msg}")
            self.failed_tests.append({
                "test": name,
                "status_code": response_code,
                "error": error_msg
            })
            if response_code in [500, 401, 403] or "critical" in name.lower():
                self.critical_failures.append(name)

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api{endpoint}"
        request_headers = {'Content-Type': 'application/json'}
        
        if headers:
            request_headers.update(headers)
            
        if self.token and 'Authorization' not in request_headers:
            request_headers['Authorization'] = f'Bearer {self.token}'
        
        # Remove content-type for file uploads
        if files:
            del request_headers['Content-Type']

        try:
            if method == 'GET':
                response = requests.get(url, headers=request_headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, headers=request_headers, timeout=30)
                else:
                    response = requests.post(url, json=data, headers=request_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=request_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=request_headers, timeout=30)

            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True, response.status_code)
                try:
                    return True, response.json() if response.text else {}
                except:
                    return True, {}
            else:
                error_detail = "Unknown error"
                try:
                    error_data = response.json()
                    error_detail = error_data.get('detail', str(error_data))
                except:
                    error_detail = response.text[:200] if response.text else f"HTTP {response.status_code}"
                
                self.log_test(name, False, response.status_code, error_detail)
                return False, {}

        except requests.exceptions.RequestException as e:
            self.log_test(name, False, None, f"Request failed: {str(e)}")
            return False, {}

    def create_test_image(self):
        """Create a simple test image"""
        from PIL import Image
        import io
        
        # Create a simple colored rectangle
        img = Image.new('RGB', (400, 300), color=(73, 109, 137))
        img_buffer = io.BytesIO()
        img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        return img_buffer

    def test_api_root(self):
        """Test API root endpoint"""
        return self.run_test("API Root Check", "GET", "/", 200)

    def test_signup(self, email, password, name, is_admin=False):
        """Test user signup"""
        success, response = self.run_test(
            f"User Signup ({'Admin' if is_admin else 'Regular'})",
            "POST",
            "/auth/signup",
            200,
            data={"name": name, "email": email, "password": password}
        )
        
        if success:
            if is_admin:
                self.admin_token = response.get('token')
                self.admin_user_id = response.get('user', {}).get('id')
            else:
                self.token = response.get('token')
                self.test_user_id = response.get('user', {}).get('id')
                
        return success

    def test_login(self, email, password, is_admin=False):
        """Test user login"""
        success, response = self.run_test(
            f"User Login ({'Admin' if is_admin else 'Regular'})",
            "POST",
            "/auth/login", 
            200,
            data={"email": email, "password": password}
        )
        
        if success:
            if is_admin:
                self.admin_token = response.get('token')
                self.admin_user_id = response.get('user', {}).get('id')
            else:
                self.token = response.get('token')
                self.test_user_id = response.get('user', {}).get('id')
                
        return success

    def test_auth_me(self):
        """Test /auth/me endpoint"""
        return self.run_test("Get Current User Info", "GET", "/auth/me", 200)

    def test_image_upload(self):
        """Test image upload"""
        img_buffer = self.create_test_image()
        
        success, response = self.run_test(
            "Image Upload",
            "POST",
            "/upload",
            200,
            files={'file': ('test.png', img_buffer, 'image/png')}
        )
        
        if success:
            self.image_id = response.get('image_id')
            
        return success

    def test_code_generation(self, framework='react'):
        """Test code generation from uploaded image"""
        if not self.image_id:
            self.log_test("Code Generation", False, None, "No image uploaded")
            return False
            
        success, response = self.run_test(
            f"Code Generation ({framework})",
            "POST",
            "/generate",
            200,
            data={"image_id": self.image_id, "framework": framework}
        )
        
        return success, response.get('code', '') if success else ''

    def test_ai_chat(self, code, message="Make the background blue"):
        """Test AI chat modification"""
        success, response = self.run_test(
            "AI Chat Code Modification",
            "POST", 
            "/chat",
            200,
            data={
                "code": code,
                "message": message,
                "framework": "react",
                "project_id": self.project_id
            }
        )
        
        return success, response.get('code', '') if success else ''

    def test_create_project(self, title="Test Project", framework="react", code="<div>Test</div>"):
        """Test project creation"""
        success, response = self.run_test(
            "Create Project",
            "POST",
            "/projects",
            200,
            data={
                "title": title,
                "framework": framework, 
                "generated_code": code,
                "updated_code": code
            }
        )
        
        if success:
            self.project_id = response.get('id')
            
        return success

    def test_get_projects(self):
        """Test getting all projects"""
        return self.run_test("Get All Projects", "GET", "/projects", 200)

    def test_get_project(self):
        """Test getting specific project"""
        if not self.project_id:
            self.log_test("Get Project", False, None, "No project created")
            return False
            
        return self.run_test(f"Get Project {self.project_id}", "GET", f"/projects/{self.project_id}", 200)

    def test_update_project(self):
        """Test updating project"""
        if not self.project_id:
            self.log_test("Update Project", False, None, "No project created")
            return False
            
        return self.run_test(
            "Update Project",
            "PUT",
            f"/projects/{self.project_id}",
            200,
            data={"title": "Updated Test Project", "updated_code": "<div>Updated</div>"}
        )

    def test_delete_project(self):
        """Test deleting project"""
        if not self.project_id:
            self.log_test("Delete Project", False, None, "No project created")
            return False
            
        success, _ = self.run_test("Delete Project", "DELETE", f"/projects/{self.project_id}", 200)
        if success:
            self.project_id = None
        return success

    def test_admin_stats(self):
        """Test admin statistics endpoint"""
        # Save current token
        current_token = self.token
        
        # Switch to admin token if available
        if self.admin_token:
            self.token = self.admin_token
            
        success, response = self.run_test("Admin Statistics", "GET", "/admin/stats", 200)
        
        # Restore original token
        self.token = current_token
        
        return success

    def test_unauthorized_access(self):
        """Test unauthorized access scenarios"""
        # Save current token
        current_token = self.token
        
        # Remove token for unauthorized test
        self.token = None
        
        # Test accessing protected endpoint without token
        success, _ = self.run_test(
            "Unauthorized Access Test",
            "GET", 
            "/auth/me",
            401  # Should return 401
        )
        
        # Restore token
        self.token = current_token
        
        return success

    def print_summary(self):
        """Print test summary"""
        print(f"\n📊 TEST SUMMARY")
        print(f"{'='*50}")
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                print(f"  • {test['test']}: {test['error']}")
                
        if self.critical_failures:
            print(f"\n🚨 CRITICAL FAILURES:")
            for failure in self.critical_failures:
                print(f"  • {failure}")

    def run_full_test_suite(self):
        """Run complete test suite"""
        print("🚀 Starting AI Screenshot-to-UI API Tests...")
        print(f"Base URL: {self.base_url}")
        print("="*60)
        
        # Test API availability
        if not self.test_api_root():
            print("❌ API not accessible - stopping tests")
            return False

        # Generate test user credentials
        timestamp = datetime.now().strftime('%H%M%S')
        test_email = f"test_user_{timestamp}@example.com"
        admin_email = f"admin_user_{timestamp}@example.com"
        test_password = "TestPass123!"
        
        # Authentication Flow Tests
        print("\n🔐 Authentication Tests")
        print("-" * 30)
        
        # Test signup
        if not self.test_signup(test_email, test_password, f"Test User {timestamp}"):
            print("❌ User signup failed - critical error")
            return False
            
        # Test login with same credentials
        if not self.test_login(test_email, test_password):
            print("❌ User login failed - critical error") 
            return False
            
        # Test auth/me
        if not self.test_auth_me():
            print("❌ Auth verification failed - critical error")
            return False
            
        # Test unauthorized access
        self.test_unauthorized_access()
        
        # Upload & Generation Tests
        print("\n📤 Upload & Generation Tests")
        print("-" * 35)
        
        # Test image upload
        if not self.test_image_upload():
            print("❌ Image upload failed - skipping generation tests")
        else:
            # Test code generation
            success, generated_code = self.test_code_generation('react')
            if success and generated_code:
                # Test AI chat modification
                self.test_ai_chat(generated_code, "Make the button larger")
            
        # Project Management Tests
        print("\n📁 Project Management Tests")
        print("-" * 35)
        
        # Test project creation
        if not self.test_create_project():
            print("❌ Project creation failed - skipping other project tests")
        else:
            # Test getting projects
            self.test_get_projects()
            
            # Test getting specific project
            self.test_get_project()
            
            # Test updating project
            self.test_update_project()
            
            # Test deleting project (do this last)
            self.test_delete_project()
            
        # Admin Tests (create admin user first)
        print("\n👑 Admin Tests")
        print("-" * 20)
        
        # Try to create admin user (this might fail if admin creation is restricted)
        admin_signup_success = self.test_signup(admin_email, test_password, f"Admin User {timestamp}", is_admin=True)
        
        if admin_signup_success:
            # Test admin stats endpoint
            self.test_admin_stats()
        else:
            print("ℹ️  Admin user creation failed - admin tests skipped")

        # Print final summary
        self.print_summary()
        
        # Return success if critical tests pass (>70% success rate and no critical failures)
        success_rate = (self.tests_passed / self.tests_run) * 100
        return success_rate >= 70 and len(self.critical_failures) == 0


def main():
    """Main test execution"""
    # Initialize tester
    tester = UIGenAPITester()
    
    try:
        success = tester.run_full_test_suite()
        return 0 if success else 1
    except Exception as e:
        print(f"❌ Test execution failed: {str(e)}")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)