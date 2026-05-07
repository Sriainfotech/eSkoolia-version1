# Copilot Prompt — Admissions Command Center Rebuild
> Paste this entire prompt into Copilot. It is self-contained and complete.

---

## CONTEXT

Rebuild `frontend/components/admissions/AdmissionsCommandCenter.tsx` (and its sub-components) as described below.

**Product scope**: Eskoolia is a multi-tenant School ERP. The same codebase runs for multiple schools, each with their own database. 700–800+ students per school. During admission season, total applications across all classes can exceed 600. The current single-pipeline board cannot handle this volume. Replace it entirely with the 3-layer architecture described here.

**Critical constraints before writing a single line:**
1. **Never hardcode class lists.** Fetch from `GET /api/classes/?academic_year={year}` — different schools have different class structures (some Nursery–10, some 1–12, some 6–12 only).
2. **Always scope by academic year.** Every data fetch must include `academic_year` as a query param. Use the currently selected year from `useAcademicYear()` hook (or equivalent existing hook).
3. **Respect RBAC.** Check `user.role` and `user.permissions` before rendering bulk delete, counsellor assignment dropdowns, or any destructive action. A Counsellor sees only their assigned classes. A Principal sees all.
4. **Check existing API endpoints first.** Look inside `frontend/lib/api/` before writing any API call. Never create duplicate endpoints.
5. **No `any` in TypeScript.** Define interfaces for every API response shape.
6. **Performance at scale.** Lists are paginated (25/page). Search is debounced (300ms). Detail panel data is lazy-loaded on open — not pre-fetched for every row in the list.

## DESIGN RULES — MATCH EXISTING THEME EXACTLY (NON-NEGOTIABLE)

This product has a Universal Design Contract. Every page across all modules looks structurally identical — only the content changes. Deviating from this breaks the product's visual consistency across 15+ modules.

Open `frontend/components/students/StudentList.tsx` and read it completely before writing any JSX. The Command Center must match it precisely:
- **Page title**: Two words — bold first word + italic purple second word. Example: `Admissions <em className="text-indigo-500 not-italic font-light">Command Center</em>`
- **Outer wrapper**: single white `rounded-2xl shadow-sm border border-gray-100 bg-white p-6` card containing all content
- **Section numbering**: Each major section has a small `01`, `02`, `03` badge in gray with a label, same as Student List
- **Primary color**: `indigo-600` / `#4f46e5` for buttons, active pills, badges
- **Stat cards**: 4-column grid at top, each `rounded-xl border border-gray-100 bg-white p-4`
- **Filter pills**: Tailwind pill buttons `rounded-full px-3 py-1 text-sm`. Active = `bg-indigo-600 text-white`. Inactive = `bg-gray-100 text-gray-600 hover:bg-gray-200`
- **Primary button**: `bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700`
- **Outline button**: `border border-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-50`
- **No new color libraries. No new UI component libraries. Tailwind only.**
- **Reuse existing API hooks** — do not create duplicate endpoints

---

## ARCHITECTURE — THREE LAYERS

### LAYER 1 — MORNING BRIEF (Section 01)

A collapsible section at the top. Collapsed by default after first visit (store preference in `localStorage`).

When expanded shows 4 alert cards in a row:

| Card | Content | Color |
|------|---------|-------|
| New Applications | Count of unread/uncontacted inquiries today | Indigo |
| Follow-up Overdue | Inquiries with no contact in 3+ days | Amber |
| Visits Today | Scheduled visits for today | Green |
| Decisions Pending | Offer made but no enrollment confirmation >7 days | Red |

Each card is clickable. Clicking it sets the active class filter to "All Classes" and the stage filter to the relevant tab (see Layer 2). This is how admin starts their day — click the red "8 Decisions Pending" card and immediately see those 8 applications.

---

### LAYER 2 — CLASS PORTFOLIO GRID (Section 02)

