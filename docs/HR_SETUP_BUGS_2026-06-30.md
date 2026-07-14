# HR Staff Setup — Issues Found (2026-06-30)

**Page:** `/hr/setup` (Staff setup — Add Departments / Add Designations wizard)
**Context:** Manually added departments (Academics, Administration, Sports, Maintenance) and designations (Teacher, Head of Department, Principal, Admin Staff, Clerk, Sports Coach, Peon) via the browser for the `zphschool` tenant. Final state: 5 departments, 7 designations — completed successfully, but ran into the issues below along the way.

## 1. Designation form drops the selected Department on submit (intermittent)

- **Where:** Step 2 of 2 — "Add Designations" form.
- **Repro:** Select a department from the "Department" dropdown, fill in Designation Title + Short Code, click "Save & add another".
- **Observed:** Submit failed with toast *"Department and designation title are required"*, even though the Department dropdown visually showed the selected value (e.g. "Academics") and the title field was filled.
- **Workaround:** Re-open the department dropdown and re-select the same department, then resubmit — it saves correctly the second time.
- **Hypothesis:** The dropdown's selected value isn't always committed to form state before the submit handler reads it — possible race between the custom-select `onChange` and the submit click, or a controlled/uncontrolled state mismatch. Worth checking the designation form component (likely under `frontend/components/access-control/` or the HR setup page in `frontend/app/(dashboard)/...`).

## 2. Weak save-confirmation feedback on the Department form

- **Where:** Step 1 of 2 — "Add Department" form.
- **Observed:** After clicking "Save Department" / "Save & add another", there's no inline confirmation near the form itself — only a small toast in the top-right corner. The form fields also don't visibly reset/clear in a way that's obvious at a glance, making it easy to think the save silently failed (it hadn't).
- **Suggestion:** Add an inline success state on the form (e.g. brief highlight or message near the Save button) in addition to the toast, so the result is unambiguous without scrolling to check the department counter.

## 3. Page layout reflow during interaction (environment note, not necessarily an app bug)

- **Observed:** The browser viewport width changed mid-session (1568px → 1536px), which shifted on-screen coordinates of form fields between actions.
- **Impact:** Caused a couple of misclicks during manual/automated interaction (e.g. clicking the Department dropdown option landed on the wrong element once).
- **Note:** This may just be a browser/extension resize event rather than something the app does. Flagging in case it correlates with a responsive breakpoint in the setup page causing reflow unexpectedly.

## 4. CRITICAL: Staff onboarding form (`/hr/onboard`) logs the user out almost immediately on interaction

- **Where:** `/hr/onboard` — Step 1 of 10, "Staff identity".
- **Severity:** Blocking. This prevented onboarding any staff at all.
- **Repro:** Log in fresh (with or without "Trust this device"), navigate to Staff list & Onboarding → Onboard Staff, and type into the **Staff Code** field (the very first input on the form).
- **Observed:** Within 1-2 seconds of typing, the app force-logs-out back to `/login` (or `/login?next=%2Fhr%2Fonboard`). This was 100% reproducible across more than a dozen attempts, including:
  - Fresh logins immediately before the attempt.
  - With "Trust this device" checked.
  - Reaching the form via direct URL navigation vs. via UI clicks (Staff list & Onboarding → Onboard Staff) — both paths fail identically.
  - Tightly batching the click+type actions with no gaps in between (ruling out simple idle-timeout).
- **Other symptoms on this page:** The "Mother tongue", "Religion", and "Nationality" dropdowns are permanently stuck on "Loading..." and never resolve — even before the logout occurs.
- **Confirmed root cause** (verified by reading the code, not just hypothesis):
  - `frontend/lib/api-auth.ts`, function `requestWithRefreshResponse` (~lines 144–235): any request that receives a `401` triggers a hard, global redirect — `clearAuthTokens()` followed by `window.location.href = "/login"`. This fires for **any** 401 from **any** call, not just a real expired-session check, and there are three separate trigger points in that function (initial-token-missing path, post-refresh-retry-still-401, and refresh-call failure itself).
  - The onboarding page fires several background lookup calls on mount (pincode lookup, languages, religions, countries, employment types — see `lookupPincode` in `frontend/.../useHrApi.ts:402-414`, and `useMasterLanguages`/`useMasterReligions`/`useMasterCountries`/`useStaffFormOptions` around `useHrApi.ts:655-680`, all routed through the same `apiRequestWithRefresh` → `requestWithRefreshResponse` path). On the backend, the pincode-lookup view (`backend/apps/core/views.py:1922`) and the master lookup endpoints (`backend/apps/master/urls.py`: `languages/`, `religions/`, `countries/`, `employment-types/`) all require `IsAuthenticated`.
  - **The actual bug:** `lookupPincode` (and similar lookup helpers) swallow their own errors with `catch { return null }` — so the *caller* never sees a failure. But the global redirect side-effect inside `requestWithRefreshResponse`/`refreshAccessToken` already runs *before* that catch block executes. So if any one of these background lookup calls hits a 401 (e.g. the access token is momentarily stale right as the wizard loads, or a refresh races), the user gets force-logged-out **silently** — no visible error, just an instant redirect to `/login` — even though nothing about their actual session needed re-authenticating. This matches the observed behavior exactly: stuck "Loading..." dropdowns (the failed lookups) followed by near-immediate logout, on this page only.
  - **Suggested fix:** the background/non-critical lookup calls (pincode, master lists for mother tongue/religion/nationality/etc.) should not share the global "redirect-on-401" path. Either give them a non-redirecting fetch variant, or add an option to `requestWithRefreshResponse` to suppress the forced redirect for background calls, reserving the hard global logout for primary user-initiated actions (e.g. the actual save/submit request).
