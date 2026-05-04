"use client";
import React, { useRef, useState } from "react";

// ─── field definitions ────────────────────────────────────────────────────────
interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  hint?: string;
  type?: string;
}

const FIELD_GROUPS: Array<{ section: string; fields: FieldDef[] }> = [
  {
    section: "Section A — Student Identity",
    fields: [
      { key: "firstName",    label: "First Name",    required: true,  hint: "As per birth certificate" },
      { key: "lastName",     label: "Last Name",     required: true  },
      { key: "dateOfBirth",  label: "Date of Birth", required: true,  hint: "DD / MM / YYYY", type: "text" },
      { key: "gender",       label: "Gender",        required: true,  hint: "MALE / FEMALE / OTHER" },
      { key: "bloodGroup",   label: "Blood Group",   required: false, hint: "e.g. A+" },
      { key: "religion",     label: "Religion",      required: false },
      { key: "nationality",  label: "Nationality",   required: false },
      { key: "motherTongue", label: "Mother Tongue", required: false },
    ],
  },
  {
    section: "Section B — Contact & Address",
    fields: [
      { key: "phone",       label: "Mobile Phone",  required: true,  hint: "10-digit" },
      { key: "email",       label: "Email",         required: false },
      { key: "addressLine", label: "Address Line",  required: true  },
      { key: "city",        label: "City",          required: true  },
      { key: "district",    label: "District",      required: true  },
      { key: "stateName",   label: "State",         required: true  },
      { key: "pincode",     label: "Pincode",       required: true,  hint: "6-digit" },
    ],
  },
  {
    section: "Section C — Parent / Guardian",
    fields: [
      { key: "guardianName",       label: "Guardian Full Name",   required: true  },
      { key: "guardianRelation",   label: "Relationship",         required: false, hint: "Father / Mother / Guardian" },
      { key: "guardianPhone",      label: "Guardian Mobile",      required: true,  hint: "10-digit" },
      { key: "guardianEmail",      label: "Guardian Email",       required: false },
      { key: "guardianOccupation", label: "Guardian Occupation",  required: false },
    ],
  },
  {
    section: "Section D — Government Identity",
    fields: [
      { key: "aadhaarNo", label: "Aadhaar Number", required: false, hint: "12 digits" },
    ],
  },
];

const REQUIRED_KEYS = FIELD_GROUPS.flatMap(g => g.fields.filter(f => f.required).map(f => f.key));
const FIELD_LABEL_MAP: Record<string, string> = Object.fromEntries(
  FIELD_GROUPS.flatMap(g => g.fields.map(f => [f.key, f.label]))
);

// ─── OCR extraction ───────────────────────────────────────────────────────────
async function runOcr(
  file: File,
  onProgress: (p: number) => void
): Promise<Record<string, string>> {
  const Tesseract = await import("tesseract.js");
  onProgress(10);
  const worker = await Tesseract.createWorker("eng", 1, {
    logger: (m: { status: string; progress?: number }) => {
      if (m.status === "recognizing text" && m.progress)
        onProgress(10 + Math.round(m.progress * 80));
    },
  });
  const result = await worker.recognize(file);
  await worker.terminate();
  onProgress(95);

  const text = result.data.text;
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const findAfterLabel = (label: string): string => {
    const idx = lines.findIndex(l => l.toUpperCase().includes(label.toUpperCase()));
    if (idx >= 0 && idx + 1 < lines.length) {
      const val = lines[idx + 1].replace(/^[-:_\s]+/, "").trim();
      if (val && !val.toUpperCase().includes("SECTION") && !val.toUpperCase().includes("STUDENT"))
        return val;
    }
    return "";
  };

  const raw: Record<string, string> = {
    firstName:          findAfterLabel("FIRST NAME"),
    lastName:           findAfterLabel("LAST NAME"),
    dateOfBirth:        findAfterLabel("DATE OF BIRTH"),
    gender:             findAfterLabel("GENDER"),
    bloodGroup:         findAfterLabel("BLOOD GROUP"),
    religion:           findAfterLabel("RELIGION"),
    nationality:        findAfterLabel("NATIONALITY"),
    motherTongue:       findAfterLabel("MOTHER TONGUE"),
    phone:              findAfterLabel("MOBILE PHONE"),
    email:              findAfterLabel("EMAIL"),
    addressLine:        findAfterLabel("ADDRESS LINE"),
    city:               findAfterLabel("CITY"),
    district:           findAfterLabel("DISTRICT"),
    stateName:          findAfterLabel("STATE"),
    pincode:            findAfterLabel("PINCODE"),
    guardianName:       findAfterLabel("GUARDIAN FULL NAME"),
    guardianRelation:   findAfterLabel("RELATIONSHIP"),
    guardianPhone:      findAfterLabel("GUARDIAN MOBILE"),
    guardianEmail:      findAfterLabel("GUARDIAN EMAIL"),
    guardianOccupation: findAfterLabel("GUARDIAN OCCUPATION"),
    aadhaarNo:          findAfterLabel("AADHAAR"),
  };

  Object.keys(raw).forEach(k => { if (!raw[k]) delete raw[k]; });
  return raw;
}

