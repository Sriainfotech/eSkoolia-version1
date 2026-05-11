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