A grid of class health cards. One card per class level:
`Nursery · LKG · UKG · Grade 1 · Grade 2 · Grade 3 · Grade 4 · Grade 5 · Grade 6 · Grade 7 · Grade 8 · Grade 9 · Grade 10`

**Grid layout**: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3`

**Each class card** (`rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow`):
```
[Class Name]         [Health dot]
Seats: 14 / 30
Pipeline: 45 apps
[Mini bar: filled seats vs total]
```

**Health dot logic** (colored circle top-right of card):
- 🔴 Red: seats >90% full OR 10+ applications with no contact >5 days
- 🟡 Amber: seats 60-90% full OR active pipeline with some overdue
- 🟢 Green: healthy pipeline, seats available, good contact rate
- ⚪ Gray: no applications yet this season

**Selected state**: clicking a card highlights it with `border-indigo-500 bg-indigo-50` and opens Layer 3 below.

**"All Classes" option**: A special card at the start of the grid labeled "All Classes" that shows total across the school.

---

### LAYER 3 — CLASS WORKSPACE (Section 03, appears when class selected)

This section renders below the grid when a class card is clicked. It is the main work area.

**Header row**:
- Left: Class name + section selector dropdown (e.g. "Grade 3 · Section A ▾")
- Right: `Bulk Message` button (disabled until rows are selected) + `Export` button + `+ New Inquiry` button

**Stage tabs** (horizontal tab row, same pill style as Student List status filters):

| Tab | Label | What it shows |
|-----|-------|---------------|
| All | All · {count} | Every application for this class |
| New | New · {count} | Not yet contacted |
| Active | In Conversation · {count} | Visit scheduled / docs exchanged / ongoing |
| Pending | Decision Pending · {count} | Offer made, awaiting confirmation |
| Enrolled | Enrolled · {count} | Completed enrollments |
| Waitlist | Waitlist · {count} | Seat unavailable, holding |
| Cold | Cold / Dropped · {count} | No response 10+ days |

**Application list** (compact table rows, NOT cards):

Each row:
```
[☐] [Child Name]  [Parent Name]  [Source badge]  [Days in stage]  [Last action]  [Counsellor avatar]  [Edit ···]
```

- Checkbox on the left for bulk select
- Source badge: colored pill — Walk-in (blue), WhatsApp (green), Website (purple), Phone (gray), Referral (amber)
- Days in stage: shows as `3d` — turns amber at 5d, red at 10d
- Clicking a row opens the Detail Panel (see below)
- Rows are paginated: 25 per page with pagination controls

**Bulk action bar** (appears at bottom when ≥1 row checked, sticky):
```
[{n} selected]  [Send Message ▾]  [Move Stage ▾]  [Assign To ▾]  [Delete]  [Clear]
```
- "Send Message" opens template picker modal (grouped: Welcome / Follow-up / Visit / Offer / Waitlist / Rejection)
- "Move Stage" shows the 6 stage options as a dropdown
- After bulk action, uncheck all and show a toast "Message sent to 14 families"

**Detail Panel** (right-side drawer, `w-96`, slides in from right when row clicked):

Sections inside the panel:
1. **Header**: Child name, class applied, source, assigned counsellor, stage pill
2. **Quick actions**: Move Stage / Send Message / Schedule Visit / Add Note — as icon buttons
3. **Application details**: Parent name, phone, email, child DOB, sibling flag (if sibling application exists, show link)
4. **Document checklist**: Birth cert / TC / Photo / Aadhar — each with ✓ / ✗ / Pending
5. **Activity timeline**: Chronological log — "Inquiry received", "Called on 3 May", "Visit scheduled", etc.
6. **Notes**: Free text notes with timestamp, add new note inline

**Sibling detection**: When opening a detail panel, query the API for other applications from the same parent phone number. If found, show a yellow banner: "⚠ Sibling application found: [Name] for [Class]. View →"

---

## STATE MANAGEMENT

```typescript
// Key state variables
const [selectedClass, setSelectedClass] = useState<string>('all')
const [selectedSection, setSelectedSection] = useState<string>('all')
const [activeStageTab, setActiveStageTab] = useState<string>('all')
const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
const [detailPanelId, setDetailPanelId] = useState<string | null>(null)
const [briefCollapsed, setBriefCollapsed] = useState<boolean>(
  () => localStorage.getItem('brief_collapsed') === 'true'
)
```

---

## API INTEGRATION

**Step 1 — Before writing any API call:** Open `frontend/lib/api/` and list every existing admissions-related function. Use those exact function names. Do not create a new function if one already exists that does the same thing.

**Step 2 — Expected endpoints** (verify each exists before using):

| Data needed | Expected endpoint | Params required |
|-------------|------------------|-----------------|
| Inquiries list | `GET /api/admissions/inquiries/` | `class, stage, section, academic_year, page, search` |
| Class list (dynamic) | `GET /api/classes/` | `academic_year` |
| Class capacity | `GET /api/admissions/capacity/` | `academic_year` |
| Move stage | `PATCH /api/admissions/inquiries/{id}/` | `{ stage }` |
| Bulk message | `POST /api/admissions/bulk-message/` | `{ ids[], template_id, academic_year }` |
| Activity timeline | `GET /api/admissions/inquiries/{id}/timeline/` | — |
| Morning brief counts | `GET /api/admissions/dashboard/brief/` | `academic_year` |
| Audit log | `POST /api/audit/log/` | `{ action, entity, entity_id, detail }` |
| Sibling check | `GET /api/admissions/inquiries/?parent_phone={phone}` | `parent_phone, academic_year` |

**Step 3 — If an endpoint does not exist yet:** Add `// TODO: create Django endpoint` comment and mock with realistic data. Do not block UI rendering on missing endpoints.

