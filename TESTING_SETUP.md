# Eskoolia ERP — Testing Setup Guide

## What's installed

| Layer | Tool | Purpose |
|-------|------|---------|
| Backend | `pytest` + `pytest-django` | Run Django model & API tests |
| Backend | `pytest-reuse-db` | Reuse DB between runs (faster) |
| Frontend | `jest` + `jest-environment-jsdom` | Run React component tests |
| Frontend | `@testing-library/react` | Render components in tests |
| VS Code | Python extension + Jest extension | Shows tests in the Testing panel |

---

## Step 1 — Install backend test packages

```bash
cd backend
# Activate your venv first:
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

pip install pytest pytest-django pytest-reuse-db
```

Then add to `requirements.txt`:
```
pytest==8.2.0
pytest-django==4.8.0
pytest-reuse-db==0.5.0
```

---

## Step 2 — Install frontend test packages

```bash
cd frontend
npm install --save-dev jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/jest
```

---

## Step 3 — Install VS Code extensions

Install these two extensions from the VS Code Extensions panel (Ctrl+Shift+X):

1. **Python** (Microsoft) — `ms-python.python`
2. **Jest** (Orta) — `orta.vscode-jest`

After installing, click the **flask icon** (Testing panel) in the left sidebar → it will discover all tests automatically.

---

## Running Tests

### From terminal:
```bash
# All tests:
./run_tests.sh

# Smoke tests only (run before every push — takes ~30 seconds):
./run_tests.sh smoke

# Backend only:
./run_tests.sh backend

# Frontend only:
./run_tests.sh frontend
```

### From VS Code Testing panel:
- Click the flask icon in the left sidebar
- Click ▶ Run All Tests
- Or click individual tests to run/debug one at a time

### Pre-push habit:
```bash
# In the eskoolia-v1 folder, before every git push:
./run_tests.sh smoke
git push origin main
```

---

## Test file locations

```
eskoolia-v1/
├── backend/
│   ├── pytest.ini              ← pytest config
│   ├── conftest.py             ← shared fixtures (School, User, Student, etc.)
│   └── tests/
│       ├── test_auth.py        ← login, JWT, tenant isolation (SMOKE)
│       ├── test_students.py    ← student model + API
│       ├── test_fees.py        ← fees group, type, assignment, payment
│       ├── test_admissions.py  ← inquiry CRUD
│       └── test_access_control.py ← roles, permissions, RBAC
│
└── frontend/
    ├── jest.config.js          ← Jest config
    ├── jest.setup.ts           ← mocks for Next.js router/Link
    └── __tests__/
        ├── PageHeader.test.tsx ← shared header component
        └── utils.test.ts       ← pure utility functions (currency, phone, date)
```

---

## Deterministic Backend Pytest Rules (Neon/PostgreSQL)

Use these rules for all backend test runs to avoid bootstrap drift and schema contamination.

1. Python runtime (required)
- Run backend tests with `py -3.10`.
- Do not use system `python` for backend pytest commands.

2. Settings module (required)
- Backend pytest must use `config.settings.test`.
- This is already configured in [backend/pytest.ini](backend/pytest.ini).

3. Working directory (required)
- Run pytest from [backend](backend), not from repository root.
- Example:
```powershell
Set-Location "D:/eskoolia/New folder (2)/eSkoolia-version1/backend"
py -3.10 -m pytest apps/super_admin/tests.py -q --create-db
```

4. Test database workflow
- Default safe path: use `--create-db` for clean deterministic bootstrap.
- `--reuse-db` is blocked unless `PYTEST_ALLOW_REUSE_DB=1` is explicitly set.

5. Neon/PostgreSQL caveats
- Expect long first bootstrap when creating the test database and applying migrations.
- A missing `tenant_plans`/tenancy table usually indicates migration drift; regenerate/apply tenancy migrations before retrying.
- Keep test target isolated from production/shared DB names.

6. Recommended commands
- Minimal super_admin smoke:
```powershell
py -3.10 -m pytest apps/super_admin/tests.py::test_dashboard_and_school_list_match_contract -vv -s --maxfail=1 --create-db
```
- Sprint 1 super_admin suite:
```powershell
py -3.10 -m pytest apps/super_admin/tests.py -q --create-db
```

---

## Adding tests for new features

Every time you build a new feature, add:

**Backend** — in `backend/tests/test_<module>.py`:
```python
@pytest.mark.smoke
def test_my_new_feature(admin_client, school):
    response = admin_client.post("/api/my-module/endpoint/", {...}, format="json")
    assert response.status_code == 201
```

**Frontend** — in `frontend/__tests__/<Component>.test.tsx`:
```tsx
it('renders correctly', () => {
  render(<MyComponent prop="value" />);
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

Smoke tests (`@pytest.mark.smoke`) run in ~30 seconds and catch the most critical regressions before every push.
