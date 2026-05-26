"use client";
/**
 * HR Directory — Staff by department accordion groups, profile drawer, filter bar.
 */
import { useCallback, useRef, useState } from "react";
import {
  Search, Filter, Plus, Edit2, Trash2, Eye, UserCheck, UserX,
  Phone, Mail, Calendar, ChevronDown, ChevronRight, User,
} from "lucide-react";
import {
  HrButton, HrBadge, HrKpiCard, HrModal, HrDrawer, HrHero,
  HrField, HrInput, HrSelect, HrSkeleton, HrConfirmDialog,
  statusToBadge, useHrToast,
} from "@/components/hr/HrUi";
import { useStaff, useDepartments, updateStaffStatus } from "@/hooks/useHrApi";
import type { Staff } from "@/types/hr";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const avatarColor = (name: string) => {
  const colors = ["#6D4AFF", "#2563EB", "#22C55E", "#F59E0B", "#E0463A", "#06B6D4"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % colors.length;
  return colors[h];
};
const initials = (name: string) =>
  name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

const getDisplayName = (staff: Staff | null | undefined): string => {
  if (!staff) return "Staff";
  return staff.full_name ?? ([staff.first_name, staff.last_name].filter(Boolean).join(" ") || "Staff");
};

const getPhone = (staff: Staff | null | undefined): string => {
  if (!staff) return "—";
  return staff.phone_number ?? staff.mobile ?? "—";
};

// ─── Staff Avatar ─────────────────────────────────────────────────────────────
function StaffAvatar({ staff }: { staff: Staff }) {
  const name = getDisplayName(staff);
  const bg = avatarColor(name);
  return (
    <div
      className="w-[36px] h-[36px] rounded-full flex items-center justify-center text-white font-[900] text-[13px] shrink-0"
      style={{ background: bg }}
    >
      {initials(name)}
    </div>
  );
}

// ─── Context Menu ─────────────────────────────────────────────────────────────
function ContextMenu({
  staff,
  onView,
  onEdit,
  onToggleStatus,
}: {
  staff: Staff;
  onView: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={ref}>
      <HrButton variant="icon" size="icon" onClick={() => setOpen((p) => !p)}>
        <span className="text-[18px] leading-none">⋮</span>
      </HrButton>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 bg-white border border-[var(--line)] rounded-[10px] py-1 z-10 w-[170px]"
          style={{ boxShadow: "0 8px 24px -4px rgba(15,18,34,0.14)" }}
          onBlur={() => setOpen(false)}
        >
          {[
            { label: "View Profile", icon: <Eye size={13} />, action: onView },
            { label: "Edit", icon: <Edit2 size={13} />, action: onEdit },
            {
              label: staff.status === "active" ? "Deactivate" : "Reactivate",
              icon: staff.status === "active" ? <UserX size={13} /> : <UserCheck size={13} />,
              action: onToggleStatus,
            },
          ].map(({ label, icon, action }) => (
            <button
              key={label}
              onClick={() => { action(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-[8px] text-[13px] text-left hover:bg-[var(--soft)] transition-colors"
            >
              <span className="text-[var(--muted)]">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Staff Profile Drawer ─────────────────────────────────────────────────────
function ProfileDrawer({ staff, onClose }: { staff: Staff | null; onClose: () => void }) {
  if (!staff) return null;
  return (
    <HrDrawer isOpen={!!staff} onClose={onClose} title="Staff Profile">
      <div className="flex flex-col gap-6">
        {/* Avatar + Name */}
        <div className="flex items-center gap-4">
          <div
            className="w-[64px] h-[64px] rounded-full flex items-center justify-center text-white text-[22px] font-[900]"
            style={{ background: avatarColor(getDisplayName(staff)) }}
          >
            {initials(getDisplayName(staff))}
          </div>
          <div>
            <div className="text-[18px] font-[800]">{getDisplayName(staff)}</div>
            <div className="text-[var(--muted)] text-[13px] mt-[2px]">{staff.designation_name}</div>
            <HrBadge variant={staff.status === "active" ? "green" : "grey"} className="mt-1">
              {staff.status}
            </HrBadge>
          </div>
        </div>

        {/* Contact */}
        <div className="grid gap-2">
          <div className="text-[11px] font-[700] text-[var(--muted)] uppercase tracking-[0.08em]">Contact</div>
          {[
            { icon: <Phone size={14} />, text: getPhone(staff) },
            { icon: <Mail size={14} />, text: staff.email ?? staff.official_email ?? staff.personal_email ?? "—" },
            { icon: <Calendar size={14} />, text: staff.joining_date ? `Joined ${staff.joining_date}` : "—" },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-[13px]">
              <span className="text-[var(--brand)]">{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* Role */}
        <div className="grid gap-2">
          <div className="text-[11px] font-[700] text-[var(--muted)] uppercase tracking-[0.08em]">Role & Dept</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Department", staff.department_name],
              ["Designation", staff.designation_name],
              ["Employment", staff.employment_type ?? "—"],
              ["Staff ID", staff.staff_id ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="bg-[#fafafa] rounded-[8px] p-2">
                <div className="text-[10px] text-[var(--muted)] uppercase">{k}</div>
                <div className="text-[13px] font-[700] mt-[1px]">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </HrDrawer>
  );
}

// ─── Department Accordion Row ─────────────────────────────────────────────────
function DeptAccordion({
  deptName,
  members,
  onView,
  onEdit,
  onToggleStatus,
}: {
  deptName: string;
  members: Staff[];
  onView: (s: Staff) => void;
  onEdit: (s: Staff) => void;
  onToggleStatus: (s: Staff) => void;
}) {
  const [open, setOpen] = useState(true);
  const active = members.filter((s) => s.status === "active").length;

  return (
    <div className="border border-[var(--line)] rounded-[12px] overflow-hidden mb-3">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 p-[12px_16px] text-left"
        style={{ background: open ? "#f8f6ff" : "#fafafa", borderLeft: "4px solid var(--strong)" }}
      >
        <span className="flex-1 font-[850] text-[14px]">{deptName}</span>
        <HrBadge variant="purple">{members.length} staff</HrBadge>
        <HrBadge variant="green">{active} active</HrBadge>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {open && (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#fafafa] text-[#64748b] text-[11px] uppercase tracking-[0.08em]">
              <th className="px-3 py-[10px] text-left">Staff</th>
              <th className="px-3 py-[10px] text-left">Designation</th>
              <th className="px-3 py-[10px] text-left">Phone</th>
              <th className="px-3 py-[10px] text-left">Joining Date</th>
              <th className="px-3 py-[10px] text-left">Status</th>
              <th className="px-3 py-[10px] text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((s) => (
              <tr key={s.id} className="border-t border-[#f4f4f8] hover:bg-[#fafafd] transition-colors">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <StaffAvatar staff={s} />
                    <div>
                      <div className="font-[750] text-[13px]">{getDisplayName(s)}</div>
                      <div className="text-[11px] text-[var(--muted)]">{s.staff_id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-[13px]">{s.designation_name}</td>
                <td className="px-3 py-3 text-[13px]">{getPhone(s)}</td>
                <td className="px-3 py-3 text-[12px] text-[var(--muted)]">{s.joining_date || "—"}</td>
                <td className="px-3 py-3">
                  <HrBadge variant={statusToBadge(s.status)}>{s.status}</HrBadge>
                </td>
                <td className="px-3 py-3">
                  <ContextMenu
                    staff={s}
                    onView={() => onView(s)}
                    onEdit={() => onEdit(s)}
                    onToggleStatus={() => onToggleStatus(s)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Main Directory Page ──────────────────────────────────────────────────────
export default function HrDirectoryPage() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data, loading, refetch } = useStaff({ search, department: deptFilter, status: statusFilter });
  const { data: deptData } = useDepartments();
  const { toast } = useHrToast();

  const [viewingStaff, setViewingStaff] = useState<Staff | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Staff | null>(null);
  const [toggling, setToggling] = useState(false);

  const staff = data?.results ?? [];
  const departments = deptData?.results ?? [];

  // Group staff by department
  const byDept = staff.reduce<Record<string, Staff[]>>((acc, s) => {
    const d = s.department_name || "Unassigned";
    (acc[d] = acc[d] || []).push(s);
    return acc;
  }, {});

  const handleToggleStatus = async () => {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      const newStatus = toggleTarget.status === "active" ? "inactive" : "active";
      await updateStaffStatus(toggleTarget.id, newStatus);
      toast(`Staff ${newStatus === "active" ? "reactivated" : "deactivated"}`);
      void refetch();
    } catch { toast("Failed to update status", "error"); }
    finally { setToggling(false); setToggleTarget(null); }
  };

  const activeCount = staff.filter((s) => s.status === "active").length;
  const inactiveCount = staff.filter((s) => s.status === "inactive").length;

  return (
    <div>
      <HrHero
        eyebrow="HR Module"
        title="Staff"
        accent="Directory"
        sub={`${data?.count ?? "—"} staff members across ${departments.length} departments.`}
        actions={
          <HrButton variant="primary" onClick={() => { window.location.href = "/hr/onboard"; }}>
            <Plus size={14} /> Onboard Staff
          </HrButton>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <HrKpiCard label="Total Staff" value={data?.count ?? "—"} />
        <HrKpiCard label="Active" value={activeCount} color="var(--green)" />
        <HrKpiCard label="Inactive" value={inactiveCount} color="var(--amber)" />
        <HrKpiCard label="Departments" value={departments.length} />
      </div>

      {/* Filter bar */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff name or ID…"
            className="w-full pl-9 pr-3 py-[9px] border border-[var(--line)] rounded-[8px] text-[13px] outline-none focus:border-[var(--brand)]"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="border border-[var(--line)] rounded-[8px] px-3 py-[9px] text-[13px] outline-none focus:border-[var(--brand)]"
        >
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-[var(--line)] rounded-[8px] px-3 py-[9px] text-[13px] outline-none focus:border-[var(--brand)]"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Department accordion groups */}
      {loading ? (
        <HrSkeleton rows={6} />
      ) : staff.length === 0 ? (
        <div
          className="bg-white border border-[var(--line)] rounded-[14px] py-16 text-center text-[var(--muted)]"
        >
          No staff found. <button className="text-[var(--brand)] font-[700]" onClick={() => { window.location.href = "/hr/onboard"; }}>Onboard your first staff member.</button>
        </div>
      ) : (
        Object.entries(byDept).map(([deptName, members]) => (
          <DeptAccordion
            key={deptName}
            deptName={deptName}
            members={members}
            onView={setViewingStaff}
            onEdit={setEditingStaff}
            onToggleStatus={setToggleTarget}
          />
        ))
      )}

      {/* Profile Drawer */}
      <ProfileDrawer staff={viewingStaff} onClose={() => setViewingStaff(null)} />

      {/* Deactivation Confirm */}
      <HrConfirmDialog
        isOpen={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={() => void handleToggleStatus()}
        title={toggleTarget?.status === "active" ? "Deactivate Staff" : "Reactivate Staff"}
        message={
          toggleTarget?.status === "active"
            ? `This will deactivate ${getDisplayName(toggleTarget)}. They will lose system access.`
            : `Reactivate ${getDisplayName(toggleTarget)} and restore their system access?`
        }
        confirmLabel={toggleTarget?.status === "active" ? "Deactivate" : "Reactivate"}
        danger={toggleTarget?.status === "active"}
        loading={toggling}
      />
    </div>
  );
}
