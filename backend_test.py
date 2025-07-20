import requests
import sys
from datetime import datetime
import json

class AircraftAPITester:
    def __init__(self, base_url="https://7268f3ac-9f43-409d-901e-f3b4c6052145.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.aircraft_ids = []
        self.user_ids = []
        self.categories_data = {}
        self.manufacturers_data = {}

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, list):
                        print(f"   Response: List with {len(response_data)} items")
                    elif isinstance(response_data, dict):
                        print(f"   Response keys: {list(response_data.keys())}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_new_3_level_hierarchy(self):
        """Test the NEW 3-level hierarchy: Categories -> Manufacturers -> Simulations"""
        print("\n🔍 Testing NEW 3-Level Hierarchy")
        
        # Level 1: Categories with counts
        success1, response1 = self.run_test(
            "Level 1: Get Categories with Counts",
            "GET",
            "api/categories-with-counts",
            200
        )
        
        if success1 and isinstance(response1, dict):
            self.categories_data = response1
            print(f"   Found {len(response1)} categories")
            for category, data in response1.items():
                print(f"   - {category}: {data.get('count', 0)} aircraft, avg rating {data.get('avg_rating', 0)}")
        
        # Level 2: Aircraft manufacturers for first category
        if self.categories_data:
            first_category = list(self.categories_data.keys())[0]
            success2, response2 = self.run_test(
                f"Level 2: Get Manufacturers for {first_category}",
                "GET",
                f"api/aircraft-manufacturers/{first_category}",
                200
            )
            
            if success2 and isinstance(response2, dict):
                self.manufacturers_data = response2
                print(f"   Found {len(response2)} manufacturers for {first_category}")
                for manufacturer, data in response2.items():
                    models = data.get('models', [])
                    print(f"   - {manufacturer}: {data.get('count', 0)} simulations, {len(models)} models")
            
            # Level 3: Simulations with sorting for first manufacturer
            if self.manufacturers_data:
                first_manufacturer = list(self.manufacturers_data.keys())[0]
                sort_options = ["rating", "reviews", "price_low", "price_high", "newest"]
                
                for sort_by in sort_options:
                    success3, response3 = self.run_test(
                        f"Level 3: Get {first_manufacturer} Simulations (sort: {sort_by})",
                        "GET",
                        f"api/simulations/{first_category}/{first_manufacturer}",
                        200,
                        params={"sort_by": sort_by}
                    )
                    
                    if success3 and isinstance(response3, list):
                        print(f"   Found {len(response3)} simulations sorted by {sort_by}")
                        if response3:
                            first_sim = response3[0]
                            print(f"   Top result: {first_sim.get('developer', 'N/A')} {first_sim.get('name', 'N/A')}")
        
        return success1

    def test_get_all_aircraft(self):
        """Test GET /api/aircraft"""
        success, response = self.run_test(
            "Get All Aircraft",
            "GET",
            "api/aircraft",
            200
        )
        if success and isinstance(response, list):
            self.aircraft_ids = [aircraft.get('id') for aircraft in response if aircraft.get('id')]
            print(f"   Found {len(response)} aircraft")
            if response:
                print(f"   Sample aircraft: {response[0].get('name')} by {response[0].get('manufacturer')}")
        return success

    def test_get_manufacturers(self):
        """Test GET /api/manufacturers"""
        success, response = self.run_test(
            "Get Manufacturers",
            "GET",
            "api/manufacturers",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found manufacturers: {response}")
        return success

    def test_get_aircraft_grouped_by_manufacturer(self):
        """Test GET /api/aircraft/grouped-by-manufacturer - NEW FEATURE"""
        success, response = self.run_test(
            "Get Aircraft Grouped by Manufacturer",
            "GET",
            "api/aircraft/grouped-by-manufacturer",
            200
        )
        if success and isinstance(response, dict):
            print(f"   Found {len(response)} manufacturers")
            for manufacturer, data in response.items():
                variants = data.get('variants', [])
                aircraft_list = data.get('aircraft_list', [])
                print(f"   - {manufacturer}: {len(variants)} variants, {len(aircraft_list)} aircraft")
                if variants:
                    print(f"     Variants: {', '.join(variants[:3])}")
        return success

    def test_get_aircraft_types(self):
        """Test GET /api/aircraft-types - NEW FEATURE"""
        success, response = self.run_test(
            "Get Aircraft Types",
            "GET",
            "api/aircraft-types",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found aircraft types: {response}")
        return success

    def test_search_functionality(self):
        """Test search functionality with ?search= parameter - ENHANCED FEATURE"""
        search_terms = ["Boeing", "A320", "PMDG", "study level"]
        
        all_passed = True
        for search_term in search_terms:
            success, response = self.run_test(
                f"Search for '{search_term}'",
                "GET",
                "api/aircraft",
                200,
                params={"search": search_term}
            )
            
            if success and isinstance(response, list):
                print(f"   Search results: {len(response)} aircraft")
                if response:
                    # Verify search worked by checking if search term appears in results
                    found_in_results = False
                    for aircraft in response:
                        if (search_term.lower() in aircraft.get('name', '').lower() or
                            search_term.lower() in aircraft.get('manufacturer', '').lower() or
                            search_term.lower() in aircraft.get('aircraft_type', '').lower() or
                            search_term.lower() in aircraft.get('description', '').lower()):
                            found_in_results = True
                            break
                    
                    if found_in_results:
                        print(f"   ✅ Search working correctly")
                    else:
                        print(f"   ❌ Search not working correctly")
                        all_passed = False
            else:
                all_passed = False
                
        return all_passed

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        success, response = self.run_test(
            "Get Current User (Unauthenticated)",
            "GET",
            "api/auth/me",
            200
        )
        
        if success and isinstance(response, dict):
            if response.get('user') is None:
                print(f"   ✅ Correctly returns null user when not authenticated")
            else:
                print(f"   ⚠️  Unexpected user data: {response}")
        
        return success

    def test_admin_aircraft_update(self):
        """Test PUT /api/aircraft/{id} - NEW ADMIN FEATURE (should fail without auth)"""
        if not self.aircraft_ids:
            print("❌ No aircraft IDs available for testing")
            return False
            
        aircraft_id = self.aircraft_ids[0]
        update_data = {
            "name": "Updated Aircraft Name",
            "description": "Updated description for testing"
        }
        
        # Test updating aircraft without auth - should fail with 401
        success, response = self.run_test(
            f"Update Aircraft (Unauthorized): {aircraft_id}",
            "PUT",
            f"api/aircraft/{aircraft_id}",
            401,
            data=update_data
        )
        
        return success

    def test_admin_endpoints_unauthorized(self):
        """Test admin endpoints without authentication - should fail"""
        # Test with proper schema for aircraft creation
        success1 = self.test_admin_aircraft_creation_schema()
        
        # Test updating aircraft without auth - should fail with 401
        success2 = self.test_admin_aircraft_update()
        
        return success1 and success2

    def test_user_profile_endpoints(self):
        """Test user profile endpoints - NEW FEATURE"""
        # First get some user IDs from reviews if available
        if self.aircraft_ids:
            aircraft_id = self.aircraft_ids[0]
            success, reviews = self.run_test(
                f"Get Reviews to Find User IDs",
                "GET",
                f"api/aircraft/{aircraft_id}/reviews",
                200
            )
            
            if success and isinstance(reviews, list) and reviews:
                user_id = reviews[0].get('user_id')
                if user_id:
                    self.user_ids.append(user_id)
                    
                    # Test get user profile
                    success, response = self.run_test(
                        f"Get User Profile: {user_id}",
                        "GET",
                        f"api/users/{user_id}",
                        200
                    )
                    
                    if success and isinstance(response, dict):
                        print(f"   User: {response.get('name')} ({response.get('email')})")
                    
                    # Test get user reviews
                    success2, response2 = self.run_test(
                        f"Get User Reviews: {user_id}",
                        "GET",
                        f"api/users/{user_id}/reviews",
                        200
                    )
                    
                    if success2 and isinstance(response2, list):
                        print(f"   User has {len(response2)} reviews")
                        if response2:
                            print(f"   Sample review: {response2[0].get('title')}")
                    
                    return success and success2
        
        # Test with invalid user ID
        success, response = self.run_test(
            "Get User Profile (Invalid ID)",
            "GET",
            "api/users/invalid-user-id",
            404
        )
        
        return success

    def test_get_categories(self):
        """Test GET /api/categories"""
        success, response = self.run_test(
            "Get Categories",
            "GET",
            "api/categories",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found categories: {response}")
        return success

    def test_get_stats(self):
        """Test GET /api/stats"""
        success, response = self.run_test(
            "Get Platform Stats",
            "GET",
            "api/stats",
            200
        )
        if success and isinstance(response, dict):
            print(f"   Stats: {response}")
        return success
        """Test GET /api/stats"""
        success, response = self.run_test(
            "Get Platform Stats",
            "GET",
            "api/stats",
            200
        )
        if success and isinstance(response, dict):
            print(f"   Stats: {response}")
        return success

    def test_aircraft_filtering(self):
        """Test aircraft filtering functionality"""
        filters = [
            {"manufacturer": "PMDG"},
            {"category": "Commercial"},
            {"price_type": "Paid"},
            {"compatibility": "MS2024"}
        ]
        
        all_passed = True
        for filter_params in filters:
            filter_name = list(filter_params.keys())[0]
            filter_value = list(filter_params.values())[0]
            
            success, response = self.run_test(
                f"Filter by {filter_name}: {filter_value}",
                "GET",
                "api/aircraft",
                200,
                params=filter_params
            )
            
            if success and isinstance(response, list):
                print(f"   Filtered results: {len(response)} aircraft")
                if response:
                    # Verify filtering worked
                    if filter_name == "manufacturer":
                        filtered_correctly = all(aircraft.get('manufacturer') == filter_value for aircraft in response)
                    elif filter_name == "category":
                        filtered_correctly = all(aircraft.get('category') == filter_value for aircraft in response)
                    elif filter_name == "price_type":
                        filtered_correctly = all(aircraft.get('price_type') == filter_value for aircraft in response)
                    elif filter_name == "compatibility":
                        filtered_correctly = all(filter_value in aircraft.get('compatibility', []) for aircraft in response)
                    
                    if filtered_correctly:
                        print(f"   ✅ Filtering working correctly")
                    else:
                        print(f"   ❌ Filtering not working correctly")
                        all_passed = False
            else:
                all_passed = False
                
        return all_passed

    def test_get_aircraft_by_id(self):
        """Test GET /api/aircraft/{id}"""
        if not self.aircraft_ids:
            print("❌ No aircraft IDs available for testing")
            return False
            
        aircraft_id = self.aircraft_ids[0]
        success, response = self.run_test(
            f"Get Aircraft by ID: {aircraft_id}",
            "GET",
            f"api/aircraft/{aircraft_id}",
            200
        )
        
        if success and isinstance(response, dict):
            print(f"   Aircraft: {response.get('name')} by {response.get('manufacturer')}")
        return success

    def test_get_aircraft_reviews(self):
        """Test GET /api/aircraft/{id}/reviews"""
        if not self.aircraft_ids:
            print("❌ No aircraft IDs available for testing")
            return False
            
        aircraft_id = self.aircraft_ids[0]
        success, response = self.run_test(
            f"Get Aircraft Reviews: {aircraft_id}",
            "GET",
            f"api/aircraft/{aircraft_id}/reviews",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} reviews")
        return success

    def test_create_review(self):
        """Test POST /api/aircraft/{id}/reviews - should fail without auth"""
        if not self.aircraft_ids:
            print("❌ No aircraft IDs available for testing")
            return False
            
        aircraft_id = self.aircraft_ids[0]
        test_review = {
            "title": "Great Aircraft!",
            "content": "This is a test review for the aircraft. Very detailed and realistic.",
            "ratings": {
                "overall": 5,
                "performance": 4,
                "visual_quality": 5,
                "flight_model": 4,
                "systems_accuracy": 5
            }
        }
        
        success, response = self.run_test(
            f"Create Review for Aircraft (Unauthorized): {aircraft_id}",
            "POST",
            f"api/aircraft/{aircraft_id}/reviews",
            401,
            data=test_review
        )
        
        return success

    def test_invalid_aircraft_id(self):
        """Test with invalid aircraft ID"""
        success, response = self.run_test(
            "Get Aircraft with Invalid ID",
            "GET",
            "api/aircraft/invalid-id-123",
            404
        )
        return success

    def test_google_oauth_verification(self):
        """Test Google OAuth verification endpoint"""
        # Test without credential - should fail
        success1, response = self.run_test(
            "Google OAuth Verify (No Credential)",
            "POST",
            "api/auth/google/verify",
            400,
            data={}
        )
        
        # Test with invalid credential - should fail
        success2, response = self.run_test(
            "Google OAuth Verify (Invalid Credential)",
            "POST",
            "api/auth/google/verify",
            400,
            data={"credential": "invalid-token-123"}
        )
        
        return success1 and success2

    def test_logout_functionality(self):
        """Test logout functionality"""
        success, response = self.run_test(
            "Logout User",
            "POST",
            "api/auth/logout",
            200
        )
        
        if success and isinstance(response, dict):
            if response.get('status') == 'success':
                print(f"   ✅ Logout successful: {response.get('message')}")
            else:
                print(f"   ⚠️  Unexpected logout response: {response}")
        
        return success

    def test_archive_restore_functionality(self):
        """Test archive and restore aircraft functionality (admin only)"""
        if not self.aircraft_ids:
            print("❌ No aircraft IDs available for testing")
            return False
            
        aircraft_id = self.aircraft_ids[0]
        
        # Test archive without auth - should fail with 401
        success1, response = self.run_test(
            f"Archive Aircraft (Unauthorized): {aircraft_id}",
            "POST",
            f"api/aircraft/{aircraft_id}/archive",
            401
        )
        
        # Test restore without auth - should fail with 401
        success2, response = self.run_test(
            f"Restore Aircraft (Unauthorized): {aircraft_id}",
            "POST",
            f"api/aircraft/{aircraft_id}/restore",
            401
        )
        
        # Test get archived aircraft without auth - should fail with 401
        success3, response = self.run_test(
            "Get Archived Aircraft (Unauthorized)",
            "GET",
            "api/admin/archived-aircraft",
            401
        )
        
        return success1 and success2 and success3

    def test_multiple_images_support(self):
        """Test that aircraft data includes additional_images field"""
        if not self.aircraft_ids:
            print("❌ No aircraft IDs available for testing")
            return False
            
        aircraft_id = self.aircraft_ids[0]
        success, response = self.run_test(
            f"Verify Multiple Images Support: {aircraft_id}",
            "GET",
            f"api/aircraft/{aircraft_id}",
            200
        )
        
        if success and isinstance(response, dict):
            # Check if additional_images field exists
            if 'additional_images' in response:
                additional_images = response.get('additional_images', [])
                print(f"   ✅ additional_images field found: {len(additional_images)} images")
                
                # Check if it's a list
                if isinstance(additional_images, list):
                    print(f"   ✅ additional_images is properly formatted as list")
                else:
                    print(f"   ❌ additional_images is not a list: {type(additional_images)}")
                    return False
                    
                # Check other image fields
                image_url = response.get('image_url')
                cockpit_image_url = response.get('cockpit_image_url')
                print(f"   Main image_url: {'✅ Present' if image_url else '❌ Missing'}")
                print(f"   Cockpit image_url: {'✅ Present' if cockpit_image_url else '❌ Missing'}")
                
                return True
            else:
                print(f"   ❌ additional_images field not found in aircraft data")
                return False
        
        return success

    def test_admin_aircraft_creation_schema(self):
        """Test aircraft creation with proper schema"""
        test_aircraft_data = {
            "name": "Test Aircraft",
            "developer": "Test Developer",
            "aircraft_manufacturer": "Test Manufacturer", 
            "aircraft_model": "Test Model",
            "variant": "Test Variant",
            "category": "Commercial",
            "price_type": "Paid",
            "price": "$99.99",
            "description": "Test aircraft description",
            "compatibility": ["MS2024"],
            "features": ["Test Feature"],
            "additional_images": ["https://example.com/image1.jpg", "https://example.com/image2.jpg"]
        }
        
        # Test creating aircraft without auth - should fail with 401
        success, response = self.run_test(
            "Create Aircraft with Proper Schema (Unauthorized)",
            "POST",
            "api/aircraft",
            401,
            data=test_aircraft_data
        )
        
        return success

    def test_page_view_tracking(self):
        """Test page view tracking functionality"""
        if not self.aircraft_ids:
            print("❌ No aircraft IDs available for testing")
            return False
            
        aircraft_id = self.aircraft_ids[0]
        
        # Get initial aircraft data to check view_count and last_viewed fields
        success1, initial_data = self.run_test(
            f"Get Initial Aircraft Data: {aircraft_id}",
            "GET",
            f"api/aircraft/{aircraft_id}",
            200
        )
        
        if not success1:
            return False
            
        # Check if view_count and last_viewed fields exist
        initial_view_count = initial_data.get('view_count', 0)
        initial_last_viewed = initial_data.get('last_viewed')
        
        print(f"   Initial view_count: {initial_view_count}")
        print(f"   Initial last_viewed: {initial_last_viewed}")
        
        # Test tracking a page view
        success2, view_response = self.run_test(
            f"Track Page View: {aircraft_id}",
            "POST",
            f"api/aircraft/{aircraft_id}/view",
            200
        )
        
        if not success2:
            return False
            
        # Verify response includes updated view count
        if isinstance(view_response, dict):
            returned_view_count = view_response.get('view_count')
            if returned_view_count == initial_view_count + 1:
                print(f"   ✅ View count incremented correctly: {initial_view_count} -> {returned_view_count}")
            else:
                print(f"   ❌ View count not incremented correctly: expected {initial_view_count + 1}, got {returned_view_count}")
                return False
        
        # Get updated aircraft data to verify changes
        success3, updated_data = self.run_test(
            f"Get Updated Aircraft Data: {aircraft_id}",
            "GET",
            f"api/aircraft/{aircraft_id}",
            200
        )
        
        if not success3:
            return False
            
        # Verify view_count was incremented and last_viewed was updated
        updated_view_count = updated_data.get('view_count', 0)
        updated_last_viewed = updated_data.get('last_viewed')
        
        if updated_view_count == initial_view_count + 1:
            print(f"   ✅ View count persisted correctly: {updated_view_count}")
        else:
            print(f"   ❌ View count not persisted: expected {initial_view_count + 1}, got {updated_view_count}")
            return False
            
        if updated_last_viewed != initial_last_viewed:
            print(f"   ✅ Last viewed timestamp updated")
        else:
            print(f"   ❌ Last viewed timestamp not updated")
            return False
        
        # Test multiple views on same aircraft
        success4, view_response2 = self.run_test(
            f"Track Second Page View: {aircraft_id}",
            "POST",
            f"api/aircraft/{aircraft_id}/view",
            200
        )
        
        if success4 and isinstance(view_response2, dict):
            second_view_count = view_response2.get('view_count')
            if second_view_count == initial_view_count + 2:
                print(f"   ✅ Multiple views tracked correctly: {second_view_count}")
            else:
                print(f"   ❌ Multiple views not tracked correctly: expected {initial_view_count + 2}, got {second_view_count}")
                return False
        
        return success1 and success2 and success3 and success4

    def test_page_view_tracking_invalid_aircraft(self):
        """Test page view tracking with non-existent aircraft ID"""
        success, response = self.run_test(
            "Track Page View (Invalid Aircraft ID)",
            "POST",
            "api/aircraft/invalid-aircraft-id-123/view",
            404
        )
        
        return success

    def test_aircraft_analytics(self):
        """Test aircraft analytics endpoint"""
        success, response = self.run_test(
            "Get Aircraft Analytics",
            "GET",
            "api/aircraft-analytics",
            200
        )
        
        if not success:
            return False
            
        if not isinstance(response, dict):
            print(f"   ❌ Analytics response is not a dictionary")
            return False
            
        # Check required fields in analytics response
        required_fields = ['most_viewed', 'trending', 'category_analytics', 'total_views']
        for field in required_fields:
            if field not in response:
                print(f"   ❌ Missing required field: {field}")
                return False
            else:
                print(f"   ✅ Found required field: {field}")
        
        # Verify most_viewed is a list
        most_viewed = response.get('most_viewed', [])
        if isinstance(most_viewed, list):
            print(f"   ✅ most_viewed is a list with {len(most_viewed)} items")
            
            # Check if sorted by view_count descending
            if len(most_viewed) > 1:
                is_sorted = all(
                    most_viewed[i].get('view_count', 0) >= most_viewed[i+1].get('view_count', 0)
                    for i in range(len(most_viewed)-1)
                )
                if is_sorted:
                    print(f"   ✅ most_viewed is sorted by view_count descending")
                else:
                    print(f"   ❌ most_viewed is not sorted correctly")
                    return False
        else:
            print(f"   ❌ most_viewed is not a list")
            return False
        
        # Verify trending is a list
        trending = response.get('trending', [])
        if isinstance(trending, list):
            print(f"   ✅ trending is a list with {len(trending)} items")
        else:
            print(f"   ❌ trending is not a list")
            return False
        
        # Verify category_analytics is a list
        category_analytics = response.get('category_analytics', [])
        if isinstance(category_analytics, list):
            print(f"   ✅ category_analytics is a list with {len(category_analytics)} items")
            
            # Check structure of category analytics
            if category_analytics:
                first_category = category_analytics[0]
                required_category_fields = ['_id', 'total_views', 'aircraft_count', 'avg_views_per_aircraft']
                for field in required_category_fields:
                    if field not in first_category:
                        print(f"   ❌ Missing field in category analytics: {field}")
                        return False
                print(f"   ✅ Category analytics structure is correct")
        else:
            print(f"   ❌ category_analytics is not a list")
            return False
        
        # Verify total_views is a number
        total_views = response.get('total_views', 0)
        if isinstance(total_views, (int, float)):
            print(f"   ✅ total_views is a number: {total_views}")
        else:
            print(f"   ❌ total_views is not a number: {type(total_views)}")
            return False
        
        return True

    def test_aircraft_model_view_fields(self):
        """Test that aircraft model includes view_count and last_viewed fields"""
        if not self.aircraft_ids:
            print("❌ No aircraft IDs available for testing")
            return False
            
        aircraft_id = self.aircraft_ids[0]
        success, response = self.run_test(
            f"Verify Aircraft Model View Fields: {aircraft_id}",
            "GET",
            f"api/aircraft/{aircraft_id}",
            200
        )
        
        if not success:
            return False
            
        if not isinstance(response, dict):
            print(f"   ❌ Aircraft response is not a dictionary")
            return False
        
        # Check view_count field
        if 'view_count' in response:
            view_count = response.get('view_count')
            if isinstance(view_count, int) and view_count >= 0:
                print(f"   ✅ view_count field present and valid: {view_count}")
            else:
                print(f"   ❌ view_count field invalid: {view_count} (type: {type(view_count)})")
                return False
        else:
            print(f"   ❌ view_count field missing from aircraft model")
            return False
        
        # Check last_viewed field (can be null for new aircraft)
        if 'last_viewed' in response:
            last_viewed = response.get('last_viewed')
            print(f"   ✅ last_viewed field present: {last_viewed}")
        else:
            print(f"   ❌ last_viewed field missing from aircraft model")
            return False
        
        return True

    def test_archived_aircraft_excluded_from_analytics(self):
        """Test that archived aircraft are excluded from analytics"""
        # First get analytics to see current state
        success1, analytics_response = self.run_test(
            "Get Analytics (Before Archive Test)",
            "GET",
            "api/aircraft-analytics",
            200
        )
        
        if not success1:
            return False
            
        # Get all aircraft including archived ones
        success2, all_aircraft = self.run_test(
            "Get All Aircraft (Including Archived)",
            "GET",
            "api/aircraft",
            200,
            params={"include_archived": True}
        )
        
        if not success2:
            return False
            
        # Get non-archived aircraft
        success3, non_archived_aircraft = self.run_test(
            "Get Non-Archived Aircraft",
            "GET",
            "api/aircraft",
            200
        )
        
        if not success3:
            return False
            
        # Verify that analytics only includes non-archived aircraft
        most_viewed = analytics_response.get('most_viewed', [])
        most_viewed_ids = [aircraft.get('id') for aircraft in most_viewed]
        non_archived_ids = [aircraft.get('id') for aircraft in non_archived_aircraft]
        
        # Check that all aircraft in most_viewed are in non_archived list
        all_non_archived = all(aircraft_id in non_archived_ids for aircraft_id in most_viewed_ids)
        
        if all_non_archived:
            print(f"   ✅ Analytics correctly excludes archived aircraft")
        else:
            print(f"   ❌ Analytics may include archived aircraft")
            return False
        
        return True

def main():
    print("🚀 Starting Aircraft Review Platform API Tests")
    print("=" * 60)
    
    # Setup
    tester = AircraftAPITester()
    
    # Run all tests
    test_results = []
    
    # NEW 3-LEVEL HIERARCHY TEST - PRIORITY
    test_results.append(tester.test_new_3_level_hierarchy())
    
    # Basic API tests
    test_results.append(tester.test_get_all_aircraft())
    test_results.append(tester.test_get_categories())
    test_results.append(tester.test_get_stats())
    
    # Authentication tests
    test_results.append(tester.test_auth_endpoints())
    test_results.append(tester.test_google_oauth_verification())
    test_results.append(tester.test_logout_functionality())
    
    # Individual aircraft tests
    test_results.append(tester.test_get_aircraft_by_id())
    test_results.append(tester.test_get_aircraft_reviews())
    
    # Aircraft model field tests
    test_results.append(tester.test_aircraft_model_view_fields())
    test_results.append(tester.test_multiple_images_support())
    
    # NEW PAGE VIEW TRACKING TESTS
    test_results.append(tester.test_page_view_tracking())
    test_results.append(tester.test_page_view_tracking_invalid_aircraft())
    test_results.append(tester.test_aircraft_analytics())
    test_results.append(tester.test_archived_aircraft_excluded_from_analytics())
    
    # Archive/restore functionality test
    test_results.append(tester.test_archive_restore_functionality())
    
    # Review system tests
    test_results.append(tester.test_create_review())
    
    # Filtering and search tests
    test_results.append(tester.test_aircraft_filtering())
    test_results.append(tester.test_search_functionality())
    
    # Admin endpoint tests (unauthorized)
    test_results.append(tester.test_admin_endpoints_unauthorized())
    
    # Error handling test
    test_results.append(tester.test_invalid_aircraft_id())
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed! Backend API is working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main())