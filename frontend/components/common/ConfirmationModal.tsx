"use client";

type ConfirmationModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loadingLabel?: string;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loadingLabel,
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17, 24, 39, 0.5)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(460px, 100%)",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 10 }}>{title}</h3>
        <p style={{ margin: 0, color: "var(--text-muted)", marginBottom: 16 }}>{message}</p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            style={{
              border: "1px solid var(--line)",
              background: "var(--surface)",
              color: "var(--text)",
              borderRadius: 8,
              height: 36,
              padding: "0 12px",
              cursor: isConfirming ? "not-allowed" : "pointer",
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            style={{
              border: "1px solid #dc2626",
              background: "#dc2626",
              color: "#fff",
              borderRadius: 8,
              height: 36,
              padding: "0 12px",
              cursor: isConfirming ? "not-allowed" : "pointer",
              opacity: isConfirming ? 0.85 : 1,
            }}
          >
            {isConfirming ? (loadingLabel || `${confirmLabel}...`) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