- **Impact:** As a direct result, the requested task (onboard 15 teachers via this form) could not be completed. No staff records were created. Reproduced 100% of the time (12+ attempts) across fresh logins, with/without "Trust this device", and via both direct URL and UI navigation to the form.

## 5. Staff onboarding submit fails with "A valid integer is required" (`num_children`)

- **Where:** `/hr/onboard` — Step 10 of 10, "Review & onboard" → Submit & Onboard.
- **Severity:** Blocking. `POST /api/v1/hr/staff/` returns `400 Bad Request`, staff record is not created.
- **Repro:** Fill out the onboarding wizard for a staff member whose marital status is "Single" (or otherwise leave "No. of Children" empty), reach Step 10, click "Submit & Onboard".
- **Observed:** 400 response, error message "A valid integer is required."
- **Root cause:**
  - "No. of Children" defaults to `""` and is explicitly reset to `""` whenever marital status is set to "Single" — `frontend/app/(dashboard)/hr/onboard/page.tsx:1364`.
  - `handleSubmit` spreads the rest of the form state directly into the request payload without sanitizing this field — `frontend/app/(dashboard)/hr/onboard/page.tsx:4000-4021` — so `num_children: ""` is sent verbatim.
  - Backend model field is `PositiveSmallIntegerField(null=True, blank=True)` (`backend/apps/hr/models.py:186`), but the serializer has no explicit override for it (`backend/apps/hr/serializers.py:511`), so DRF auto-generates a plain `IntegerField`. Its `allow_null=True` only tolerates Python `None`, not `""` — so `int("")` raises DRF's "A valid integer is required." during field-level parsing.
  - There's already a guard for a blank `num_children` in `validate()` (`backend/apps/hr/serializers.py:1063-1070`), but object-level `validate()` runs *after* field-level parsing, so it never gets a chance to run — the field-level error fires first.
- **Suggested fix:** (1) Frontend — convert `""` → `null` (or drop the key) for `num_children` before building the submit payload. (2) Backend — give `num_children` an explicit serializer field (`IntegerField(required=False, allow_null=True)` with `""` treated as `None` in `to_internal_value`) so the API is robust regardless of what any client sends.
- **Not `basic_salary`:** despite being displayed with "₹" and comma formatting on-screen, `basic_salary` is correctly converted to a clean `Number` before submit (`page.tsx:4020`) — it was not the cause.

## 6. Staff onboarding submit fails with "Value must be valid JSON." / "Not a valid string." (`custom_field`, `other_document`)

- **Where:** `/hr/onboard` — Step 10 of 10, "Review & onboard" → Submit & Onboard, when the wizard was opened in edit/resume mode (`?staff_id=...`, e.g. via "Save draft" then resuming, or editing an existing staff record).
- **Severity:** Blocking. `POST /api/v1/hr/staff/` returns `400 Bad Request`, staff record is not created/updated.
- **Observed response:**
  ```json
  {
    "success": false,
    "message": "Value must be valid JSON.",
    "errors": {
      "custom_field": ["Value must be valid JSON."],
      "other_document": {"0": ["Not a valid string."]}
    }
  }
  ```
- **Root cause:** Same class of bug as #5 (`num_children`), but at the *load* end instead of the *submit* end.
  - When the wizard opens in edit/resume mode, `frontend/app/(dashboard)/hr/onboard/page.tsx:3500` does `const mapped = { ...(json || {}) }` — spreading the **entire** `GET /api/v1/hr/staff/{id}/` response into form state unfiltered, then `setForm(mapped)` (`page.tsx:3607`). This is the only place `form.custom_field` is ever populated — there's no UI control for it.
  - Backend-only/derived fields like `custom_field` (a nested dict) and `other_document` (already a clean array) get absorbed into `form` as a side effect.
  - On submit, `payload` is built via `...rest` spread from `form` (`page.tsx:4003-4004`), so these backend-shaped values ride straight back out through `createStaff`'s FormData string-conversion (`frontend/hooks/useHrApi.ts:189-215`), getting mangled in the process.
  - Backend-side, `backend/apps/hr/serializers.py:698-702` sweeps any unrecognized payload key into `custom_field`; a stray/malformed value there throws `TypeError` on `json.dumps()`, surfaced by DRF's `JSONField` as "Value must be valid JSON."
  - `other_document = serializers.ListField(child=serializers.CharField(...))` (`backend/apps/hr/serializers.py:389-393`) then rejects a non-string item at index 0 with DRF's stock "Not a valid string." — confirmed by tracing `CharField.to_internal_value`, which produces that exact message for any non-str/int/float input.
  - Confirmed the backend preprocessing (`_normalize_staff_request_data`, `views.py:532-605`) does run before validation on `create()` (`views.py:610-612`) — the bug is upstream of it, in what the frontend feeds in.
- **Suggested fix:** In `page.tsx:3500`, whitelist which fields get copied from the GET response into form state (exclude `custom_field`, `other_document`, `id`, and other backend-derived/bookkeeping keys) instead of spreading the raw response wholesale — reconstruct only the editable UI fields, same approach already used there for dates/phone/email.

## Not a bug

- The overall HR Setup wizard flow (Departments → Designations → Review → "HR Structure Configured") worked correctly and the final counts (5 departments / 7 designations) matched what was entered.
