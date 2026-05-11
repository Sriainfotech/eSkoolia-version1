"""
Smoke tests for the admissions app.
These verify the app and its models/serializers import correctly and the
core admin-inquiry flow works end-to-end against the test database.
"""

import pytest


@pytest.mark.django_db
def test_admissions_app_loads():
    """App-level import sanity — models should be importable."""
    from apps.admissions import models  # noqa: F401
    assert hasattr(models, "AdmissionInquiry")


@pytest.mark.django_db
def test_admission_inquiry_create(school):
    """Create a minimal AdmissionInquiry and verify it is persisted."""
    from apps.admissions.models import AdmissionInquiry

    inquiry = AdmissionInquiry.objects.create(
        school=school,
        full_name="Test Student",
        phone="9000000000",
        status="new",
    )
    assert inquiry.pk is not None
    assert AdmissionInquiry.objects.filter(pk=inquiry.pk).exists()


@pytest.mark.django_db
def test_admissions_serializer_loads():
    """Serializer module should import without errors."""
    from apps.admissions import serializers  # noqa: F401
    assert hasattr(serializers, "AdmissionInquirySerializer")
