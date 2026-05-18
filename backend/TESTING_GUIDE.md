"""
API Testing Best Practices and Template
Complete examples for testing Django REST Framework endpoints
"""

# ============================================================================
# TESTING TEMPLATE (tests/test_api.py or apps/module/tests.py)
# ============================================================================

from django.test import TestCase, TransactionTestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient, APITestCase
from rest_framework import status
from django.utils import timezone
from datetime import timedelta

User = get_user_model()


class BaseAPITestCase(APITestCase):
    """
    Base test case for all API tests.
    Provides common setup, authentication, and assertion methods.
    """
    
    def setUp(self):
        """Set up test data"""
        self.client = APIClient()
        
        # Create a school
        from apps.tenancy.models import School
        self.school = School.objects.create(
            name="Test School",
            code="TS001",
            email="test@school.com"
        )
        
        # Create admin user
        self.admin_user = User.objects.create_user(
            username='admin',
            password='admin@123',
            email='admin@test.com',
            school=self.school,
            is_staff=True,
            is_superuser=True
        )
        
        # Create regular user (teacher)
        self.teacher_user = User.objects.create_user(
            username='teacher',
            password='teacher@123',
            email='teacher@test.com',
            school=self.school
        )
        
        # Create non-school user (should have limited access)
        self.other_school_user = User.objects.create_user(
            username='other',
            password='other@123',
            email='other@test.com',
            school=None
        )
    
    def authenticate(self, user):
        """Authenticate as a specific user"""
        self.client.force_authenticate(user=user)
    
    def logout(self):
        """Logout the current user"""
        self.client.force_authenticate(user=None)
    
    def assert_success_response(self, response, expected_status=status.HTTP_200_OK):
        """Assert that response was successful"""
        self.assertEqual(response.status_code, expected_status)
        self.assertTrue(response.json().get('success'))
    
    def assert_error_response(self, response, expected_status=status.HTTP_400_BAD_REQUEST):
        """Assert that response was an error"""
        self.assertEqual(response.status_code, expected_status)
        self.assertFalse(response.json().get('success'))


# ============================================================================
# EXAMPLE: Fees API Tests
# ============================================================================

