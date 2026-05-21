# Project State — Eskoolia V1
> Last updated: 15 May 2026

---

## Environment

| Item | Value |
|---|---|
| Python version | 3.12.0 |
| Django version | 5.1.8 |
| Database | PostgreSQL |
| Database config | `DB_ENGINE=django.db.backends.postgresql` / `DATABASE_URL=postgresql://...` |
| Data state | Live / real data — all migrations applied |

---

## Installed Apps

### Third-party
```
channels
corsheaders
rest_framework
rest_framework_simplejwt.token_blacklist
drf_spectacular
django_filters
```

### Custom apps
```
apps.core
apps.tenancy
apps.users
apps.admissions
apps.access_control
apps.students
apps.academics
apps.attendance
apps.fees
apps.exams
apps.finance
apps.hr
apps.library
apps.behaviour
apps.chat
apps.communication
apps.competitions
apps.reports
```

---

## User Model

- **Type:** Custom (extends `AbstractUser`)
- **Location:** `apps/users/models.py` → `class User(AbstractUser)`
- **Setting:** `AUTH_USER_MODEL = "users.User"`

---

## Tenancy

- **Type:** Single-schema (NOT django-tenants / separate DB schemas)
- **App:** `apps.tenancy`
- **Model:** `class School(models.Model)` — one School record per tenant, stored in shared DB

---

## Decisions

| Decision | Choice |
|---|---|
| Migration strategy | B — migrate existing data (real data in DB) |
| Domain for dev | `localhost` / `lvh.me` *(to be confirmed)* |

---

## Git Status

- Code committed: ✅ `git commit -m "15/5"` — clean working tree as of 15 May 2026
