# Django Project Structure Reference

## Project Overview

This is a **Django REST Framework (DRF)** application for an educational management system. The project follows a modular architecture with clear separation of concerns.

**Location:** `backend/` directory  
**Type:** RESTful API built with Django 4.x and Django REST Framework  
**Database:** SQLite (development), PostgreSQL (production)

---

## 1. Existing Django Modules (Apps)

### Directory Structure

```
backend/
├── config/                 # Project configuration
│   ├── settings/          # Settings (base, local, production)
│   ├── urls.py           # Main URL router
│   ├── wsgi.py           # WSGI configuration
│   ├── asgi.py           # ASGI configuration
│   ├── celery.py         # Celery configuration
│   └── exception_handler.py
├── apps/                  # All Django applications
│   ├── core/             # Core utilities and common functionality
│   ├── tenancy/          # Multi-tenancy support (School/Tenant)
│   ├── users/            # User authentication and management
│   ├── access_control/   # RBAC (Role-Based Access Control)
│   ├── admissions/       # Student admission system
│   ├── students/         # Student records and profiles
│   ├── academics/        # Academic structure (classes, subjects)
│   ├── attendance/       # Attendance tracking
│   ├── fees/             # Fees management and payments
│   ├── exams/            # Examination system
│   ├── finance/          # Financial transactions
│   ├── hr/               # Human Resources (staff, leave, payroll)
│   ├── library/          # Library management
│   ├── behaviour/        # Student behavior/discipline
│   └── reports/          # Report generation
├── manage.py             # Django management script
├── requirements.txt      # Python dependencies
└── db.sqlite3           # Development database
```

### Current Modules Summary

| Module | Purpose | Key Features |
|--------|---------|--------------|
| **core** | Common utilities, base classes, exceptions | DateTimeUtils, SearchUtils, ValidationUtils |
| **tenancy** | Multi-school support, tenant isolation | School model, tenant middleware |
| **users** | Authentication, JWT tokens | User model, Login/Logout/Me endpoints |
| **access_control** | Role-Based Access Control | Role, Permission models with permission codes |
| **admissions** | Student admission queries | Admission applications, tracking |
| **students** | Student profiles and records | Student data, enrollment |
| **academics** | Academic structure | Classes, sections, subjects, class time-tables |
| **attendance** | Attendance tracking | Student/staff attendance records |
| **fees** | Fee management | Fee types, assignments, discounts, payments |
| **exams** | Exam system | Exam schedule, marks, results, online exams |
| **finance** | Financial management | Income, expense, accounts, bank reconciliation |
| **hr** | Human Resources | Staff, departments, designations, leave, payroll |
| **library** | Library operations | Books, categories, issue/return, fine management |
| **behaviour** | Discipline management | Student behavior records, complaints |
| **reports** | Report generation | Various school reports |

---

## 2. Sample Module Reference Architecture

### HR Module - Complete Example

The **HR Module** (`apps/hr/`) is a comprehensive module that demonstrates the full architecture pattern. Use it as a reference for implementing the Chat module.

#### Directory Structure

```
apps/hr/
├── __init__.py
├── apps.py              # App configuration
├── models.py            # Database models
├── serializers.py       # DRF serializers
├── views.py             # API views (ViewSets)
├── urls.py              # URL routing
├── migrations/          # Database migrations
│   ├── __init__.py
│   ├── 0001_initial.py
│   ├── 0002_hr_leave_define_staff_attendance_and_profile.py
│   └── 0003_staff_extended_profile_tabs.py
└── __pycache__/
```

#### File Details

##### **models.py** - Database Models

Defines ORM models with relationships and constraints:

```python
# Example pattern from HR module
class Department(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="departments")
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "hr_departments"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["school", "name"], name="uq_hr_dept_school_name"),
        ]

    def __str__(self):
        return self.name

class Staff(models.Model):
    STATUS_CHOICES = [
        ("active", "Active"),
        ("inactive", "Inactive"),
        ("terminated", "Terminated"),
    ]
    
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="staff_members")
    user = models.OneToOneField("users.User", on_delete=models.SET_NULL, null=True, blank=True)
    staff_no = models.CharField(max_length=40)
    first_name = models.CharField(max_length=80)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    join_date = models.DateField()
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "hr_staff"
        constraints = [
            models.UniqueConstraint(fields=["school", "staff_no"], name="uq_hr_staff_school_staff_no"),
        ]
```

**Key Patterns:**
- Always include `school` ForeignKey for multi-tenancy
- Use `related_name` for reverse relationships
- Add `created_at` and `updated_at` timestamps
- Use choice fields for status enums
- Define `Meta.db_table` for custom table names
- Add unique constraints in Meta for data integrity

##### **serializers.py** - REST Serializers

Converts models to/from JSON:

