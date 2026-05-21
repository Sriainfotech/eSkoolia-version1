# School ERP - Django REST Framework API

## 🎯 Project Overview

This is a complete Django REST Framework rewrite of the School ERP system. The project converts PHP/Laravel backend logic into a modern, scalable, production-ready REST API.

**Status**: ✅ Core API Structure Complete | 🔄 Ready for Module Implementation

## 📁 Documentation Structure

### For Getting Started
1. **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** - Complete API endpoint reference
2. **[CONVERSION_GUIDE.md](CONVERSION_GUIDE.md)** - How to convert PHP code to Django
3. **[README.md](.\/README.md)** - Quick start guide

### For Development
4. **[FEES_MODULE_EXAMPLE.py](FEES_MODULE_EXAMPLE.py)** - Complete example module (Models, Serializers, Views, URLs)
5. **[TESTING_GUIDE.md](TESTING_GUIDE.md)** - Complete testing examples and patterns

### For Deployment
6. **[PRODUCTION_GUIDE.md](PRODUCTION_GUIDE.md)** - Deployment, security, monitoring, and optimization

## 🚀 Quick Start

```bash
# 1. Setup virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Setup database
python manage.py migrate

# 4. Create superuser
python manage.py createsuperuser

# 5. Run development server
python manage.py runserver

# 6. Access API
# Swagger: http://localhost:8000/api/docs/
# Redoc: http://localhost:8000/api/redoc/
```

## 📊 Project Structure

```
rewrite/backend/
├── config/                          # Project configuration
│   ├── settings/
│   │   ├── base.py                 # Base settings
│   │   ├── local.py                # Local development
│   │   └── production.py           # Production
│   ├── urls.py                      # Main URL routing
│   ├── wsgi.py                      # WSGI configuration
│   ├── exception_handler.py         # Custom exceptions
│   └── urls_improved.py             # Improved URL organization
│
├── apps/
│   ├── core/                        # Core functionality
│   │   ├── models.py               # Core models (School, Class, etc)
│   │   ├── serializers.py          # Core serializers
│   │   ├── base_serializers.py     # Reusable serializer base classes ✨ NEW
│   │   ├── viewsets.py             # PaginatedModelViewSet base class ✨ NEW
│   │   ├── exceptions.py           # Custom exceptions ✨ NEW
│   │   ├── responses.py            # Response utilities ✨ NEW
│   │   ├── utils.py                # Helper functions ✨ NEW
│   │   ├── urls.py
│   │   └── views.py
│   │
│   ├── academics/                   # Academic management
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   │
│   ├── students/                    # Student management
│   ├── attendance/                  # Attendance tracking
│   ├── admissions/                  # Admissions management
│   ├── access_control/              # Roles & permissions
│   ├── tenancy/                     # Multi-school support
│   └── users/                       # Authentication & users
│
├── tests/
│   └── test_api.py
│
├── requirements.txt
├── manage.py
│
├── API_DOCUMENTATION.md            # API reference ✨ NEW
├── CONVERSION_GUIDE.md             # PHP to Django guide ✨ NEW
├── FEES_MODULE_EXAMPLE.py          # Complete example ✨ NEW
├── TESTING_GUIDE.md                # Testing patterns ✨ NEW
├── PRODUCTION_GUIDE.md             # Deployment guide ✨ NEW
└── this file
```

## ✨ What's New in This Update

### 1. **Exception Handling Framework** (`apps/core/exceptions.py`)
- Custom exception classes for consistent error responses
- `APIError`, `ValidationError`, `ResourceNotFound`, `PermissionDenied`, etc.
- Standardized error response format across all endpoints

### 2. **Response Utilities** (`apps/core/responses.py`)
- `StandardizedResponse` class for consistent responses
- `APIResponseMixin` for ViewSets
- Success and error response templates

### 3. **Base ViewSet Classes** (`apps/core/viewsets.py`)
- `PaginatedModelViewSet` - Base for all API endpoints
- Automatic pagination, filtering, and sorting
- School tenant scoping
- Standardized CRUD responses
- Custom action support

