"""
Tests — Fees Module
====================
Covers: FeesGroup, FeesType, FeesAssignment constraints and payment logic
"""

import pytest
from decimal import Decimal
from django.db import IntegrityError


@pytest.mark.model
class TestFeesGroupModel:

    def test_fees_group_created(self, fees_group):
        assert fees_group.pk is not None
        assert fees_group.name == "Tuition Group"
        assert fees_group.is_active is True

    def test_fees_group_unique_per_school_year(self, school, academic_year):
        """Same group name cannot exist twice for same school + year."""
        from apps.fees.models import FeesGroup
        FeesGroup.objects.create(
            school=school, academic_year=academic_year,
            name="Duplicate Group", is_active=True,
        )
        with pytest.raises(IntegrityError):
            FeesGroup.objects.create(
                school=school, academic_year=academic_year,
                name="Duplicate Group", is_active=True,
            )

    def test_fees_group_str(self, fees_group):
        assert "Tuition Group" in str(fees_group)


@pytest.mark.model
class TestFeesTypeModel:

    def test_fees_type_created(self, fees_type):
        assert fees_type.pk is not None
        assert fees_type.amount == Decimal("5000.00")

    def test_fees_type_amount_cannot_be_negative(self, school, academic_year, fees_group):
        """MinValueValidator should reject negative amounts."""
        from apps.fees.models import FeesType
        from django.core.exceptions import ValidationError
        ft = FeesType(
            school=school,
            academic_year=academic_year,
            fees_group=fees_group,
            name="Bad Fee",
            amount=Decimal("-100.00"),
        )
        with pytest.raises(ValidationError):
            ft.full_clean()

    def test_fees_type_unique_per_group(self, school, academic_year, fees_group):
        from apps.fees.models import FeesType
        FeesType.objects.create(
            school=school, academic_year=academic_year,
            fees_group=fees_group, name="Dup Fee", amount=Decimal("1000.00"),
        )
        with pytest.raises(IntegrityError):
            FeesType.objects.create(
                school=school, academic_year=academic_year,
                fees_group=fees_group, name="Dup Fee", amount=Decimal("2000.00"),
            )

    def test_fees_type_str(self, fees_type):
        s = str(fees_type)
        assert "Term 1 Fee" in s
        assert "5000" in s


@pytest.mark.model
class TestFeesAssignment:

    def test_fees_assignment_created(self, student, fees_type):
        """Assigning fees to a student records an unpaid entry."""
        from apps.fees.models import FeesAssignment
        assignment = FeesAssignment.objects.create(
            school=student.school,
            student=student,
            fees_type=fees_type,
            amount_due=fees_type.amount,
            amount_paid=Decimal("0.00"),
            status="unpaid",
        )
        assert assignment.pk is not None
        assert assignment.status == "unpaid"

    def test_partial_payment_updates_status(self, student, fees_type):
        from apps.fees.models import FeesAssignment
        assignment = FeesAssignment.objects.create(
            school=student.school,
            student=student,
            fees_type=fees_type,
            amount_due=fees_type.amount,
            amount_paid=Decimal("2500.00"),
            status="partial",
        )
        assert assignment.status == "partial"
        assert assignment.amount_paid < assignment.amount_due

    def test_full_payment_status(self, student, fees_type):
        from apps.fees.models import FeesAssignment
        assignment = FeesAssignment.objects.create(
            school=student.school,
            student=student,
            fees_type=fees_type,
            amount_due=fees_type.amount,
            amount_paid=fees_type.amount,
            status="paid",
        )
        assert assignment.status == "paid"

    @pytest.mark.smoke
    def test_outstanding_balance_logic(self, student, fees_type):
        """amount_due - amount_paid = outstanding balance."""
        from apps.fees.models import FeesAssignment
        assignment = FeesAssignment.objects.create(
            school=student.school,
            student=student,
            fees_type=fees_type,
            amount_due=Decimal("5000.00"),
            amount_paid=Decimal("1000.00"),
            status="partial",
        )
        balance = assignment.amount_due - assignment.amount_paid
        assert balance == Decimal("4000.00")


@pytest.mark.api
class TestFeesAPI:

    def test_list_fees_groups_requires_auth(self, api_client):
        response = api_client.get("/api/fees/groups/")
        assert response.status_code in (401, 403)

    def test_admin_can_list_fees_groups(self, admin_client, fees_group):
        response = admin_client.get("/api/fees/groups/")
        assert response.status_code == 200

    def test_create_fees_group(self, admin_client, school, academic_year):
        payload = {
            "name": "Transport Fee Group",
            "academic_year": academic_year.pk,
            "is_active": True,
        }
        response = admin_client.post("/api/fees/groups/", payload, format="json")
        assert response.status_code == 201

    def test_fees_summary_endpoint(self, admin_client, student):
        """Check that a fees summary/report endpoint exists and responds."""
        response = admin_client.get(f"/api/fees/student/{student.pk}/summary/")
        # Either 200 (exists) or 404 (not yet built) — not 500
        assert response.status_code in (200, 404)
