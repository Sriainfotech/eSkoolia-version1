# Complete Pagination Migration Guide

## Status Overview

✅ **Backend Coverage**: 35+ ViewSets now have `ApiPageNumberPagination`
- Core: ItemCategory, ItemStore, Supplier, Item, ItemReceive, ItemIssue, ItemSell
- Students: StudentCategory, StudentGroup, Guardian, Student
- HR: Department, Designation, Staff, LeaveType, LeaveDefine, LeaveRequest, StaffAttendance, PayrollRecord
- Finance: ChartOfAccount, BankAccount, LedgerEntry, FundTransfer
- Fees: FeesGroup, FeesType, FeesAssignment, FeesPayment
- Library: BookCategory, Book, LibraryMember, BookIssue
- Behaviour: Incident, AssignedIncident
- Admissions: AdmissionInquiry, ComplaintEntry, PostalReceiveEntry, PostalDispatchEntry, VisitorBookEntry
- Academics: ClassSubjectAssignment, ClassTeacherAssignment, Homework

✅ **Frontend Demo Panels**: 3 TIER-1 screens fully migrated
- RoleManagementPanel (earliest example)
- SchoolManagementPanel (earliest example)
- StudentListPanel (new)

⏭️ **Remaining**: 60+ list/panel components need frontend migration

---

## Migration Pattern Template

### **Step 1: Add Imports**

```typescript
import { PaginationControls } from "@/components/common/PaginationControls";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { usePersistentPagination } from "@/hooks/usePersistentPagination";
import {
  buildPaginationQuery,
  extractListData,
  extractPaginationMeta,
  type ListApiResponse,
} from "@/lib/pagination";
```

### **Step 2: Define Key State Variables**

Replace/Add:
```typescript
// ❌ REMOVE:
const [rows, setRows] = useState<YourType[]>([]);

// ✅ ADD:
const { page, pageSize, setPage, setPageSize } = usePersistentPagination("module.panel", 1, 10);
const [rows, setRows] = useState<YourType[]>([]);
const [totalCount, setTotalCount] = useState(0);
const [totalPages, setTotalPages] = useState(0);
const [loading, setLoading] = useState(false);

// For delete confirmation:
const [deleteCandidate, setDeleteCandidate] = useState<YourType | null>(null);
const [deletingId, setDeletingId] = useState<number | null>(null);
```

### **Step 3: Create Main Load Function**

```typescript
const loadData = async (pageNum = 1, pageSizeNum = 10) => {
  try {
    setLoading(true);
    
    // Build query with filters
    const query = buildPaginationQuery(pageNum, pageSizeNum, {
      search: searchTerm,           // if applicable
      status: statusFilter,          // if applicable
      category_id: selectedCategory, // if applicable
      // Add any other filters your panel uses
    });
    
    const response = await apiRequestWithRefresh<ListApiResponse<YourType>>(
      `/api/v1/module/endpoint/?${query}`,
      { headers: { "Content-Type": "application/json" } }
    );
    
    const listData = extractListData(response);
    const meta = extractPaginationMeta(response);
    
    setRows(listData);
    if (meta) {
      setTotalCount(meta.count);
      setTotalPages(Math.ceil(meta.count / pageSizeNum));
    }
    setError("");
  } catch {
    setError("Unable to load data.");
  } finally {
    setLoading(false);
  }
};

// On mount or when pagination changes
useEffect(() => {
  void loadData(page, pageSize);
}, [page, pageSize]);

// When filters change, reset to page 1
const handleFilterChange = (newFilters: any) => {
  // Update filter states
  setFilterState(newFilters);
  setPage(1); // Reset pagination
};
```

### **Step 4: Add Delete with Confirmation Modal**