### 4. **Reusable Serializers** (`apps/core/base_serializers.py`)
- `AuditedModelSerializer` - Base for models with timestamps
- `TenantScopedSerializer` - Multi-school support
- `DynamicFieldsSerializer` - Selective field inclusion
- `BulkOperationSerializer` - Bulk operations support
- Legacy PHP-style field aliases

### 5. **API Utilities** (`apps/core/utils.py`)
- `DateTimeUtils` - Date handling and parsing
- `SearchUtils` - Search and filtering utilities
- `ValidationUtils` - Common validations
- `PaginationUtils` - Pagination helpers
- `AggregationUtils` - Statistics and grouping
- `BulkOperationUtils` - Bulk CRUD operations
- `ResponseFormatUtils` - Response formatting

### 6. **Comprehensive Documentation** ✨ NEW
- **API_DOCUMENTATION.md** - Complete API reference with examples
- **CONVERSION_GUIDE.md** - Step-by-step guide for PHP to Django conversion
- **FEES_MODULE_EXAMPLE.py** - Complete working example (Models→Serializers→Views→URLs)
- **TESTING_GUIDE.md** - Full testing examples and best practices
- **PRODUCTION_GUIDE.md** - Deployment, security, monitoring, performance

### 7. **Updated Settings** (`config/settings/base.py`)
- Custom exception handler configured
- Search and Ordering filters added
- Improved REST_FRAMEWORK configuration
- Better error handling

## 🔄 API Endpoints

### Academics Management
```
GET    /api/academics/class-subjects/
POST   /api/academics/class-subjects/
GET    /api/academics/class-teachers/
POST   /api/academics/class-teachers/
GET    /api/academics/class-routines/
GET    /api/academics/homeworks/
GET    /api/academics/lessons/
```

### Student Management
```
GET    /api/students/students/
POST   /api/students/students/
GET    /api/students/categories/
GET    /api/students/guardians/
```

### Attendance
```
GET    /api/attendance/attendance/
POST   /api/attendance/attendance/
GET    /api/attendance/attendance/students?class_id=1&section_id=1&date=2024-01-01
POST   /api/attendance/attendance/bulk/
```

### Admissions
```
GET    /api/admissions/inquiries/
POST   /api/admissions/inquiries/
GET    /api/admissions/followups/
```

### Access Control
```
GET    /api/access-control/roles/
POST   /api/access-control/roles/
GET    /api/access-control/user-roles/
GET    /api/access-control/permissions/
```

## 📝 Common Query Parameters

### Pagination
```
?page=2&page_size=50
```

### Search
```
?search=john
```

### Filtering
```
?active_status=true&class_id=1
```

### Ordering
```
?ordering=-created_at
```

### Field Selection
```
?fields=id,name,email
```

## 🔐 Authentication

```bash
# Get tokens
curl -X POST http://localhost:8000/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"user@email.com","password":"password"}'

# Response
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}

# Use access token
curl -H "Authorization: Bearer <access_token>" \
  http://localhost:8000/api/students/students/

# Refresh token
curl -X POST http://localhost:8000/auth/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh":"<refresh_token>"}'
```

## 📋 Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### List Response
```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "pagination": {
    "count": 100,
    "page": 1,
    "page_size": 25,
    "total_pages": 4,
    "has_next": true
  },
  "data": [...]
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "validation_error",
    "message": "Invalid data provided",
    "details": {}
  }
}
```

## 🛠️ How to Use These Tools

### 1. Creating a New Module

See `CONVERSION_GUIDE.md` for step-by-step instructions.

```bash
# Create new app
python manage.py startapp fees

# Follow the structure:
# 1. Create models (see FEES_MODULE_EXAMPLE.py)
# 2. Create serializers (extend TenantScopedSerializer)
# 3. Create ViewSets (extend PaginatedModelViewSet)
# 4. Create URLs (register with DefaultRouter)
```

### 2. Converting PHP Code

