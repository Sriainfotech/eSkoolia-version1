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
- **Per-card toggle switch** added to every role card in the grid

---

### 8. Academics → Foundation Setup — Holidays, Classes, Streams (Yesterday)

Major refactor of the Academics Foundation Setup wizard. Step 6 ("Holidays") was removed; holidays now live directly inside the Academic Year card so they are managed alongside the year they belong to.

#### 8.1 Holidays moved into Academic Year (no separate step)

- Removed the standalone "Holidays" step (step 6) from the Foundation Setup wizard.
- `HolidayCalendarCard` is now rendered live inside `AcademicYearPane` in both:
  - **Add Academic Year** modal — holidays can be defined while creating the year.
  - **Copy Year** modal — holidays can be reviewed/edited during the copy flow.
- Holidays are persisted against the academic year via the existing `/api/v1/core/holidays/` endpoint and reload on year switch.

#### 8.2 Tenancy fix — User 41 `school_id` NULL

- User 41 had `school_id = NULL`, causing `TenantQueryMixin` to raise `DRFValidationError({"school": [...]})` on every create endpoint (classes, streams, holidays).
- Re-patched the user record so `school_id` points to the correct tenant.
- Confirmed `perform_create` flow on all Core ViewSets now succeeds.

#### 8.3 ClassesPane refactor (`frontend/components/academics/foundation/panes/ClassesPane.tsx`)

- Removed the **Sections** and **Students** columns from the classes table — these are now managed elsewhere and were cluttering the foundation view.
- Display name is normalized through `normalizeClassName` so legacy entries like `"2"`, `"4"`, `"5"` render as `"Grade 2"`, `"Grade 4"`, `"Grade 5"`.
- Added `inferLevel(name)` to derive the level (pre / primary / middle / secondary / senior) from the class name.
- **Capacity validation 1–200** enforced on both sides:
  - Backend: `ClassSerializer.validate_capacity` (in `backend/apps/core/serializers.py`) — message: `"Capacity must be between 1 and 200 students per section."`
  - Frontend: inline validation in `addClass` / `updateClass` with matching toast.
- Default capacity by level: pre = 25, primary/middle/secondary = 40, senior = 35.

#### 8.4 Legacy class-name normalization (DB cleanup)

- Ran a one-off Django shell command that loaded each `Class` instance, called `Class.normalize_name(...)`, and saved if changed.
- 6 rows were corrected (e.g. `"2"` → `"Grade 2"`, `"4"` → `"Grade 4"`, `"5"` → `"Grade 5"`).
- No production data lost — names only.

#### 8.5 Section capacity error message upgrade

- In `CoreSetupPanel.tsx`, the generic capacity validation toast was replaced with the explicit, copy-paste-friendly message:
  > **"Capacity must be between 1 and 200 students per section."**

#### 8.6 Stream feature — initial release

A new `Stream` model was added so Senior Secondary classes (Grade 11 & 12) can carry streams like MPC, BiPC, MEC, etc.

**Backend** (`backend/apps/core/`):
- **`models.py` — `Stream`**:
  - Fields: `school` (FK), `name` (CharField 50), `is_active`, `created_at`
  - `Meta`: `db_table = "streams"`, unique constraint `uq_stream_school_name` on `(school, name)`
  - `DEFAULT_NAMES = ["Science", "Commerce", "Humanities / Arts", "Vocational"]`
  - `NAME_REGEX = r"^[A-Za-z][A-Za-z0-9 /&.\-]{0,49}$"`
  - `ensure_defaults(school)` classmethod — seeds the four defaults on first access
  - `clean()` validates `NAME_REGEX`; `save()` calls `clean()` first
- **`models.py` — `Class.streams`**: M2M to `Stream` (initially `blank=True`, later moved to `through="ClassStream"` — see §9)
- **`serializers.py`**:
  - `StreamSerializer`: `validate_name` uses `NAME_REGEX` and case-insensitive duplicate check (`name__iexact`)
  - `ClassSerializer`: added `streams` (write list of IDs) + `stream_details` (read-only list of `{id, name, is_active}`)
  - Cross-validation in `ClassSerializer.validate`: streams allowed **only** on Grade 11 / Grade 12; otherwise rejects with `"Streams can only be assigned to Grade 11 or Grade 12."`
