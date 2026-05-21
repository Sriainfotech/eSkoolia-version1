# Docker/Django REST Framework API - Conversion Guide

## Complete Project Structure

```
rewrite/
  backend/
    ├── manage.py
    ├── requirements.txt
    ├── db.sqlite3
    ├── API_DOCUMENTATION.md
    ├── FEES_MODULE_EXAMPLE.py        # Example: Fees module conversion
    ├── CONVERSION_GUIDE.md            # This file
    ├── config/
    │   ├── __init__.py
    │   ├── settings/
    │   │   ├── __init__.py
    │   │   ├── base.py               # Base settings
    │   │   ├── local.py              # Local development
    │   │   └── production.py          # Production settings
    │   ├── urls.py                   # Main URL routing
    │   ├── wsgi.py
    │   ├── asgi.py
    │   ├── exception_handler.py       # Custom exception handlers
    │   └── urls_improved.py           # Improved URL organization
    │
    ├── apps/
    │   ├── core/
    │   │   ├── models.py             # Core models (School, Class, etc)
    │   │   ├── serializers.py        # Core serializers
    │   │   ├── base_serializers.py   # Base classes for all serializers
    │   │   ├── viewsets.py           # PaginatedModelViewSet base class
    │   │   ├── utils.py              # Utility functions (validation, pagination, etc)
    │   │   ├── exceptions.py         # Custom exceptions
    │   │   ├── responses.py          # Response formatting utilities
    │   │   └── urls.py
    │   │
    │   ├── academics/
    │   │   ├── models.py
    │   │   ├── serializers.py
    │   │   ├── views.py
    │   │   └── urls.py
    │   │
    │   ├── students/
    │   │   ├── models.py
    │   │   ├── serializers.py
    │   │   ├── views.py
    │   │   └── urls.py
    │   │
    │   ├── attendance/
    │   │   ├── models.py
    │   │   ├── serializers.py
    │   │   ├── views.py
    │   │   └── urls.py
    │   │
    │   ├── admissions/
    │   │   ├── models.py
    │   │   ├── serializers.py
    │   │   ├── views.py
    │   │   └── urls.py
    │   │
    │   ├── access_control/
    │   │   ├── models.py
    │   │   ├── serializers.py
    │   │   ├── views.py
    │   │   ├── permission_classes.py
    │   │   └── urls.py
    │   │
    │   ├── tenancy/
    │   │   ├── models.py
    │   │   ├── serializers.py
    │   │   └── middleware.py
    │   │
    │   ├── users/
    │   │   ├── models.py
    │   │   ├── serializers.py
    │   │   ├── views.py
    │   │   └── urls.py
    │   │
    │   └── fees/                     # NEW: Fees module
    │       ├── models.py
    │       ├── serializers.py
    │       ├── views.py
    │       └── urls.py
    │
    └── tests/
```

## Step-by-Step Conversion Process

### Step 1: Understand the PHP Code
- Identify all models/entities used
- List all API endpoints and their operations
- Document business logic and validation rules
- Note any special requirements or edge cases

### Step 2: Create Django Models
- Create models in `models.py` matching the database schema
- Add foreign keys for relationships
- Add validators for data integrity
- Add database constraints
- Add Meta options (db_table, ordering, unique_together)

**Example from PHP Fees Controller → Django Model:**

```php
// PHP Laravel Model
class FmFeesGroup extends Model {
    protected $table = 'fm_fees_groups';
    protected $fillable = ['school_id', 'academic_id', 'name', 'description'];
}
```

```python
# Django Model
class FeesGroup(models.Model):
    school = models.ForeignKey('tenancy.School', on_delete=models.CASCADE)
    academic_year = models.ForeignKey('core.AcademicYear', on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'fees_groups'
        unique_together = [['school', 'academic_year', 'name']]
```

### Step 3: Create Serializers
- Create serializers for validation and response formatting
- Add custom validators for business logic
- Handle read-only fields (id, timestamps)
- Support nested relationships

**Example:**

```python
from apps.core.base_serializers import TenantScopedSerializer

class FeesGroupSerializer(TenantScopedSerializer):
    fees_types_count = serializers.SerializerMethodField()
    
    class Meta:
        model = FeesGroup
        fields = ['id', 'school_id', 'name', 'description', 'fees_types_count']
        read_only_fields = ['id', 'school', 'created_at']
    
    def get_fees_types_count(self, obj):
        return obj.fees_types.filter(active_status=True).count()
    
    def validate_name(self, value):
        # Custom validation
        if FeesGroup.objects.filter(name=value).exists():
            raise serializers.ValidationError("Name already exists")
        return value
```

### Step 4: Create ViewSets
- Extend `PaginatedModelViewSet` from `apps.core.viewsets`
- Implement `get_queryset()` with school filtering
- Override CRUD methods as needed
- Add custom `@action` endpoints for special operations

**Example:**