```python
from rest_framework import serializers
from .models import Department, Staff

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "school", "name", "description", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "school", "created_at", "updated_at"]

class StaffSerializer(serializers.ModelSerializer):
    class Meta:
        model = Staff
        fields = [
            "id", "school", "user", "staff_no", "first_name", "email", 
            "phone", "join_date", "status", "created_at", "updated_at"
        ]
        read_only_fields = ["id", "school", "created_at", "updated_at"]

    def validate(self, attrs):
        """Validate field relationships and school ownership"""
        request = self.context.get("request")
        school_id = request.user.school_id if request else None
        user = attrs.get("user") or getattr(self.instance, "user", None)
        
        if school_id and user and user.school_id and user.school_id != school_id:
            raise serializers.ValidationError(
                {"user": "Selected user does not belong to your school."}
            )
        return attrs
```

**Key Patterns:**
- Always mark `id`, `school`, `created_at`, `updated_at` as read-only
- Include validation to check school ownership
- Use context to access request/user information

##### **views.py** - API ViewSets

Handles HTTP requests and business logic:

```python
from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from rest_framework.response import Response

class SchoolScopedModelViewSet(viewsets.ModelViewSet):
    """Base ViewSet that auto-scopes queries to user's school"""
    permission_classes = [permissions.IsAuthenticated]
    permission_codes = {}  # Define permission codes for actions

    def get_required_permission_code(self):
        """Get permission code for current action"""
        action = getattr(self, "action", None)
        if action and action in self.permission_codes:
            return self.permission_codes[action]
        return self.permission_codes.get("*")

    def initial(self, request, *args, **kwargs):
        """Check permission codes before processing request"""
        super().initial(request, *args, **kwargs)
        code = self.get_required_permission_code()
        if not code:
            return
        user = request.user
        if user.is_superuser:
            return
        if not user.has_permission_code(code):
            raise PermissionDenied("You do not have permission to perform this action.")

    def get_queryset(self):
        """Auto-filter by school_id"""
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            return queryset
        if user.school_id:
            return queryset.filter(school_id=user.school_id)
        return queryset.none()

    def perform_create(self, serializer):
        """Auto-set school when creating objects"""
        user = self.request.user
        school = user.school
        if not school and not user.is_superuser:
            raise PermissionDenied("School context is required.")
        serializer.save(school=school)

class DepartmentViewSet(SchoolScopedModelViewSet):
    queryset = Department.objects.select_related("school").all()
    serializer_class = DepartmentSerializer
    filterset_fields = ["is_active"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at"]
    permission_codes = {"*": "human_resource.departments.view"}

class StaffViewSet(SchoolScopedModelViewSet):
    queryset = Staff.objects.select_related("school", "user", "department").all()
    serializer_class = StaffSerializer
    search_fields = ["first_name", "last_name", "email", "staff_no"]
    ordering_fields = ["first_name", "join_date"]
    permission_codes = {
        "*": "human_resource.staff.view",
        "create": "human_resource.staff.create",
        "update": "human_resource.staff.update",
        "destroy": "human_resource.staff.delete",
    }

    @action(detail=True, methods=["get"], permission_codes="human_resource.staff.view_profile")
    def profile(self, request, pk=None):
        """Custom endpoint: GET /api/v1/hr/staff/{id}/profile/"""
        staff = self.get_object()
        serializer = self.get_serializer(staff)
        return Response(serializer.data)
```

**Key Patterns:**
- Inherit from `SchoolScopedModelViewSet` for automatic school filtering
- Define `permission_codes` dict to map actions to permission codes
- Use `filterset_fields` for filtering support
- Use `search_fields` for search functionality
- `@action` decorator for custom endpoints
- Always check school ownership in validation

##### **urls.py** - URL Routing

Registers ViewSet routes:

```python
from rest_framework.routers import DefaultRouter
from .views import DepartmentViewSet, StaffViewSet

router = DefaultRouter()
router.register("departments", DepartmentViewSet, basename="hr-department")
router.register("staff", StaffViewSet, basename="hr-staff")

urlpatterns = router.urls

# Generates endpoints:
# GET/POST      /api/v1/hr/departments/
# GET/PUT/PATCH /api/v1/hr/departments/{id}/
# DELETE        /api/v1/hr/departments/{id}/
# GET           /api/v1/hr/departments/{id}/profile/
```

**Key Patterns:**
- Use DefaultRouter for automatic CRUD endpoints
- Register with descriptive basename
- Custom actions automatically get their own routes

##### **apps.py** - App Configuration

```python
from django.apps import AppConfig

class HrConfig(AppConfig):
    default_auto_field = 'django.db.BigAutoField'
    name = 'apps.hr'
    verbose_name = 'Human Resources'
```

---

## 3. Core Utilities Module

**Location:** `apps/core/`

Provides shared utilities for all modules:

### **core/utils.py** - Helper Functions

```python
# DateTimeUtils - Date/Time operations
class DateTimeUtils:
    @staticmethod
    def parse_date(date_str)
    @staticmethod
    def get_academic_year_dates(academic_year)
    @staticmethod
    def get_date_range(start_date, end_date)
    @staticmethod
    def get_month_range(year, month)

# SearchUtils - Filtering and searching
class SearchUtils:
    @staticmethod
    def build_search_query(search_term, search_fields)
    @staticmethod
    def apply_filters(queryset, filters)
    @staticmethod
    def apply_range_filter(queryset, field, start_value, end_value)

# ValidationUtils - Data validation
class ValidationUtils:
    # Add validation methods here
```

