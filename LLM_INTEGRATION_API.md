# eSkoolia × LLM Integration — API Reference

**Date:** 2026-05-27  
**Branch:** `demo`  
**Base URL (production):** `https://app.eskoolia.com`  
**Base URL (local dev):** `http://127.0.0.1:8002`

---

## How to Start the Servers

### Backend (Django)
```bash
cd School/eSkoolia-version1/backend

# First time / after pulling new code:
python manage.py migrate

# Run dev server:
python manage.py runserver 8002
```

### Frontend (Next.js)
```bash
cd School/eSkoolia-version1/frontend
npm install       # only when package.json changes
npm run dev       # starts on http://localhost:3000
```

---

## 1. Authentication

All LLM requests must carry the eSkoolia JWT in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Obtain a token via:

```
POST /api/v1/auth/login/
Body: { "username": "jdoe", "password": "secret" }
Response: { "access": "...", "refresh": "..." }
```

The LLM app **must** validate tokens by calling `/api/v1/auth/me/` (not by decoding locally). Cache the response per token for 1–5 minutes to reduce latency.

---

## 2. GET /api/v1/auth/me/

Returns the authenticated user's full profile including the new LLM fields.

**Headers:** `Authorization: Bearer <token>`

### Response

```json
{
  "id": 42,
  "username": "jdoe",
  "email": "jdoe@school.edu",
  "first_name": "John",
  "last_name": "Doe",
  "school_id": 7,
  "school_name": "Greenwood High",
  "is_superuser": false,
  "is_school_admin": false,
  "role_ids": [3],
  "role_names": ["Teacher"],
  "permission_codes": ["student_info.student_list.view"],
  "must_change_password": false,
  "llm_enabled": true,
  "class_section": null
}
```

### LLM-specific fields

| Field | Type | Notes |
|-------|------|-------|
| `school_name` | `string \| null` | School display name |
| `llm_enabled` | `bool` | `true` = this school has LLM access. Always `true` for super admins (no school). |
| `class_section` | `string \| null` | Students only. Format: `"5A"`, `"10C"`, `"1B"`. `null` for all non-student roles. |

### LLM app logic

```python
me = requests.get("/api/v1/auth/me/", headers=...).json()

if not me["llm_enabled"]:
    raise PermissionDenied("LLM not enabled for this school")

school_id   = me["school_id"]
school_name = me["school_name"]
role        = me["role_names"]          # ["Teacher"] / ["Student"] / ["Parent"]
class_section = me["class_section"]     # "5A" or None
```

---

## 3. Toggle LLM Access (Super Admin only)

### POST /api/v1/super-admin/llm/schools/{school_id}/

Enable or disable LLM for a school. Requires super admin JWT.

```
POST /api/v1/super-admin/llm/schools/7/
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{ "enabled": true }
```

#### Response `200 OK`
```json
{
  "school_id": 7,
  "school_name": "Greenwood High",
  "llm_enabled": true,
  "llm_enabled_at": "2026-05-27T10:30:00Z",
  "llm_enabled_by": "platformadmin"
}
```

To **disable**:
```json
{ "enabled": false }
```

Response `llm_enabled_at` and `llm_enabled_by` will be `null` when disabled.

---

## 4. List Schools with LLM Status (Super Admin only)

### GET /api/v1/super-admin/llm/schools/

```
GET /api/v1/super-admin/llm/schools/
Authorization: Bearer <super_admin_token>
```

#### Optional filter
```
GET /api/v1/super-admin/llm/schools/?llm_enabled=true
GET /api/v1/super-admin/llm/schools/?llm_enabled=false
```

#### Response `200 OK`
```json
{
  "count": 2,
  "results": [
    {
      "id": 7,
      "name": "Greenwood High",
      "code": "GRH",
      "llm_enabled": true,
      "llm_enabled_at": "2026-05-27T10:30:00Z",
      "llm_enabled_by": "platformadmin",
      "is_active": true
    },
    {
      "id": 12,
      "name": "Sunrise Academy",
      "code": "SRA",
      "llm_enabled": false,
      "llm_enabled_at": null,
      "llm_enabled_by": null,
      "is_active": true
    }
  ]
}
```

---

## 5. Student Login Accounts

When a student is admitted via `POST /api/v1/students/students/`, a User account is automatically created:

| Field | Value |
|-------|-------|
| `username` | `{admission_no}_{school_code}` (e.g. `2024001_grh`) |
| `password` | Date of birth as `DDMMYYYY` (e.g. `15082010`). If DOB absent, uses admission number. |
| `must_change_password` | `true` — student must change on first login |
| `school` | Linked to the same school |

The student can then log in with these credentials via `POST /api/v1/auth/login/` and call `/api/v1/auth/me/` which will return their `class_section`.

---

## 6. Error Responses

| Status | Meaning |
|--------|---------|
| `401 Unauthorized` | Token missing, expired, or invalid |
| `403 Forbidden` | Authenticated but lacks permission (e.g. non-super-admin hitting toggle endpoint) |
| `404 Not Found` | School ID does not exist |

---

## 7. Out of Scope (LLM team's responsibility)

- PDF Q&A, summaries, quizzes, assignment auto-grading
- Storing chat history (MongoDB)
- Token caching (Redis on LLM side, 1–5 min per token)
- Prompt construction based on `class_section` grade level