**Step 4 — Audit every mutation.** After every successful stage move, bulk message, or delete — call `POST /api/audit/log/` so the school has a complete action history. Use a fire-and-forget pattern (don't await, don't block UI).

---

## FILE STRUCTURE

```
components/admissions/
  AdmissionsCommandCenter.tsx     ← main file, orchestrates all layers
  command-center/
    MorningBrief.tsx              ← Section 01
    ClassPortfolioGrid.tsx        ← Section 02, class health cards
    ClassWorkspace.tsx            ← Section 03, tabs + list
    ApplicationRow.tsx            ← single compact row in list
    ApplicationDetailPanel.tsx    ← right drawer
    BulkActionBar.tsx             ← sticky bottom bar when rows selected
    TemplatePicker.tsx            ← modal for choosing message template
```

---

## ANIMATIONS & VISUAL POLISH

### Motion Library
Use Framer Motion (already installed). Define these variants in a local `variants` object at the top of each component:

```typescript
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } }
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } }
}

const slideInRight = {
  hidden: { opacity: 0, x: 40 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } }
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  show:   { opacity: 1, scale: 1, transition: { duration: 0.25, ease: 'easeOut' } }
}
```

### Where to Apply Each Animation

| Element | Animation | Notes |
|---------|-----------|-------|
| Morning Brief cards (4 stat cards) | `stagger` container + `fadeUp` children | On initial mount |
| Class Portfolio Grid cards | `stagger` container + `scaleIn` children | Stagger delay 0.05s per card |
| Class Workspace section | `fadeUp` | Triggered when a class is selected |
| Application list rows | `stagger` + `fadeUp` | Re-runs when tab changes |
| Detail Panel drawer | `slideInRight` + `AnimatePresence` | Slides in from right edge |
| Bulk Action Bar | `motion.div` fixed bottom, `y: 80 → y: 0` when rows selected | Slides up from bottom |
| Health dot | CSS `animate-pulse` (Tailwind) on 🔴 Red status only | Draws attention to urgent classes |
| Stage tab indicator | Framer `layoutId="tab-indicator"` shared layout animation | Smooth pill slides between tabs |

### Loading States — Shimmer Skeletons
While API data is fetching, show shimmer skeletons — NOT spinners. Use this Tailwind shimmer pattern:

