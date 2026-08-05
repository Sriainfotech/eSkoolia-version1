from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from decimal import Decimal
from datetime import timedelta

from apps.core.models import (
    ItemCategory, ItemStore, Supplier, Item, ItemReceive, ItemReceiveChild,
    ItemIssue, ItemSell, ItemSellChild
)
from apps.tenancy.models import School
from apps.users.models import User


class ReportTestSetup(APITestCase):
    """Base test setup for all report tests"""

    def setUp(self):
        """Setup test data"""
        # Create school
        self.school = School.objects.create(
            name="Test School",
            code="TS001",
            is_active=True
        )

        # Create user and get token
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
            school=self.school
        )

        refresh = RefreshToken.for_user(self.user)
        self.token = str(refresh.access_token)

        # Create test data
        self._create_test_data()

    def _create_test_data(self):
        """Create sample data for testing"""
        # Create categories
        self.category1 = ItemCategory.objects.create(
            school=self.school,
            title="Electronics",
            description="Electronic items",
            is_active=True
        )

        # Create stores
        self.store1 = ItemStore.objects.create(
            school=self.school,
            title="Main Store",
            location="Building A",
            is_active=True
        )

        # Create supplier
        self.supplier1 = Supplier.objects.create(
            school=self.school,
            name="ABC Supplies",
            contact_person="John Doe",
            phone="+1-555-0123",
            email="john@abc.com",
            is_active=True
        )

        # Create items
        self.item1 = Item.objects.create(
            school=self.school,
            category=self.category1,
            item_code="ITEM-001",
            name="Laptop",
            unit="piece",
            quantity=Decimal("50.00"),
            reorder_level=Decimal("20.00"),
            unit_cost=Decimal("800.00"),
            unit_price=Decimal("1000.00"),
            supplier=self.supplier1,
            is_active=True
        )

        self.item2 = Item.objects.create(
            school=self.school,
            category=self.category1,
            item_code="ITEM-002",
            name="Mouse",
            unit="piece",
            quantity=Decimal("5.00"),
            reorder_level=Decimal("50.00"),
            unit_cost=Decimal("25.00"),
            unit_price=Decimal("35.00"),
            supplier=self.supplier1,
            is_active=True
        )

        # Create receive transaction
        self.receive1 = ItemReceive.objects.create(
            school=self.school,
            supplier=self.supplier1,
            receive_date=timezone.now().date(),
            total_amount=Decimal("40000.00"),
            discount=Decimal("0.00"),
            tax=Decimal("0.00"),
            payment_status="pending",
            reference_no="RCV-001",
            created_by=self.user
        )

        ItemReceiveChild.objects.create(
            receive=self.receive1,
            item=self.item1,
            quantity=Decimal("50.00"),
            unit_cost=Decimal("800.00"),
            total_cost=Decimal("40000.00")
        )

        # Create issue transaction
        self.issue1 = ItemIssue.objects.create(
            school=self.school,
            issue_date=timezone.now().date(),
            store=self.store1,
            subject="Equipment issue",
            notes="Test issue",
            issued_by=self.user
        )

        # Create sale transaction
        self.sale1 = ItemSell.objects.create(
            school=self.school,
            sell_date=timezone.now().date(),
            total_amount=Decimal("10000.00"),
            discount=Decimal("0.00"),
            tax=Decimal("0.00"),
            payment_status="completed",
            reference_no="SAL-001",
            sold_to="Customer XYZ",
            created_by=self.user
        )

        ItemSellChild.objects.create(
            sell=self.sale1,
            item=self.item1,
            quantity=Decimal("10.00"),
            unit_price=Decimal("1000.00")
        )

    def get_auth_headers(self):
        """Get authorization headers"""
        return {
            'HTTP_AUTHORIZATION': f'Bearer {self.token}',
            'content_type': 'application/json'
        }


