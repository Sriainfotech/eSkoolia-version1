"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2, Loader2, AlertTriangle, Image as ImageIcon, UploadCloud,
  GraduationCap, BadgeCheck, Wallet, Receipt, FileSignature, BookOpen,
  Check, Eye, EyeOff, LayoutTemplate, ScrollText,
} from "lucide-react";
import { apiRequestWithRefresh, apiRequestWithRefreshResponse } from "@/lib/api-auth";
import { useUnsavedChangesGuard } from "@/contexts/UnsavedChangesContext";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BrandingSettings {
  id?: number;
  header_mode: "generated" | "uploaded";
  header_style: "classic" | "modern" | "minimal" | "executive" | "letterpress" | "banner";
  header_text_color: string;
  accent_color: string;
  header_size: "compact" | "standard" | "tall";
  logo_position: "left" | "center" | "right";
  show_divider: boolean;
  divider_style: "none" | "solid" | "double" | "dashed" | "thick_rule";
  show_watermark: boolean;
  watermark_text: string;
  show_logo: boolean;
  letterhead_source_file_type: string;
  letterhead_file_name: string | null;
  declaration_student_verification: string;
  declaration_staff_onboarding: string;
  declaration_payslip: string;
  declaration_fee_receipt: string;
  declaration_transfer_certificate: string;
  declaration_admission: string;
  updated_by_name: string | null;
  updated_at: string;
}

type Tone = "purple" | "blue" | "amber" | "rose" | "green" | "cyan";
const TONES: Record<Tone, { fg: string; bg: string; soft: string; gradient: string }> = {
  purple: { fg: "var(--pu)", bg: "var(--pu-tint)", soft: "var(--pu-soft)", gradient: "linear-gradient(135deg,var(--pu) 0%,var(--pu-deep) 100%)" },
  blue:   { fg: "var(--info)", bg: "var(--info-soft)", soft: "var(--info)", gradient: "linear-gradient(135deg,var(--info) 0%,var(--pu) 100%)" },
  amber:  { fg: "var(--warn)", bg: "var(--warn-soft)", soft: "var(--warn)", gradient: "linear-gradient(135deg,var(--warn) 0%,var(--danger) 100%)" },
  rose:   { fg: "var(--danger)", bg: "var(--danger-soft)", soft: "var(--danger)", gradient: "linear-gradient(135deg,var(--danger) 0%,var(--pu) 100%)" },
  green:  { fg: "var(--ok)", bg: "var(--ok-soft)", soft: "var(--ok)", gradient: "linear-gradient(135deg,var(--ok) 0%,var(--info) 100%)" },
  cyan:   { fg: "var(--info)", bg: "var(--info-soft)", soft: "var(--info)", gradient: "linear-gradient(135deg,#0ea5e9 0%,var(--pu) 100%)" },
};

// ─── Style gallery data ──────────────────────────────────────────────────────

const STYLE_OPTIONS: Array<{
  value: BrandingSettings["header_style"];
  label: string;
  hint: string;
  tone: Tone;
  bwNote: string;
}> = [
  { value: "classic",     label: "Classic",     hint: "Centered logo, name, address stack",            tone: "purple", bwNote: "Clean centered stack" },
  { value: "modern",      label: "Modern",      hint: "Left logo, left-aligned detail column",          tone: "blue",   bwNote: "Left-aligned layout" },
  { value: "minimal",     label: "Minimal",     hint: "Inline logo + single compact line",              tone: "amber",  bwNote: "Lightweight single line" },
  { value: "executive",   label: "Executive",   hint: "Logo | vertical rule | bold name + details",    tone: "cyan",   bwNote: "Bold rule separator" },
  { value: "letterpress", label: "Letterpress", hint: "Double border rules top & bottom, centered",    tone: "rose",   bwNote: "⭐ Best for B&W print" },
  { value: "banner",      label: "Banner",      hint: "Solid dark band with white text, detail strip", tone: "green",  bwNote: "⭐ Max contrast in B&W" },
];

// ─── Declaration fields ──────────────────────────────────────────────────────