- **`views.py` — `StreamViewSet`**:
  - `TenantQueryMixin` based `ModelViewSet`
  - `get_queryset` lazily calls `Stream.ensure_defaults(school)` on first list per school
  - `create` / `update` / `partial_update` catch `IntegrityError` → `"A stream with this name already exists."`
- **`urls.py`**: registered `router.register("streams", StreamViewSet, basename="stream")`
- **Migration `0021_stream_class_streams_stream_uq_stream_school_name.py`** — applied.

**Frontend** (`frontend/components/academics/foundation/`):
- **`types.ts`**:
  - New `Stream` interface: `{ id, name, is_active, created_at? }`
  - `SchoolClass` extended: `streams?: number[]`, `stream_details?: Stream[]`
- **`panes/ClassesPane.tsx`**:
  - State: `streamsList`, `streamsLoading`, `selectedStreams: Set<number>`, `showAddStream`, `newStreamName`, `addingStream`
  - `loadStreams()` → `GET /api/v1/core/streams/`
  - `toggleStream(id)` — adds/removes from `selectedStreams`
  - `addStream()` — regex + duplicate validation, then `POST /api/v1/core/streams/`
  - **Streams UI** (visible only when level = senior):
    - Pill checkbox list (selected = `#5B4FCF` / white, unselected = white / `#D2D7DC` border)
    - "+ Add Stream" toggle opens an inline input (Enter saves, Escape cancels)
  - `handleLevelChange` clears `selectedStreams` / `showAddStream` / `newStreamName`
  - `openEditClass` pre-populates `selectedStreams` from `cls.stream_details`

---

### 9. Per-Stream Capacity for Senior Secondary (Today)

Building on §8.6, Senior Secondary classes now carry **a separate capacity per stream** instead of a single class-wide capacity. Non-senior classes are unchanged.

> Requirement: *"When streams are selected, automatically show separate capacity fields for each stream / Hide the common capacity field for streamed classes / For non-stream classes, keep the existing single capacity field unchanged."*

#### 9.1 Backend — `ClassStream` through model

**`backend/apps/core/models.py` — new `ClassStream` model:**
- `school_class` → FK `Class` (`related_name="class_streams"`, on_delete=CASCADE)
- `stream` → FK `Stream` (`related_name="class_links"`, on_delete=CASCADE)
- `capacity` → `PositiveSmallIntegerField(default=40)`, validated 1–200
- `created_at` → `auto_now_add`
- `Meta`:
  - `db_table = "class_streams"`
  - `ordering = ["stream__name"]`
  - `UniqueConstraint(["school_class", "stream"], name="uq_class_stream")`
- `clean()` enforces capacity range; `save()` calls `clean()` first.
- `MIN_CAPACITY = 1`, `MAX_CAPACITY = 200` constants.

**`Class.streams` updated** to use the new through model:
```python
streams = models.ManyToManyField(
    Stream,
    through="ClassStream",
    blank=True,
    related_name="classes",
    help_text="Applicable to Senior Secondary (Grade 11-12).",
)
```

#### 9.2 Migration — `0022_manual_m2m_through_change.py`

Django cannot `AlterField` to add `through=` on an existing M2M (raises `ValueError: Cannot alter field … you cannot alter to or from M2M fields, or add or remove through= on M2M fields`). Workaround:
- The auto-generated `AlterField` migration was deleted.
- A hand-written empty migration `0022_manual_m2m_through_change.py` was created with:
  1. `RemoveField(Class, "streams")` — drops the auto-generated M2M table.
  2. `CreateModel(ClassStream, …)` — creates the explicit through table `class_streams`.
  3. `AddField(Class, "streams", ManyToManyField(through=ClassStream, …))` — re-adds the M2M.
- Applied cleanly: `Applying core.0022_manual_m2m_through_change... OK`.
- Safe because no production data was using class↔stream links yet.

#### 9.3 `ClassSerializer` updates (`backend/apps/core/serializers.py`)

- Imported `ClassStream` from `.models`.
- New write-only field **`stream_capacities`**:
  ```python
  stream_capacities = serializers.ListField(
      child=serializers.DictField(), required=False, write_only=True,
      help_text="[{stream: <id>, capacity: <int 1-200>}, ...] — Senior Secondary only",
  )
  ```
