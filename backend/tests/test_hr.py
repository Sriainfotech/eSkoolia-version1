"""
Tests — HR serializer behavior
===============================
Covers staff serializer address/email representation and alias mapping.
"""

import pytest
from django.contrib.auth import get_user_model

from apps.hr.models import Staff
from apps.hr.serializers import StaffSerializer


@pytest.mark.django_db
class TestStaffSerializer:
    def test_to_representation_exposes_city_state_aliases(self, school):
        User = get_user_model()
        user = User.objects.create_user(
            username="staff_test_user",
            email="staff_test@example.com",
            password="TestPass@123",
            school=school,
        )

        staff = Staff.objects.create(
            school=school,
            user=user,
            staff_no="HR-001",
            first_name="Test",
            join_date="2026-01-01",
            status="active",
            custom_field={
                "current_city": "Bangalore",
                "current_state": "Karnataka",
                "pincode": "560001",
            },
        )

        data = StaffSerializer(staff).data

        assert data["city"] == "Bangalore"
        assert data["state"] == "Karnataka"
        assert data["current_pin"] == "560001"
        assert data["current_city"] == "Bangalore"
        assert data["current_state"] == "Karnataka"

    def test_to_representation_falls_back_to_current_address_for_city_and_pin(self, school):
        User = get_user_model()
        user = User.objects.create_user(
            username="staff_test_user2",
            email="staff_test2@example.com",
            password="TestPass@123",
            school=school,
        )

        staff = Staff.objects.create(
            school=school,
            user=user,
            staff_no="HR-002",
            first_name="Fallback",
            join_date="2026-01-01",
            status="active",
            current_address="Miyapur",
        )

        data = StaffSerializer(staff).data

        assert data["city"] == "Miyapur"
        assert data["current_city"] == "Miyapur"
        assert data["current_state"] == ""
        assert data["current_pin"] == ""

        user2 = User.objects.create_user(
            username="staff_test_user3",
            email="staff_test3@example.com",
            password="TestPass@123",
            school=school,
        )

        staff_with_pin = Staff.objects.create(
            school=school,
            user=user2,
            staff_no="HR-003",
            first_name="PinFallback",
            join_date="2026-01-01",
            status="active",
            current_address="Ameerpet 500038",
        )

        data_with_pin = StaffSerializer(staff_with_pin).data
        assert data_with_pin["city"] == ""
        assert data_with_pin["current_pin"] == "500038"