```python
from apps.core.viewsets import PaginatedModelViewSet

class FeesGroupViewSet(PaginatedModelViewSet):
    model = FeesGroup
    serializer_class = FeesGroupSerializer
    filterset_fields = ['active_status']
    search_fields = ['name']
    ordering_fields = ['name', 'created_at']
    
    def get_queryset(self):
        user = self.request.user
        queryset = FeesGroup.objects.select_related('school', 'academic_year')
        
        if not user.is_superuser:
            queryset = queryset.filter(school_id=user.school_id)
        
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(school_id=self.request.user.school_id)
    
    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        # Handle bulk creation
        serializer = self.get_serializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)
```

### Step 5: Register URLs
- Create URL router in `urls.py`
- Register all ViewSets
- Include app URLs in main `config/urls.py`

**Example:**

```python
# apps/fees/urls.py
from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import FeesGroupViewSet, FeesTypeViewSet

router = DefaultRouter()
router.register('groups', FeesGroupViewSet, basename='fees-group')
router.register('types', FeesTypeViewSet, basename='fees-type')

urlpatterns = [path('', include(router.urls))]
```

### Step 6: Add Tests
- Create tests for each ViewSet
- Test CRUD operations
- Test filtering and searching
- Test permissions and error handling

```python
# apps/fees/tests.py
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

class FeesGroupViewSetTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        # Create test data
    
    def test_list_fees_groups(self):
        response = self.client.get('/api/fees/groups/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_create_fees_group(self):
        data = {'name': 'Tuition', 'description': 'Monthly tuition'}
        response = self.client.post('/api/fees/groups/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
```

### Step 7: Migration from PHP
- Dump data from PHP/MySQL database
- Write Django data migration or import script
- Test data integrity
- Deploy to Django application

## PHP to Django Mapping Reference

| PHP/Laravel | Django |
|-------------|--------|
| Model class | `models.Model` |
| `$fillable` | `fields` in Meta |
| `hasMany()` | `ForeignKey` with `related_name` |
| `belongsTo()` | `ForeignKey` |
| `belongsToMany()` | `ManyToManyField` |
| Route controller | ViewSet class |
| Request validation | Serializer validation |
| DB query | Django ORM QuerySet |
| Auth::user()->school_id | `self.request.user.school_id` |
| where() clause | `.filter()` |
| select / join | `.select_related()` `.prefetch_related()` |
| pluck / get | `.values()` `.values_list()` |
| save() | `.save()` |
| delete() | `.delete()` |
| JSON response | `Response()` |

## Common Patterns

### Tenant Scoping (Multi-School)
```python
def get_queryset(self):
    user = self.request.user
    queryset = Model.objects.all()
    
    if not user.is_superuser:
        queryset = queryset.filter(school_id=user.school_id)
    
    return queryset
```

### Custom Validation
```python
def validate(self, data):
    if data['end_date'] <= data['start_date']:
        raise serializers.ValidationError("end_date must be after start_date")
    return data
```

### Custom Actions
```python
@action(detail=False, methods=['get'])
def summary(self, request):
    queryset = self.get_queryset()
    return Response({
        'total': queryset.count(),
        'active': queryset.filter(active_status=True).count()
    })
```

### Bulk Operations
```python
@action(detail=False, methods=['post'])
def bulk_delete(self, request):
    ids = request.data.get('ids', [])
    count, _ = Model.objects.filter(id__in=ids).delete()
    return Response({'deleted': count})
```

### Filtering Examples
```
GET /api/model/?field=value
GET /api/model/?search=term
GET /api/model/?ordering=-created_at
GET /api/model/?page=2&page_size=50
```

## Production Checklist

- [ ] Use environment variables for secrets
- [ ] Enable CORS only for allowed origins
- [ ] Set DEBUG=False in production
- [ ] Use PostgreSQL instead of SQLite
- [ ] Implement rate limiting
- [ ] Add API versioning
- [ ] Create comprehensive API docs
- [ ] Add logging and monitoring
- [ ] Configure email alerts for errors
- [ ] Setup automated backups
- [ ] Run security checks (python manage.py check --deploy)
- [ ] Load test the API
- [ ] Setup CI/CD pipeline
- [ ] Document all endpoints
- [ ] Create deployment guide

## API Response Format

All successful responses:
```json
{
  "success": true,
  "message": "Operation description",
  "data": {},
  "pagination": {}  // for list endpoints
}
```

All error responses:
```json
{
  "success": false,
  "error": {
    "code": "error_code",
    "message": "Human readable message",
    "details": {}  // optional
  }
}
```

## Status Codes

- 200: OK
- 201: Created
- 204: No Content
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict
- 500: Server Error

## Next Steps

1. Create new app: `python manage.py startapp app_name`
2. Create models following the pattern
3. Create migrations: `python manage.py makemigrations`
4. Create serializers with validation
5. Create ViewSets extending PaginatedModelViewSet
6. Register URLs
7. Test endpoints with Postman/Insomnia
8. Deploy to staging
9. Load testing
10. Deploy to production
