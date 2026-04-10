/**
 * COMPREHENSIVE LOADING INDICATOR SYSTEM DOCUMENTATION
 * 
 * This system provides production-ready loading state management for all action buttons
 * in your school ERP system.
 */

// =============================================================================
// 1. BASIC USAGE - Single Button with Loading
// =============================================================================

/*
import { useState } from "react";
import { ActionButton } from "@/components/common/ActionButton";
import { useActionLoader } from "@/hooks/useActionLoader";

export function SaveFormExample() {
  const [data, setData] = useState("");
  const { isLoading, execute } = useActionLoader();

  const handleSave = async () => {
    await execute(async () => {
      const response = await fetch("/api/save", {
        method: "POST",
        body: JSON.stringify({ data }),
      });
      if (!response.ok) throw new Error("Save failed");
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
*/

// =============================================================================
// 2. MULTIPLE BUTTONS - Form with Save, Delete, Update
// =============================================================================

/*
import { useFormLoader } from "@/hooks/useFormLoader";
import { ActionButton } from "@/components/common/ActionButton";

export function FormWithMultipleActions() {
  const form = useFormLoader();

  const handleSave = async () => {
    // Validation
    if (!form.error) {
      await fetch("/api/save", { method: "POST" });
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure?")) {
      await fetch("/api/delete", { method: "DELETE" });
    }
  };

  return (
    <div>
      <ActionButton
        label="Save"
        loadingLabel="Saving"
        isLoading={form.isSaving}
        onClick={() => form.execute("save", handleSave)}
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
*/

// =============================================================================
// 3. PAGE-LEVEL LOADING - For Heavy Operations (Import, Bulk Upload)
// =============================================================================

/*
import { usePageLoader } from "@/hooks/useActionLoader";
import { PageLoader } from "@/components/common/PageLoader";
import { ActionButton } from "@/components/common/ActionButton";

export function ImportDataExample() {
  const { isLoading, execute, message } = usePageLoader();
  const [file, setFile] = useState<File | null>(null);

  const handleImport = async () => {
    const formData = new FormData();
    if (file) formData.append("file", file);

    await execute(async () => {
      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Import failed");
    }, "Importing data... This may take a moment");
  };

  return (
    <>
      <PageLoader isOpen={isLoading} message={message} />
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <ActionButton
        label="Import"
        loadingLabel="Importing"
        isLoading={isLoading}
        onClick={handleImport}
      />
    </>
  );
}
*/

// =============================================================================
// 4. TABLE ACTIONS - Edit, Delete, View with Loading Per Button
// =============================================================================

/*
import { useFormLoader } from "@/hooks/useFormLoader";
import { ActionButton } from "@/components/common/ActionButton";

export function TableWithActions({ items }: { items: any[] }) {
  const form = useFormLoader();

  const handleEdit = async (id: number) => {
    await form.execute("edit", async () => {
      const response = await fetch(`/api/item/${id}/edit`);
      if (!response.ok) throw new Error("Edit failed");
    });
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Delete this item?")) {
      await form.execute("delete", async () => {
        const response = await fetch(`/api/item/${id}/delete`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Delete failed");
      });
    }
  };

  return (
    <table>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>{item.name}</td>
            <td>
              <ActionButton
                label="Edit"
                isLoading={form.isLoading("edit")}
                onClick={() => handleEdit(item.id)}
                variant="primary"
              />
              <ActionButton
                label="Delete"
                loadingLabel="Deleting"
                isLoading={form.isDeleting}
                onClick={() => handleDelete(item.id)}
                variant="danger"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
*/

// =============================================================================
// 5. ADVANCED: CUSTOM HOOK PATTERN FOR SPECIFIC OPERATIONS
// =============================================================================

/*
export function useStudentSearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);

  const search = async (query: string) => {
    if (isLoading) return; // Prevent duplicate requests

    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/students/search?q=${query}`);
      if (!response.ok) throw new Error("Search failed");
      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, error, results, search };
}

export function StudentSearchComponent() {
  const { isLoading, error, results, search } = useStudentSearch();

  return (
    <div>
      <ActionButton
        label="Search"
        loadingLabel="Searching"
        isLoading={isLoading}
        onClick={() => search("query")}
      />
      {error && <p>{error}</p>}
      {results.map((r) => <div key={r.id}>{r.name}</div>)}
    </div>
  );
}
*/

// =============================================================================
// KEY FEATURES
// =============================================================================

