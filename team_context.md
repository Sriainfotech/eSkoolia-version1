# Eskoolia ERP — Frontend Cleanup & Login Permission Module
## Team Context Document

---

## What Was Done

### 1. Module Visibility Cleanup (`frontend/lib/routes.ts`)

Seven modules with no backend support were hidden from all navigation surfaces (TopBar pills, ModuleGrid dashboard cards, CommandPalette, ManagePins). Each is commented out with `// HIDDEN - no backend yet` so they can be re-enabled when ready:

| Module         | ID           |
|----------------|--------------|
| Library        | `library`    |
| Transport      | `transport`  |
| Inventory      | `inventory`  |
| Behaviour      | `behaviour`  |
| Chat           | `utilities`  |
| Settings       | `settings`   |
| Accounts       | `accounts`   |

### 2. "Coming Soon" Pages

Five modules render a polished **Coming Soon** page (`components/shared/ComingSoon.tsx`) instead of broken UIs:

- **Attendance** — all pages under `app/(dashboard)/attendance/`
- **Fees** — groups, carry-forward, due, master, payments, types
- **Examination** — 14 sub-pages under `app/(dashboard)/exams/`
- **Staff / HR** — 9 sub-pages under `app/(dashboard)/hr/`
- **Reports** — 14 sub-pages under `app/(dashboard)/reports/`

### 3. Academics Sub-pages

15 Academics sub-pages replaced with Coming Soon. **Three pages kept working**:

- `/academics/core-setup`
- `/academics/assign-class-teacher`
- `/academics/assign-subject`

### 4. Coming Soon Hover Tooltips

Hover tooltips showing **"Coming Soon"** were added to three nav surfaces:

- **`components/nav/ModulePill.tsx`** — top-bar nav pill: whole module shows "Coming Soon" instead of a dropdown for attendance, fees, exam, reports, hr
- **`components/home/ModuleGrid.tsx`** — dashboard module card: tooltip on hover
- **`components/home/QuickAccessGrid.tsx`** — pinned quick-access items: tooltip on hover

Sub-items in the Academics dropdown that are Coming Soon get a **"Soon" pill badge**.

### 5. "Due Fees Login Permission" Removed from Nav

- Removed from `lib/routes.ts` (roles sub-array)
- Removed from `components/layout/sidebar-menu.data.ts`

### 6. Login Permission Module (Redesigned)

A full redesign of the Login Permission screen at `/roles/login-permission`.

#### Files created

```
lib/login-permission/
  types.ts          — TypeScript interfaces for all data shapes
  utils.ts          — initials(), formatDate(), paginationWindow(), cn(), genTempPassword()
  mock-data.ts      — 840 seeded mock student users (deterministic via mulberry32 PRNG)
  api.ts            — API client (mock + real Django REST, switches via NEXT_PUBLIC_USE_MOCK)

components/login-permission/
  Hero.tsx           — Gradient editorial header banner
  StatsRow.tsx       — 4 stat cards (Total, Active, Disabled, Never Logged In) with shimmer
  FilterBar.tsx      — Role dropdown + search + status tabs + Export button
  UsersTable.tsx     — Paginated data table with checkboxes, toggle switches, credential key icon
  Pagination.tsx     — Page window + rows-per-page selector
  BulkActionBar.tsx  — Sticky bottom bar (Enable All / Disable All / Reset Passwords)
  CredentialDrawer.tsx — Right slide-in panel: reset temp password / set initial password
  ConfirmModal.tsx   — Confirmation dialog for destructive bulk actions
  Toast.tsx          — Success / error toasts, auto-dismiss after 4 s
```

The existing route file was replaced:
```
app/(dashboard)/roles/login-permission/page.tsx  — owns all state, orchestrates components
```

#### Credential Drawer — option cards

Each action is displayed as a card with a title, badge, and description:

| Card | Badge | Description |
|------|-------|-------------|
| **Reset password** | `Recommended` (green) | System generates a secure random password and emails it to the user's email. A one-time backup copy is shown here. Use this whenever the user has a working email. |
| **Set initial password** | `No-email fallback` (amber) | You type the password yourself — for onboarding a user with no working email, so you can share it directly. Available only because this user has never logged in. |

The "Set initial password" card is only rendered when `user.lastLogin === null`.



| Feature | Detail |
|---------|--------|
| **Mock mode** | `NEXT_PUBLIC_USE_MOCK=true` in `.env.local` — 840 students, in-memory mutations |
| **Debounced search** | 350 ms debounce; Enter key triggers immediate search |
| **Server-side filtering** | role / search / status / class / section passed to API; pagination resets on filter change |
| **Toggle switch** | Per-row toggle; optimistic UI update + stats counter update |
| **Bulk select** | Per-page checkbox → "Select all N matching" banner → `allMatching=true` in bulk payload |
| **Bulk enable/disable** | Confirm modal → `POST /api/login-permission/bulk/access/` |
| **Bulk password reset** | Confirm modal → `POST /api/login-permission/bulk/reset/` |
| **Credential drawer** | Reset temp password (always) + Set initial password (only if `lastLogin === null`) |
| **Export CSV** | Mock: Blob download; Real: redirects to Django export endpoint |
| **Class & Section filter** | Appears only when role = Students; Class dropdown + Section dropdown (section disabled until class selected); resets when switching roles or clicking Reset |

