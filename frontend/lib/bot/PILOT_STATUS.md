# Bot manifest conversion status

## Converted to manifests (lib/bot/manifests/)
- **students** — pure lookup, no actions. Searches `/api/v1/students/students/`.
- **attendance** — one action (`mark-absent`), gated by `attendance_enabled` and
  `student_info.student_attendance.view`. Searches the same students endpoint
  (the action's target entity is a Student).
- **fees** — pure lookup, gated by `fees_enabled`. Id-keyed by
  `BotContext.lastViewedEntity`, not free-text search (the backend endpoint
  only filters by student id).

## Not yet converted — still handled as direct intents in lib/aiBotIntent.ts
- **admissions/enquiry lookup** (`enquiry-lookup` intent) — searches
  `/api/v1/admissions/inquiries/`.
- **admissions/phone lookup** (`phone-lookup` intent) — same endpoint, by phone.
- **bus/lunch/emergency issue reporting** (`report-bus`/`report-lunch`/
  `report-emergency` intents) — launches `IssueFlow.tsx`; these don't persist
  to a backend today (pre-existing gap, not introduced by this pass).
- **planner-task** and **compose-message** are generic (not tied to a specific
  REST entity) and stay as direct intents by design — see
  `lib/bot/calendarEventsApi.ts` and `lib/bot/draftProviders/`.

## Converting the next module
1. Add `lib/bot/manifests/<module>.ts` exporting a `BotModuleManifest`.
2. Register it in `ALL_MANIFESTS` in `lib/bot/manifestLoader.ts`.
3. Reuse the module's existing `permission` string from `lib/routes.ts`'s
   `MODULES`/`FLAT_INDEX` for `requiredPermissionCode` — don't invent a
   second permission code for the same page.
4. If the module is plan-gated, set `requiredFeatureFlag` to the matching key
   in `apps/tenancy/feature_flags.py`'s `DEFAULT_FEATURES`.
5. `ManifestFuzzyResolver` picks it up automatically via keyword scoring —
   no changes needed in `components/AIBot.tsx`.
