"use client";

type PaginationControlsProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  loading = false,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  const safeCurrent = Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1;
  const safeTotalPages = Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1;
  const from = totalItems === 0 ? 0 : (safeCurrent - 1) * pageSize + 1;
  const to = totalItems === 0 ? 0 : Math.min(safeCurrent * pageSize, totalItems);

  return (
    <div
      style={{
        marginTop: 12,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
        Showing {from}-{to} of {totalItems}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <label style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Rows:
          <select
            value={pageSize}
            disabled={loading}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            style={{
              marginLeft: 6,
              padding: "4px 6px",
              border: "1px solid var(--line)",
              borderRadius: 6,
              background: "var(--surface)",
              color: "var(--text)",
            }}
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled={loading || safeCurrent <= 1}
          onClick={() => onPageChange(1)}
          style={{
            padding: "6px 10px",
            border: "1px solid var(--line)",
            borderRadius: 6,
            background: "var(--surface)",
            color: "var(--text)",
            cursor: loading || safeCurrent <= 1 ? "not-allowed" : "pointer",
          }}
        >
          First
        </button>

        <button
          type="button"
          disabled={loading || safeCurrent <= 1}
          onClick={() => onPageChange(safeCurrent - 1)}
          style={{
            padding: "6px 10px",
            border: "1px solid var(--line)",
            borderRadius: 6,
            background: "var(--surface)",
            color: "var(--text)",
            cursor: loading || safeCurrent <= 1 ? "not-allowed" : "pointer",
          }}
        >
          Prev
        </button>

        <span style={{ minWidth: 80, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          Page {safeCurrent} / {safeTotalPages}
        </span>

        <button
          type="button"
          disabled={loading || safeCurrent >= safeTotalPages}
          onClick={() => onPageChange(safeCurrent + 1)}
          style={{
            padding: "6px 10px",
            border: "1px solid var(--line)",
            borderRadius: 6,
            background: "var(--surface)",
            color: "var(--text)",
            cursor: loading || safeCurrent >= safeTotalPages ? "not-allowed" : "pointer",
          }}
        >
          Next
        </button>

        <button
          type="button"
          disabled={loading || safeCurrent >= safeTotalPages}
          onClick={() => onPageChange(safeTotalPages)}
          style={{
            padding: "6px 10px",
            border: "1px solid var(--line)",
            borderRadius: 6,
            background: "var(--surface)",
            color: "var(--text)",
            cursor: loading || safeCurrent >= safeTotalPages ? "not-allowed" : "pointer",
          }}
        >
          Last
        </button>
      </div>
    </div>
  );
}
