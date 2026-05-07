# Marketing Page — Edit Button Bug Fix
**File:** `frontend/components/admissions/AdmissionsMarketing.tsx`

---

## Bugs Confirmed (via live browser audit)

| # | Bug | Confirmed |
|---|-----|-----------|
| 1 | Edit button hit area too small (51×34px — misses clicks) | ✅ |
| 2 | No Escape key to close modal | ✅ |
| 3 | No backdrop click-to-close | ✅ |

---

## Fix 1 — Bigger Edit Button Hit Area

Find this (around line 591):
```tsx
<button
  onClick={() => handleEditCampaign(campaign)}
  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50 text-gray-700"
>
  Edit
</button>
```

Replace with:
```tsx
<button
  onClick={() => handleEditCampaign(campaign)}
  className="border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 hover:border-gray-300 text-gray-700 transition-colors min-w-[64px]"
>
  Edit
</button>
```

**What changed:** `px-3 py-1.5` → `px-4 py-2`, added `min-w-[64px]`, `font-medium`, `transition-colors`. Button is now 64px minimum width and taller — much easier to click.

---

## Fix 2 — Escape Key to Close Modal

Find your state declarations at the top of the component (look for `useState(false)` near `editModalOpen`):

```tsx
const [editModalOpen, setEditModalOpen] = useState(false);
```

Right after all your `useState` declarations, add this `useEffect`:

```tsx
// Close edit modal on Escape key
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && editModalOpen) {
      setEditModalOpen(false);
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [editModalOpen]);
```

Make sure `useEffect` is imported at the top:
```tsx
import { useState, useEffect } from 'react';
```

---

## Fix 3 — Backdrop Click to Close Modal

Find your modal JSX. It likely looks like:
```tsx
{editModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center ...">
    <div className="bg-white rounded-xl p-6 ...">
      {/* modal content */}
    </div>
  </div>
)}
```

Replace with:
```tsx
{editModalOpen && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    onClick={() => setEditModalOpen(false)}
  >
    <div
      className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* modal content — unchanged */}
    </div>
  </div>
)}
```

**What changed:** Outer `div` gets `onClick={() => setEditModalOpen(false)}`. Inner modal card gets `onClick={(e) => e.stopPropagation()}` so clicking inside doesn't close the modal.

---

## All 3 Fixes Together — Quick Checklist

- [ ] Open `frontend/components/admissions/AdmissionsMarketing.tsx`
- [ ] Line ~591: Update Edit button className (`px-3 py-1.5` → `px-4 py-2 min-w-[64px]`)
- [ ] After useState block: Add `useEffect` with `keydown` → Escape handler
- [ ] Modal outer div: Add `onClick={() => setEditModalOpen(false)}`
- [ ] Modal inner div: Add `onClick={(e) => e.stopPropagation()}`
- [ ] Top import: Ensure `useEffect` is in the React import

---

## Bonus UX Improvements (same file, same button group)

While you're there, also update the Delete/Cancel button to make the intent clearer:

```tsx
{/* If campaign is scheduled/draft, show Cancel Campaign instead of ambiguous "Cancel" */}
<button
  onClick={() => setCampaigns(prev => prev.filter(x => x.id !== campaign.id))}
  className="border border-red-200 rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-50 text-red-600 transition-colors min-w-[64px]"
>
  Cancel
</button>
```

The red color signals destructive action clearly — right now it looks the same as Edit which causes confusion.