class FeesGroupAPITestCase(BaseAPITestCase):
    """Test cases for Fees Group API endpoints"""
    
    def setUp(self):
        super().setUp()
        
        # Create academic year
        from apps.core.models import AcademicYear
        self.academic_year = AcademicYear.objects.create(
            school=self.school,
            name="2024-2025",
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=365),
            is_current=True
        )
    
    def test_create_fees_group_authenticated(self):
        """Test creating a fees group as authenticated user"""
        self.authenticate(self.teacher_user)
        
        data = {
            'name': 'Tuition Fees',
            'description': 'Monthly tuition fees',
            'active_status': True,
            'academic_year': self.academic_year.id,
        }
        
        response = self.client.post('/api/fees/groups/', data, format='json')
        self.assert_success_response(response, status.HTTP_201_CREATED)
        self.assertEqual(response.json()['data']['name'], 'Tuition Fees')
    
    def test_create_fees_group_unauthenticated(self):
        """Test that unauthenticated users cannot create fees groups"""
        data = {
            'name': 'Tuition Fees',
            'description': 'Monthly tuition fees',
        }
        
        response = self.client.post('/api/fees/groups/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_create_fees_group_duplicate_name(self):
        """Test that duplicate fee group names raise validation error"""
        from apps.fees.models import FeesGroup
        
        # Create first group
        FeesGroup.objects.create(
            school=self.school,
            academic_year=self.academic_year,
            name='Tuition Fees',
            description='Monthly tuition'
        )
        
        self.authenticate(self.teacher_user)
        
        # Try to create duplicate
        data = {
            'name': 'Tuition Fees',
            'description': 'Duplicate',
            'academic_year': self.academic_year.id,
        }
        
        response = self.client.post('/api/fees/groups/', data, format='json')
        self.assert_error_response(response, status.HTTP_400_BAD_REQUEST)
    
    def test_list_fees_groups(self):
        """Test listing fees groups"""
        from apps.fees.models import FeesGroup
        
        # Create a few groups
        for i in range(3):
            FeesGroup.objects.create(
                school=self.school,
                academic_year=self.academic_year,
                name=f'Group {i}',
                description=f'Description {i}'
            )
        
        self.authenticate(self.teacher_user)
        response = self.client.get('/api/fees/groups/', format='json')
        
        self.assert_success_response(response, status.HTTP_200_OK)
        self.assertEqual(response.json()['pagination']['count'], 3)
    
    def test_list_fees_groups_filtered_by_school(self):
        """Test that users only see their school's data"""
        from apps.fees.models import FeesGroup
        from apps.tenancy.models import School
        
        # Create another school with its own fees group
        other_school = School.objects.create(name="Other School")
        FeesGroup.objects.create(
            school=other_school,
            academic_year=self.academic_year,
            name='Other School Group'
        )
        
        # Create group for our school
        FeesGroup.objects.create(
            school=self.school,
            academic_year=self.academic_year,
            name='Our School Group'
        )
        
        self.authenticate(self.teacher_user)
        response = self.client.get('/api/fees/groups/', format='json')
        
        self.assert_success_response(response)
        # Should only see 1 group (not the other school's)
        self.assertEqual(response.json()['pagination']['count'], 1)
    
    def test_retrieve_fees_group(self):
        """Test retrieving a specific fees group"""
        from apps.fees.models import FeesGroup
        
        group = FeesGroup.objects.create(
            school=self.school,
            academic_year=self.academic_year,
            name='Tuition Fees'
        )
        
        self.authenticate(self.teacher_user)
        response = self.client.get(f'/api/fees/groups/{group.id}/', format='json')
        
        self.assert_success_response(response)
        self.assertEqual(response.json()['data']['name'], 'Tuition Fees')
    
    def test_update_fees_group(self):
        """Test updating a fees group"""
        from apps.fees.models import FeesGroup
        
        group = FeesGroup.objects.create(
            school=self.school,
            academic_year=self.academic_year,
            name='Tuition Fees'
        )
        
        self.authenticate(self.teacher_user)
        data = {'name': 'Updated Tuition Fees', 'description': 'Updated description'}
        response = self.client.put(f'/api/fees/groups/{group.id}/', data, format='json')
        
        self.assert_success_response(response, status.HTTP_200_OK)
        self.assertEqual(response.json()['data']['name'], 'Updated Tuition Fees')
    
    def test_delete_fees_group(self):
        """Test deleting a fees group"""
        from apps.fees.models import FeesGroup
        
        group = FeesGroup.objects.create(
            school=self.school,
            academic_year=self.academic_year,
            name='Tuition Fees'
        )
        
        self.authenticate(self.teacher_user)
        response = self.client.delete(f'/api/fees/groups/{group.id}/', format='json')
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(FeesGroup.objects.filter(id=group.id).exists())
    
    def test_search_fees_groups(self):
        """Test searching fees groups"""
        from apps.fees.models import FeesGroup
        
        FeesGroup.objects.create(
            school=self.school,
            academic_year=self.academic_year,
            name='Tuition Fees'
        )
        FeesGroup.objects.create(
            school=self.school,
            academic_year=self.academic_year,
            name='Transport Fees'
        )
        
        self.authenticate(self.teacher_user)
        response = self.client.get('/api/fees/groups/?search=Tuition', format='json')
        
        self.assert_success_response(response)
        self.assertEqual(response.json()['pagination']['count'], 1)
    
    def test_pagination(self):
        """Test pagination"""
        from apps.fees.models import FeesGroup
        
        # Create 30 groups
        for i in range(30):
            FeesGroup.objects.create(
                school=self.school,
                academic_year=self.academic_year,
                name=f'Group {i}'
            )
        
        self.authenticate(self.teacher_user)
        
        # First page (default 25 per page)
        response = self.client.get('/api/fees/groups/?page=1', format='json')
        self.assert_success_response(response)
        self.assertEqual(len(response.json()['data']), 25)
        self.assertTrue(response.json()['pagination']['has_next'])
        
        # Second page
        response = self.client.get('/api/fees/groups/?page=2', format='json')
        self.assertEqual(len(response.json()['data']), 5)
        self.assertFalse(response.json()['pagination']['has_next'])
    
    def test_custom_page_size(self):
        """Test custom page size"""
        from apps.fees.models import FeesGroup
        
        for i in range(20):
            FeesGroup.objects.create(
                school=self.school,
                academic_year=self.academic_year,
                name=f'Group {i}'
            )
        
        self.authenticate(self.teacher_user)
        response = self.client.get('/api/fees/groups/?page_size=10', format='json')
        
        self.assertEqual(len(response.json()['data']), 10)


# ============================================================================
# PERFORMANCE Testing
# ============================================================================

class PerformanceTestCase(TransactionTestCase):
    """Test cases for API performance"""
    
    def setUp(self):
        self.client = APIClient()
        from apps.tenancy.models import School
        from apps.core.models import AcademicYear
        
        self.school = School.objects.create(name="Test School")
        self.academic_year = AcademicYear.objects.create(
            school=self.school,
            name="2024",
            is_current=True
        )
        
        self.user = User.objects.create_user(
            username='test',
            password='test@123',
            school=self.school
        )
    
    def test_list_endpoint_query_count(self):
        """Test that list endpoint doesn't have N+1 query problem"""
        from django.test.utils import override_settings
        from apps.fees.models import FeesGroup
        
        # Create test data
        for i in range(10):
            FeesGroup.objects.create(
                school=self.school,
                academic_year=self.academic_year,
                name=f'Group {i}'
            )
        
        self.client.force_authenticate(user=self.user)
        
        # Use assertNumQueries to check query count
        with self.assertNumQueries(3):  # Adjust based on actual queries
            response = self.client.get('/api/fees/groups/')
            self.assertEqual(response.status_code, status.HTTP_200_OK)


# ============================================================================
# ERROR Handling Tests
# ============================================================================

class ErrorHandlingTestCase(BaseAPITestCase):
    """Test cases for API error handling"""
    
    def test_invalid_json(self):
        """Test handling of invalid JSON"""
        self.authenticate(self.teacher_user)
        
        response = self.client.post(
            '/api/fees/groups/',
            'invalid json',
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_missing_required_field(self):
        """Test handling of missing required fields"""
        self.authenticate(self.teacher_user)
        
        data = {
            'description': 'Missing name field'
        }
        
        response = self.client.post('/api/fees/groups/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.json()['success'])
    
    def test_404_not_found(self):
        """Test handling of non-existent resource"""
        self.authenticate(self.teacher_user)
        
        response = self.client.get('/api/fees/groups/999999/', format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_method_not_allowed(self):
        """Test handling of disallowed HTTP methods"""
        self.authenticate(self.teacher_user)
        
        response = self.client.patch('/api/fees/groups/1/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


# ============================================================================
# RUNNING TESTS
# ============================================================================

"""
Run tests from command line:

# Run all tests
python manage.py test

# Run specific test class
python manage.py test apps.fees.tests.FeesGroupAPITestCase

# Run specific test method
python manage.py test apps.fees.tests.FeesGroupAPITestCase.test_create_fees_group_authenticated

# Run with verbosity
python manage.py test -v 2

# Run with coverage
pip install coverage
coverage run --source='.' manage.py test
coverage report

# Run with profile
python -m py_spy record -o profile.svg -- python manage.py test

# Run pytest against the dedicated test settings (default in backend/pytest.ini)
pytest

# Force a fresh PostgreSQL test database on the next run
pytest --create-db

# Inspect test database hygiene and list any test tenant schemas
DJANGO_SETTINGS_MODULE=config.settings.test python manage.py test_db_hygiene --show-reset-steps

# Remove only tenant schemas that were created for tests
DJANGO_SETTINGS_MODULE=config.settings.test python manage.py test_db_hygiene --cleanup-test-schemas
"""

## Test Hygiene Notes

- Pytest now uses `config.settings.test` by default.
- `--reuse-db` is not enabled by default because it can preserve stale PostgreSQL state.
- If you intentionally need reuse for local debugging, set `PYTEST_ALLOW_REUSE_DB=1` explicitly.
- If you do not provide `DATABASE_URL_TEST`, local pytest runs fall back to an isolated SQLite test database.
- The `test_db_hygiene` command never drops public schema objects or non-test tenant schemas.
- For Neon or other managed PostgreSQL instances, prefer `pytest --create-db` for clean runs instead of manual table cleanup.