### **core/exceptions.py** - Custom Exceptions

```python
class InvalidQueryParams(Exception):
    pass

class SchoolContextRequired(Exception):
    pass
```

### **core/viewsets.py** - Base ViewSets

Contains `SchoolScopedModelViewSet` base class used by all modules.

---

## 4. Tenancy/Multi-Tenancy System

**Location:** `apps/tenancy/`

Ensures data isolation per school:

```python
class School(models.Model):
    """Represents each school/tenant"""
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    # ... other fields
```

**Pattern:** Every model has `school = models.ForeignKey("tenancy.School", ...)`

---

## 5. Main URL Configuration

**Location:** `config/urls.py`

```python
urlpatterns = [
    path("api/v1/auth/", include("apps.users.urls")),
    path("api/v1/access-control/", include("apps.access_control.urls")),
    path("api/v1/students/", include("apps.students.urls")),
    path("api/v1/academics/", include("apps.academics.urls")),
    path("api/v1/attendance/", include("apps.attendance.urls")),
    path("api/v1/fees/", include("apps.fees.urls")),
    path("api/v1/exams/", include("apps.exams.urls")),
    path("api/v1/finance/", include("apps.finance.urls")),
    path("api/v1/hr/", include("apps.hr.urls")),
    path("api/v1/library/", include("apps.library.urls")),
    path("api/v1/behaviour/", include("apps.behaviour.urls")),
    path("api/v1/reports/", include("apps.reports.urls")),
]
```

---

## 6. Chat/Message Module - Does NOT Exist

**Finding:** No existing Chat or Message-related Django module.

**Recommendation:** Create a new `messaging` or `chat` app following the patterns established by existing modules.

---

## 7. Architecture Pattern Template for New Module

Follow this structure when implementing the Chat module:

```
apps/messaging/                    # New module name
├── __init__.py
├── apps.py
├── models.py                      # Conversation, Message models
├── serializers.py                 # ConversationSerializer, MessageSerializer
├── views.py                       # ConversationViewSet, MessageViewSet
├── urls.py                        # Router and URL patterns
├── migrations/
│   └── __init__.py
└── __pycache__/
```

### Minimal Implementation Template

**models.py:**
```python
from django.db import models
from django.utils import timezone

class Conversation(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE)
    participants = models.ManyToManyField("users.User", related_name="conversations")
    title = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "messaging_conversations"

class Message(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey("users.User", on_delete=models.CASCADE)
    content = models.TextField()
    attachment = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "messaging_messages"
        ordering = ["created_at"]
```

**serializers.py:**
```python
from rest_framework import serializers
from .models import Conversation, Message

class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.get_full_name", read_only=True)
    
    class Meta:
        model = Message
        fields = ["id", "sender", "sender_name", "content", "attachment", "created_at"]
        read_only_fields = ["id", "sender", "created_at"]

class ConversationSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)
    
    class Meta:
        model = Conversation
        fields = ["id", "title", "participants", "messages", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]
```

**views.py:**
```python
from rest_framework import viewsets, permissions
from apps.core.viewsets import SchoolScopedModelViewSet
from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer

class ConversationViewSet(SchoolScopedModelViewSet):
    queryset = Conversation.objects.prefetch_related("participants", "messages").all()
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ["title", "participants__first_name"]

class MessageViewSet(SchoolScopedModelViewSet):
    queryset = Message.objects.select_related("sender", "conversation").all()
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]
```

**urls.py:**
```python
from rest_framework.routers import DefaultRouter
from .views import ConversationViewSet, MessageViewSet

router = DefaultRouter()
router.register("conversations", ConversationViewSet, basename="messaging-conversation")
router.register("messages", MessageViewSet, basename="messaging-message")

urlpatterns = router.urls
```

Then register in `config/settings/base.py`:
```python
INSTALLED_APPS = [
    # ... existing apps
    "apps.messaging",  # Add this
]
```

And include URLs in `config/urls.py`:
```python
path("api/v1/messaging/", include("apps.messaging.urls")),
```

---

## 8. Key Framework Dependencies

**Django:** Web framework
**Django REST Framework:** REST API toolkit
**djangorestframework-simplejwt:** JWT authentication
**drf-spectacular:** API schema/documentation
**django-filter:** Filtering support
**django-cors-headers:** CORS support
**python-dotenv:** Environment configuration
**Celery:** Async task handling
**Pillow:** Image handling

---

## 9. Settings Structure

**Location:** `config/settings/`

- **base.py** - Common settings for all environments
- **local.py** - Development settings
- **production.py** - Production settings

Environment variables are loaded from `.env` file.

---

## Summary

This project follows **Django best practices** with:
- Modular architecture (one app per feature)
- Multi-tenancy support (school isolation)
- RBAC with permission codes
- REST API with Swagger documentation
- Auto-scoped querysets by school
- Utility classes for common operations
- Comprehensive model relationships and constraints

Use the **HR module** as your reference for implementing any new module, including the Chat module.
