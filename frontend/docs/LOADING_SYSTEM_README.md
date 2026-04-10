# Global Loading Indicator System

A production-ready loading state management system for all action buttons in your school ERP system.

## 🎯 Features

✅ **Button-Level Loading**
- Show spinner inside button
- Dynamic text updates (Save → Saving...)
- Auto-disable during request
- Prevent double-click submissions

✅ **Page-Level Loading**
- Optional overlay for heavy operations
- Disable form interaction
- Custom loading messages

✅ **Error & Success Handling**
- Automatic error capture
- Display custom messages
- Re-enable buttons on failure

✅ **Multiple Actions**
- Manage multiple buttons simultaneously
- No conflicts between actions
- Independent loading states

✅ **Smart Prevention**
- No duplicate submissions
- Throttle rapid clicks
- Handle network delays gracefully

## 📦 Components & Hooks

### Components

**Spinner** (`@/components/common/Spinner`)
```tsx
<Spinner size={16} color="var(--primary)" />
```
- Inline loading spinner
- Customizable size and color

**PageLoader** (`@/components/common/PageLoader`)
```tsx
<PageLoader isOpen={isLoading} message="Loading..." />
```
- Full-page overlay
- Prevents background interaction

**ActionButton** (`@/components/common/ActionButton`)
```tsx
<ActionButton
  label="Save"
  loadingLabel="Saving"
  isLoading={isLoading}
  onClick={handleSave}
  variant="primary"
/>
```
- Production-ready button
- Built-in loading state
- Support for variants: `primary`, `danger`, `success`, `secondary`

### Hooks

**useActionLoader** (`@/hooks/useActionLoader`)
```tsx
const { isLoading, execute, setIsLoading } = useActionLoader();

await execute(async () => {
  await apiPost("/api/save", data);
});
```
- Single action loading state
- Prevents duplicate execution
- Auto cleanup

**usePageLoader** (`@/hooks/useActionLoader`)
```tsx
const { isLoading, execute, message } = usePageLoader();

await execute(async () => {
  // Heavy operation
}, "Importing data...");
```
- Page-level overlay
- Custom messages
- Long-running operations

**useFormLoader** (`@/hooks/useFormLoader`)
```tsx
const form = useFormLoader();

// Check specific action states
form.isSaving;      // Is save action running?
form.isDeleting;    // Is delete action running?
form.isSearching;   // Is search action running?

// Execute action with auto-loading
await form.execute("save", async () => {
  await apiPost("/api/save", data);
});

// Handle messages
form.error;         // Error message
form.success;       // Success message
form.setError("msg");
form.setSuccessMessage("msg");
```
- Multiple action support
- Form-level state management
- Built-in error/success handling

## 🚀 Usage Examples

### Example 1: Simple Save Button
```tsx
import { ActionButton } from "@/components/common/ActionButton";
import { useActionLoader } from "@/hooks/useActionLoader";

export function SaveForm() {
  const { isLoading, execute } = useActionLoader();

  const handleSave = async () => {
    await execute(async () => {
      await apiPost("/api/save", formData);
    });
  };

  return (
    <ActionButton
      label="Save"
      loadingLabel="Saving"
      isLoading={isLoading}
      onClick={handleSave}
      variant="primary"
    />
  );
}
```

### Example 2: Form with Multiple Buttons
```tsx
import { useFormLoader } from "@/hooks/useFormLoader";
import { ActionButton } from "@/components/common/ActionButton";

export function CompleteForm() {
  const form = useFormLoader();

  return (
    <div>
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

### Example 3: Table Actions
```tsx
{rows.map((row) => (
  <tr key={row.id}>
    <td>{row.name}</td>
    <td>
      <ActionButton
        label="Edit"
        isLoading={false}
        onClick={() => handleEdit(row.id)}
        variant="primary"
      />
      <ActionButton
        label="Delete"
        loadingLabel="Deleting"
        isLoading={form.isDeleting}
        onClick={() => form.execute("delete", () => handleDelete(row.id))}
        variant="danger"
      />
    </td>
  </tr>
))}
```

### Example 4: Page-Level Loading (Import)
```tsx
import { usePageLoader } from "@/hooks/useActionLoader";
import { PageLoader } from "@/components/common/PageLoader";

export function ImportStudents() {
  const { isLoading, execute, message } = usePageLoader();

  const handleImport = async () => {
    await execute(async () => {
      await apiPost("/api/import", { file });
    }, "Importing students... This may take a moment");
  };

  return (
    <>
      <PageLoader isOpen={isLoading} message={message} />
      <ActionButton
        label="Import"
        loadingLabel="Importing"
        isLoading={isLoading}
        onClick={handleImport}
        variant="primary"
      />
    </>
  );
}
```

## 📋 Utility Functions

Located in `@/utils/actionHelper.ts`

```tsx
// Render button content with spinner
renderButtonContent(isLoading, label, loadingLabel?)

// Get button styles with loading state
getActionButtonStyle(actionName, isLoading, baseStyle)

// Create action handler with error handling
createActionHandler(action, setIsLoading, setError?, setSuccess?)

// Execute API with automatic error handling
executeApiAction(apiCall, onSuccess, onError)

// Validate API response
validateApiResponse(response)

// Debounce action handler
debounceAction(action, delay?)
```

## 🎨 Button Variants

```tsx
<ActionButton variant="primary" ... />     // Blue
<ActionButton variant="danger" ... />      // Red
<ActionButton variant="success" ... />     // Green
<ActionButton variant="secondary" ... />   // Gray
```

## ✅ Best Practices

1. **Always show loader within 100ms** of click
2. **Prevent UI freezing** - always provide feedback
3. **Use consistent design** across the app
4. **Never allow interaction** while processing
5. **Handle slow APIs gracefully** - show custom messages
6. **Skip loader for < 200ms operations** (optional)
7. **Always provide success/error feedback**
8. **Auto-clear messages** after 5-10 seconds (optional)
9. **Use appropriate button variants** for context
10. **Test with network throttling** to ensure UX

## 🔄 Migration Guide

### Before (Old Pattern)
```tsx
const [loading, setLoading] = useState(false);

const handleSave = async () => {
  setLoading(true);
  try {
    await api.save(data);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

<button disabled={loading} onClick={handleSave}>
  {loading ? "Saving..." : "Save"}
</button>
```

### After (New Pattern)
```tsx
const { isLoading, execute } = useActionLoader();

const handleSave = async () => {
  await execute(async () => {
    await api.save(data);
  });
};

<ActionButton
  label="Save"
  loadingLabel="Saving"
  isLoading={isLoading}
  onClick={handleSave}
/>
```

## 📝 Implementation Checklist

- [x] Spinner component with animation
- [x] PageLoader overlay component
- [x] ActionButton with loading support
- [x] useActionLoader hook
- [x] usePageLoader hook
- [x] useFormLoader hook (multiple actions)
- [x] Action helper utilities
- [x] Example: ExamTypePanel updated
- [x] Documentation and examples
- [ ] Update remaining components (Student Attendance, etc.)

## 🎓 Example Components Using System

1. **ExamTypePanel** - Demonstrates save/update/delete with ActionButton
2. **StudentAttendanceCreatePanel** - Ready to integrate
3. **All form components** - Can use useFormLoader
4. **All import/bulk operations** - Can use usePageLoader

## 📞 Support

For questions or issues, refer to:
- `/docs/LOADING_SYSTEM.tsx` - Comprehensive examples
- Component source files - Inline documentation
- Hook implementations - Detailed comments

---

**Status**: ✅ Production-Ready
**Version**: 1.0.0
**Last Updated**: April 6, 2026
