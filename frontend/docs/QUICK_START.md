# Quick Start Guide - Global Loading System

Get up and running with the loading indicator system in 5 minutes!

---

## ⚡ Installation (Already Done!)

All components and hooks are already in place:

```
✅ Spinner.tsx
✅ PageLoader.tsx  
✅ ActionButton.tsx
✅ useActionLoader.ts
✅ useFormLoader.ts
✅ usePageLoader.ts
✅ actionHelper.ts
```

---

## 🚀 5-Minute Quick Start

### Step 1: Import the Hook (Choose One)

**Option A: Single Action**
```tsx
import { useActionLoader } from "@/hooks/useActionLoader";

const { isLoading, execute } = useActionLoader();
```

**Option B: Multiple Actions (Form)**
```tsx
import { useFormLoader } from "@/hooks/useFormLoader";

const form = useFormLoader();
```

**Option C: Page-Level Loading**
```tsx
import { usePageLoader } from "@/hooks/useActionLoader";

const { isLoading, execute, message } = usePageLoader();
```

---

### Step 2: Replace Your Button

**Before**:
```tsx
const [loading, setLoading] = useState(false);

<button disabled={loading} onClick={async () => {
  setLoading(true);
  try {
    await saveData();
  } finally {
    setLoading(false);
  }
}}>
  {loading ? "Saving..." : "Save"}
</button>
```

**After**:
```tsx
import { ActionButton } from "@/components/common/ActionButton";
import { useFormLoader } from "@/hooks/useFormLoader";

const form = useFormLoader();

<ActionButton
  label="Save"
  loadingLabel="Saving"
  isLoading={form.isSaving}
  onClick={() => form.execute("save", saveData)}
  variant="primary"
/>
```

---

### Step 3: Add Error/Success Messages

```tsx
{form.error && (
  <p style={{ color: "#dc2626" }}>{form.error}</p>
)}
{form.success && (
  <p style={{ color: "#059669" }}>{form.success}</p>
)}
```

---

## 💻 Complete Example

```tsx
import { ActionButton } from "@/components/common/ActionButton";
import { useFormLoader } from "@/hooks/useFormLoader";

export function MyForm() {
  const form = useFormLoader();
  const [data, setData] = useState("");

  const handleSave = async () => {
    const response = await fetch("/api/save", {
      method: "POST",
      body: JSON.stringify({ data }),
    });
    if (!response.ok) throw new Error("Save failed");
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure?")) return;
    const response = await fetch("/api/delete", { method: "DELETE" });
    if (!response.ok) throw new Error("Delete failed");
  };

  return (
    <div>
      <input
        value={data}
        onChange={(e) => setData(e.target.value)}
        placeholder="Enter data"
      />

      <ActionButton
        label="Save"
        loadingLabel="Saving"
        isLoading={form.isSaving}
        onClick={() => form.execute("save", handleSave)}
        variant="primary"
      />

      <ActionButton
        label="Delete"
        loadingLabel="Deleting"
        isLoading={form.isDeleting}
        onClick={() => form.execute("delete", handleDelete)}
        variant="danger"
      />

      {form.error && <p style={{ color: "#dc2626" }}>{form.error}</p>}
      {form.success && <p style={{ color: "#059669" }}>{form.success}</p>}
    </div>
  );
}
```

---

## 🎯 Common Use Cases

### 1. Search Button
```tsx
<ActionButton
  label="Search"
  loadingLabel="Searching"
  isLoading={form.isSearching}
  onClick={() => form.execute("search", handleSearch)}
/>
```

### 2. Delete Button
```tsx
<ActionButton
  label="Delete"
  loadingLabel="Deleting"
  isLoading={form.isDeleting}
  onClick={() => form.execute("delete", handleDelete)}
  variant="danger"
/>
```

### 3. Update Button
```tsx
<ActionButton
  label="Update"
  loadingLabel="Updating"
  isLoading={form.isUpdating}
  onClick={() => form.execute("update", handleUpdate)}
/>
```

### 4. Import Button (with Page Loader)
```tsx
const { isLoading, execute, message } = usePageLoader();

<>
  <PageLoader isOpen={isLoading} message={message} />
  <ActionButton
    label="Import"
    loadingLabel="Importing"
    isLoading={isLoading}
    onClick={() => execute(
      async () => {
        await importFile();
      },
      "Importing students... This may take a moment"
    )}
  />
</>
```

---

## 🎨 Button Variants

```tsx
<ActionButton variant="primary"... />    // Blue (default)
<ActionButton variant="danger"... />     // Red (delete)
<ActionButton variant="success"... />    // Green (confirm)
<ActionButton variant="secondary"... />  // Gray (cancel)
```