const DECLARATION_FIELDS: Array<{
  key: keyof Pick<BrandingSettings,
    "declaration_student_verification" | "declaration_staff_onboarding" |
    "declaration_payslip" | "declaration_fee_receipt" |
    "declaration_transfer_certificate" | "declaration_admission">;
  label: string;
  placeholder: string;
  tone: Tone;
  icon: typeof GraduationCap;
}> = [
  { key: "declaration_student_verification", label: "Student Verification",    placeholder: "I/We, parent/guardian of {studentName}, declare the above information is true and correct.",  tone: "purple", icon: GraduationCap },
  { key: "declaration_staff_onboarding",     label: "Staff Onboarding",        placeholder: "Use {staffName} to insert the staff member's name automatically.",                             tone: "blue",   icon: BadgeCheck },
  { key: "declaration_payslip",              label: "Payslip",                 placeholder: "Shown at the bottom of every payslip.",                                                         tone: "amber",  icon: Wallet },
  { key: "declaration_fee_receipt",          label: "Fee Receipt",             placeholder: "This receipt is computer generated. No signature required.",                                   tone: "cyan",   icon: Receipt },
  { key: "declaration_transfer_certificate", label: "Transfer Certificate",    placeholder: "Certified that the above information is correct as per school records.",                       tone: "rose",   icon: FileSignature },
  { key: "declaration_admission",            label: "Admission Form",          placeholder: "I hereby declare that the information furnished above is true, complete and correct.",          tone: "green",  icon: BookOpen },
];

// ─── Shared styles ───────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  border: "1px solid var(--bd-2)", borderRadius: 10, padding: "9px 11px",
  fontSize: 14, background: "var(--bg-1)", color: "var(--ink-1)", width: "100%",
};

// ─── Divider preview strip ───────────────────────────────────────────────────

function DividerPreview({ style, color }: { style: BrandingSettings["divider_style"]; color: string }) {
  const base: React.CSSProperties = { width: "100%", display: "flex", flexDirection: "column", justifyContent: "center", height: 24, gap: 3 };
  if (style === "none") return <div style={{ ...base, color: "var(--ink-3)", fontSize: 11, textAlign: "center" }}>no rule</div>;
  if (style === "solid") return <div style={{ ...base }}><div style={{ height: 2, background: color, borderRadius: 1 }} /></div>;
  if (style === "double") return <div style={{ ...base }}><div style={{ height: 1, background: color, borderRadius: 1 }} /><div style={{ height: 2, background: color, borderRadius: 1 }} /></div>;
  if (style === "dashed") {
    return (
      <div style={{ ...base }}>
        <div style={{ height: 2, background: `repeating-linear-gradient(to right,${color} 0,${color} 12px,transparent 12px,transparent 20px)`, borderRadius: 1 }} />
      </div>
    );
  }
  // thick_rule
  return <div style={{ ...base }}><div style={{ height: 4, background: color, borderRadius: 1 }} /><div style={{ height: 1, background: color, borderRadius: 1, opacity: 0.5 }} /></div>;
}

// ─── Main component ──────────────────────────────────────────────────────────

