import { Spinner } from "./Spinner";

export function PageLoader({ isOpen, message = "Loading..." }: { isOpen: boolean; message?: string }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: 32,
          textAlign: "center",
          minWidth: 200,
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <Spinner size={32} color="var(--primary)" />
        </div>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>{message}</p>
      </div>
    </div>
  );
}
