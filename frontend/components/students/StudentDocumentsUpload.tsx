"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { ChangeEvent, DragEvent, ReactNode } from "react";

export type DocumentStatus = "idle" | "validating" | "uploading" | "success" | "error";

export interface DocumentState {
  status: DocumentStatus;
  fileName: string;
  url: string | null;
  error: string | null;
  uploadedAt: string | null;
}

export type DocumentType = "birth_certificate" | "aadhaar_card" | "medical_information" | "transfer_certificate" | "caste_certificate" | "udid_card";

export interface DocumentsUploadState {
  birth_certificate: DocumentState;
  aadhaar_card: DocumentState;
  medical_information: DocumentState;
  transfer_certificate?: DocumentState;
  caste_certificate?: DocumentState;
  udid_card?: DocumentState;
}

export interface CustomDocMeta { id: string; name: string; note: string; dueDate: string; }
export interface MarksheetMeta { id: string; name: string; }

export interface StudentDocumentsUploadProps {
  documents: DocumentsUploadState;
  onPickFile: (documentType: DocumentType, file: File) => void | Promise<void>;
  onDeleteFile?: (documentType: DocumentType) => void;
  consentChecked: boolean;
  onConsentChange: (checked: boolean) => void;
  consentError?: string | null;
  sectionCounter?: string;
  navButtonsSlot?: ReactNode;
  categoryName?: string;
  isPwD?: boolean;
  initialCustomDocs?: CustomDocMeta[];
  initialMarksheets?: MarksheetMeta[];
  onCustomDocsMetaChange?: (docs: CustomDocMeta[]) => void;
  onMarksheetMetaChange?: (sheets: MarksheetMeta[]) => void;
}

type CardSpec = { key: DocumentType; title: string; badge: { label: string; variant: "req" | "mask" | "opt" }; iconLabel: string; iconVariant: "purple" | "pill"; idleDescription: string; };

const CARDS: ReadonlyArray<CardSpec> = [
  { key: "birth_certificate", title: "Birth certificate", badge: { label: "REQUIRED", variant: "req" }, iconLabel: "BC", iconVariant: "purple", idleDescription: "Government-issued proof of date of birth. PDF, JPG, or PNG up to 5 MB." },
  { key: "aadhaar_card", title: "Aadhaar card", badge: { label: "MASKED", variant: "mask" }, iconLabel: "ID", iconVariant: "purple", idleDescription: "We store only the last 4 digits. The full number is never saved to disk or shared." },
  { key: "caste_certificate", title: "Caste certificate", badge: { label: "REQUIRED", variant: "req" }, iconLabel: "CC", iconVariant: "purple", idleDescription: "Required for the selected reserved category. PDF, JPG, or PNG up to 5 MB." },
  { key: "udid_card", title: "UDID / disability certificate", badge: { label: "REQUIRED", variant: "req" }, iconLabel: "PD", iconVariant: "purple", idleDescription: "Unique Disability ID issued by the government. PDF, JPG, or PNG up to 5 MB." },
  { key: "medical_information", title: "Medical information", badge: { label: "OPTIONAL", variant: "opt" }, iconLabel: "MR", iconVariant: "pill", idleDescription: "Allergies, ongoing conditions, emergency contact for medical decisions. Stored encrypted." },
  { key: "transfer_certificate", title: "Transfer Certificate (TC)", badge: { label: "OPTIONAL", variant: "opt" }, iconLabel: "TC", iconVariant: "purple", idleDescription: "Previous school Transfer Certificate and last attended report card. Required for lateral admissions." },
];

const EMPTY_DOC_STATE: DocumentState = { status: "idle", fileName: "", url: null, error: null, uploadedAt: null };

interface PendingEntry { enabled: boolean; dueDate: string; }
interface CustomDoc { id: string; name: string; dueDate: string; fileObj: File | null; fileName: string; uploadedAt: string | null; note: string; url?: string; }
interface MarksheetEntry { id: string; name: string; fileObj: File | null; fileName: string; url: string | null; }
interface PreviewEntry { title: string; fileObj: File; }
type DeleteConfirm = { key: string; fileName: string; isCustom: boolean; isMarksheet: boolean };