Reference `FEES_MODULE_EXAMPLE.py` which shows the complete conversion:
- PHP Fees Controller → Django FeesGroupViewSet, FeesTypeViewSet, etc.
- With all business logic maintained
- With proper error handling and validation

### 3. Testing Endpoints

See `TESTING_GUIDE.md` for comprehensive testing examples.

```bash
# Run tests
python manage.py test

# Run with coverage
pip install coverage
coverage run --source='.' manage.py test
coverage report
```

### 4. Deploying to Production

See `PRODUCTION_GUIDE.md` for:
- Docker deployment
- Server deployment (Ubuntu/Nginx)
- SSL setup
- Database configuration
- Monitoring and backups
- Performance optimization

## 📚 API Documentation

Auto-generated documentation available at:
- **Swagger UI**: http://localhost:8000/api/docs/
- **ReDoc**: http://localhost:8000/api/redoc/
- **Schema**: http://localhost:8000/api/schema/

## ✅ Production Readiness Checklist

- [x] User authentication (JWT)
- [x] Multi-school support (tenancy)
- [x] Role-based access control
- [x] Pagination and filtering
- [x] Exception handling
- [x] Request validation
- [x] API documentation
- [x] Unit tests template
- [x] Docker support ready
- [x] Security headers configured
- [x] Logging structure in place
- [x] Performance optimization guidelines
- [ ] Rate limiting (TODO)
- [ ] API versioning (TODO)
- [ ] Call monitoring (TODO)

## 🔧 Key Features

✅ **Tenant Scoping** - Multi-school support with automatic filtering
✅ **Input Validation** - Serializer-based validation with custom rules
✅ **Error Handling** - Standardized error responses via custom exception handler
✅ **Pagination** - Configurable pagination with metadata
✅ **Filtering & Search** - Query parameter based filtering
✅ **Authentication** - JWT token-based authentication
✅ **Permissions** - Role-based access control
✅ **Documentation** - Auto-generated API docs (Swagger, ReDoc)
✅ **Testing** - Complete testing examples and patterns
✅ **Production Ready** - Docker, Nginx, PostgreSQL, monitoring setup

## 🚦 Status

| Component | Status | Notes |
|-----------|--------|-------|
| Core Framework | ✅ Complete | Ready for use |
| Academics Module | ✅ Complete | All endpoints implemented |
| Students Module | ✅ Complete | All endpoints implemented |
| Attendance Module | ✅ Complete | All endpoints implemented |
| Admissions Module | ✅ Complete | All endpoints implemented |
| Access Control | ✅ Complete | Role & permission system |
| Documentation | ✅ Complete | API, Conversion, Testing, Production |
| Tests | ✅ Template Ready | Examples provided |
| Docker Setup | ✅ Ready | docker-compose included |
| Deployment | ✅ Guide Complete | Ubuntu/Nginx/SSL instructions |

## 📖 Next Steps

1. **Read** [CONVERSION_GUIDE.md](CONVERSION_GUIDE.md) to understand how to convert PHP modules
2. **Study** [FEES_MODULE_EXAMPLE.py](FEES_MODULE_EXAMPLE.py) for a complete working example
3. **Implement** new modules following the same pattern
4. **Test** using patterns from [TESTING_GUIDE.md](TESTING_GUIDE.md)
5. **Deploy** following [PRODUCTION_GUIDE.md](PRODUCTION_GUIDE.md)

## 🤝 Contributing

When adding new modules:
1. Extend `PaginatedModelViewSet` for ViewSets
2. Extend `TenantScopedSerializer` for Serializers
3. Add proper docstrings
4. Include comprehensive tests
5. Update API_DOCUMENTATION.md

## 📞 Support

For questions about:
- **Conversion**: See CONVERSION_GUIDE.md
- **API Usage**: See API_DOCUMENTATION.md
- **Testing**: See TESTING_GUIDE.md
- **Deployment**: See PRODUCTION_GUIDE.md

---

**Created**: March 18, 2026
**Version**: 1.0.0
**DRF Version**: 3.14+
**Django Version**: 5.0+