export function DocumentBrandingPanel() {
  const [settings, setSettings] = useState<BrandingSettings | null>(null);
  const [form, setForm] = useState<Partial<BrandingSettings>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [schoolLogoUrl, setSchoolLogoUrl] = useState<string | null>(null);
  const [bwPreview, setBwPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeStep, setActiveStep] = useState<"header" | "declarations">("header");
  const [selectedDeclaration, setSelectedDeclaration] = useState<typeof DECLARATION_FIELDS[number]["key"]>(DECLARATION_FIELDS[0].key);

  const loadPreview = useCallback(async () => {
    try {
      const res = await apiRequestWithRefreshResponse("/api/v1/settings/document-branding/header-image/");
      if (!res.ok) return;
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(blob);
    } catch {
      // preview is best-effort
    }
  }, []);

  // Debounced live preview — fires 420 ms after the last style-relevant form change.
  // Only runs for generated mode; uploaded mode already shows the stored PNG.
  useEffect(() => {
    if (!settings || form.header_mode !== "generated") return;

    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);

    previewDebounceRef.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const payload = {
          header_style:      form.header_style,
          header_text_color: form.header_text_color,
          accent_color:      form.accent_color,
          header_size:       form.header_size,
          logo_position:     form.logo_position,
          show_divider:      form.show_divider,
          divider_style:     form.divider_style,
          show_watermark:    form.show_watermark,
          watermark_text:    form.watermark_text ?? "",
          show_logo:         form.show_logo,
        };
        const res = await apiRequestWithRefreshResponse("/api/v1/settings/document-branding/preview/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) return;
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onload = () => setPreviewUrl(reader.result as string);
        reader.readAsDataURL(blob);
      } catch {
        // best-effort
      } finally {
        setPreviewLoading(false);
      }
    }, 420);

    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.header_mode, form.header_style, form.header_text_color, form.accent_color,
    form.header_size, form.logo_position, form.show_divider, form.divider_style,
    form.show_watermark, form.watermark_text, form.show_logo, settings,
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, schoolInfo] = await Promise.all([
        apiRequestWithRefresh<BrandingSettings>("/api/v1/settings/document-branding/"),
        apiRequestWithRefresh<{ logo_url?: string | null }>("/api/v1/settings/school-info/").catch(() => null),
      ]);
      setSettings(data);
      setForm(data);
      if (schoolInfo?.logo_url) setSchoolLogoUrl(schoolInfo.logo_url);
      await loadPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load document branding settings.");
    } finally {
      setLoading(false);
    }
  }, [loadPreview]);

  useEffect(() => { void load(); }, [load]);

  const patch = <K extends keyof BrandingSettings>(key: K, value: BrandingSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Partial<BrandingSettings> = {
        header_mode: form.header_mode,
        header_style: form.header_style,
        header_text_color: form.header_text_color,
        accent_color: form.accent_color,
        header_size: form.header_size,
        logo_position: form.logo_position,
        show_divider: form.show_divider,
        divider_style: form.divider_style,
        show_watermark: form.show_watermark,
        watermark_text: form.watermark_text ?? "",
        show_logo: form.show_logo,
        declaration_student_verification: form.declaration_student_verification ?? "",
        declaration_staff_onboarding: form.declaration_staff_onboarding ?? "",
        declaration_payslip: form.declaration_payslip ?? "",
        declaration_fee_receipt: form.declaration_fee_receipt ?? "",
        declaration_transfer_certificate: form.declaration_transfer_certificate ?? "",
        declaration_admission: form.declaration_admission ?? "",
      };
      const updated = await apiRequestWithRefresh<BrandingSettings>("/api/v1/settings/document-branding/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSettings(updated);
      setForm(updated);
      setSuccess("Saved — this header now applies to every printed document across the ERP.");
      await loadPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save. Check the fields above.");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const isDirty = !!settings && JSON.stringify(form) !== JSON.stringify(settings);
  useUnsavedChangesGuard(isDirty, handleSave);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiRequestWithRefreshResponse("/api/v1/settings/document-branding/upload-letterhead/", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        const errBody = body?.error as Record<string, unknown> | undefined;
        const fieldErrors = body?.field_errors as Record<string, string[]> | undefined;
        const msg = errBody?.message ?? fieldErrors?.file?.[0] ?? "Upload failed.";
        throw new Error(String(msg));
      }
      const updated = await res.json() as BrandingSettings;
      setSettings(updated);
      setForm(updated);
      setSuccess("Letterhead uploaded and applied everywhere.");
      await loadPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleUpload(file);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  // Light segmented-control button style
  const segBtn = (sel: boolean): React.CSSProperties => ({
    flex: 1, padding: "5px 0", borderRadius: 6, border: "none",
    background: sel ? "var(--bg-1)" : "transparent",
    color: sel ? "var(--ink-1)" : "var(--ink-3)", fontSize: 11.5, fontWeight: sel ? 700 : 500,
    cursor: "pointer", transition: "all 0.12s", textTransform: "capitalize" as const,
    boxShadow: sel ? "var(--sh-1)" : "none",
  });

  // Toggle switch
  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <div onClick={onClick}
      style={{ width: 34, height: 19, borderRadius: 10, background: on ? "var(--pu)" : "var(--bd-3)", position: "relative", cursor: "pointer", transition: "background 0.15s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 2, left: on ? 17 : 2, width: 15, height: 15, borderRadius: "50%", background: "#fff", transition: "left 0.15s", boxShadow: "var(--sh-1)" }} />
    </div>
  );

  // Section wrapper — label + content, hairline divider below
  const section = (label: string, children: React.ReactNode, noBorder?: boolean) => (
    <div style={{ padding: "16px 20px", borderBottom: noBorder ? "none" : "1px solid var(--bd)" }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
        {label}
      </div>
      {children}
    </div>
  );

  return (
    <div>

      {/* ── Minimal page header ─────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: "var(--ink-1)", margin: 0, display: "flex", alignItems: "baseline", gap: 8 }}>
            Document <em style={{ fontFamily: "var(--font-instrument-serif,'Instrument Serif',Georgia,serif)", fontWeight: 400, fontStyle: "italic", color: "var(--pu)", fontSize: 25 }}>Branding</em>
          </h1>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--ink-3)" }}>Header applied to every PDF in the ERP</p>
        </div>
        <button className="db-save-btn" onClick={() => { void handleSave().catch(() => {}); }} disabled={saving || loading}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "linear-gradient(135deg,var(--pu) 0%,var(--pu-deep) 100%)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: saving || loading ? "default" : "pointer", opacity: saving || loading ? 0.6 : 1, boxShadow: "0 6px 18px -8px var(--pu)", flexShrink: 0 }}>
          {saving ? (<><Loader2 size={13} className="db-spin" /> Saving…</>) : (<><CheckCircle2 size={13} /> Save changes</>)}
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8, color: "var(--danger)", background: "var(--danger-soft)", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 500 }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}
      {success && (
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8, color: "var(--ok)", background: "var(--ok-soft)", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 500 }}>
          <CheckCircle2 size={14} /> {success}
        </div>
      )}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink-2)", fontSize: 14, padding: "48px 0" }}>
          <Loader2 size={18} className="db-spin" /> Loading…
        </div>
      )}

      {!loading && settings && (
        <div className="db-grid" style={{ display: "grid", gridTemplateColumns: "390px minmax(0,1fr)", gap: 20, alignItems: "start" }}>

          {/* ════════════ SETTINGS CARD ════════════ */}
          <div style={{ background: "var(--bg-1)", border: "1px solid var(--bd-2)", borderRadius: 14, boxShadow: "var(--sh-2)", overflow: "hidden" }}>

            {/* Step tabs */}
            <div style={{ display: "flex", padding: "0 20px", borderBottom: "1px solid var(--bd)" }}>
              {([
                { id: "header" as const, label: "Header", icon: LayoutTemplate },
                { id: "declarations" as const, label: "Declarations", icon: ScrollText },
              ] as const).map(({ id, label, icon: Icon }) => {
                const sel = activeStep === id;
                return (
                  <button key={id} type="button" onClick={() => setActiveStep(id)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 4px", marginRight: 22, background: "transparent", border: "none", borderBottom: `2.5px solid ${sel ? "var(--pu)" : "transparent"}`, color: sel ? "var(--ink-1)" : "var(--ink-3)", fontSize: 13, fontWeight: sel ? 700 : 600, cursor: "pointer", transition: "all 0.12s" }}>
                    <Icon size={14} /> {label}
                  </button>
                );
              })}
            </div>

            <div style={{ maxHeight: "calc(100vh - 260px)", overflowY: "auto" }}>

              {activeStep === "header" && (<>

              {/* Source */}
              {section("Header source", (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {([
                    { value: "generated" as const, label: "Generated", sub: "Built from school info" },
                    { value: "uploaded"  as const, label: "Uploaded",  sub: settings.letterhead_file_name ? `"${settings.letterhead_file_name}"` : "Upload a file below" },
                  ] as const).map(({ value, label, sub }) => {
                    const sel = form.header_mode === value;
                    const dis = value === "uploaded" && !settings.letterhead_file_name;
                    return (
                      <button key={value} type="button" disabled={dis} onClick={() => patch("header_mode", value)}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${sel ? "var(--pu)" : "var(--bd-2)"}`, background: sel ? "var(--pu-tint)" : "var(--bg-1)", cursor: dis ? "default" : "pointer", opacity: dis ? 0.45 : 1, transition: "all 0.12s", textAlign: "left" }}>
                        <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${sel ? "var(--pu)" : "var(--bd-3)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {sel && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--pu)" }} />}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-1)" }}>{label}</div>
                          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1 }}>{sub}</div>
                        </div>
                      </button>
                    );
                  })}

                  {/* Upload dropzone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{ padding: "10px 12px", borderRadius: 10, border: `1.5px dashed ${dragOver ? "var(--pu)" : "var(--bd-3)"}`, background: dragOver ? "var(--pu-tint)" : "var(--bg-2)", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", transition: "all 0.12s" }}>
                    {uploading ? <Loader2 size={14} className="db-spin" style={{ color: "var(--ink-3)" }} /> : <UploadCloud size={14} style={{ color: "var(--ink-3)", flexShrink: 0 }} />}
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink-1)" }}>{uploading ? "Uploading…" : settings.letterhead_file_name ? "Replace letterhead" : "Upload letterhead"}</div>
                      <div style={{ fontSize: 10, color: "var(--ink-3)" }}>PDF · JPEG · PNG · max 5 MB</div>
                    </div>
                    <input ref={fileInputRef} type="file" accept="application/pdf,image/jpeg,image/png" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) void handleUpload(e.target.files[0]); e.target.value = ""; }} />
                  </div>

                  {/* Include logo */}
                  {form.header_mode === "generated" && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--bd-2)", background: "var(--bg-2)", opacity: schoolLogoUrl ? 1 : 0.65 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 7, background: "#fff", border: "1px solid var(--bd)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                          {schoolLogoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={schoolLogoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                          ) : (
                            <ImageIcon size={14} style={{ color: "var(--ink-4)" }} />
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-1)" }}>Include logo</div>
                          <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{schoolLogoUrl ? "Reuses the logo from School Info → Branding" : "Add a logo under School Info → Branding to enable this"}</div>
                        </div>
                      </div>
                      <Toggle on={!!form.show_logo && !!schoolLogoUrl} onClick={() => { if (schoolLogoUrl) patch("show_logo", !form.show_logo); }} />
                    </div>
                  )}
                </div>
              ))}

              {form.header_mode === "generated" && (
                <>
                  {/* Style */}
                  {section("Style", (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {STYLE_OPTIONS.map((opt) => {
                        const sel = form.header_style === opt.value;
                        return (
                          <button key={opt.value} type="button" onClick={() => patch("header_style", opt.value)}
                            style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "8px 10px", borderRadius: 9, background: sel ? "var(--pu-tint)" : "var(--bg-1)", border: `1.5px solid ${sel ? "var(--pu)" : "var(--bd-2)"}`, cursor: "pointer", textAlign: "left", transition: "all 0.12s" }}>
                            {/* Mini layout diagram */}
                            <div style={{ width: 38, height: 26, borderRadius: 4, background: "#fff", border: "1px solid var(--bd)", overflow: "hidden", flexShrink: 0, position: "relative" }}>
                              {opt.value === "classic" && (<>
                                <div style={{ position: "absolute", top: 3, left: "50%", transform: "translateX(-50%)", width: 7, height: 7, borderRadius: 2, background: "#1a1a2e", opacity: 0.6 }} />
                                <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", width: 22, height: 2, borderRadius: 1, background: "#1a1a2e", opacity: 0.7 }} />
                                <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", width: 15, height: 1, borderRadius: 1, background: "#1a1a2e", opacity: 0.35 }} />
                              </>)}
                              {opt.value === "modern" && (<>
                                <div style={{ position: "absolute", top: 4, left: 3, width: 8, height: 18, borderRadius: 2, background: "#1a1a2e", opacity: 0.55 }} />
                                <div style={{ position: "absolute", top: 5, left: 14, width: 20, height: 2, borderRadius: 1, background: "#1a1a2e", opacity: 0.8 }} />
                                <div style={{ position: "absolute", top: 10, left: 14, width: 14, height: 1, borderRadius: 1, background: "#1a1a2e", opacity: 0.4 }} />
                                <div style={{ position: "absolute", top: 14, left: 14, width: 17, height: 1, borderRadius: 1, background: "#1a1a2e", opacity: 0.3 }} />
                              </>)}
                              {opt.value === "minimal" && (<>
                                <div style={{ position: "absolute", top: 9, left: 4, width: 7, height: 7, borderRadius: 2, background: "#1a1a2e", opacity: 0.6 }} />
                                <div style={{ position: "absolute", top: 11, left: 14, right: 4, height: 2, borderRadius: 1, background: "#1a1a2e", opacity: 0.65 }} />
                              </>)}
                              {opt.value === "executive" && (<>
                                <div style={{ position: "absolute", top: 4, left: 3, width: 7, height: 18, borderRadius: 2, background: "#1a1a2e", opacity: 0.45 }} />
                                <div style={{ position: "absolute", top: 0, bottom: 0, left: 12, width: 1, background: "#1a1a2e", opacity: 0.3 }} />
                                <div style={{ position: "absolute", top: 5, left: 16, width: 18, height: 2, borderRadius: 1, background: "#1a1a2e", opacity: 0.75 }} />
                                <div style={{ position: "absolute", top: 10, left: 16, width: 12, height: 1, borderRadius: 1, background: "#1a1a2e", opacity: 0.38 }} />
                                <div style={{ position: "absolute", top: 14, left: 16, width: 15, height: 1, borderRadius: 1, background: "#1a1a2e", opacity: 0.28 }} />
                              </>)}
                              {opt.value === "letterpress" && (<>
                                <div style={{ position: "absolute", top: 1, left: 3, right: 3, height: 2, borderRadius: 1, background: "#1a1a2e" }} />
                                <div style={{ position: "absolute", top: 4, left: 3, right: 3, height: 1, borderRadius: 1, background: "#1a1a2e", opacity: 0.45 }} />
                                <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", width: 10, height: 2, borderRadius: 1, background: "#1a1a2e", opacity: 0.75 }} />
                                <div style={{ position: "absolute", top: 13, left: "50%", transform: "translateX(-50%)", width: 18, height: 1, borderRadius: 1, background: "#1a1a2e", opacity: 0.35 }} />
                                <div style={{ position: "absolute", bottom: 4, left: 3, right: 3, height: 1, borderRadius: 1, background: "#1a1a2e", opacity: 0.45 }} />
                                <div style={{ position: "absolute", bottom: 1, left: 3, right: 3, height: 2, borderRadius: 1, background: "#1a1a2e" }} />
                              </>)}
                              {opt.value === "banner" && (<>
                                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 14, background: "#1a1a2e", borderRadius: "3px 3px 0 0" }} />
                                <div style={{ position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)", width: 18, height: 2, borderRadius: 1, background: "rgba(255,255,255,0.8)" }} />
                                <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", width: 11, height: 1, borderRadius: 1, background: "rgba(255,255,255,0.5)" }} />
                                <div style={{ position: "absolute", bottom: 4, left: 3, right: 3, height: 1, borderRadius: 1, background: "#1a1a2e", opacity: 0.25 }} />
                              </>)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: sel ? 700 : 600, color: "var(--ink-1)" }}>{opt.label}</div>
                              <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{opt.hint}</div>
                            </div>
                            {sel && (
                              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--pu)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <Check size={10} color="#fff" strokeWidth={3} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}

                  {/* Colors */}
                  {section("Colors", (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {([
                        ["header_text_color", "Text color"] as const,
                        ["accent_color",      "Accent / dividers"] as const,
                      ] as const).map(([key, label]) => (
                        <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12.5, color: "var(--ink-2)", fontWeight: 500 }}>{label}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--bd-2)", borderRadius: 8, padding: "3px 8px 3px 3px" }}>
                            <input type="color" value={(form[key] as string) || "#1a1a2e"} onChange={(e) => patch(key, e.target.value.toUpperCase())}
                              style={{ width: 22, height: 22, borderRadius: 5, border: "none", cursor: "pointer", padding: 0, background: "transparent" }} />
                            <input value={(form[key] as string) ?? ""} onChange={(e) => patch(key, e.target.value)} maxLength={7}
                              style={{ width: 64, border: "none", background: "transparent", fontSize: 11.5, fontFamily: "var(--font-mono,monospace)", color: "var(--ink-1)", outline: "none", fontWeight: 600 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* Layout */}
                  {section("Layout", (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {([
                        ["header_size",   "Size",       ["compact", "standard", "tall"]  ] as const,
                        ["logo_position", "Logo",       ["left",    "center",   "right"] ] as const,
                      ] as const).map(([key, label, opts]) => (
                        <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontSize: 12.5, color: "var(--ink-2)", fontWeight: 500, flexShrink: 0 }}>{label}</span>
                          <div style={{ display: "inline-flex", background: "var(--bg-2)", borderRadius: 8, padding: 2 }}>
                            {opts.map((v) => (
                              <button key={v} type="button" onClick={() => patch(key, v)} style={segBtn(form[key] === v)}>{v}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* Decorations */}
                  {section("Decorations", (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                      {/* Divider toggle + style */}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: form.show_divider ? 10 : 0 }}>
                          <span style={{ fontSize: 12.5, color: "var(--ink-2)", fontWeight: 500 }}>Bottom divider</span>
                          <Toggle on={!!form.show_divider} onClick={() => patch("show_divider", !form.show_divider)} />
                        </div>
                        {form.show_divider && (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4 }}>
                            {(["none","solid","double","dashed","thick_rule"] as const).map((ds) => {
                              const sel = form.divider_style === ds;
                              return (
                                <button key={ds} type="button" onClick={() => patch("divider_style", ds)}
                                  style={{ borderRadius: 7, padding: "6px 3px", border: `1.5px solid ${sel ? "var(--pu)" : "var(--bd-2)"}`, background: sel ? "var(--pu-tint)" : "var(--bg-2)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                  <DividerPreview style={ds} color={sel ? "var(--pu)" : "var(--ink-4)"} />
                                  <span style={{ fontSize: 8, fontWeight: 700, color: sel ? "var(--pu)" : "var(--ink-3)", textTransform: "capitalize", whiteSpace: "nowrap" }}>{ds.replace("_"," ")}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Watermark toggle + text */}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: form.show_watermark ? 8 : 0 }}>
                          <span style={{ fontSize: 12.5, color: "var(--ink-2)", fontWeight: 500 }}>Diagonal watermark</span>
                          <Toggle on={!!form.show_watermark} onClick={() => patch("show_watermark", !form.show_watermark)} />
                        </div>
                        {form.show_watermark && (
                          <input value={form.watermark_text ?? ""} onChange={(e) => patch("watermark_text", e.target.value)} maxLength={80}
                            style={{ width: "100%", background: "var(--bg-2)", border: "1px solid var(--bd-2)", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "var(--ink-1)", outline: "none" }}
                            placeholder="Defaults to school name" />
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}

              </>)}

              {activeStep === "declarations" && section("Declarations", (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {DECLARATION_FIELDS.map(({ key, label, tone, icon: Icon }) => {
                    const t = TONES[tone];
                    const sel = selectedDeclaration === key;
                    const val = (form[key] as string) ?? "";
                    return (
                      <button key={key} type="button" onClick={() => setSelectedDeclaration(key)}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9, border: `1.5px solid ${sel ? "var(--pu)" : "var(--bd-2)"}`, background: sel ? "var(--pu-tint)" : "var(--bg-1)", cursor: "pointer", textAlign: "left", transition: "all 0.12s" }}>
                        <span style={{ width: 26, height: 26, borderRadius: 8, background: t.bg, color: t.fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={13} strokeWidth={2.25} />
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-1)" }}>{label}</div>
                          <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{val ? val : "Not set"}</div>
                        </span>
                        {!!val && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--pu)", flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              ), true)}

            </div>
          </div>

          {/* ════════════ PREVIEW PANEL ════════════ */}
          <div style={{ background: "var(--bg-1)", border: "1px solid var(--bd-2)", borderRadius: 14, boxShadow: "var(--sh-2)", display: "flex", flexDirection: "column", padding: 20 }}>

            {activeStep === "header" ? (
              <>
                {/* Preview controls */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: previewLoading ? "var(--warn)" : "var(--ok)", display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-1)" }}>
                      {previewLoading ? "Rendering…" : "Live preview"}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--ink-3)" }}>— A4 proportions, unsaved</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <button type="button" onClick={() => setBwPreview((v) => !v)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 8, border: `1.5px solid ${bwPreview ? "var(--ink-1)" : "var(--bd-2)"}`, background: bwPreview ? "var(--ink-1)" : "var(--bg-1)", color: bwPreview ? "var(--bg-1)" : "var(--ink-2)", cursor: "pointer", fontSize: 11.5, fontWeight: 700 }}>
                      {bwPreview ? <Eye size={12} /> : <EyeOff size={12} />} B&amp;W
                    </button>
                  </div>
                </div>

                {/* Canvas */}
                <div style={{ background: "var(--bg-2)", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 20px 20px" }}>
                  <div style={{ width: "min(100%, 460px)", aspectRatio: "210 / 297", background: "#fff", borderRadius: 6, boxShadow: "var(--sh-3)", border: "1px solid var(--bd-2)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    {previewUrl ? (
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewUrl} alt="Header preview"
                          style={{ display: "block", width: "100%", height: "auto", filter: bwPreview ? "grayscale(1) contrast(1.05)" : "none", opacity: previewLoading ? 0.35 : 1, transition: "opacity 0.15s, filter 0.2s" }} />
                        {previewLoading && (
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", background: "rgba(255,255,255,0.94)", borderRadius: 6, padding: "6px 12px", fontSize: 11.5, color: "#555", fontWeight: 700, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                              <Loader2 size={13} className="db-spin" /> Rendering…
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ height: 90, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 13, gap: 7 }}>
                        <ImageIcon size={15} /> No preview yet — save to render
                      </div>
                    )}
                    {/* Simulated page content */}
                    <div style={{ flex: 1, minHeight: 0, overflow: "hidden", padding: "18px 22px 24px", display: "flex", flexDirection: "column", gap: 9, filter: bwPreview ? "grayscale(1)" : "none" }}>
                      <div style={{ height: 8, background: "#e8e8e8", borderRadius: 3, width: "50%" }} />
                      <div style={{ height: 5, background: "#efefef", borderRadius: 2, width: "88%" }} />
                      <div style={{ height: 5, background: "#efefef", borderRadius: 2, width: "73%" }} />
                      <div style={{ height: 5, background: "#efefef", borderRadius: 2, width: "92%" }} />
                      <div style={{ height: 5, background: "#efefef", borderRadius: 2, width: "61%" }} />
                      <div style={{ height: 1, background: "#e5e5e5", margin: "4px 0" }} />
                      <div style={{ height: 5, background: "#efefef", borderRadius: 2, width: "80%" }} />
                      <div style={{ height: 5, background: "#efefef", borderRadius: 2, width: "55%" }} />
                    </div>
                  </div>

                  {settings.updated_at && (
                    <div style={{ marginTop: 12, fontSize: 11, color: "var(--ink-3)", textAlign: "center" }}>
                      Saved by {settings.updated_by_name ?? "—"} · {new Date(settings.updated_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </>
            ) : (() => {
              const active = DECLARATION_FIELDS.find((f) => f.key === selectedDeclaration) ?? DECLARATION_FIELDS[0];
              const t = TONES[active.tone];
              return (
                <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <span style={{ width: 30, height: 30, borderRadius: 9, background: t.bg, color: t.fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <active.icon size={15} strokeWidth={2.25} />
                    </span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-1)" }}>{active.label}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Printed on every {active.label} PDF generated by the ERP</div>
                    </div>
                  </div>
                  <textarea value={(form[active.key] as string) ?? ""} onChange={(e) => patch(active.key, e.target.value)} placeholder={active.placeholder}
                    style={{ flex: 1, minHeight: 320, width: "100%", background: "var(--bg-2)", border: "1px solid var(--bd-2)", borderRadius: 10, padding: "16px 18px", fontSize: 14, lineHeight: 1.7, color: "var(--ink-1)", resize: "none", outline: "none", fontFamily: "inherit" }} />
                  <div style={{ marginTop: 8, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                      Use <code style={{ background: "var(--bg-2)", padding: "1px 5px", borderRadius: 4, fontFamily: "var(--font-mono,monospace)" }}>{"{studentName}"}</code> / <code style={{ background: "var(--bg-2)", padding: "1px 5px", borderRadius: 4, fontFamily: "var(--font-mono,monospace)" }}>{"{staffName}"}</code> where applicable — replaced automatically at print time.
                    </div>
                    <button type="button" className="db-save-btn" onClick={() => { void handleSave().catch(() => {}); }} disabled={saving || loading}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,var(--pu) 0%,var(--pu-deep) 100%)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 15px", fontSize: 12.5, fontWeight: 700, cursor: saving || loading ? "default" : "pointer", opacity: saving || loading ? 0.6 : 1, boxShadow: "0 6px 18px -8px var(--pu)", flexShrink: 0, whiteSpace: "nowrap" }}>
                      {saving ? (<><Loader2 size={12} className="db-spin" /> Saving…</>) : (<><CheckCircle2 size={12} /> Save changes</>)}
                    </button>
                  </div>
                </div>
              );
            })()}

          </div>

        </div>
      )}

      <style jsx>{`
        .db-spin { animation: db-rotate 0.8s linear infinite; }
        @keyframes db-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .db-save-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
        .db-save-btn { transition: all 0.15s ease; }
        @media (max-width: 860px) {
          .db-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