```tsx
// Shimmer base class — add to skeleton divs
const shimmer = "animate-pulse bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 rounded-lg"

// Class portfolio skeleton (while loading classes)
<div className="grid grid-cols-5 gap-3">
  {Array.from({ length: 13 }).map((_, i) => (
    <div key={i} className={`${shimmer} h-24`} />
  ))}
</div>

// Application row skeleton (while loading list)
{Array.from({ length: 8 }).map((_, i) => (
  <div key={i} className="flex gap-3 p-3 border-b border-gray-50">
    <div className={`${shimmer} w-4 h-4 rounded`} />
    <div className={`${shimmer} h-4 w-36`} />
    <div className={`${shimmer} h-4 w-24`} />
    <div className={`${shimmer} h-4 w-16`} />
  </div>
))}
```

### Micro-interactions

**Class portfolio cards:**
```tsx
<motion.div
  whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
  whileTap={{ scale: 0.98 }}
  transition={{ duration: 0.15 }}
  className={`rounded-xl border p-4 cursor-pointer ${
    selectedClass === cls.id
      ? 'border-indigo-500 bg-indigo-50 shadow-md'
      : 'border-gray-100 bg-white hover:border-gray-200'
  }`}
>
```

**Application rows:**
```tsx
<motion.tr
  whileHover={{ backgroundColor: '#f9fafb' }}
  transition={{ duration: 0.1 }}
  className="border-b border-gray-50 cursor-pointer"
>
```

**Primary buttons:**
```tsx
className="... transition-all duration-150 hover:shadow-md active:scale-95"
```

**Stat count numbers in Morning Brief — animate the number on load:**
```tsx
// Use a simple counting animation with useEffect
const [displayed, setDisplayed] = useState(0)
useEffect(() => {
  if (!value) return
  let start = 0
  const step = Math.ceil(value / 20)
  const timer = setInterval(() => {
    start += step
    if (start >= value) { setDisplayed(value); clearInterval(timer) }
    else setDisplayed(start)
  }, 30)
  return () => clearInterval(timer)
}, [value])
```

### Visual Design Details

**Class health cards — capacity bar:**
```tsx
// Thin progress bar showing seats filled
<div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
  <motion.div
    className={`h-full rounded-full ${
      pct > 90 ? 'bg-red-400' : pct > 60 ? 'bg-amber-400' : 'bg-indigo-400'
    }`}
    initial={{ width: 0 }}
    animate={{ width: `${pct}%` }}
    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
  />
</div>
```

**Source badges — each source has a distinct color:**
```tsx
const sourceBadge = {
  'walk-in':  'bg-blue-50 text-blue-700 border-blue-100',
  'whatsapp': 'bg-green-50 text-green-700 border-green-100',
  'website':  'bg-purple-50 text-purple-700 border-purple-100',
  'phone':    'bg-gray-50 text-gray-700 border-gray-200',
  'referral': 'bg-amber-50 text-amber-700 border-amber-100',
}
// Usage: <span className={`text-xs px-2 py-0.5 rounded-full border ${sourceBadge[source]}`}>{source}</span>
```

**Days-overdue indicator with color shift:**
```tsx
const daysColor =
  days <= 2  ? 'text-gray-400' :
  days <= 5  ? 'text-amber-500 font-medium' :
               'text-red-500 font-semibold'
// Render: <span className={daysColor}>{days}d</span>
```

**Detail panel sections use a subtle left border accent:**
```tsx
<div className="border-l-2 border-indigo-200 pl-3 mb-4">
  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Documents</p>
  {/* content */}
</div>
```

**Empty state (when a tab has 0 applications):**
```tsx
<motion.div variants={fadeUp} className="flex flex-col items-center py-16 text-center">
  <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
    <CheckCircle className="w-6 h-6 text-gray-300" />
  </div>
  <p className="text-sm font-medium text-gray-500">All clear</p>
  <p className="text-xs text-gray-400 mt-1">No applications in this stage</p>
</motion.div>
```