```typescript
const remove = async (id: number) => {
  try {
    setDeletingId(id);
    await apiRequestWithRefresh(`/api/v1/module/endpoint/${id}/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    
    // Recalculate pagination if last item on page was deleted
    const remainingAfterDelete = rows.filter(r => r.id !== id);
    if (remainingAfterDelete.length === 0 && page > 1) {
      setPage(page - 1);
    } else {
      await loadData(page, pageSize);
    }
    
    setToast("Successfully deleted.");
  } catch {
    setError("Unable to delete item.");
  } finally {
    setDeleteCandidate(null);
    setDeletingId(null);
  }
};
```

### **Step 5: Update JSX with PaginationControls**

```tsx
// In your list table section:
<div className="white-box" style={boxStyle()}>
  <h3 style={{ marginTop: 0, marginBottom: 12 }}>List Title</h3>
  
  {/* Table */}
  <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Column 1</th>
          <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Column 2</th>
          <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {loading && <tr><td colSpan={3} style={{ padding: 12 }}>Loading...</td></tr>}
        {!loading && rows.length === 0 && <tr><td colSpan={3} style={{ padding: 12, color: "var(--text-muted)" }}>No records found.</td></tr>}
        {!loading && rows.map((row) => (
          <tr key={row.id}>
            <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.field1}</td>
            <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.field2}</td>
            <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
              <button onClick={() => setDeleteCandidate(row)}>Delete</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  
  {/* Pagination Controls */}
  <PaginationControls
    currentPage={page}
    totalPages={totalPages}
    pageSize={pageSize}
    totalItems={totalCount}
    onPageChange={(newPage) => setPage(newPage)}
    onPageSizeChange={(newSize) => {
      setPageSize(newSize);
      setPage(1);
    }}
    loading={loading}
    pageSizeOptions={[5, 10, 25, 50]}
  />
</div>

{/* Confirmation Modal */}
<ConfirmationModal
  isOpen={deleteCandidate !== null}
  title="Delete Record?"
  message={`Are you sure you want to delete "${deleteCandidate?.name}"?`}
  confirmLabel="Delete"
  cancelLabel="Cancel"
  onConfirm={() => deleteCandidate ? void remove(deleteCandidate.id) : undefined}
  onCancel={() => setDeleteCandidate(null)}
  isConfirming={deletingId !== null}
/>
```

---

## Quick Mapping: FrontEnd → Backend

| Frontend Panel | Backend ViewSet | API Endpoint | Status |
|---|---|---|---|
| StudentListPanel | StudentViewSet | `/api/v1/students/students/` | ✅ Migrated |
| StudentDisabledPanel | StudentViewSet | `/api/v1/students/students/?is_disabled=true` | ✅ Migrated |
| StudentUnassignedPanel | StudentViewSet | `/api/v1/students/students/?unassigned=true` | ✅ Migrated |
| RoleManagementPanel | RoleViewSet | `/api/v1/access-control/roles/` | ✅ Migrated |
| SchoolManagementPanel | SchoolViewSet | `/api/v1/tenancy/schools/` | ✅ Migrated |
| HrDepartmentsPanel | DepartmentViewSet | `/api/v1/hr/departments/` | ⏭️ Ready |
| HrDesignationsPanel | DesignationViewSet | `/api/v1/hr/designations/` | ⏭️ Ready |
| HrStaffPanel | StaffViewSet | `/api/v1/hr/staff/` | ⏭️ Ready |
| FinanceChartAccountsPanel | ChartOfAccountViewSet | `/api/v1/finance/chart-of-accounts/` | ⏭️ Ready |
| FinanceBankAccountsPanel | BankAccountViewSet | `/api/v1/finance/bank-accounts/` | ⏭️ Ready |
| FeesGroupPanel | FeesGroupViewSet | `/api/v1/fees/fees-groups/` | ⏭️ Ready |
| FeesPaymentPanel | FeesPaymentViewSet | `/api/v1/fees/fees-payments/` | ⏭️ Ready |
| LibraryBooksPanel | BookViewSet | `/api/v1/library/books/` | ⏭️ Ready |
| BehaviourIncidentPanel | IncidentViewSet | `/api/v1/behaviour/incidents/` | ⏭️ Ready |
| ComplaintPanel | ComplaintEntryViewSet | `/api/v1/admissions/complaint-entries/` | ⏭️ Ready |
| PostalReceivePanel | PostalReceiveEntryViewSet | `/api/v1/admissions/postal-receive-entries/` | ⏭️ Ready |
| PostalDispatchPanel | PostalDispatchEntryViewSet | `/api/v1/admissions/postal-dispatch-entries/` | ⏭️ Ready |

---

## Key Types for Type Safety

```typescript
// From lib/pagination.ts
type PaginatedApiResponse<T> = {
  success?: boolean;
  message?: string;
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type ListApiResponse<T> = T[] | PaginatedApiResponse<T> | { data: T[] } | { results: T[] };

// Helper functions
function extractListData<T>(value: ListApiResponse<T>): T[]
function extractPaginationMeta<T>(value: unknown): { count: number; next: string | null; previous: string | null } | null
function buildPaginationQuery(page: number, pageSize: number, extra?: Record<string, any>): string
```

---

## Checklist for Each Migration

- [ ] Add import statements (5 new imports)
- [ ] Add state variables (page, pageSize, totalCount, totalPages, loading, deleteCandidate, deletingId)
- [ ] Create loadData() function with filter params
- [ ] Add useEffect hook that calls loadData on page/pageSize change
- [ ] Add filter handlers that reset page to 1
- [ ] Replace delete window.confirm() with Modal
- [ ] Add PaginationControls component to JSX
- [ ] Wire up pagination callbacks (onPageChange, onPageSizeChange)
- [ ] Add ConfirmationModal JSX
- [ ] Test filters + pagination + delete flow
- [ ] Verify no TypeScript errors

---

## Compilation Check

After migrating a panel, verify:
```bash
# Check for TypeScript errors
npx tsc --noEmit

# Or in your IDE terminal
npm run dev
```

Expected: No errors related to your migrated panel components.

---

## Next Steps

1. **Tier 1 (High Impact)**: HR panels, Finance panels, Student-related panels
2. **Tier 2 (Medium Impact)**: Library, Behaviour, Admissions panels
3. **Tier 3 (Lower Impact)**: Academic setup panels, Core/Inventory panels

All backend endpoints are ready. Frontend migrations just need the pattern applied consistently.