- `stream_details` (read-only) now enriched with capacity:
  ```python
  [{"id", "name", "is_active", "capacity"}]
  ```
  Built by querying `ClassStream.objects.filter(school_class=obj).select_related("stream")`.
- `validate_stream_capacities`:
  - Each entry must be a dict with valid `stream` id and integer `capacity`.
  - Duplicate stream ids rejected.
  - Stream must belong to the same school (tenant check).
  - Capacity must be 1–200, message: `"Stream '<name>' capacity must be between 1 and 200."`
- `validate`:
  - If `stream_capacities` or `streams` provided on a non-senior class → reject: `"Streams can only be assigned to Grade 11 or Grade 12."`
- `create` / `update`:
  - Pop `capacity`, `stream_capacities`, `streams` from validated_data.
  - `_apply_stream_capacities(instance, stream_caps)` clears existing `ClassStream` rows for the class and bulk-creates the new ones.
  - Back-compat: if only the legacy `streams` ID list is sent (no `stream_capacities`), each row is created with default capacity = 35.
- `Meta.fields` now includes `"stream_capacities"` (write-only) alongside `"streams"` and `"stream_details"`.

#### 9.4 Frontend — per-stream capacity UI (`frontend/components/academics/foundation/panes/ClassesPane.tsx`)

- New state:
  ```ts
  const [streamCapacities, setStreamCapacities] =
    useState<Record<number, string>>({});
  ```
- `toggleStream(id)` now also seeds `streamCapacities[id] = "35"` on first check.
- `setStreamCapacity(id, value)` — strips non-digits and caps length at 3.
- `handleLevelChange` also resets `streamCapacities` to `{}`.
- `openEditClass` pre-populates `streamCapacities` from each `cls.stream_details[i].capacity`.

**New "Stream Capacities" card** (rendered inside the Streams block, only when level = senior **and** `selectedStreams.size > 0`):
- Header label: **"Stream Capacities"** (`#6F767E` uppercase).
- White card with `#E8ECEF` border and `divide-y` rows.
- One row per selected stream:
  - Stream name (`#1A1D1F`, semibold, 13 px) on the left.
  - Number input on the right (`min=1 max=200`, width 80 px, placeholder `35`) + caption `"students"`.
- Helper text below: `"Capacity is set per stream (1–200). Default 35."`.

**Common "Maximum Student Capacity" input** is now wrapped in `{level !== "senior" && ( … )}` — hidden for Senior Secondary, unchanged for every other level.

**Payload changes:**
- `addClass()` (create) — Senior:
  ```ts
  body.stream_capacities = Array.from(selectedStreams).map(sid => ({
    stream: sid,
    capacity: parseInt(streamCapacities[sid] ?? "35", 10),
  }));
  ```
  Non-senior: still sends `{ name, capacity }` exactly as before.
- `updateClass()` (PATCH) — Senior sends `stream_capacities`; non-senior sends `stream_capacities: []` to clear any stale links.

**Validation:**
- Senior: must select at least one stream → toast `"Select at least one stream for Senior Secondary classes."`
- Per-stream capacity validated 1–200 → toast: `"<Stream> capacity must be between 1 and 200."`
- Non-senior: existing capacity check unchanged.

#### 9.5 Summary of files touched today

| File | Change |
|------|--------|
| `backend/apps/core/models.py` | Added `ClassStream` through model; updated `Class.streams` to `through="ClassStream"` |
| `backend/apps/core/serializers.py` | Imported `ClassStream`; added `stream_capacities` write field; enriched `stream_details` with capacity; `_apply_stream_capacities` helper; back-compat for legacy `streams` list |
| `backend/apps/core/migrations/0022_manual_m2m_through_change.py` | Hand-written migration: remove auto M2M → create `ClassStream` → re-add M2M with `through` |
| `frontend/components/academics/foundation/panes/ClassesPane.tsx` | `streamCapacities` state, per-stream capacity card, hide common capacity for senior, new payload shape, per-stream validation toasts |

#### 9.6 Verification

- `python manage.py migrate core` → **OK**.
- `get_errors` on `models.py`, `serializers.py`, `ClassesPane.tsx` → **no errors**.
- Daphne and Next.js need a restart to pick up the model + serializer changes; the frontend hot-reloads on save.

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
