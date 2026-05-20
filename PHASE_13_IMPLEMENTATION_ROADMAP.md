# PHASE 13: Super Admin Console UI & ERP Screen Integration
## Comprehensive Implementation Roadmap

**Date**: May 14, 2026  
**Foundation**: Phases 1-12 complete (multi-tenancy, auth, RBAC, migration engine all stable)  
**Goal**: Build exact pixel-accurate Super Admin Console matching provided PDF design  
**Timeline**: 4 weeks (Sprints 0-4)

---

## TABLE OF CONTENTS

1. [Design Constants](#design-constants)
2. [Architecture Overview](#architecture-overview)
3. [Sprint 0: Foundation & Setup](#sprint-0-foundation--setup-05-days)
4. [Sprint 1: Backend API](#sprint-1-backend-api-2-3-days)
5. [Sprint 2: Frontend Client Layer](#sprint-2-frontend-client-layer-1-day)
6. [Sprint 3: Super Admin Screens](#sprint-3-super-admin-screens-3-4-days)
7. [Sprint 4: V2 & Polish](#sprint-4-v2--polish-1-2-days)
8. [Success Criteria](#success-criteria)

---

## DESIGN CONSTANTS

### Color Tokens (from tokens.css)
- **Primary Accent**: `--pu: #6D4AFF` (indigo-600)
- **Error**: `--err: #E0463A` (red)
- **Success**: `--success: #10B981` (green)
- **Warning**: `--warning: #F59E0B` (amber)
- **Neutral**: grays from gray-50 to gray-900

### Component Tokens
```css
/* KPI Card */
rounded-xl border border-gray-100 bg-white p-4

/* White outer card (sections) */
rounded-2xl shadow-sm border border-gray-100 bg-white p-6

/* Active filter pill */
bg-indigo-600 text-white rounded-full px-3 py-1 text-sm

/* Inactive filter pill */
bg-gray-100 text-gray-600 rounded-full px-3 py-1 text-sm

/* Page header */
font-bold + text-indigo-500 font-light (subtitle)
```

### Typography
- **Headers**: font-bold + text-indigo-500
- **Subtitles**: font-light text-gray-600
- **Monospace Keys**: `font-mono text-sm` (policy keys)
- **Badges**: text-xs font-semibold

---

## ARCHITECTURE OVERVIEW

### Route Structure
```
frontend/app/
├── (dashboard)/           ← EXISTING: school ERP (untouched)
│   └── dashboard/
├── (super-admin)/         ← NEW: super admin console
│   ├── layout.tsx        ← role check, sidebar
│   └── super-admin/
│       ├── page.tsx      ← redirect to dashboard
│       ├── dashboard/page.tsx
│       ├── schools/
│       │   ├── page.tsx
│       │   └── [tenantId]/page.tsx
│       ├── billing/page.tsx
│       ├── audit/page.tsx
│       └── policies/page.tsx
```

### Authentication
- Separate endpoint: `/api/auth/super-admin/token/`
- JWT payload includes: `role: "super_admin"`
- Protected by `IsSuperAdmin` permission class
- Layout checks role before rendering

### API Structure
```
/api/super-admin/
├── dashboard/         GET
├── schools/          GET, POST, PATCH, DELETE
├── billing/
│   ├── invoices/    GET, POST
│   └── mrr/         GET
├── audit/           GET, (export)
└── policies/        GET, PATCH, (export)
```

---

## SPRINT 0: FOUNDATION & SETUP (0.5 days)

### 0.1 Study Design Document
- [ ] Read Section 01-10 of Super Admin Console PDF completely
- [ ] Memorize color tokens and component patterns
- [ ] Understand all 5 screen layouts exactly
- [ ] Note all hardcoded data to be replaced

### 0.2 Frontend Setup
- [ ] Verify tokens.css has all required colors
- [ ] Check existing components: Button, Badge, Input, Table, KPICard
- [ ] Understand NextAuth integration for JWT
- [ ] Verify reusable StudentList.tsx pattern

### 0.3 Backend Setup  
- [ ] Verify django-tenants installed and configured
- [ ] Check TENANT_MODEL set correctly
- [ ] Verify TenantMainMiddleware is first in MIDDLEWARE
- [ ] Confirm PUBLIC schema access for super-admin views

### 0.4 Create Super Admin Folder Structure
- [ ] Create `app/(super-admin)/` route group
- [ ] Create `lib/api/super-admin/` directory
- [ ] Create `components/super-admin/` directory
- [ ] Create `types/super-admin/` directory

**Deliverable**: Folder structure ready, all imports verified, zero breaking changes.

---

## SPRINT 1: BACKEND API (2-3 days)

### 1.1 Authentication
- [ ] Create `IsSuperAdmin` permission class in `permissions.py`
- [ ] Add super-admin login endpoint: `/api/auth/super-admin/token/`
- [ ] Return JWT with `role: "super_admin"` in payload
- [ ] Test with curl

### 1.2 Dashboard API
- [ ] Endpoint: `GET /api/super-admin/dashboard/`
- [ ] Returns: `DashboardData` interface (see Section 05 PDF)
  - totalSchools, activeSchools, totalStudents, totalStaff
  - mrr.current, mrr.trend
  - alertCount
  - boardBreakdown[] (CBSE, SSC AP, ICSE, SSC TG)
  - trends (students, mrr)
- [ ] Query: SchoolTenant.objects.all().aggregate()
- [ ] Last 5 audit events for recent activity

### 1.3 School Management API
- [ ] GET `/api/super-admin/schools/`
  - Paginated (25 per page)
  - Filters: status, board, plan, search (name, tenantId, GSTIN)
  - Returns: SchoolTenant list with all fields
- [ ] POST `/api/super-admin/schools/provision/`
  - Input: name, subdomain_url, state, board, plan, shard_region, storage_region
  - Output: tenant_id, status (provisioned)
  - Action: Create SchoolTenant record
- [ ] PATCH `/api/super-admin/schools/{tenant_id}/`
  - Allowed fields: plan, status, api_access
  - Tenant ID immutable
- [ ] DELETE `/api/super-admin/schools/{tenant_id}/`
  - Soft delete or archive (optional: schema deletion)

### 1.4 Billing API
- [ ] GET `/api/super-admin/billing/invoices/`
  - Paginated list with status badges (Paid/Sent/Overdue)
  - Filters: status, school, date range
- [ ] POST `/api/super-admin/billing/invoices/`
  - Auto-compute IGST vs CGST+SGST based on seller/buyer state
  - Input: school, period, amount
  - Output: invoice with tax breakdown
- [ ] GET `/api/super-admin/billing/mrr/`
  - Returns: current MRR, previous MRR, trend%
- [ ] GET `/api/super-admin/billing/export/gstr1/`
  - Returns CSV/Excel GSTR-1 export

### 1.5 Audit API
- [ ] GET `/api/super-admin/audit/`
  - Paginated (newest first)
  - Filters: actor, action, tenant, date range
  - Returns: AuditEvent objects with timestamp, actor, action, detail, ipAddress
- [ ] POST audit entries on every mutation (provision, update, delete)
- [ ] GET `/api/super-admin/audit/export/`
  - Returns CSV export with all fields

### 1.6 Policies API (V2)
- [ ] GET `/api/super-admin/policies/`
  - Returns all GlobalPolicy objects grouped by category
  - Fields: key, description, value, is_toggle, is_overridable
- [ ] PATCH `/api/super-admin/policies/`
  - Input: { key: new_value }
  - Audit-log every change
- [ ] GET `/api/super-admin/policies/export/`
  - Returns JSON/YAML config export

### 1.7 Wire Up URLs
- [ ] Create `tenants/urls_super_admin.py`
- [ ] Register in `backend/urls.py`: `path("api/super-admin/", include(...))`
- [ ] Test all endpoints with Postman

**Deliverable**: All 6 API endpoint suites working, fully tested with curl/Postman.

---

## SPRINT 2: FRONTEND CLIENT LAYER (1 day)

### 2.1 Create API Client: `lib/api/super-admin/schools.ts`
```typescript
export interface SchoolTenant {
  tenant_id: string;
  name: string;
  plan: 'trial' | 'premium' | 'enterprise';
  status: string;
  students: number;
  seats: number;
  lastActivity: string;
  // ... all fields
}

export async function getSchools(params: any): Promise<PaginatedResponse<SchoolTenant>> { ... }
export async function provisionSchool(data: any): Promise<{ tenant_id: string; status: string }> { ... }
export async function updateSchool(tenantId: string, data: any): Promise<SchoolTenant> { ... }
export async function deleteSchool(tenantId: string): Promise<void> { ... }
```

### 2.2 Create API Client: `lib/api/super-admin/dashboard.ts`
```typescript
export interface DashboardData {
  totalSchools: number;
  activeSchools: number;
  totalStudents: number;
  totalStaff: number;
  mrr: { current: number; trend: number };
  alertCount: number;
  boardBreakdown: { board: string; count: number; percent: number }[];
  trends: { students: number; mrr: number };
}

export async function getDashboard(): Promise<DashboardData> { ... }
```

### 2.3 Create API Client: `lib/api/super-admin/billing.ts`
```typescript
export interface Invoice { ... }
export interface MrrData { ... }

export async function getInvoices(params: any): Promise<PaginatedResponse<Invoice>> { ... }
export async function createInvoice(data: any): Promise<Invoice> { ... }
export async function getMrr(): Promise<MrrData> { ... }
export async function exportGstr1(): Promise<Blob> { ... }
```

### 2.4 Create API Client: `lib/api/super-admin/audit.ts`
```typescript
export interface AuditEvent { ... }

export async function getAuditEvents(params: any): Promise<PaginatedResponse<AuditEvent>> { ... }
export async function exportAuditCsv(params: any): Promise<Blob> { ... }
```

### 2.5 Create API Client: `lib/api/super-admin/policies.ts`
```typescript
export interface GlobalPolicy { ... }

export async function getPolicies(): Promise<GroupedPolicies> { ... }
export async function updatePolicies(changes: any): Promise<void> { ... }
export async function exportPolicies(): Promise<Blob> { ... }
```

### 2.6 Create Layout Shell: `app/(super-admin)/layout.tsx`
- [ ] Check JWT role === "super_admin"
- [ ] Redirect to login if not
- [ ] Render sidebar + topbar + main content area
- [ ] Navigation: Dashboard / Schools / Billing / Audit / Policies
- [ ] Profile dropdown in topbar

**Deliverable**: All API clients fully typed, layout shell ready, zero console errors.

---

## SPRINT 3: SUPER ADMIN SCREENS (3-4 days)

### 3.1 Dashboard Screen: `super-admin/dashboard/page.tsx`

**Layout** (from PDF):
- Header: "Super Admin Dashboard" title + "Platform Overview" subtitle
- 4 KPI Cards row:
  - Total Schools (number, +X% trend)
  - Students Served (number, +X% trend)
  - Monthly Recurring Revenue (number, +X% trend)
  - Needs Attention (count)
- Schools by Board: Horizontal bar chart (Recharts BarChart)
  - CBSE, SSC AP, ICSE, SSC TG breakdown
- Recent Activity: Timeline with last 5 events
- Export button in header

**Implementation**:
- [ ] useEffect → getDashboard() with loading state
- [ ] Shimmer skeleton for 4 KPI cards while loading
- [ ] Map KPI data to card components
- [ ] Recharts BarChart for board breakdown
- [ ] Timeline component for recent activity
- [ ] Error state with retry

### 3.2 School Management Screen: `super-admin/schools/page.tsx`

**Layout** (from PDF):
- Header: "School Management" + action button "Add School"
- 4 KPI row: Total, Active, On Trial, Needs Attention
- Filter bar: status, board, plan, region, state chips + search input
- School grid/list with school cards
  - Card shows: TenantID, GSTIN, board, plan badge, seat usage bar, last activity
  - Click card → detail panel

**Implementation**:
- [ ] useEffect → getSchools() with loading state
- [ ] Shimmer skeleton rows while loading
- [ ] Filter chips wired to URL query params (?status=active&board=CBSE)
- [ ] Debounced search input (300ms)
- [ ] School cards grid layout
- [ ] Detail panel modal when card clicked
- [ ] Provision form in modal with all fields

### 3.3 Billing Screen: `super-admin/billing/page.tsx`

**Layout** (from PDF):
- Header: "Tenants & Billing" title
- 4 KPI row: MRR, GST Collected, Outstanding, At-Risk
- Invoice list table:
  - Columns: Number, School, Date, Amount, Status, GST, Actions
  - Status badges (Paid/Sent/Overdue) with colors
  - Click row → full GST invoice detail panel
- Full Invoice Detail Panel:
  - Seller GSTIN (29AABCE1234F1ZS)
  - Invoice line items
  - SAC codes
  - IGST/CGST/SGST breakdown
  - Total in words
- Export GSTR-1 button
- New Invoice button

**Implementation**:
- [ ] KPI cards with MRR trend data
- [ ] Invoice list table with sorting/pagination
- [ ] Status badges with color coding
- [ ] Row click → detail panel with full invoice
- [ ] Tax calculation display
- [ ] "Amount in words" using num2words-india
- [ ] Export button with file download

### 3.4 Audit Log Screen: `super-admin/audit/page.tsx`

**Layout** (from PDF):
- Header: "Audit Log" title
- Filter panel:
  - Actor select
  - Action multi-select
  - Date range picker (calendar)
  - Tenant filter
- Audit event list (paginated):
  - Columns: Timestamp, Actor, Action, Detail, IP, Status
  - Color-coded icons (ok=green, warn=amber, danger=red)
  - Newest first
- Export CSV button
- Refresh button

**Implementation**:
- [ ] Filter section with all controls
- [ ] Debounced filter → URL query params
- [ ] Paginated event list
- [ ] Status icons with colors
- [ ] Format timestamp as "X min ago"
- [ ] Export CSV button with download
- [ ] Refresh button to re-fetch

### 3.5 Create Sidebar Component

**Requirements** (from design):
- Collapsible sidebar with Eskoolia logo
- Navigation items: Dashboard / Schools / Billing / Audit / Policies
- Active state indicator
- Collapse/expand toggle
- Profile dropdown in bottom corner
- Logout option

**Implementation**:
- [ ] Sidebar component with collapsible state
- [ ] Active route indicator
- [ ] Smooth transitions
- [ ] Mobile: collapse on small screens
- [ ] Profile dropdown with avatar + logout

**Deliverable**: 4 full screens (Dashboard, Schools, Billing, Audit) fully functional with real data from APIs, responsive layout, exact design match.

---

## SPRINT 4: V2 & POLISH (1-2 days)

### 4.1 Global Policies Screen (V2 - OPTIONAL)

**Layout** (from PDF):
- 3 collapsible panels:
  - Security & Authentication
  - Data Isolation & Retention
  - Billing & Compliance
- Each policy row:
  - Monospace key (e.g., `password.min_length`)
  - Description
  - Current value (editable inline or modal)
  - Toggle switch if applicable
- Save Changes button
- Export Config button

**Implementation** (if time allows):
- [ ] GlobalPolicy Django model
- [ ] Seed with 14 policies
- [ ] API endpoint GET/PATCH
- [ ] Frontend with inline editors
- [ ] Batch save on "Save Changes"

### 4.2 Polish & UX Refinements
- [ ] Loading skeletons for all screens
- [ ] Empty states with illustrations
- [ ] Error states with retry logic
- [ ] Success/error toasts
- [ ] Confirmation dialogs for destructive actions
- [ ] Graceful error handling on all API calls
- [ ] Form validations on all inputs

### 4.3 Responsive Design Audit
- [ ] Desktop (1920px): Full layout
- [ ] Laptop (1366px): Slight compression
- [ ] Tablet (768px): Sidebar collapse, responsive tables
- [ ] Mobile (375px): Hamburger menu, stacked cards
- [ ] Test on actual devices or DevTools

### 4.4 Performance Optimization
- [ ] Code-split routes
- [ ] Lazy-load components
- [ ] React Query caching strategy
- [ ] Virtualize long lists if needed
- [ ] Optimize images/icons
- [ ] Measure lighthouse scores

### 4.5 Accessibility & QA
- [ ] Run axe DevTools on all screens
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG standards
- [ ] Screen reader compatible labels
- [ ] No console errors in production build

**Deliverable**: Polished, accessible, performant Super Admin Console ready for production testing.

---

## SUCCESS CRITERIA

### Screen Completion Checklist

#### Dashboard Screen ✅
- [ ] Loads without errors
- [ ] 4 KPI cards display real data
- [ ] Board breakdown chart renders correctly
- [ ] Recent activity timeline shows last 5 events
- [ ] All numbers update when data changes
- [ ] Loading skeleton visible on initial load
- [ ] Responsive on all viewports
- [ ] Exact design match (spacing, colors, typography)

#### School Management Screen ✅
- [ ] School list loads with pagination
- [ ] Filter chips work (URL query params update)
- [ ] Search input debounces correctly
- [ ] School cards display all fields correctly
- [ ] Click card → detail panel opens
- [ ] Provision form submits and creates tenant
- [ ] Returned tenant_id is displayed read-only
- [ ] All validations work
- [ ] Exact design match

#### Billing Screen ✅
- [ ] MRR KPI row displays correctly
- [ ] Invoice table loads and displays correctly
- [ ] Status badges show correct colors
- [ ] Click row → full invoice detail panel
- [ ] Tax split (IGST/CGST/SGST) displays correctly
- [ ] Amount in words calculation works
- [ ] Export GSTR-1 downloads file
- [ ] New Invoice button works
- [ ] Exact design match

#### Audit Log Screen ✅
- [ ] Event list loads paginated
- [ ] Filters work (actor, action, date range)
- [ ] Color-coded status icons display
- [ ] Timestamps format as "X min ago"
- [ ] Export CSV downloads file
- [ ] Refresh button re-fetches data
- [ ] Exact design match

#### Overall Quality ✅
- [ ] Zero breaking changes to existing school ERP
- [ ] Super-admin routing fully isolated
- [ ] Role-based access enforced on all screens
- [ ] All APIs fully connected
- [ ] Performance acceptable (LCP < 2s)
- [ ] Accessibility WCAG AA compliant
- [ ] Mobile responsive
- [ ] Production-ready code quality

---

## CRITICAL IMPLEMENTATION RULES

### DO:
✅ Match provided PDF/screens exactly  
✅ Preserve pixel-level structure  
✅ Use existing backend architecture  
✅ Create reusable components  
✅ Maintain enterprise-grade polish  
✅ Integrate RBAC correctly  
✅ Handle all error states gracefully  

### DON'T:
❌ Redesign provided screens  
❌ Simplify layouts  
❌ Break backend compatibility  
❌ Remove RBAC integration  
❌ Hardcode any data  
❌ Skip error/loading/empty states  
❌ Ignore responsive design  

---

## DELIVERABLES BY END OF PHASE 13

1. ✅ Super Admin Console fully functional
2. ✅ 4 V1 screens (Dashboard, Schools, Billing, Audit)
3. ✅ Exact design implementation
4. ✅ All APIs integrated
5. ✅ RBAC enforced
6. ✅ Responsive & accessible
7. ✅ Production-ready code quality
8. ✅ Optional V2 features (Policies)
9. ✅ Ready for production deployment

---

## NEXT IMMEDIATE STEPS

1. **Today**: Complete Sprint 0 setup
2. **Tomorrow**: Begin Sprint 1 backend API
3. **This Week**: Complete Sprints 1-2
4. **Next Week**: Complete Sprint 3 (screens)
5. **Following Week**: Sprint 4 polish + production readiness

---

**Status**: READY TO BEGIN IMPLEMENTATION  
**Last Updated**: May 14, 2026  
**Next Review**: After Sprint 0 completion
