# Quick Reference Card - Django REST API

## 📋 Checklist: Creating a New Module

```bash
# 1. Create app
python manage.py startapp mymodule

# 2. Create models.py
# 3. Create serializers.py
# 4. Create views.py
# 5. Create urls.py
# 6. Add to INSTALLED_APPS in settings
python manage.py makemigrations mymodule
python manage.py migrate

# 7. Test
python manage.py runserver
# Visit http://localhost:8000/api/docs/
```

---

## 🏗️ Module Template

### models.py
```python
from django.db import models

class MyModel(models.Model):
    school = models.ForeignKey('tenancy.School', on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    active_status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'my_models'
        ordering = ['-created_at']
        unique_together = [['school', 'name']]
```

### serializers.py
```python
from apps.core.base_serializers import TenantScopedSerializer

class MySerializer(TenantScopedSerializer):
    class Meta:
        model = MyModel
        fields = ['id', 'school_id', 'name', 'active_status', 'created_at']
        read_only_fields = ['id', 'school', 'created_at']
```

### views.py
```python
from apps.core.viewsets import PaginatedModelViewSet
from .models import MyModel
from .serializers import MySerializer

class MyViewSet(PaginatedModelViewSet):
    model = MyModel
    serializer_class = MySerializer
    filterset_fields = ['active_status']
    search_fields = ['name']
    ordering_fields = ['name', 'created_at']
```

### urls.py
```python
from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import MyViewSet

router = DefaultRouter()
router.register('my-models', MyViewSet, basename='my-model')

urlpatterns = [path('', include(router.urls))]
```

---

## 🔗 API Patterns

### List with Pagination
```
GET /api/module/?page=2&page_size=50
```

### Search
```
GET /api/module/?search=john
```

### Filter
```
GET /api/module/?active_status=true&class_id=1
```

### Order
```
GET /api/module/?ordering=-created_at
```

### Select Fields
```
GET /api/module/?fields=id,name,email
```

### Combine
```
GET /api/module/?search=john&active_status=true&ordering=-created_at&page=1&page_size=25
```

---

## ✅ Response Patterns

### Success (200)
```json
{
  "success": true,
  "message": "Success message",
  "data": {...}
}
```

### Created (201)
```json
{
  "success": true,
  "message": "Resource created successfully",
  "data": {...}
}
```

### List (200)
```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "pagination": {
    "count": 100,
    "page": 1,
    "page_size": 25,
    "total_pages": 4
  },
  "data": [...]
}
```

### Error (400+)
```json
{
  "success": false,
  "error": {
    "code": "validation_error",
    "message": "Error message"
  }
}
```

---

## 🛡️ Permissions Pattern

```python
from rest_framework.permissions import IsAuthenticated, BasePermission

class IsSchoolAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_superuser or request.user.school_id

class MyViewSet(PaginatedModelViewSet):
    permission_classes = [IsAuthenticated, IsSchoolAdmin]
```

---

## 🔍 Custom Actions

```python
from rest_framework.decorators import action
from rest_framework.response import Response

class MyViewSet(PaginatedModelViewSet):
    @action(detail=False, methods=['get'])
    def summary(self, request):
        queryset = self.get_queryset()
        return Response({
            "success": True,
            "data": {
                "total": queryset.count(),
                "active": queryset.filter(active_status=True).count()
            }
        })
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        obj = self.get_object()
        obj.active_status = True
        obj.save()
        return Response({"success": True, "data": self.get_serializer(obj).data})
```

---

## ✔️ Validation Pattern

```python
class MySerializer(TenantScopedSerializer):
    def validate_name(self, value):
        if len(value) < 3:
            raise serializers.ValidationError("Name too short")
        return value
    
    def validate(self, data):
        if data['end_date'] <= data['start_date']:
            raise serializers.ValidationError("end_date must be after start_date")
        return data
```

---

## 🧪 Test Pattern