---

## 📊 Form Hook Methods & Properties

```tsx
const form = useFormLoader();

// Check specific loading states
form.isSaving        // true/false
form.isDeleting      // true/false
form.isSearching     // true/false
form.isImporting     // true/false
form.isUpdating      // true/false
form.isAnyLoading    // true if any action is loading

// Execute actions with auto-loading
await form.execute("save", handleSave);
await form.execute("delete", handleDelete);

// Error/Success messages
form.error           // Error message string
form.success         // Success message string
form.setError("msg");
form.setSuccessMessage("msg");
form.clearMessages();

// Check if specific action is loading
form.isLoading("save");
form.isLoading("custom_action");
```

---

## 🔄 Async/Await Pattern

All methods work with async/await:

```tsx
// ✅ Correct
await form.execute("save", async () => {
  await apiPost("/api/save", data);
  form.setSuccessMessage("Saved!");
});

// ✅ Also works
form.execute("save", async () => {
  await apiPost("/api/save", data);
});

// ✅ With error handling
await form.execute("save", async () => {
  try {
    await apiPost("/api/save", data);
  } catch (err) {
    throw new Error("Custom error message");
  }
});
```

---

## ❌ Common Mistakes

### ❌ Don't: Forget to await
```tsx
// WRONG
form.execute("save", handleSave);

// RIGHT
await form.execute("save", handleSave);
```

### ❌ Don't: Mix with manual state
```tsx
// WRONG
const [loading, setLoading] = useState(false);
const form = useFormLoader();

// RIGHT - just use form
const form = useFormLoader();
```

### ❌ Don't: Call execute without action
```tsx
// WRONG
form.execute("save");

// RIGHT
await form.execute("save", async () => {
  await apiCall();
});
```

---

## 📚 Help & Documentation

- 📖 **Full Docs**: See `docs/LOADING_SYSTEM_README.md`
- 💡 **Examples**: See `docs/LOADING_SYSTEM.tsx`
- 🔍 **Implementation**: See `docs/IMPLEMENTATION_SUMMARY.md`
- 📝 **Example Component**: See `components/exams/ExamTypePanel.tsx`

---

## ✅ Verify It Works

1. Open `components/exams/ExamTypePanel.tsx`
2. See how it uses `ActionButton` and `useFormLoader`
3. Run your app locally
4. Click Save/Delete buttons
5. See loading spinner appear
6. Done! 🎉

---

## 🎓 Next Steps

1. **Update your components** - Replace old buttons with ActionButton
2. **Use useFormLoader** for forms with multiple buttons
3. **Use PageLoader** for long operations like import
4. **Check for errors** - TypeScript will help catch issues
5. **Test thoroughly** - Try network throttling in DevTools

---

## 💬 Tips & Tricks

### Tip 1: Auto-reset Form
```tsx
await form.execute("save", async () => {
  await apiPost("/api/save", data);
  setData(defaultValues);  // Reset form
  form.setSuccessMessage("Saved and form reset!");
});
```

### Tip 2: Conditional Buttons
```tsx
<ActionButton
  disabled={!data.trim()}  // Disable if empty
  ...
/>
```

### Tip 3: Confirmation Dialogs
```tsx
const handleDelete = async () => {
  if (!window.confirm("Delete this item?")) return;
  await apiDelete("/api/item");
};

<ActionButton
  onClick={() => form.execute("delete", handleDelete)}
  ...
/>
```

### Tip 4: Multiple Independent Actions
```tsx
const [table1] = useFormLoader();
const [table2] = useFormLoader();

// Delete from table 1 doesn't affect table 2's loading state
table1.isDeleting;  // true
table2.isDeleting;  // false (independent)
```

---

## 📋 Checklist for New Component

- [ ] Import ActionButton and useFormLoader
- [ ] Replace old button code
- [ ] Add isLoading prop to ActionButton
- [ ] Add onClick handler with form.execute()
- [ ] Display form.error message
- [ ] Display form.success message
- [ ] Test with network throttling
- [ ] Verify no duplicate submissions

---

## 🚀 Ready to Deploy!

**Status**: ✅ Production Ready

**Time to integrate a form**: ~5 minutes

**Benefits**:
- ✅ Less code to write
- ✅ Consistent UX
- ✅ No duplicates
- ✅ Better error handling
- ✅ Professional appearance

---

**Happy coding!** 🎉

Questions? Check the full documentation in `docs/LOADING_SYSTEM_README.md`