**Toast notification after bulk action:**
```tsx
// Show a fixed bottom-right toast after bulk send
<AnimatePresence>
  {toast && (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10 }}
      className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-xl flex items-center gap-2"
    >
      <CheckCircle className="w-4 h-4 text-green-400" />
      {toast}
    </motion.div>
  )}
</AnimatePresence>
```

---

## ERROR, LOADING & EMPTY STATES (mandatory for every async section)

Every section that fetches data must have all three states handled — no exceptions:

```tsx
// Pattern to follow for every async section
if (isLoading) return <ShimmerSkeleton />      // shimmer, not spinner
if (error)     return <ErrorState retry={refetch} message={error.message} />
if (!data || data.length === 0) return <EmptyState label="No applications yet" />
return <ActualContent data={data} />
```

**ErrorState component** (create once, reuse everywhere):
```tsx
<div className="flex flex-col items-center py-12 text-center">
  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-3">
    <AlertCircle className="w-5 h-5 text-red-400" />
  </div>
  <p className="text-sm text-gray-500">{message}</p>
  <button onClick={retry} className="mt-3 text-sm text-indigo-600 hover:underline">Try again</button>
</div>
```

## WHAT TO REMOVE

- The old single horizontal pipeline kanban board (the drag-drop stage columns) — remove entirely as default view
- The single "All Applications" flat list as the landing state
- Any hardcoded class list — fetch from `/api/classes/` so it works for schools with any number of classes

---

## TYPESCRIPT INTERFACES (define before writing components)

```typescript
// Define these in types/admissions.ts — import in all components

interface ClassConfig {
  id: string
  name: string          // e.g. "Nursery", "LKG", "Grade 5"
  sections: Section[]
  capacity: number
  filled: number
  pipelineCount: number
  healthStatus: 'urgent' | 'active' | 'healthy' | 'quiet'
  academicYear: string
}

interface Inquiry {
  id: string
  childName: string
  parentName: string
  parentPhone: string
  parentEmail: string
  classApplied: string
  section?: string
  source: 'walk-in' | 'whatsapp' | 'website' | 'phone' | 'referral' | 'other'
  stage: 'new' | 'active' | 'decision' | 'enrolled' | 'waitlist' | 'cold'
  daysInStage: number
  counsellorId?: string
  lastActionAt: string
  academicYear: string
  hasSibling?: boolean
}

interface MorningBrief {
  newToday: number
  overdueFollowUp: number
  visitsToday: number
  decisionsPending: number
}

interface BulkActionPayload {
  ids: string[]
  templateId?: string
  targetStage?: string
  counsellorId?: string
  academicYear: string
}
```

## FINAL CHECKLIST BEFORE SUBMITTING CODE

- [ ] Page title matches "Student List" style — bold + italic purple second word
- [ ] All content inside one white `rounded-2xl` outer card
- [ ] Numbered sections (01, 02, 03) with collapse arrows
- [ ] Class portfolio grid renders for all 13 classes dynamically from API
- [ ] Health dots use correct color logic
- [ ] Stage tabs show live counts from API
- [ ] Bulk select + bulk message works end to end
- [ ] Detail panel slides in from right with AnimatePresence
- [ ] Sibling detection banner implemented
- [ ] Morning brief cards are clickable and set filters
- [ ] No new npm packages installed
- [ ] All TypeScript types defined (no `any`) — interfaces in `types/admissions.ts`
- [ ] Class list fetched from `/api/classes/` — never hardcoded
- [ ] Academic year passed as param on every API call
- [ ] RBAC: counsellor-only actions hidden from teacher/parent roles
- [ ] Every mutation fires audit log (`POST /api/audit/log/`) fire-and-forget
- [ ] Error state + empty state implemented for every async section
- [ ] Search input debounced at 300ms
- [ ] Pagination controls render at 25+ rows
- [ ] Detail panel data fetched on open (lazy), not on list render