export function StudentDocumentsUpload({
  documents, onPickFile, onDeleteFile, consentChecked, onConsentChange, consentError,
  sectionCounter = "05 / 06", navButtonsSlot, categoryName, isPwD,
  initialCustomDocs, initialMarksheets, onCustomDocsMetaChange, onMarksheetMetaChange,
}: StudentDocumentsUploadProps) {
  const birthCertRef = useRef<HTMLInputElement | null>(null);
  const aadhaarRef = useRef<HTMLInputElement | null>(null);
  const medicalRef = useRef<HTMLInputElement | null>(null);
  const transferCertRef = useRef<HTMLInputElement | null>(null);
  const casteRef = useRef<HTMLInputElement | null>(null);
  const udidRef = useRef<HTMLInputElement | null>(null);

  const [localFileObjects, setLocalFileObjects] = useState<Partial<Record<DocumentType, File>>>({});
  const [pendingMap, setPendingMap] = useState<Partial<Record<DocumentType, PendingEntry>>>({});
  const [customDocs, setCustomDocs] = useState<CustomDoc[]>(() => (initialCustomDocs || []).map(d => ({ ...d, fileObj: null, fileName: "", uploadedAt: null, url: undefined })));
  const [newDocName, setNewDocName] = useState("");
  const [newDocDue, setNewDocDue] = useState("");
  const [newDocFile, setNewDocFile] = useState<File | null>(null);
  const [newDocFileName, setNewDocFileName] = useState("");
  const [newDocError, setNewDocError] = useState("");
  const newDocFileRef = useRef<HTMLInputElement | null>(null);
  const [marksheetEntries, setMarksheetEntries] = useState<MarksheetEntry[]>(() => (initialMarksheets || []).map(m => ({ ...m, fileObj: null, fileName: "", url: null })));
  const [newMarkName, setNewMarkName] = useState("");
  const [newMarkFile, setNewMarkFile] = useState<File | null>(null);
  const [newMarkFileName, setNewMarkFileName] = useState("");
  const [newMarkError, setNewMarkError] = useState("");
  const newMarkFileRef = useRef<HTMLInputElement | null>(null);
  const markReplaceRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const customReplaceRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [previewEntry, setPreviewEntry] = useState<PreviewEntry | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => { onCustomDocsMetaChange?.(customDocs.map(d => ({ id: d.id, name: d.name, note: d.note, dueDate: d.dueDate }))); }, [customDocs]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onMarksheetMetaChange?.(marksheetEntries.map(m => ({ id: m.id, name: m.name }))); }, [marksheetEntries]); // eslint-disable-line react-hooks/exhaustive-deps

  const normalizedCategory = String(categoryName || "").trim().toLowerCase();
  const showCaste = !!normalizedCategory && normalizedCategory !== "general";
  const showUdid = !!isPwD;
  const visibleCards = CARDS.filter((c) => { if (c.key === "caste_certificate") return showCaste; if (c.key === "udid_card") return showUdid; return true; });
  const stateOf = (key: DocumentType): DocumentState => documents[key] ?? EMPTY_DOC_STATE;
  const todayISO = new Date().toISOString().slice(0, 10);
  const maxDueISO = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const refFor = (key: DocumentType) => { if (key === "birth_certificate") return birthCertRef; if (key === "aadhaar_card") return aadhaarRef; if (key === "caste_certificate") return casteRef; if (key === "udid_card") return udidRef; if (key === "transfer_certificate") return transferCertRef; return medicalRef; };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>, documentType: DocumentType) => {
    const file = e.target.files?.[0];
    if (file) { setLocalFileObjects((prev) => ({ ...prev, [documentType]: file })); try { await onPickFile(documentType, file); } catch { /* parent handles */ } }
    e.target.value = "";
  };
  const handleDragOver = useCallback((e: DragEvent<HTMLElement>) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);
  const handleDrop = useCallback(async (e: DragEvent<HTMLElement>) => {
    e.preventDefault(); setIsDragOver(false);
    const file = e.dataTransfer.files?.[0]; if (!file) return;
    const firstEmpty = visibleCards.find((c) => stateOf(c.key).status === "idle"); if (!firstEmpty) return;
    setLocalFileObjects((prev) => ({ ...prev, [firstEmpty.key]: file }));
    try { await onPickFile(firstEmpty.key, file); } catch { /* parent handles */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCards, documents]);

  const confirmDelete = (key: string, fileName: string, isCustom: boolean, isMarksheet = false) => setDeleteConfirm({ key, fileName, isCustom, isMarksheet });
  const executeDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.isMarksheet) { setMarksheetEntries(prev => prev.filter(m => m.id !== deleteConfirm.key)); }
    else if (deleteConfirm.isCustom) { setCustomDocs(prev => prev.filter(d => d.id !== deleteConfirm.key)); }
    else { const docKey = deleteConfirm.key as DocumentType; setLocalFileObjects((prev) => { const next = { ...prev }; delete next[docKey]; return next; }); onDeleteFile?.(docKey); }
    setDeleteConfirm(null);
  };
  const togglePending = (key: DocumentType) => setPendingMap(prev => ({ ...prev, [key]: { enabled: !(prev[key]?.enabled ?? false), dueDate: prev[key]?.dueDate ?? "" } }));
  const setPendingDue = (key: DocumentType, val: string) => setPendingMap(prev => ({ ...prev, [key]: { ...(prev[key] ?? { enabled: true }), dueDate: val } }));

  const addCustomDoc = () => {
    if (!newDocName.trim()) { setNewDocError("Please enter a document name."); return; }
    if (customDocs.length >= 10) { setNewDocError("Maximum 10 custom documents allowed."); return; }
    setNewDocError("");
    const id = "custom-" + Date.now();
    setCustomDocs(prev => [...prev, { id, name: newDocName.trim(), dueDate: newDocDue, fileObj: newDocFile, fileName: newDocFileName, uploadedAt: newDocFile ? new Date().toLocaleString("en-IN") : null, note: "", url: newDocFile ? URL.createObjectURL(newDocFile) : undefined }]);
    setNewDocName(""); setNewDocDue(""); setNewDocFile(null); setNewDocFileName("");
    if (newDocFileRef.current) newDocFileRef.current.value = "";
  };
  const addMarksheet = () => {
    if (!newMarkName.trim()) { setNewMarkError("Please enter a name for this marksheet."); return; }
    if (marksheetEntries.length >= 10) { setNewMarkError("Maximum 10 marksheets allowed."); return; }
    setNewMarkError("");
    const id = "mark-" + Date.now();
    setMarksheetEntries(prev => [...prev, { id, name: newMarkName.trim(), fileObj: newMarkFile, fileName: newMarkFileName, url: newMarkFile ? URL.createObjectURL(newMarkFile) : null }]);
    setNewMarkName(""); setNewMarkFile(null); setNewMarkFileName("");
    if (newMarkFileRef.current) newMarkFileRef.current.value = "";
  };
  const replaceMarksheet = (id: string, file: File | null) => { if (!file) return; setMarksheetEntries(prev => prev.map(m => m.id === id ? { ...m, fileObj: file, fileName: file.name, url: URL.createObjectURL(file) } : m)); };
  const replaceCustomDoc = (id: string, file: File | null) => { if (!file) return; setCustomDocs(prev => prev.map(d => d.id === id ? { ...d, fileObj: file, fileName: file.name, url: URL.createObjectURL(file), uploadedAt: new Date().toLocaleString("en-IN") } : d)); };

  const stateClass = (state: DocumentState) => state.status === "success" ? "is-success" : state.status === "error" ? "is-error" : state.status === "uploading" ? "is-uploading" : "";
  const iconContent = (state: DocumentState, fallbackLabel: string) => state.status === "success" ? "v" : state.status === "error" ? "x" : fallbackLabel;
  const actionLabel = (state: DocumentState) => state.status === "uploading" ? "Uploading..." : state.status === "success" ? "Replace" : "Upload file";

  return (
    <section className={`doc-shell${isDragOver ? " drag-over" : ""}`} id="documents" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <header className="doc-header">
        <div className="doc-header-text">
          <h2 className="doc-title">Upload <em className="doc-title-em">documents</em></h2>
          <p className="doc-subtitle">Upload the documents your school needs on file. Some appear only when relevant.</p>
        </div>
        <span className="doc-counter">{sectionCounter}</span>
      </header>

      {visibleCards.map((spec) => (
        <input key={`input-${spec.key}`} type="file" ref={refFor(spec.key)} className="doc-hidden-input" title={`${spec.title} file input`} accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleFileChange(e, spec.key)} />
      ))}

      <div className="doc-grid">
        {visibleCards.map((spec) => {
          const state = stateOf(spec.key);
          const pending = pendingMap[spec.key];
          const localFile = localFileObjects[spec.key];
          const isUploading = state.status === "uploading";
          return (
            <article key={spec.key} className={`doc-card ${stateClass(state)}`.trim()} tabIndex={0}
              onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !isUploading && e.target === e.currentTarget) { e.preventDefault(); refFor(spec.key).current?.click(); } }}>
              <div className="doc-card-top">
                <div className="doc-card-row">
                  <span className={`doc-icon doc-icon-${spec.iconVariant}`}>{iconContent(state, spec.iconLabel)}</span>
                  <span className={`doc-badge doc-badge-${spec.badge.variant}`}>{spec.badge.label}</span>
                </div>
                <h3 className="doc-card-title">{spec.title}</h3>
                <div className="doc-card-body">
                  {state.status === "success" ? (
                    <><p className="doc-status-ok">Uploaded</p>
                    {state.fileName && <p className="doc-status-filename">{state.fileName}</p>}
                    {state.uploadedAt && <p className="doc-status-ts">{state.uploadedAt}</p>}</>
                  ) : state.status === "error" ? (
                    <><p className="doc-status-bad">Upload failed</p>{state.error && <p className="doc-status-error-detail">{state.error}</p>}</>
                  ) : state.status === "uploading" ? (
                    <><p className="doc-status-run">Uploading...</p><div className="upload-progress"><div className="upload-progress-bar" /></div></>
                  ) : (
                    <p className="doc-card-desc">{spec.idleDescription}</p>
                  )}
                </div>
              </div>
              <div className="doc-actions-row">
                <button type="button" className="doc-action" onClick={() => refFor(spec.key).current?.click()} disabled={isUploading}>{actionLabel(state)}</button>
                {state.status === "success" && localFile && (
                  <button type="button" className="doc-icon-btn" title="Preview" onClick={() => setPreviewEntry({ title: spec.title, fileObj: localFile })}>Preview</button>
                )}
                {state.status === "success" && state.url && !localFile && (
                  <a href={state.url} target="_blank" rel="noopener noreferrer" className="doc-icon-btn">Preview</a>
                )}
                {state.status === "success" && (
                  <button type="button" className="doc-icon-btn doc-icon-btn-danger" title="Delete" onClick={() => confirmDelete(spec.key, state.fileName || spec.title, false)}>Delete</button>
                )}
              </div>
              <div className="doc-pending-row">
                <label className="doc-pending-label"><input type="checkbox" checked={pending?.enabled ?? false} onChange={() => togglePending(spec.key)} className="doc-pending-check" />Mark as pending</label>
                {pending?.enabled && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <label style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Expected submission by</label>
                    <input type="date" className="doc-pending-date" value={pending.dueDate} min={todayISO} max={maxDueISO} onChange={(e) => setPendingDue(spec.key, e.target.value)} />
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Section 1: Previous Academic Marksheets */}
      <div className="doc-subsection">
        <h4 className="doc-subsection-title">Previous Academic Marksheets</h4>
        <p className="doc-subsection-note">Upload previous year marksheets or report cards (PDF or image, max 10)</p>
        {marksheetEntries.length < 10 && (
          <div className="doc-add-row">
            <input type="text" className="doc-add-input" placeholder="e.g. Class 5 Report Card, Annual Marksheet 2023"
              value={newMarkName} onChange={(e) => { setNewMarkName(e.target.value); if (newMarkError) setNewMarkError(""); }} />
            <button type="button" className="doc-pick-btn" onClick={() => newMarkFileRef.current?.click()}>
              {newMarkFileName ? newMarkFileName.slice(0, 20) + (newMarkFileName.length > 20 ? "..." : "") : "Choose file"}
            </button>
            <input ref={newMarkFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setNewMarkFile(f); setNewMarkFileName(f.name); } e.target.value = ""; }} />
            <button type="button" className="doc-add-btn" onClick={addMarksheet}>+ Add</button>
          </div>
        )}
        {newMarkError && <p className="doc-err-msg">{newMarkError}</p>}
        {marksheetEntries.length > 0 && (
          <div className="doc-file-list">
            {marksheetEntries.map((entry) => (
              <div key={entry.id} className="doc-file-row">
                <span className="doc-file-icon">PDF</span>
                <div className="doc-file-info">
                  <span className="doc-file-name">{entry.name}</span>
                  {entry.fileName ? <span className="doc-file-fname">{entry.fileName}</span> : <span className="doc-file-fname doc-file-fname-warn">No file attached</span>}
                </div>
                <div className="doc-file-actions">
                  {entry.fileObj && <button type="button" className="doc-act-btn" onClick={() => setPreviewEntry({ title: entry.name, fileObj: entry.fileObj! })}>Preview</button>}
                  <input ref={(el) => { markReplaceRefs.current[entry.id] = el; }} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { replaceMarksheet(entry.id, e.target.files?.[0] || null); e.target.value = ""; }} />
                  <button type="button" className="doc-act-btn" onClick={() => markReplaceRefs.current[entry.id]?.click()}>{entry.fileName ? "Replace" : "Upload"}</button>
                  <button type="button" className="doc-act-btn doc-act-danger" onClick={() => confirmDelete(entry.id, entry.name, false, true)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Custom Documents */}
      <div className="doc-subsection">
        <h4 className="doc-subsection-title">Custom Documents</h4>
        <p className="doc-subsection-note">Add any additional documents required by your school (max 10)</p>
        {customDocs.length < 10 && (
          <div className="doc-add-row">
            <input type="text" className="doc-add-input" placeholder="Document name (e.g. Bonafide Certificate)"
              value={newDocName} onChange={(e) => { setNewDocName(e.target.value); if (newDocError) setNewDocError(""); }} />
            <button type="button" className="doc-pick-btn" onClick={() => newDocFileRef.current?.click()}>
              {newDocFileName ? newDocFileName.slice(0, 20) + (newDocFileName.length > 20 ? "..." : "") : "Choose file"}
            </button>
            <input ref={newDocFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setNewDocFile(f); setNewDocFileName(f.name); } e.target.value = ""; }} />
            <button type="button" className="doc-add-btn" onClick={addCustomDoc}>+ Add</button>
          </div>
        )}
        {newDocError && <p className="doc-err-msg">{newDocError}</p>}
        {customDocs.length > 0 && (
          <div className="doc-file-list">
            {customDocs.map((doc) => (
              <div key={doc.id} className="doc-file-row">
                <span className="doc-file-icon">DOC</span>
                <div className="doc-file-info">
                  <span className="doc-file-name">{doc.name}</span>
                  {doc.fileName ? <span className="doc-file-fname">{doc.fileName}</span> : <span className="doc-file-fname doc-file-fname-warn">No file attached</span>}
                </div>
                <div className="doc-file-actions">
                  {doc.fileObj && <button type="button" className="doc-act-btn" onClick={() => setPreviewEntry({ title: doc.name, fileObj: doc.fileObj! })}>Preview</button>}
                  <input ref={(el) => { customReplaceRefs.current[doc.id] = el; }} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { replaceCustomDoc(doc.id, e.target.files?.[0] || null); e.target.value = ""; }} />
                  <button type="button" className="doc-act-btn" onClick={() => customReplaceRefs.current[doc.id]?.click()}>{doc.fileName ? "Replace" : "Upload"}</button>
                  <button type="button" className="doc-act-btn doc-act-danger" onClick={() => confirmDelete(doc.id, doc.name, true)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="doc-callout doc-rte">
        <span className="doc-rte-icon" aria-hidden="true">i</span>
        <div>
          <h4 className="doc-rte-title">RTE Act 2009 compliance</h4>
          <p className="doc-rte-text">Students admitted under the 25% EWS/DG quota must have their income or caste certificate verified within 30 days. All personal data is stored per the Digital Personal Data Protection Act, 2023 and is never shared with third parties without parental consent. <a href="#" className="doc-rte-link">Read our data policy</a></p>
        </div>
      </div>

      <div className="doc-callout doc-consent">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <input type="checkbox" id="consent-checkbox" checked={consentChecked} onChange={(e) => { e.stopPropagation(); onConsentChange(e.target.checked); }} onClick={(e) => e.stopPropagation()} style={{ cursor: "pointer", width: 16, height: 16, accentColor: "#6c3ce1", marginTop: 3, flexShrink: 0 }} />
          <div>
            <label htmlFor="consent-checkbox" style={{ cursor: "pointer" }}>
              <div className="doc-consent-title">Parent / Guardian consent <span style={{ color: "#dc2626", fontWeight: 700 }}>*</span></div>
            </label>
            <p className="doc-consent-text">I confirm that the student&apos;s parent or legal guardian has authorized me to submit these documents and has consented to their storage for school records, admissions, fee management, and legally required reporting. I understand that withdrawing consent requires a written request.</p>
          </div>
        </div>
        {consentError ? <p className="doc-error-msg">{consentError}</p> : null}
      </div>

      {navButtonsSlot}

      {deleteConfirm && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Remove document?</div>
            <p className="modal-body">Are you sure you want to remove <strong>{deleteConfirm.fileName}</strong>? This cannot be undone.</p>
            <div className="modal-actions">
              <button type="button" className="modal-cancel" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button type="button" className="modal-confirm" onClick={executeDelete}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {previewEntry && (
        <div className="doc-preview-backdrop" onClick={() => setPreviewEntry(null)}>
          <aside className="doc-preview-panel doc-preview-open" onClick={(e) => e.stopPropagation()}>
            <div className="doc-preview-header">
              <span className="doc-preview-title">{previewEntry.title}</span>
              <button type="button" className="doc-preview-close" onClick={() => setPreviewEntry(null)}>x</button>
            </div>
            <div className="doc-preview-body">
              {previewEntry.fileObj.type.startsWith("image/") ? (
                <img src={URL.createObjectURL(previewEntry.fileObj)} alt={previewEntry.title} className="doc-preview-img" />
              ) : (
                <iframe src={URL.createObjectURL(previewEntry.fileObj)} title={previewEntry.title} className="doc-preview-iframe" />
              )}
            </div>
          </aside>
        </div>
      )}

      <style jsx>{`
        .doc-shell { background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:32px; font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; color:#111827; }
        .doc-shell.drag-over { outline:2px dashed #6c3ce1; background:rgba(91,79,232,.03); }
        .doc-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:28px; }
        .doc-header-text { flex:1; min-width:0; }
        .doc-title { margin:0; font-size:28px; font-weight:700; line-height:1.15; letter-spacing:-0.015em; color:#111827; }
        .doc-title-em { color:#5b3df5; font-style:italic; font-weight:400; }
        .doc-subtitle { margin:8px 0 0; font-size:14px; color:#6b7280; line-height:1.5; max-width:68ch; }
        .doc-counter { font-size:13px; color:#9ca3af; white-space:nowrap; padding-top:6px; }
        .doc-hidden-input { display:none; }
        .doc-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:20px; margin-bottom:16px; }
        .doc-card { display:flex; flex-direction:column; gap:12px; min-height:176px; padding:20px 22px; background:#fff; border:1px solid #e7eaf1; border-radius:20px; transition:border-color 180ms,box-shadow 180ms,transform 180ms; }
        .doc-card:hover { border-color:#c7bcfb; box-shadow:0 0 0 4px rgba(91,61,245,.06),0 8px 20px rgba(17,24,39,.05); transform:translateY(-1px); }
        .doc-card-top { display:flex; flex-direction:column; gap:10px; flex:1; }
        .doc-card-row { display:flex; justify-content:space-between; align-items:center; gap:12px; }
        .doc-icon { width:40px; height:40px; border-radius:10px; display:inline-flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; flex-shrink:0; letter-spacing:0.02em; }
        .doc-icon-purple { background:#f3eeff; color:#5b3df5; }
        .doc-icon-pill { background:#fdeff0; color:#be123c; }
        .doc-badge { display:inline-flex; align-items:center; padding:4px 10px; border-radius:999px; font-size:10.5px; font-weight:600; letter-spacing:0.6px; text-transform:uppercase; white-space:nowrap; }
        .doc-badge-req { background:#fee2e2; color:#b91c1c; }
        .doc-badge-mask { background:#ffedd5; color:#9a3412; }
        .doc-badge-opt { background:#f3f4f6; color:#6b7280; }
        .doc-card-title { margin:0; font-size:16px; font-weight:700; color:#111827; }
        .doc-card-body { display:flex; flex-direction:column; gap:4px; }
        .doc-card-desc { margin:0; font-size:14px; color:#6b7280; line-height:1.5; }
        .doc-status-ok { margin:0; font-size:14px; color:#047857; font-weight:600; }
        .doc-status-filename { margin:0; font-size:13px; color:#047857; font-weight:500; word-break:break-word; }
        .doc-status-ts { margin:0; font-size:11px; color:#6b7280; }
        .doc-status-bad { margin:0; font-size:14px; color:#b91c1c; font-weight:600; }
        .doc-status-error-detail { margin:0; font-size:13px; color:#7f1d1d; word-break:break-word; }
        .doc-status-run { margin:0; font-size:14px; color:#1d4ed8; font-weight:600; }
        .upload-progress { width:100%; height:4px; background:#dbeafe; border-radius:999px; overflow:hidden; margin-top:4px; }
        .upload-progress-bar { height:100%; width:60%; background:#3b82f6; border-radius:999px; animation:doc-progress 1.4s ease-in-out infinite; }
        @keyframes doc-progress { 0%{transform:translateX(-100%)} 100%{transform:translateX(220%)} }
        .doc-actions-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .doc-action { display:inline-flex; align-items:center; gap:6px; padding:0; border:none; background:transparent; color:#5b3df5; cursor:pointer; font-size:13px; font-weight:500; font-family:inherit; }
        .doc-action:hover:not(:disabled) { color:#4c33e6; text-decoration:underline; }
        .doc-action:disabled { cursor:not-allowed; opacity:0.7; }
        .doc-icon-btn { border:1px solid #e5e7eb; background:#fff; cursor:pointer; font-size:12px; padding:4px 10px; border-radius:6px; color:#374151; font-family:inherit; transition:background 120ms; display:inline-flex; align-items:center; gap:3px; text-decoration:none; }
        .doc-icon-btn:hover { background:#f9fafb; border-color:#9ca3af; }
        .doc-icon-btn-danger:hover { background:#fee2e2; border-color:#fca5a5; color:#b91c1c; }
        .doc-pending-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:2px; }
        .doc-pending-label { display:flex; align-items:center; gap:6px; font-size:12px; color:#6b7280; cursor:pointer; user-select:none; }
        .doc-pending-check { width:14px; height:14px; accent-color:#5b3df5; cursor:pointer; flex-shrink:0; }
        .doc-pending-date { font-size:12px; padding:4px 8px; border:1px solid #d1d5db; border-radius:6px; color:#374151; background:#fff; }
        .doc-card.is-success { background:#ecfdf5; border-color:#a7f3d0; }
        .doc-card.is-success .doc-icon { background:#10b981; color:#fff; }
        .doc-card.is-success .doc-action { color:#059669; }
        .doc-card.is-error { background:#fef2f2; border-color:#fca5a5; }
        .doc-card.is-error .doc-icon { background:#dc2626; color:#fff; }
        .doc-card.is-error .doc-action { color:#dc2626; }
        .doc-card.is-uploading { background:#eff6ff; border-color:#93c5fd; }
        .doc-card.is-uploading .doc-icon { background:#3b82f6; color:#fff; animation:doc-spin 1s linear infinite; }
        @keyframes doc-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .doc-subsection { margin:24px 0 0; padding:18px 20px; background:#f8f7ff; border-radius:12px; border:1px solid #e9e4ff; }
        .doc-subsection-title { font-size:15px; font-weight:700; color:#1f2937; margin:0 0 3px; }
        .doc-subsection-note { font-size:12px; color:#6b7280; margin:0 0 14px; }
        .doc-add-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .doc-add-input { flex:1; min-width:160px; padding:8px 12px; border:1px solid #d1d5db; border-radius:8px; font-size:13px; color:#111827; background:#fff; font-family:inherit; }
        .doc-add-input:focus { outline:none; border-color:#6c3ce1; box-shadow:0 0 0 3px rgba(108,60,225,.08); }
        .doc-pick-btn { padding:8px 12px; border:1px solid #d1d5db; border-radius:8px; background:#fff; color:#374151; font-size:12px; font-weight:500; cursor:pointer; white-space:nowrap; font-family:inherit; max-width:200px; overflow:hidden; text-overflow:ellipsis; }
        .doc-pick-btn:hover { background:#f9fafb; border-color:#9ca3af; }
        .doc-add-btn { padding:8px 16px; border:1px solid #6c3ce1; border-radius:8px; background:#6c3ce1; color:#fff; cursor:pointer; font-size:13px; font-weight:600; white-space:nowrap; font-family:inherit; flex-shrink:0; }
        .doc-add-btn:hover { background:#5a2ee0; }
        .doc-err-msg { color:#dc2626; font-size:12px; margin:6px 0 0; }
        .doc-file-list { display:flex; flex-direction:column; gap:8px; margin-top:14px; }
        .doc-file-row { display:flex; align-items:center; gap:10px; padding:10px 14px; background:#fff; border:1px solid #e5e7eb; border-radius:10px; flex-wrap:wrap; }
        .doc-file-icon { background:#ede9fe; color:#6c3ce1; width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:700; flex-shrink:0; letter-spacing:0.02em; }
        .doc-file-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
        .doc-file-name { font-size:13px; font-weight:600; color:#111827; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .doc-file-fname { font-size:11px; color:#6b7280; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .doc-file-fname-warn { color:#d97706; }
        .doc-file-actions { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
        .doc-act-btn { padding:5px 12px; border:1px solid #e5e7eb; border-radius:6px; background:#fff; color:#374151; font-size:11px; font-weight:500; cursor:pointer; font-family:inherit; white-space:nowrap; transition:background 120ms; }
        .doc-act-btn:hover { background:#f9fafb; border-color:#9ca3af; }
        .doc-act-danger:hover { background:#fee2e2; border-color:#fca5a5; color:#b91c1c; }
        .doc-callout { margin-top:20px; padding:18px 22px; border-radius:16px; display:flex; gap:14px; align-items:flex-start; }
        .doc-rte { background:#fffbeb; border:1px solid #fde68a; }
        .doc-rte-icon { width:28px; height:28px; background:#f59e0b; color:#fff; border-radius:999px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; flex-shrink:0; margin-top:2px; }
        .doc-rte-title { margin:0 0 6px; font-size:14px; font-weight:600; color:#92400e; }
        .doc-rte-text { margin:0; font-size:13px; color:#78350f; line-height:1.6; }
        .doc-rte-link { color:#b45309; text-decoration:underline; font-weight:500; }
        .doc-consent { background:#f7f5ff; border:1px solid #c4b5fd; }
        .doc-consent-title { margin:0 0 6px; font-size:14px; font-weight:600; color:#111827; }
        .doc-consent-text { margin:0; font-size:13px; color:#4b5563; line-height:1.6; }
        .doc-error-msg { font-size:12px; color:#dc2626; margin:8px 0 0; }
        .doc-preview-backdrop { position:fixed; inset:0; z-index:849; background:rgba(15,23,42,.3); }
        .doc-preview-panel { position:fixed; top:0; right:0; bottom:0; width:min(720px,90vw); background:#fff; z-index:850; box-shadow:-12px 0 32px rgba(15,23,42,.12); display:flex; flex-direction:column; transform:translateX(100%); transition:transform 240ms ease; }
        .doc-preview-panel.doc-preview-open { transform:translateX(0); }
        .doc-preview-header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid #e5e7eb; }
        .doc-preview-title { font-size:15px; font-weight:600; color:#111827; }
        .doc-preview-close { width:32px; height:32px; border-radius:8px; border:1px solid #d1d5db; background:#fff; cursor:pointer; font-size:14px; }
        .doc-preview-body { flex:1; overflow:auto; display:flex; align-items:center; justify-content:center; padding:16px; background:#f8fafc; }
        .doc-preview-img { max-width:100%; max-height:100%; object-fit:contain; border-radius:8px; }
        .doc-preview-iframe { width:100%; height:100%; border:none; border-radius:8px; min-height:60vh; }
        .modal-backdrop { position:fixed; inset:0; z-index:1000; background:rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; padding:20px; }
        .modal-box { background:#fff; border-radius:16px; padding:28px 32px; max-width:420px; width:100%; box-shadow:0 20px 60px rgba(0,0,0,0.25); text-align:center; }
        .modal-title { font-size:18px; font-weight:700; color:#111827; margin:0 0 10px; }
        .modal-body { font-size:14px; color:#6b7280; margin:0 0 20px; line-height:1.6; }
        .modal-actions { display:flex; justify-content:center; gap:10px; }
        .modal-cancel { padding:9px 22px; border:1px solid #d1d5db; border-radius:8px; background:#fff; color:#374151; font-size:14px; font-weight:500; cursor:pointer; font-family:inherit; }
        .modal-cancel:hover { background:#f9fafb; border-color:#9ca3af; }
        .modal-confirm { padding:9px 22px; border:1px solid #dc2626; border-radius:8px; background:#dc2626; color:#fff; font-size:14px; font-weight:600; cursor:pointer; font-family:inherit; }
        .modal-confirm:hover { background:#b91c1c; }
        @media (max-width:768px) {
          .doc-shell { padding:20px; border-radius:14px; }
          .doc-grid { grid-template-columns:1fr; gap:14px; }
          .doc-add-row { flex-direction:column; }
          .doc-add-input,.doc-pick-btn,.doc-add-btn { width:100%; max-width:none; }
        }
      `}</style>
    </section>
  );
}

export default StudentDocumentsUpload;