/*
✅ Features:

1. BUTTON-LEVEL LOADING:
   - Show spinner inside button
   - Update text dynamically (Save → Saving...)
   - Disable button during request
   - Prevent double-click submission

2. PAGE-LEVEL LOADING:
   - Optional overlay for heavy operations
   - Disable form interaction
   - Show custom loading message

3. ERROR HANDLING:
   - Automatic error capture
   - Display error messages
   - Re-enable button on failure

4. SUCCESS FEEDBACK:
   - Success message display
   - Auto-clear messages
   - Form reset options

5. MULTIPLE ACTIONS:
   - Manage multiple buttons simultaneously
   - No conflicts between actions
   - Independent loading states

6. AUTOMATIC PREVENTION:
   - No duplicate submissions
   - Prevents rapid consecutive clicks
   - Handles network delays gracefully

7. FLEXIBLE STATUS LABELS:
   - "Saving..."
   - "Updating..."
   - "Deleting..."
   - "Searching..."
   - "Importing..."
   - "Loading..."
   - Custom labels
*/

// =============================================================================
// COMPONENTS AVAILABLE
// =============================================================================

/*
1. 🔄 Spinner Component
   Location: @/components/common/Spinner
   - Inline spinner with customizable size/color
   - Auto-injects spin animation CSS

2. 📄 PageLoader Component
   Location: @/components/common/PageLoader
   - Full-page overlay loader
   - Custom loading message
   - Prevents background interaction

3. 🖱️ ActionButton Component
   Location: @/components/common/ActionButton
   - Production-ready button with built-in loading
   - Support for variants (primary, danger, success, secondary)
   - Automatic disable during loading

4. 🎣 useActionLoader Hook
   Location: @/hooks/useActionLoader
   - Single action loading state
   - Prevents duplicate execution
   - Manual setIsLoading control

5. 🎣 usePageLoader Hook
   Location: @/hooks/useActionLoader
   - Page-level overlay loading
   - Custom message support

6. 🎣 useFormLoader Hook
   Location: @/hooks/useFormLoader
   - Multiple action support
   - Form-level state management
   - Built-in error/success handling
*/

// =============================================================================
// BEST PRACTICES
// =============================================================================

/*
1. ✅ Always show loader within 100ms of click
2. ✅ Prevent UI freezing without feedback
3. ✅ Use consistent loader design across app
4. ✅ Never allow interaction while processing
5. ✅ Handle slow APIs gracefully
6. ✅ Don't show loader for < 200ms operations
7. ✅ Always provide success/error feedback
8. ✅ Clear messages after 5-10 seconds (optional)
9. ✅ Use appropriate button variants
10. ✅ Test with network throttling
*/

// =============================================================================
// COMMON PATTERNS
// =============================================================================

/*
PATTERN 1: Simple Save Button
------
const { isLoading, execute } = useActionLoader();

<ActionButton
  label="Save"
  loadingLabel="Saving"
  isLoading={isLoading}
  onClick={() => execute(async () => {
    await apiPost("/api/save", data);
  })}
/>

PATTERN 2: Form with Multiple Buttons
------
const form = useFormLoader();

<div>
  <ActionButton
    label="Save"
    isLoading={form.isSaving}
    onClick={() => form.execute("save", handleSave)}
  />
  <ActionButton
    label="Delete"
    isLoading={form.isDeleting}
    onClick={() => form.execute("delete", handleDelete)}
    variant="danger"
  />
  {form.error && <ErrorMessage>{form.error}</ErrorMessage>}
  {form.success && <SuccessMessage>{form.success}</SuccessMessage>}
</div>

PATTERN 3: Table Actions
------
{rows.map((row) => (
  <ActionButton
    label="Delete"
    loadingLabel="Deleting"
    isLoading={form.isDeleting}
    onClick={() => form.execute("delete", () => handleDelete(row.id))}
    variant="danger"
  />
))}

PATTERN 4: Heavy Operations (Import)
------
const { isLoading, execute, message } = usePageLoader();

<>
  <PageLoader isOpen={isLoading} message={message} />
  <ActionButton
    label="Import"
    loadingLabel="Importing"
    isLoading={isLoading}
    onClick={() => execute(
      () => handleImport(),
      "Importing attendances... Please wait"
    )}
  />
</>
*/

// =============================================================================
// MIGRATION GUIDE - FROM OLD BUTTONS TO NEW SYSTEM
// =============================================================================

/*
BEFORE:
------
const [loading, setLoading] = useState(false);

const handleSave = async () => {
  setLoading(true);
  try {
    await apiPost("/api/save", data);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

<button 
  disabled={loading}
  onClick={handleSave}
>
  {loading ? "Saving..." : "Save"}
</button>


AFTER:
------
const { isLoading, execute } = useActionLoader();

const handleSave = async () => {
  await execute(async () => {
    await apiPost("/api/save", data);
  });
};

<ActionButton
  label="Save"
  loadingLabel="Saving"
  isLoading={isLoading}
  onClick={handleSave}
/>
*/

export function LoadingSystemDocumentation() {
  return (
    <div style={{ padding: 20, background: "#f5f5f5", borderRadius: 8 }}>
      <h2>Loading System Documentation</h2>
      <p>See code comments above for comprehensive examples and patterns.</p>
    </div>
  );
}
