"use client";
/**
 * HR shared UI components — Modal, Drawer, Toast, Badge, Button, etc.
 * All use CSS variables defined in globals.css.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { X, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// BUTTON
// ─────────────────────────────────────────────────────────────────────────────
type BtnVariant = "primary" | "ghost" | "soft" | "green" | "red" | "icon";
type BtnSize = "default" | "sm" | "icon";

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
}

const variantStyles: Record<BtnVariant, string> = {
  primary:
    "bg-gradient-to-br from-[var(--brand)] to-[#8b5cf6] text-white border-transparent shadow-[0_8px_18px_-8px_rgba(108,60,225,0.55)] hover:shadow-[0_12px_24px_-8px_rgba(108,60,225,0.65)] hover:-translate-y-px",
  ghost: "bg-white text-gray-700 border-[var(--line)] hover:bg-[var(--bg-2)]",
  soft: "bg-[var(--soft)] text-[var(--brand)] border-[#ddd6fe] hover:bg-[#e5dfff]",
  green: "bg-[var(--green)] text-white border-transparent hover:-translate-y-px",
  red: "bg-[#fff1f2] text-[var(--red)] border-[#fecdd3] hover:bg-[#ffe4e6]",
  icon: "bg-white border-[var(--line)] text-gray-500 hover:bg-[var(--soft)] hover:text-[var(--brand)] hover:border-[#ddd6fe]",
};

const sizeStyles: Record<BtnSize, string> = {
  default: "h-[38px] px-[13px] text-[13px]",
  sm: "h-[30px] px-[10px] text-[12px]",
  icon: "h-[32px] w-[32px] p-0 justify-center",
};

export function HrButton({
  variant = "ghost",
  size = "default",
  loading,
  children,
  className = "",
  disabled,
  ...rest
}: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center gap-[7px] font-[750] rounded-[10px] border transition-all duration-150",
        variantStyles[variant],
        sizeStyles[size],
        (disabled || loading) ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        className,
      ].join(" ")}
    >
      {loading ? <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" /> : null}
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BADGE
// ─────────────────────────────────────────────────────────────────────────────
type BadgeVariant = "purple" | "green" | "red" | "amber" | "blue" | "grey" | "archived";

const badgeStyles: Record<BadgeVariant, string> = {
  purple: "bg-[var(--soft)] text-[var(--brand)]",
  green: "bg-[#ecfdf5] text-[#059669]",
  red: "bg-[#fff1f2] text-[var(--red)]",
  amber: "bg-[#fffbeb] text-[var(--amber)]",
  blue: "bg-[#eff6ff] text-[var(--blue)]",
  grey: "bg-[#f1f5f9] text-[#64748b]",
  archived: "bg-[#f1f5f9] text-[#64748b] line-through opacity-75",
};

export function HrBadge({
  variant = "grey",
  children,
  className = "",
}: {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-[8px] py-[3px] text-[11px] font-[850] whitespace-nowrap",
        badgeStyles[variant],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export function statusToBadge(status: string): BadgeVariant {
  switch (status?.toLowerCase()) {
    case "active": return "green";
    case "inactive": return "grey";
    case "probation": return "amber";
    case "terminated":
    case "offboarded": return "red";
    case "archived": return "archived";
    default: return "grey";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI CARD
// ─────────────────────────────────────────────────────────────────────────────
export function HrKpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      className="bg-white border border-[var(--line)] rounded-[14px] p-[14px] min-h-[96px]"
      style={{ boxShadow: "var(--shadow)" }}
    >
      <div className="text-[11px] uppercase tracking-[0.08em] text-[#64748b] font-[850]">{label}</div>
      <div
        className="text-[34px] font-[850] leading-none mt-2"
        style={{ color: color ?? "var(--ink)" }}
      >
        {value}
      </div>
      {sub && <div className="text-[12px] text-[var(--muted)] mt-2">{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────────────────────────────────────
type ModalSize = "sm" | "md" | "lg" | "xl";
const modalWidths: Record<ModalSize, string> = {
  sm: "min(480px,96vw)",
  md: "min(600px,96vw)",
  lg: "min(760px,96vw)",
  xl: "min(960px,96vw)",
};

export function HrModal({
  isOpen,
  onClose,
  title,
  subtitle,
  size = "md",
  gradientHeader,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: ModalSize;
  gradientHeader?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.55)", backdropFilter: "blur(2px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-[16px] overflow-hidden shadow-[0_20px_60px_-10px_rgba(14,16,32,0.28)] flex flex-col max-h-[88vh]"
        style={{ width: modalWidths[size], animation: "hr-fade-up 0.18s ease" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={[
            "flex items-start justify-between gap-4 p-[18px_20px]",
            gradientHeader
              ? "bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] text-white"
              : "border-b border-[var(--line)]",
          ].join(" ")}
        >
          <div>
            <h2 className="m-0 text-[16px] font-[900]" style={{ fontFamily: "var(--serif)" }}>
              {title}
            </h2>
            {subtitle && (
              <p className="m-0 text-[12px] mt-1 opacity-80">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-[28px] h-[28px] flex-none border border-[var(--line)] rounded-[8px] bg-white text-gray-500 flex items-center justify-center hover:bg-[var(--soft)] hover:text-[var(--brand)]"
          >
            <X size={14} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAWER
// ─────────────────────────────────────────────────────────────────────────────
export function HrDrawer({
  isOpen,
  onClose,
  children,
  title,
  width = 390,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  width?: number;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-[900]"
          style={{ background: "rgba(15,23,42,0.35)" }}
          onClick={onClose}
        />
      )}
      <div
        className="fixed right-0 top-0 h-screen z-[901] bg-white shadow-[var(--shadow)] overflow-y-auto transition-transform duration-300"
        style={{
          width: `min(${width}px, 100vw)`,
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {title && (
          <div className="px-5 py-4 border-b border-[var(--line)] font-[800] text-[16px]">{title}</div>
        )}
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────────────────
interface ToastItem { id: number; message: string; type: "success" | "error" | "info" }
interface ToastCtx { toast: (message: string, type?: ToastItem["type"]) => void }

const ToastContext = createContext<ToastCtx>({ toast: () => {} });
export const useHrToast = () => useContext(ToastContext);

export function HrToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, type: ToastItem["type"] = "success") => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2200);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[1100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="min-w-[240px] max-w-[340px] px-4 py-3 rounded-[10px] text-white text-[13px] font-[700] shadow-lg"
            style={{
              background:
                t.type === "error" ? "#991b1b" : t.type === "info" ? "#1e40af" : "#111827",
              animation: "hr-fade-up 0.18s ease",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCORDION
// ─────────────────────────────────────────────────────────────────────────────
export function HrAccordion({
  title,
  meta,
  actions,
  children,
  defaultOpen = false,
}: {
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="border border-[var(--line)] rounded-[14px] overflow-hidden"
      style={{ boxShadow: "var(--shadow)" }}
    >
      <div
        className="flex items-center gap-3 p-[13px_16px] cursor-pointer"
        style={{
          background: "linear-gradient(to right, #fff, #fbfaff)",
          borderLeft: "4px solid var(--strong)",
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          className="text-gray-400 transition-transform duration-200"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          <ChevronRight size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-[850] text-[14px]">{title}</div>
          {meta && <div className="flex gap-2 flex-wrap mt-1">{meta}</div>}
        </div>
        {actions && (
          <div
            className="flex gap-2 items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>
      {open && (
        <div className="border-t border-[#f1f5f9] p-[14px_16px_16px]">{children}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP WIZARD (horizontal)
// ─────────────────────────────────────────────────────────────────────────────
export function HrStepWizard({
  steps,
  currentStep,
  onStepClick,
}: {
  steps: Array<{ label: string; hint?: string }>;
  currentStep: number;
  onStepClick?: (step: number) => void;
}) {
  return (
    <div className="flex items-start gap-0">
      {steps.map((step, i) => {
        const num = i + 1;
        const done = num < currentStep;
        const active = num === currentStep;
        return (
          <React.Fragment key={num}>
            <div
              className="flex flex-col items-center gap-2 cursor-pointer min-w-[120px]"
              onClick={() => onStepClick?.(num)}
            >
              <div
                className="w-[36px] h-[36px] rounded-full flex items-center justify-center font-[900] text-[14px] border-2 transition-all"
                style={{
                  background: done ? "var(--green)" : active ? "var(--brand)" : "#f3f4f6",
                  borderColor: done ? "var(--green)" : active ? "var(--brand)" : "#e5e7eb",
                  color: done || active ? "#fff" : "#64748b",
                }}
              >
                {done ? "✓" : num}
              </div>
              <span className="text-[11px] text-center font-[700] text-[#374151]">{step.label}</span>
              {step.hint && (
                <span className="text-[10px] text-[#9ca3af] text-center leading-tight">{step.hint}</span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div
                className="h-[2px] flex-1 mt-[17px]"
                style={{ background: done ? "var(--green)" : "#e5e7eb" }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM DIALOG
// ─────────────────────────────────────────────────────────────────────────────
export function HrConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  danger,
  loading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <HrModal isOpen={isOpen} onClose={onClose} title="" size="sm">
      <div className="p-5">
        <div
          className="flex items-center gap-3 mb-4 p-3 rounded-[10px]"
          style={{
            background: danger ? "linear-gradient(135deg,#fff7ed,#fff1f2)" : "var(--soft)",
          }}
        >
          <AlertTriangle size={20} className={danger ? "text-orange-500" : "text-[var(--brand)]"} />
          <div>
            <div className="font-[900] text-[15px]">{title}</div>
            <div className="text-[13px] text-[var(--muted)] mt-1">{message}</div>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <HrButton variant="ghost" onClick={onClose}>Cancel</HrButton>
          <HrButton
            variant={danger ? "red" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </HrButton>
        </div>
      </div>
    </HrModal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FIELD wrapper
// ─────────────────────────────────────────────────────────────────────────────
export function HrField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[6px]">
      <label
        className="text-[11px] uppercase tracking-[0.06em] text-[#64748b] font-[850]"
      >
        {label}
        {required && <span className="text-[var(--red)] ml-1">*</span>}
      </label>
      {children}
      {error && <span className="text-[11px] text-[var(--red)]">{error}</span>}
    </div>
  );
}

// Input / Select / Textarea with consistent styling
export function HrInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "w-full border border-[var(--line)] rounded-[11px] bg-white min-h-[40px] px-3 text-[var(--ink)] outline-none",
        "focus:border-[#c4b5fd] focus:shadow-[0_0_0_3px_rgba(108,60,225,0.12)]",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

export function HrSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        "w-full border border-[var(--line)] rounded-[11px] bg-white h-[40px] px-3 text-[var(--ink)] outline-none",
        "focus:border-[#c4b5fd] focus:shadow-[0_0_0_3px_rgba(108,60,225,0.12)]",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

export function HrTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        "w-full border border-[var(--line)] rounded-[11px] bg-white min-h-[88px] p-[10px_12px] text-[var(--ink)] outline-none resize-y",
        "focus:border-[#c4b5fd] focus:shadow-[0_0_0_3px_rgba(108,60,225,0.12)]",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON row (loading state)
// ─────────────────────────────────────────────────────────────────────────────
export function HrSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-[44px] rounded-[10px] bg-[#f1f5f9] animate-pulse" />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page hero
// ─────────────────────────────────────────────────────────────────────────────
export function HrHero({
  eyebrow,
  title,
  accent,
  sub,
  actions,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  sub?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-start gap-6 mb-5">
      <div>
        <p className="text-[13px] text-[var(--muted)] m-0 mb-1">{eyebrow}</p>
        <h1
          className="m-0 text-[38px] font-[700] leading-[1.08] tracking-[-0.02em]"
          style={{ fontFamily: "var(--serif)" }}
        >
          {title} <em className="text-[var(--brand)] not-italic font-[400]">{accent}</em>
        </h1>
        {sub && <p className="mt-2 text-[var(--muted)] m-0 leading-[1.55]">{sub}</p>}
      </div>
      {actions && <div className="flex gap-2 items-center flex-wrap">{actions}</div>}
    </div>
  );
}