#### API contract summary (Django endpoints)

```
GET  /api/login-permission/users/             → list (role, page, page_size, search, status)
PATCH /api/login-permission/users/{id}/access/ → toggle login_access
POST  /api/login-permission/users/{id}/credentials/ → reset_temp | set_initial
POST  /api/login-permission/bulk/access/      → bulk enable/disable
POST  /api/login-permission/bulk/reset/       → bulk password reset
GET  /api/login-permission/users/export/      → CSV download
```

### 7. Access Control — Roles & Permissions Module (Bug Fixes + Enhancements)

#### Backend fixes (`backend/apps/access_control/`)

**Migration 0013** (`0013_role_name_30_and_is_active.py`):
- Added `is_active = BooleanField(default=True)` back to the `Role` model (was missing, caused FieldError on all role queries)
- Truncated any existing role names > 30 chars before applying `max_length=30`

**`models.py`**:
- `is_active` field restored: `is_active = models.BooleanField(default=True)`
- `UniqueConstraint` on `(school, name)` with `nulls_distinct=False` (migration 0012)

**`serializers.py` — `validate_name`**:
- Checks for both active AND inactive name collisions
- Returns specific message: `"A deactivated role with this name already exists. Reactivate it or delete it before creating a new one."` vs `"A role with this name already exists."`
- `RoleMinimalSerializer` fields: `["id", "name", "is_system", "is_active", "created_at"]`

**`views.py` — `RoleViewSet.get_queryset`**:
- `is_active=True` filter now applies **only for the `list` action**, not for retrieve/update/destroy
- This fixed: PATCH to re-activate an inactive role was returning 404 (role not found in filtered queryset)
- `?show_inactive=1` still supported for the list action to include inactive roles explicitly

#### Frontend fixes (`frontend/components/access-control/`)

**`RoleManagementPanel.tsx`**:
- `toggleActive`: replaced `await loadRoles(page, pageSize)` with an in-place local state update (`setRoles(prev => prev.map(...))`) — prevents deactivated roles from disappearing on re-fetch
- `loadRoles`: always appends `&show_inactive=1` so inactive roles are always loaded on mount, search, and pagination
- Edit panel: Status toggle button added (green Active / red Inactive) — included in PUT body as `is_active`

**`AssignPermissionPanel.tsx`**:
- `RoleItem` interface: added `is_system?: boolean`
- `togglingRoleId` state: tracks which role's toggle is mid-request (loading indicator)
- `toggleRoleActive` async function: PATCHes `{ is_active: !current }`, updates local state, shows toast
- Initial role fetch: now always includes `&show_inactive=1` so deactivated roles persist across navigation
- **Per-card toggle switch** added to every role card in the grid:
  - Pill toggle (36×20 px): green `#16a34a` = Active, gray `#D1D5DB` = Inactive
  - Thumb slides left/right with 0.25s CSS transition
  - Inactive cards rendered at `opacity: 0.65` with lighter border/background
  - Bullet dot changes purple → gray for inactive roles
  - System roles (`is_system: true`): toggle disabled at 35% opacity, cursor `not-allowed`
  - Loading state: 55% opacity + `cursor: wait` during in-flight PATCH
  - `e.stopPropagation()` prevents triggering `switchRole` when clicking toggle
- Edit Role modal (`RoleFormModal`): Status toggle added via `isActive` / `onIsActiveChange` props; saved in PATCH body
- Inline validation errors for name conflicts (active vs inactive-specific messages)

#### Summary of bugs fixed

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| DELETE `/roles/{id}/` → 500 | `is_active` field missing from `Role` model Python definition | Restored field + migration 0013 |
| Duplicate role name — no specific error | `validate_name` only checked active roles | Now checks both; inactive gives specific message |
| PATCH to re-activate → 404 | `get_queryset` filtered `is_active=True` for ALL actions | Filter now only on `list` action |
| Deactivated role disappears from UI | `toggleActive` called `loadRoles()` (API only returns active) | Update local state directly; always fetch with `show_inactive=1` |

---

### 8. Miscellaneous Fixes

- **`django-filter` version** downgraded to `24.3` in `backend/requirements.txt` (was `25.2`, incompatible with Django 5.1.8)
- **`ClassesGrid.tsx` build error** — unescaped `"` in JSX attribute fixed with `&quot;`
- **`ModulePill.tsx` corruption** — Python-based file rewrite used to fix escaped-quote mangling from shell commands
- **`globals.css`** — Added `@keyframes shimmer` and `@keyframes slideInRight` for new components

---

## How to Run (Dev)

```bash
# Frontend
cd frontend
npm run dev          # http://localhost:3000

# Backend (separate terminal)
cd backend
python manage.py runserver 8000
# or: daphne config.asgi:application -p 8000
```

The Login Permission screen is fully usable in mock mode without the backend running.

---

## Environment Variables Added

```env
# frontend/.env.local
NEXT_PUBLIC_USE_MOCK=true   # switch to "false" when Django backend is ready
NEXT_PUBLIC_API_BASE=/api   # API base path (proxied through Next.js or direct)
```