```python
from rest_framework.test import APITestCase
from apps.core.tests import BaseAPITestCase

class MyTestCase(BaseAPITestCase):
    def test_create(self):
        self.authenticate(self.teacher_user)
        data = {'name': 'Test', 'active_status': True}
        response = self.client.post('/api/module/', data)
        self.assert_success_response(response, 201)
    
    def test_list(self):
        self.authenticate(self.teacher_user)
        response = self.client.get('/api/module/')
        self.assert_success_response(response, 200)
```

---

## 🚀 Common Django Commands

```bash
# Create migrations
python manage.py makemigrations app_name

# Apply migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run development server
python manage.py runserver

# Run tests
python manage.py test app_name.tests

# Django shell
python manage.py shell

# Check for errors
python manage.py check

# Security check
python manage.py check --deploy

# Collect static files
python manage.py collectstatic

# Generate API schema
python manage.py generateschema > openapi-schema.yml
```

---

## 🔐 Authentication

```bash
# Login
curl -X POST http://localhost:8000/auth/login/ \
  -d '{"username":"user","password":"pass"}'

# Use token
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/endpoint/

# Refresh token
curl -X POST http://localhost:8000/auth/refresh/ \
  -d '{"refresh":"<refresh_token>"}'

# Logout
curl -X POST http://localhost:8000/auth/logout/ \
  -d '{"refresh":"<refresh_token>"}'
```

---

## 📊 Exception Patterns

```python
from apps.core.exceptions import (
    ValidationError,
    ResourceNotFound,
    PermissionDenied,
    ConflictError,
    SchoolNotFound
)

# Raise validation error
raise ValidationError("Invalid data", code="invalid_email")

# Raise not found
raise ResourceNotFound("Student not found")

# Raise permission error
raise PermissionDenied("Not authorized")

# Raise conflict
raise ConflictError("Name already exists")

# Raise school not found
raise SchoolNotFound()
```

---

## 🛠️ Utility Functions

```python
from apps.core.utils import (
    DateTimeUtils,
    SearchUtils,
    ValidationUtils,
    PaginationUtils,
    AggregationUtils,
    BulkOperationUtils
)

# Parse date
date_obj = DateTimeUtils.parse_date("2024-01-15")

# Validate email
is_valid = ValidationUtils.validate_email("user@example.com")

# Paginate queryset
paginated = PaginationUtils.paginate_queryset(qs, page=1, page_size=25)

# Group by field
groups = AggregationUtils.group_by_field(queryset, 'class_id')

# Bulk delete
deleted_count, _ = BulkOperationUtils.bulk_delete(Model, ids=[1,2,3])
```

---

## 📁 File Locations

| Component | Location |
|-----------|----------|
| Models | `apps/module/models.py` |
| Serializers | `apps/module/serializers.py` |
| Views | `apps/module/views.py` |
| URLs | `apps/module/urls.py` |
| Tests | `apps/module/tests.py` |
| Base Classes | `apps/core/viewsets.py` |
| Exceptions | `apps/core/exceptions.py` |
| Utilities | `apps/core/utils.py` |
| Settings | `config/settings/base.py` |
| Main URLs | `config/urls.py` |

---

## 🔄 Status Codes Reference

| Code | Meaning | Use Case |
|------|---------|----------|
| 200 | OK | Successful GET/PUT |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid data |
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | No permission |
| 404 | Not Found | Resource missing |
| 409 | Conflict | Duplicate/conflict |
| 500 | Server Error | Unexpected error |

---

## 📖 Documentation Quick Links

| Document | Purpose |
|----------|---------|
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | All endpoints & examples |
| [CONVERSION_GUIDE.md](CONVERSION_GUIDE.md) | How to create modules |
| [FEES_MODULE_EXAMPLE.py](FEES_MODULE_EXAMPLE.py) | Complete working example |
| [TESTING_GUIDE.md](TESTING_GUIDE.md) | Testing patterns |
| [PRODUCTION_GUIDE.md](PRODUCTION_GUIDE.md) | Deployment & production |

---

**Print this page or save it! It's your quick reference while developing.**
