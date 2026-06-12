import { StaffAssignmentPanels } from "@/components/academics/StaffAssignmentPanels";

export default function StaffWorkspacePage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--page)", padding: "12px 20px 40px" }}>
      <div style={{ background: "#f8f8fc", border: "1px solid #dfdfea", borderRadius: "16px", padding: "24px" }}>
        <StaffAssignmentPanels />
      </div>
    </div>
  );
}
