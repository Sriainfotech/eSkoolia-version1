// Reusable spinner component for loading states
export function Spinner({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `2px solid rgba(255, 255, 255, 0.3)`,
        borderTop: `2px solid ${color}`,
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
      }}
    />
  );
}

// Inject keyframe animation if not already present
if (typeof window !== "undefined" && !document.getElementById("spinner-animation")) {
  const style = document.createElement("style");
  style.id = "spinner-animation";
  style.textContent = `
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;
  document.head.appendChild(style);
}