// ─── component ────────────────────────────────────────────────────────────────
interface ScanFillModalProps {
  onClose: () => void;
  onApply: (results: Record<string, string>) => void;
}

type Step = "pick" | "scanning" | "review";

export function ScanFillModal({ onClose, onApply }: ScanFillModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("pick");
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [ocrError, setOcrError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState(false);

  const missingRequired = REQUIRED_KEYS.filter(k => !fields[k]?.trim());
  const filledCount = Object.values(fields).filter(v => v?.trim()).length;

  const handleFile = async (file: File) => {
    setOcrError("");
    setFileName(file.name);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setStep("scanning");
    setProgress(5);
    try {
      const extracted = await runOcr(file, setProgress);
      setFields(extracted);
      setProgress(100);
      setStep("review");
    } catch (e) {
      console.error(e);
      setOcrError("OCR failed. The image may be unclear. Try a sharper scan.");
      setStep("pick");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const handleApply = () => {
    onApply(fields);
    onClose();
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 10100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 1000,
          maxHeight: "92vh", display: "flex", flexDirection: "column",
          boxShadow: "0 32px 80px rgba(0,0,0,0.3)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #e5e7eb",
          background: "linear-gradient(135deg,#1a0540,#3b1d8a)", borderRadius: "16px 16px 0 0",
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff" }}>
              📷 Scan & Fill — Auto extract from filled form
            </h2>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#c4b5fd" }}>
              {step === "pick" && "Select or drop a scanned / photographed admission form"}
              {step === "scanning" && `Scanning "${fileName}" with OCR…`}
              {step === "review" && `${filledCount} fields extracted. Review & correct before applying.`}
            </p>
          </div>
          <button type="button" onClick={onClose}
            style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
              borderRadius: "50%", width: 32, height: 32, fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>

          {/* ── STEP: PICK ── */}
          {step === "pick" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", padding: 40 }}>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                style={{ border: `2.5px dashed ${dragging ? "#6c3ce1" : "#d1d5db"}`,
                  borderRadius: 16, padding: "48px 60px", textAlign: "center", width: "100%",
                  maxWidth: 520, background: dragging ? "#f5f3ff" : "#fafafa",
                  transition: "all 0.2s", cursor: "pointer" }}
                onClick={() => fileInputRef.current?.click()}
              >
                <div style={{ fontSize: 52, marginBottom: 12 }}>📄</div>
                <p style={{ fontSize: 17, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
                  Drop the scanned form here
                </p>
                <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
                  Accepts JPEG, PNG, WEBP images — or use the button below
                </p>
                <button type="button"
                  style={{ padding: "10px 28px", background: "#6c3ce1", color: "#fff",
                    border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600,
                    cursor: "pointer" }}>
                  📁 Browse file
                </button>
                <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 12 }}>
                  For best results: good lighting, all 4 corners visible, text in BLOCK LETTERS
                </p>
              </div>
              {ocrError && (
                <div style={{ marginTop: 16, background: "#fef2f2", border: "1px solid #fecaca",
                  borderRadius: 8, padding: "12px 16px", color: "#dc2626", fontSize: 13,
                  maxWidth: 520, width: "100%", textAlign: "center" }}>
                  ⚠ {ocrError}
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
            </div>
          )}

          {/* ── STEP: SCANNING ── */}
          {step === "scanning" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", padding: 40 }}>
              <div style={{ textAlign: "center", maxWidth: 440 }}>
                {previewUrl && (
                  <img src={previewUrl} alt="Scanning preview"
                    style={{ maxWidth: "100%", maxHeight: 260, borderRadius: 10,
                      objectFit: "contain", marginBottom: 24, border: "1px solid #e5e7eb",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }} />
                )}
                <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 10 }}>
                  🔍 Reading the form…
                </p>
                <div style={{ background: "#e9e4ff", borderRadius: 100, height: 10,
                  width: "100%", overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ background: "#6c3ce1", height: "100%", width: `${progress}%`,
                    transition: "width 0.3s ease", borderRadius: 100 }} />
                </div>
                <p style={{ fontSize: 12, color: "#6b7280" }}>{progress}% — Extracting text with OCR…</p>
              </div>
            </div>
          )}

          {/* ── STEP: REVIEW ── */}
          {step === "review" && (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

              {/* Left — scanned image */}
              <div style={{ width: 360, flexShrink: 0, borderRight: "1px solid #e5e7eb",
                background: "#f8f7ff", display: "flex", flexDirection: "column",
                alignItems: "center", padding: 16, gap: 10, overflowY: "auto" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#6b7280",
                  textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>
                  Original scan
                </p>
                <img src={previewUrl} alt="Scanned form"
                  style={{ width: "100%", borderRadius: 8, border: "1px solid #e5e7eb",
                    objectFit: "contain", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }} />
                <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center" }}>
                  {fileName}
                </p>
                <button type="button"
                  onClick={() => { setStep("pick"); setFields({}); setPreviewUrl(""); setFileName(""); }}
                  style={{ padding: "6px 14px", background: "none", border: "1px solid #d1d5db",
                    borderRadius: 6, fontSize: 12, color: "#6b7280", cursor: "pointer" }}>
                  ↩ Scan a different file
                </button>
              </div>

              {/* Right — editable extracted form */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
                <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
                  OCR extracted <strong style={{ color: "#111827" }}>{filledCount} fields</strong>.
                  Correct any mistakes — values here will fill the enrollment form.
                </p>

                {FIELD_GROUPS.map(group => (
                  <div key={group.section} style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#6c3ce1",
                        textTransform: "uppercase", letterSpacing: "0.8px", whiteSpace: "nowrap",
                        padding: "0 8px" }}>{group.section}</span>
                      <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
                      {group.fields.map(f => {
                        const val = fields[f.key] ?? "";
                        const isEmpty = !val.trim();
                        const isMissingRequired = f.required && isEmpty;
                        return (
                          <div key={f.key}
                            style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <label style={{ fontSize: 11, fontWeight: 600,
                              color: isMissingRequired ? "#dc2626" : "#374151",
                              display: "flex", alignItems: "center", gap: 4 }}>
                              {f.label}
                              {f.required && <span style={{ color: "#dc2626" }}>*</span>}
                              {f.hint && <span style={{ fontWeight: 400, color: "#9ca3af" }}>— {f.hint}</span>}
                            </label>
                            <input
                              type={f.type || "text"}
                              value={val}
                              placeholder={isEmpty ? (f.required ? "⚠ Required — fill manually" : "Not extracted") : ""}
                              onChange={e => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                              style={{
                                padding: "7px 10px",
                                border: `1.5px solid ${isMissingRequired ? "#fca5a5" : val.trim() ? "#a7f3d0" : "#e5e7eb"}`,
                                borderRadius: 6,
                                fontSize: 13,
                                fontFamily: "'Courier New', monospace",
                                fontWeight: 600,
                                color: "#111827",
                                background: isMissingRequired ? "#fff5f5" : val.trim() ? "#f0fdf4" : "#fff",
                                outline: "none",
                                width: "100%",
                                boxSizing: "border-box",
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Missing fields summary */}
                {missingRequired.length > 0 && (
                  <div style={{ marginTop: 8, background: "#fff5f5", border: "1px solid #fecaca",
                    borderRadius: 8, padding: "12px 16px" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", margin: "0 0 6px" }}>
                      ⚠ {missingRequired.length} required field{missingRequired.length > 1 ? "s" : ""} still empty:
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {missingRequired.map(k => (
                        <span key={k} style={{ background: "#fee2e2", color: "#dc2626",
                          padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                          {FIELD_LABEL_MAP[k]}
                        </span>
                      ))}
                    </div>
                    <p style={{ fontSize: 11, color: "#6b7280", margin: "8px 0 0" }}>
                      Fill these manually or apply now — you can edit them in the form.
                    </p>
                  </div>
                )}

                {filledCount === 0 && (
                  <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8,
                    padding: "14px 16px", textAlign: "center", color: "#92400e", fontSize: 13 }}>
                    ⚠ No text could be extracted. Please ensure the scan has good lighting,
                    all 4 corners are visible, and text is filled in BLOCK LETTERS.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "review" && (
          <div style={{ padding: "14px 24px", borderTop: "1px solid #e5e7eb",
            background: "#f9fafb", borderRadius: "0 0 16px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              <strong style={{ color: "#111827" }}>{filledCount}</strong> fields filled &nbsp;·&nbsp;
              <strong style={{ color: missingRequired.length > 0 ? "#dc2626" : "#10b981" }}>
                {missingRequired.length}</strong> required still empty
            </span>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={onClose}
                style={{ padding: "9px 18px", background: "#fff", border: "1px solid #d1d5db",
                  borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", color: "#374151" }}>
                Cancel
              </button>
              <button type="button" onClick={handleApply}
                style={{ padding: "9px 22px",
                  background: missingRequired.length === 0 ? "#10b981" : "#6c3ce1",
                  color: "#fff", border: "none", borderRadius: 8, fontSize: 13,
                  fontWeight: 700, cursor: "pointer" }}>
                {missingRequired.length === 0
                  ? `✓ Apply all ${filledCount} fields to form`
                  : `Apply to form (fill ${missingRequired.length} missing fields later)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
