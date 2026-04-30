# InspireHub — Competitions & AI Reviews — Integration Guide

A **Django app** (`apps.competitions`) plus a **Next.js component set** (`components/competitions/`) that lets staff record competition results and generate empathetic, age-appropriate AI performance reviews — with Redis caching, audit logging, rate limiting, and CSV/PDF export.

---

## File tree

### Backend — `backend/apps/competitions/`
```
backend/apps/competitions/
├── __init__.py
├── apps.py
├── models.py                # House, Club, Competition, Team, Result, AIRequestLog
├── serializers.py           # Competition / Result (bulk) / AI review I/O
├── views.py                 # CompetitionViewSet, ResultViewSet (+bulk), AIReviewView, AIRequestLogViewSet
├── urls.py                  # router + /ai/review/
├── admin.py                 # all models registered with useful list_display
├── ai.py                    # prompt build, sha256 cache, provider call, fallback
├── tasks.py                 # Celery: batch_generate_reviews, export_competition_pdf
├── ai_prompts/
│   └── canonical_review.txt # exact canonical prompt
├── migrations/
│   └── __init__.py          # makemigrations will populate this
└── tests/
    ├── __init__.py
    └── test_ai_review.py    # cache hit / fallback / staff-only access
```

### Frontend — `frontend/components/competitions/` and `frontend/lib/`
```
frontend/
├── lib/
│   └── competitionsApi.js               # axios wrapper with bearer token
└── components/competitions/
    ├── InspireHubButton.jsx             # purple "Open InspireHub" header button
    ├── InspireHubModal.jsx              # 80vw modal (full-screen on mobile)
    ├── CompetitionForm.jsx              # create competition
    ├── ResultsEntryCards.jsx            # card-per-student, position chips, bulk actions
    ├── AIReviewPanel.jsx                # inline generate + edit review
    ├── MiniDashboard.jsx                # KPI tiles + leaderboard
    ├── ExportControls.jsx               # CSV + print-to-PDF
    └── competitions.tailwind.css        # .input / .btn / .btn-primary / .chip-*
```

---

## Integration steps (5–10)

### 1. Register the Django app

In `backend/config/settings.py` (or your `INSTALLED_APPS` list):
```python
INSTALLED_APPS = [
    # ...existing apps...
    "apps.competitions",
]
```

Add to `backend/config/urls.py`:
```python
path("api/v1/competitions/", include("apps.competitions.urls")),
```

### 2. Run migrations
```powershell
cd backend
python manage.py makemigrations competitions
python manage.py migrate
```

### 3. Configure Redis cache + DRF throttling

In `settings.py`:
```python
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": os.getenv("REDIS_URL", "redis://localhost:6379/1"),
    }
}
REST_FRAMEWORK = {
    # ...existing config...
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.UserRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"ai_review": "60/min", "user": "1000/hour"},
}

# AI provider switches (kept off by default — fallback template runs locally)
AI_PROVIDER = os.getenv("AI_PROVIDER", "stub")          # "openai" or "stub"
AI_API_KEY  = os.getenv("AI_API_KEY", "")
AI_MODEL    = os.getenv("AI_MODEL", "gpt-4o-mini")
ALLOW_EXTERNAL_AI = os.getenv("ALLOW_EXTERNAL_AI", "false").lower() == "true"
```

When `ALLOW_EXTERNAL_AI=False`, student names are replaced with "the student" before being sent to the provider.

### 4. Configure Celery (for batch & PDF export)

You already have `backend/config/celery.py`. Confirm `CELERY_BROKER_URL` points at Redis, then run a worker:
```powershell
celery -A config worker -l info -Q default
```
Tasks:
- `competitions.batch_generate_reviews(result_ids, user_id)`
- `competitions.export_pdf(competition_id)` (requires `pip install reportlab`)

### 5. Set provider API key

```powershell
setx AI_PROVIDER "openai"
setx AI_API_KEY "sk-..."
setx ALLOW_EXTERNAL_AI "true"   # only if your DPA allows sending names
```
If unset, the AI endpoint **still works** — it returns a templated fallback review and marks `fallback: true`.

### 6. Wire the Tailwind helpers

Easiest: import the helper file from your Next.js `app/globals.css`:
```css
@import "../components/competitions/competitions.tailwind.css";
```
Or copy the `@layer components { ... }` block from `competitions.tailwind.css` into your existing `globals.css`.

### 7. Add the InspireHub button to **Student Groups**

Edit `frontend/app/(dashboard)/student-groups/StudentGroupPage.tsx` (or its header section):

```tsx
import { useState } from 'react';
import InspireHubButton from '@/components/competitions/InspireHubButton';
import InspireHubModal from '@/components/competitions/InspireHubModal';

// inside the component:
const [hubOpen, setHubOpen] = useState(false);

// in the header / toolbar JSX, alongside existing filters:
<InspireHubButton onClick={() => setHubOpen(true)} />

<InspireHubModal
  isOpen={hubOpen}
  onClose={() => setHubOpen(false)}
  schoolId={currentSchoolId}
  students={selectedStudents /* reuse the page's existing selected-student list */}
/>
```

The modal accepts the same `students` shape the page already loads (`{ id, full_name, class_name }`), so no extra fetch is needed — it **reuses your existing selection state**.

### 8. Run the tests
```powershell
cd backend
python manage.py test apps.competitions
```
Expected:
- `test_second_call_hits_cache` — provider invoked **once** across two identical requests.
- `test_fallback_when_provider_fails` — graceful template returned on provider error.
- `test_non_staff_forbidden` — non-staff users get 403 from `/ai/review/`.

### 9. (Optional) Frontend env

Add to `frontend/.env.local`:
```
NEXT_PUBLIC_API_BASE=http://localhost:8000/api/v1
```

### 10. Verify end-to-end

1. Open `/student-groups`, click **Open InspireHub**.
2. Create a competition → modal advances to participants.
3. Pick positions via colored chips → points auto-fill.
4. Click **✨ Generate** on a card or select several and use the bulk **AI review** button.
5. **Save all results** persists to `Result` rows; **Print / PDF** exports a clean handout.

---

## Safety & efficiency summary
- **Cache**: SHA-256 of `student_id|competition_id|position|personal_contribution`, TTL 30 days. Identical payloads return instantly with `cache_hit: true`.
- **Audit**: every non-cache call writes an `AIRequestLog` row (prompt, response, cost, error).
- **Rate limit**: `60/min` per user via DRF `UserRateThrottle` scope `ai_review`.
- **Auth**: AI endpoint requires `is_staff=True`.
- **PII**: When `ALLOW_EXTERNAL_AI=False`, the student's name is redacted before the prompt leaves the server.
- **Fallback**: Provider errors return a sensible templated review so the UI never blocks.
- **Editable**: Teachers can edit the AI text inline before saving — the saved `ai_response` reflects the final approved version.
