# REST API Documentation

## Base URL
```
http://localhost:8000/api/
```

## Authentication
All endpoints (except login/health) require JWT authentication header:
```
Authorization: Bearer <access_token>
```

## Response Format

### Success Response (200, 201, etc.)
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Resource data or list of resources
  }
}
```

### List Response (with Pagination)
```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "pagination": {
    "count": 100,
    "page": 1,
    "page_size": 25,
    "total_pages": 4,
    "has_next": true,
    "has_previous": false
  },
  "data": [
    // Array of resources
  ]
}
```

### Error Response (4xx, 5xx)
```json
{
  "success": false,
  "error": {
    "code": "error_code",
    "message": "Human-readable error message",
    "details": {} // Optional: additional details
  }
}
```

## Common Query Parameters

### Pagination
- `page` - Page number (default: 1)
- `page_size` - Items per page (default: 25, max: 100)

### Filtering
- `field_name=value` - Filter by specific field
- `search=term` - Search across defined search fields
- `ordering=field_name` - Order by field (prefix with `-` for descending)

### Field Selection (Dynamic Fields)
- `fields=id,name,email` - Return only specified fields

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 204 | No Content - Resource deleted successfully |
| 400 | Bad Request - Invalid data or parameters |
| 401 | Unauthorized - Authentication required or invalid |
| 403 | Forbidden - User doesn't have permission |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 500 | Internal Server Error - Server error |

## API Endpoints

### Authentication

#### Login
```
POST /auth/login
```
Request:
```json
{
  "username": "user@example.com",
  "password": "password123"
}
```
Response:
```json
{
  "access": "jwt_token",
  "refresh": "refresh_token"
}
```

#### Refresh Token
```
POST /auth/refresh
```
Request:
```json
{
  "refresh": "refresh_token"
}
```

#### Logout
```
POST /auth/logout
```
Request:
```json
{
  "refresh": "refresh_token"
}
```

#### Health Check
```
GET /health
```
No authentication required.

### Academics

#### Class Subject Assignments
```
GET    /api/academics/class-subjects/           - List all
POST   /api/academics/class-subjects/           - Create new
GET    /api/academics/class-subjects/{id}/      - Retrieve one
PUT    /api/academics/class-subjects/{id}/      - Update
DELETE /api/academics/class-subjects/{id}/      - Delete
```

#### Class Teacher Assignments
```
GET    /api/academics/class-teachers/           - List all
POST   /api/academics/class-teachers/           - Create new
GET    /api/academics/class-teachers/{id}/      - Retrieve one
PUT    /api/academics/class-teachers/{id}/      - Update
DELETE /api/academics/class-teachers/{id}/      - Delete
```

#### Class Routines
```
GET    /api/academics/class-routines/           - List all
POST   /api/academics/class-routines/           - Create new
GET    /api/academics/class-routines/{id}/      - Retrieve one
PUT    /api/academics/class-routines/{id}/      - Update
DELETE /api/academics/class-routines/{id}/      - Delete
```

#### Homework
```
GET    /api/academics/homeworks/                - List all
POST   /api/academics/homeworks/                - Create new
GET    /api/academics/homeworks/{id}/           - Retrieve one
PUT    /api/academics/homeworks/{id}/           - Update
DELETE /api/academics/homeworks/{id}/           - Delete
```

#### Homework Submissions
```
GET    /api/academics/homework-submissions/     - List all
POST   /api/academics/homework-submissions/     - Create new
GET    /api/academics/homework-submissions/{id}/ - Retrieve one
```

#### Upload Content
```
GET    /api/academics/upload-contents/          - List all
POST   /api/academics/upload-contents/          - Create new
GET    /api/academics/upload-contents/{id}/     - Retrieve one
```

#### Lessons
```
GET    /api/academics/lessons/                  - List all
POST   /api/academics/lessons/                  - Create new (or bulk create)
GET    /api/academics/lessons/{id}/             - Retrieve one
PUT    /api/academics/lessons/{id}/             - Update
DELETE /api/academics/lessons/{id}/             - Delete
GET    /api/academics/lessons/grouped/          - Get grouped by class/section/subject
DELETE /api/academics/lessons/delete-group/     - Delete group
```

#### Lesson Topics
```
GET    /api/academics/lesson-topics/            - List all
POST   /api/academics/lesson-topics/            - Create new
GET    /api/academics/lesson-topics/{id}/       - Retrieve one
```

### Attendance

#### Student Attendance
```
GET    /api/attendance/attendance/                      - List all
POST   /api/attendance/attendance/                      - Create new
GET    /api/attendance/attendance/{id}/                 - Retrieve one
GET    /api/attendance/attendance/students?class_id=1&section_id=1&date=2024-01-01  - Get students for date
POST   /api/attendance/attendance/bulk/                 - Bulk create
POST   /api/attendance/attendance/holiday/              - Mark holiday
GET    /api/attendance/attendance/report/               - Monthly report
```

### Students

#### Students
```
GET    /api/students/students/                  - List all
POST   /api/students/students/                  - Create new
GET    /api/students/students/{id}/             - Retrieve one
PUT    /api/students/students/{id}/             - Update
DELETE /api/students/students/{id}/             - Delete
```

#### Student Categories
```
GET    /api/students/categories/                - List all
POST   /api/students/categories/                - Create new
```

#### Guardians
```
GET    /api/students/guardians/                 - List all
POST   /api/students/guardians/                 - Create new
```

### Admissions

#### Admission Inquiries
```
GET    /api/admissions/inquiries/               - List all
POST   /api/admissions/inquiries/               - Create new
GET    /api/admissions/inquiries/{id}/          - Retrieve one
PUT    /api/admissions/inquiries/{id}/          - Update
```

#### Admission Follow-Up
```
GET    /api/admissions/followups/               - List all
POST   /api/admissions/followups/               - Create new
```

### Access Control

#### Roles
```
GET    /api/access-control/roles/               - List all
POST   /api/access-control/roles/               - Create new
GET    /api/access-control/roles/{id}/          - Retrieve one
PUT    /api/access-control/roles/{id}/          - Update
DELETE /api/access-control/roles/{id}/          - Delete
```

#### User Roles
```
GET    /api/access-control/user-roles/          - List all
POST   /api/access-control/user-roles/          - Assign role
DELETE /api/access-control/user-roles/{id}/     - Remove role
```

#### Permissions
```
GET    /api/access-control/permissions/         - List all (read-only)
```

## Error Codes

| Code | Description |
|------|-------------|
| `validation_error` | Request data validation failed |
| `not_found` | Resource not found |
| `permission_denied` | User lacks required permissions |
| `unauthorized` | Authentication required or invalid |
| `conflict` | Resource conflict (e.g., already exists) |
| `school_not_found` | School context missing |
| `invalid_query_params` | Invalid query parameters |

## Filtering Examples

### By School (Automatically filtered)
```
GET /api/academics/class-teachers/
```
Only returns data for the authenticated user's school.

### By Academic Year
```
GET /api/academics/class-subjects/?academic_year_id=1
```

### By Class and Section
```
GET /api/academics/homeworks/?class_id=1&section_id=1
```

### Search
```
GET /api/students/students/?search=john
```

### Pagination
```
GET /api/academics/class-teachers/?page=2&page_size=50
```

### Ordering
```
GET /api/students/students/?ordering=-created_at
```

## Bulk Operations

Some endpoints support bulk operations:

```
POST /api/bulk/delete
```
Request:
```json
{
  "model": "students.Student",
  "ids": [1, 2, 3]
}
```

## Rate Limiting
Currently no rate limiting. Will be added in production.

## CORS
CORS is enabled for all origins in development. Configure appropriately for production.

---
**API Version**: 1.0.0  
**Last Updated**: 2026-03-18