class CategoryReportTestCase(ReportTestSetup):
    """Test category reports"""

    def test_get_category_report(self):
        """Test fetching category report"""
        response = self.client.get(
            '/api/v1/reports/categories/',
            **self.get_auth_headers()
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Check summary
        self.assertIn('summary', data)
        self.assertGreaterEqual(data['summary']['total_categories'], 1)
        self.assertGreaterEqual(data['summary']['total_items'], 2)

        # Check details
        self.assertIn('details', data)
        self.assertGreaterEqual(len(data['details']), 1)

    def test_category_report_with_status_filter(self):
        """Test category report with status filter"""
        response = self.client.get(
            '/api/v1/reports/categories/?status=active',
            **self.get_auth_headers()
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()

        # All returned categories should be active
        for detail in data['details']:
            self.assertEqual(detail['status'], 'active')


class StoreReportTestCase(ReportTestSetup):
    """Test store reports"""

    def test_get_store_report(self):
        """Test fetching store report"""
        response = self.client.get(
            '/api/v1/reports/stores/',
            **self.get_auth_headers()
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Check summary
        self.assertIn('summary', data)
        self.assertEqual(data['summary']['total_stores'], 1)
        self.assertGreaterEqual(data['summary']['total_items_stored'], 1)
        self.assertGreaterEqual(data['summary']['total_transactions'], 3)

        # Check details
        self.assertIn('details', data)
        self.assertEqual(len(data['details']), 1)

    def test_store_report_calculations(self):
        """Test store report calculations"""
        response = self.client.get(
            '/api/v1/reports/stores/',
            **self.get_auth_headers()
        )

        data = response.json()
        store_detail = data['details'][0]

        # Verify store details
        self.assertEqual(store_detail['store_name'], 'Main Store')
        self.assertGreaterEqual(store_detail['total_receives'], 1)
        self.assertGreaterEqual(store_detail['total_issues'], 1)
        self.assertGreaterEqual(store_detail['total_sales'], 1)


class SupplierReportTestCase(ReportTestSetup):
    """Test supplier reports"""

    def test_get_supplier_report(self):
        """Test fetching supplier report"""
        response = self.client.get(
            '/api/v1/reports/suppliers/',
            **self.get_auth_headers()
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Check summary
        self.assertIn('summary', data)
        self.assertEqual(data['summary']['total_suppliers'], 1)
        self.assertGreaterEqual(data['summary']['total_purchases'], 1)

        # Check details
        self.assertIn('details', data)
        self.assertEqual(len(data['details']), 1)

    def test_supplier_detail_calculations(self):
        """Test supplier detail calculations"""
        response = self.client.get(
            '/api/v1/reports/suppliers/',
            **self.get_auth_headers()
        )

        data = response.json()
        supplier_detail = data['details'][0]

        # Verify supplier details
        self.assertEqual(supplier_detail['supplier_name'], 'ABC Supplies')
        self.assertGreaterEqual(supplier_detail['total_purchases'], 1)
        self.assertGreaterEqual(Decimal(supplier_detail['total_purchase_value']), 0)


class ItemReportTestCase(ReportTestSetup):
    """Test item reports"""

    def test_get_item_report(self):
        """Test fetching item report"""
        response = self.client.get(
            '/api/v1/reports/items/',
            **self.get_auth_headers()
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Check summary
        self.assertIn('summary', data)
        self.assertEqual(data['summary']['total_items'], 2)
        self.assertGreaterEqual(Decimal(data['summary']['total_stock_units']), 1)

        # Check details
        self.assertIn('details', data)
        self.assertGreaterEqual(len(data['details']), 2)

    def test_item_report_low_stock_indicator(self):
        """Test low stock indicator in item report"""
        response = self.client.get(
            '/api/v1/reports/items/',
            **self.get_auth_headers()
        )

        data = response.json()
        
        # Find item2 which should be low stock
        item2_detail = next(
            (d for d in data['details'] if d['item_code'] == 'ITEM-002'),
            None
        )

        self.assertIsNotNone(item2_detail)
        self.assertEqual(item2_detail['status_indicator'], 'Low Stock')

    def test_item_report_with_category_filter(self):
        """Test item report with category filter"""
        response = self.client.get(
            f'/api/v1/reports/items/?category_id={self.category1.id}',
            **self.get_auth_headers()
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()

        # All items should be from the filter category
        for detail in data['details']:
            self.assertEqual(detail['category_name'], 'Electronics')


class ReceiveReportTestCase(ReportTestSetup):
    """Test receive/purchase reports"""

    def test_get_receive_report(self):
        """Test fetching receive report"""
        response = self.client.get(
            '/api/v1/reports/receives/',
            **self.get_auth_headers()
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Check summary
        self.assertIn('summary', data)
        self.assertEqual(data['summary']['total_receives'], 1)

        # Check details
        self.assertIn('details', data)
        self.assertEqual(len(data['details']), 1)

        # Check line items
        self.assertIn('line_items', data)
        self.assertGreaterEqual(len(data['line_items']), 1)

    def test_receive_report_calculations(self):
        """Test receive report calculations"""
        response = self.client.get(
            '/api/v1/reports/receives/',
            **self.get_auth_headers()
        )

        data = response.json()
        detail = data['details'][0]

        # Verify calculations
        self.assertEqual(detail['receive_number'], f'RCV-{self.receive1.id}')
        self.assertEqual(detail['total_items'], 1)
        self.assertEqual(detail['total_quantity'], '50.00')


class IssueReportTestCase(ReportTestSetup):
    """Test issue/distribution reports"""

    def test_get_issue_report(self):
        """Test fetching issue report"""
        response = self.client.get(
            '/api/v1/reports/issues/',
            **self.get_auth_headers()
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Check summary
        self.assertIn('summary', data)
        self.assertEqual(data['summary']['total_issues'], 1)

        # Check details
        self.assertIn('details', data)
        self.assertEqual(len(data['details']), 1)

        # Check line items (should be empty for issues)
        self.assertIn('line_items', data)
        self.assertEqual(len(data['line_items']), 0)


class SalesReportTestCase(ReportTestSetup):
    """Test sales reports"""

    def test_get_sales_report(self):
        """Test fetching sales report"""
        response = self.client.get(
            '/api/v1/reports/sales/',
            **self.get_auth_headers()
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Check summary
        self.assertIn('summary', data)
        self.assertEqual(data['summary']['total_sales'], 1)

        # Check details
        self.assertIn('details', data)
        self.assertEqual(len(data['details']), 1)

        # Check line items
        self.assertIn('line_items', data)
        self.assertGreaterEqual(len(data['line_items']), 1)


class DashboardTestCase(ReportTestSetup):
    """Test inventory dashboard"""

    def test_get_inventory_dashboard(self):
        """Test fetching inventory dashboard"""
        response = self.client.get(
            '/api/v1/reports/dashboard/',
            **self.get_auth_headers()
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Check summary
        self.assertIn('summary', data)
        summary = data['summary']
        self.assertGreaterEqual(summary['total_items'], 2)
        self.assertGreaterEqual(summary['total_categories'], 1)
        self.assertGreaterEqual(summary['total_stores'], 1)

        # Check recent activities
        self.assertIn('recent_activities', data)
        self.assertGreaterEqual(len(data['recent_activities']), 1)

        # Check distributions
        self.assertIn('top_items_by_value', data)
        self.assertIn('top_items_by_quantity', data)
        self.assertIn('store_distribution', data)
        self.assertIn('category_distribution', data)

    def test_dashboard_recent_activities(self):
        """Test dashboard recent activities"""
        response = self.client.get(
            '/api/v1/reports/dashboard/',
            **self.get_auth_headers()
        )

        data = response.json()
        activities = data['recent_activities']

        # Should have receive, issue, and sales activities
        activity_types = set(a['activity_type'] for a in activities)
        self.assertIn('RECEIVE', activity_types)
        self.assertIn('ISSUE', activity_types)
        self.assertIn('SALE', activity_types)


class DateRangeFilterTestCase(ReportTestSetup):
    """Test date range filtering"""

    def test_receive_report_with_date_range(self):
        """Test receive report with date range filter"""
        today = timezone.now().date()
        tomorrow = today + timedelta(days=1)

        response = self.client.get(
            f'/api/v1/reports/receives/?start_date={today}&end_date={tomorrow}',
            **self.get_auth_headers()
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Should have the receive from today
        self.assertEqual(data['summary']['total_receives'], 1)

    def test_receive_report_with_invalid_date_format(self):
        """Test receive report with invalid date format"""
        response = self.client.get(
            '/api/v1/reports/receives/?start_date=03-26-2026',
            **self.get_auth_headers()
        )

        # Should still work but ignore invalid date
        self.assertEqual(response.status_code, 200)


class AuthenticationTestCase(ReportTestSetup):
    """Test authentication for reports"""

    def test_report_without_authentication(self):
        """Test accessing report without authentication"""
        response = self.client.get('/api/v1/reports/items/')
        self.assertEqual(response.status_code, 401)

    def test_report_with_invalid_token(self):
        """Test accessing report with invalid token"""
        response = self.client.get(
            '/api/v1/reports/items/',
            HTTP_AUTHORIZATION='Bearer invalid_token'
        )
        self.assertEqual(response.status_code, 401)
