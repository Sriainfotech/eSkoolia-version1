"use client";

import { useRef, useState, useCallback } from "react";
import type { ChangeEvent, DragEvent, ReactNode } from "react";

export type DocumentStatus = "idle" | "validating" | "uploading" | "success" | "error";

export interface DocumentState {
  status: DocumentStatus;
  fileName: string;
  url: string | null;
  error: string | null;
  uploadedAt: string | null;
}

export type DocumentType = "birth_certificate" | "aadhaar_card" | "medical_information" | "caste_certificate" | "udid_card";

export interface DocumentsUploadState {
  birth_certificate: DocumentState;
  aadhaar_card: DocumentState;
  medical_information: DocumentState;
  caste_certificate?: DocumentState;
  udid_card?: DocumentState;
}

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
}

type CardSpec = {
  key: DocumentType;
  title: string;
  badge: { label: string; variant: "req" | "mask" | "opt" };
  iconGlyph: string;
  iconVariant: "purple" | "pill";
  idleDescription: string;
};

const CARDS: ReadonlyArray<CardSpec> = [
  {
    key: "birth_certificate",
    title: "Birth certificate",
    badge: { label: "REQUIRED", variant: "req" },
    iconGlyph: "📋",
    iconVariant: "purple",
    idleDescription: "Government-issued proof of date of birth. PDF, JPG, or PNG up to 5 MB.",
  },
  {
    key: "aadhaar_card",
    title: "Aadhaar card",
    badge: { label: "MASKED", variant: "mask" },
    iconGlyph: "🆔",
    iconVariant: "purple",
    idleDescription: "We store only the last 4 digits. The full number is never saved to disk or shared.",
  },
  {
    key: "caste_certificate",
    title: "Caste certificate",
    badge: { label: "REQUIRED", variant: "req" },
    iconGlyph: "📜",
    iconVariant: "purple",
    idleDescription: "Required for the selected reserved category. PDF, JPG, or PNG up to 5 MB.",
  },
  {
    key: "udid_card",
    title: "UDID / disability certificate",
    badge: { label: "REQUIRED", variant: "req" },
    iconGlyph: "♿",
    iconVariant: "purple",
    idleDescription: "Unique Disability ID issued by the government. PDF, JPG, or PNG up to 5 MB.",
  },
  {
    key: "medical_information",
    title: "Medical information",
    badge: { label: "OPTIONAL", variant: "opt" },
    iconGlyph: "💊",
    iconVariant: "pill",
    idleDescription: "Allergies, ongoing conditions, emergency contact for medical decisions. Stored encrypted.",
  },
];

const EMPTY_DOC_STATE: DocumentState = { status: "idle", fileName: "", url: null, error: null, uploadedAt: null };

interface PendingEntry {
  enabled: boolean;
  dueDate: string;
}

interface CustomDoc {
  id: string;
  name: string;
  dueDate: string;
  fileObj: File | null;
  fileName: string;
  uploadedAt: string | null;
  note?: string;
  url?: string;
}

interface PreviewEntry {
  title: string;
  fileObj: File;
}

type DeleteConfirm = { key: DocumentType | string; fileName: string; isCustom: boolean };

export function StudentDocumentsUpload({
  documents,
  onPickFile,
  onDeleteFile,
  consentChecked,
  onConsentChange,
  consentError,
  sectionCounter = "05 / 06",
  navButtonsSlot,
  categoryName,
  isPwD,
}: StudentDocumentsUploadProps) {
  const birthCertRef = useRef<HTMLInputElement | null>(null);
  const aadhaarRef = useRef<HTMLInputElement | null>(null);
  const medicalRef = useRef<HTMLInputElement | null>(null);
  const casteRef = useRef<HTMLInputElement | null>(null);
  const udidRef = useRef<HTMLInputElement | null>(null);

  const [localFileObjects, setLocalFileObjects] = useState<Partial<Record<DocumentType, File>>>({});
  const [pendingMap, setPendingMap] = useState<Partial<Record<DocumentType, PendingEntry>>>({});
  const [customDocs, setCustomDocs] = useState<CustomDoc[]>([]);
  const [newDocName, setNewDocName] = useState("");
  const [newDocDue, setNewDocDue] = useState("");
  const [newDocError, setNewDocError] = useState("");
  const [previewEntry, setPreviewEntry] = useState<PreviewEntry | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const customFileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [marksheetFiles, setMarksheetFiles] = useState<File[]>([]);
  const [marksheetPreviews, setMarksheetPreviews] = useState<string[]>([]);

  /* B11 conditionals */
  const normalizedCategory = String(categoryName || "").trim().toLowerCase();
  const showCaste = !!normalizedCategory && normalizedCategory !== "general";
  const showUdid = !!isPwD;
  const visibleCards = CARDS.filter((c) => {
    if (c.key === "caste_certificate") return showCaste;
    if (c.key === "udid_card") return showUdid;
    return true;
  });

  const stateOf = (key: DocumentType): DocumentState => documents[key] ?? EMPTY_DOC_STATE;

  const refFor = (key: DocumentType) => {
    if (key === "birth_certificate") return birthCertRef;
    if (key === "aadhaar_card") return aadhaarRef;
    if (key === "caste_certificate") return casteRef;
    if (key === "udid_card") return udidRef;
    return medicalRef;
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>, documentType: DocumentType) => {
    const file = e.target.files?.[0];
    if (file) {
      setLocalFileObjects((prev) => ({ ...prev, [documentType]: file }));
      try {
        await onPickFile(documentType, file);
      } catch {
        /* parent surfaces errors via toast */
      }
    }
    e.target.value = "";
  };

  const handleDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      const firstEmpty = visibleCards.find((c) => stateOf(c.key).status === "idle");
      if (!firstEmpty) return;
      const docType = firstEmpty.key;
      setLocalFileObjects((prev) => ({ ...prev, [docType]: file }));
      try {
        await onPickFile(docType, file);
      } catch { /* parent surfaces */ }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleCards, documents]
  );

  const confirmDelete = (key: DocumentType | string, fileName: string, isCustom: boolean) => {
    setDeleteConfirm({ key, fileName, isCustom });
  };

  const executeDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.isCustom) {
      setCustomDocs((prev) => prev.filter((d) => d.id !== deleteConfirm.key));
    } else {
      const docKey = deleteConfirm.key as DocumentType;
      setLocalFileObjects((prev) => { const next = { ...prev }; delete next[docKey]; return next; });
      onDeleteFile?.(docKey);
    }
    setDeleteConfirm(null);
  };

  const togglePending = (key: DocumentType) => {
    setPendingMap((prev) => ({
      ...prev,
      [key]: { enabled: !(prev[key]?.enabled ?? false), dueDate: prev[key]?.dueDate ?? "" },
    }));
  };

  const setPendingDue = (key: DocumentType, val: string) => {
    setPendingMap((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { enabled: true }), dueDate: val },
    }));
  };

  const addCustomDoc = () => {
    if (!newDocName.trim()) { setNewDocError('Please enter a document name.'); return; }
    if (customDocs.length >= 10) { setNewDocError('Maximum 10 custom documents allowed.'); return; }
    setNewDocError('');
    setCustomDocs((prev) => [
      ...prev,
      { id: `custom-${Date.now()}`, name: newDocName.trim(), dueDate: newDocDue, fileObj: null, fileName: "", uploadedAt: null, note: '' },
    ]);
    setNewDocName("");
    setNewDocDue("");
  };

  const updateCustomDoc = (id: string, field: 'name' | 'note', value: string) => {
    setCustomDocs(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const setCustomDocFile = (id: string, file: File | null) => {
    setCustomDocs(prev => prev.map(d => d.id === id ? { ...d, fileObj: file, fileName: file?.name || '', url: file ? URL.createObjectURL(file) : undefined, uploadedAt: file ? new Date().toLocaleString() : null } : d));
  };

  const addMarksheets = (files: FileList) => {
    const arr = Array.from(files);
    const combined = [...marksheetFiles, ...arr].slice(0, 10);
    setMarksheetFiles(combined);
    setMarksheetPreviews(combined.map(f => URL.createObjectURL(f)));
  };

  const removeMarksheet = (idx: number) => {
    setMarksheetFiles(prev => prev.filter((_, i) => i !== idx));
    setMarksheetPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCustomFileChange = (e: ChangeEvent<HTMLInputElement>, docId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCustomDocFile(docId, file);
    e.target.value = "";
  };

  const stateClass = (state: DocumentState) =>
    state.status === "success" ? "is-success"
    : state.status === "error" ? "is-error"
    : state.status === "uploading" ? "is-uploading"
    : "";

  const iconContent = (state: DocumentState, fallbackGlyph: string) => {
    if (state.status === "success") return "✓";
    if (state.status === "error") return "✗";
    if (state.status === "uploading") return "⟳";
    return fallbackGlyph;
  };

  const actionLabel = (state: DocumentState) => {
    if (state.status === "uploading") return "⏳ Uploading…";
    if (state.status === "success") return "↩ Replace";
    return "↑ Upload file";
  };

  return (
    <section
      className={`doc-shell${isDragOver ? " drag-over" : ""}`}
      id="documents"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className="doc-header">
        <div className="doc-header-text">
          <h2 className="doc-title">
            Upload <em className="doc-title-em">documents</em>
          </h2>
          <p className="doc-subtitle">
            Upload the documents your school needs on file. Some appear only when relevant — for example,
            caste certificate shows up if you picked a reserved category.
          </p>
        </div>
        <span className="doc-counter">{sectionCounter}</span>
      </header>

      {visibleCards.map((spec) => (
        <input
          key={`input-${spec.key}`}
          type="file"
          ref={refFor(spec.key)}
          className="doc-hidden-input"
          title={`${spec.title} file input`}
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => handleFileChange(e, spec.key)}
        />
      ))}

      <div className="doc-grid">
        {visibleCards.map((spec) => {
          const state = stateOf(spec.key);
          const pending = pendingMap[spec.key];
          const localFile = localFileObjects[spec.key];
          const isUploading = state.status === "uploading";
          const isDeleting = deleteConfirm?.key === spec.key && !deleteConfirm.isCustom;

          return (
            <article
              key={spec.key}
              className={`doc-card ${stateClass(state)}`.trim()}
              tabIndex={0}
              onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isUploading && e.target === e.currentTarget) { e.preventDefault(); refFor(spec.key).current?.click(); } }}
            >
              <div className="doc-card-top">
                <div className="doc-card-row">
                  <span className={`doc-icon doc-icon-${spec.iconVariant}`}>
                    {iconContent(state, spec.iconGlyph)}
                  </span>
                  <span className={`doc-badge doc-badge-${spec.badge.variant}`}>
                    {spec.badge.label}
                  </span>
                </div>
                <h3 className="doc-card-title">{spec.title}</h3>
                <div className="doc-card-body">
                  {state.status === "success" ? (
                    <>
                      <p className="doc-status-ok">✓ Uploaded</p>
                      {state.fileName && <p className="doc-status-filename">{state.fileName}</p>}
                      {state.uploadedAt && <p className="doc-status-ts">{state.uploadedAt}</p>}
                    </>
                  ) : state.status === "error" ? (
                    <>
                      <p className="doc-status-bad">✗ Upload failed</p>
                      {state.error && <p className="doc-status-error-detail">{state.error}</p>}
                    </>
                  ) : state.status === "uploading" ? (
                    <>
                      <p className="doc-status-run">Uploading…</p>
                      <div className="upload-progress"><div className="upload-progress-bar" /></div>
                    </>
                  ) : (
                    <p className="doc-card-desc">{spec.idleDescription}</p>
                  )}
                </div>
              </div>

              <div className="doc-actions-row">
                <button type="button" className="doc-action" onClick={() => refFor(spec.key).current?.click()} disabled={isUploading}>
                  {actionLabel(state)}
                </button>
                {state.status === "success" && state.url && (
                  <a href={state.url} target="_blank" rel="noopener noreferrer" className="doc-preview-link">Preview</a>
                )}
                {state.status === "success" && localFile && (
                  <button type="button" className="doc-icon-btn" title="Preview" onClick={() => setPreviewEntry({ title: spec.title, fileObj: localFile })}>
                    👁️
                  </button>
                )}
                {state.status === "success" && (
                  <button type="button" className="doc-icon-btn doc-icon-btn-danger" title="Delete" onClick={() => confirmDelete(spec.key, state.fileName || spec.title, false)}>
                    🗑️
                  </button>
                )}
              </div>

              {isDeleting && (
                <div className="doc-delete-confirm">
                  <span>Remove <strong>{state.fileName || spec.title}</strong>? Cannot be undone.</span>
                  <div className="doc-delete-btns">
                    <button type="button" className="doc-delete-cancel" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                    <button type="button" className="doc-delete-remove" onClick={executeDelete}>Remove</button>
                  </div>
                </div>
              )}

              <div className="doc-pending-row">
                <label className="doc-pending-label">
                  <input type="checkbox" checked={pending?.enabled ?? false} onChange={() => togglePending(spec.key)} className="doc-pending-check" />
                  Mark as pending
                </label>
                {pending?.enabled && (
                  <input type="date" className="doc-pending-date" value={pending.dueDate} onChange={(e) => setPendingDue(spec.key, e.target.value)} title="Due by" />
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Custom Documents Section */}
      <div className="doc-subsection">
        <h4 className="doc-subsection-title">Custom Documents</h4>
        <p className="doc-subsection-note">Add any additional documents required by your school (max 10)</p>
        
        {customDocs.map((doc) => {
          const isDelCustom = deleteConfirm?.key === doc.id && deleteConfirm.isCustom;
          return (
            <div key={doc.id} className="doc-custom-entry">
              <button type="button" className="doc-custom-remove" onClick={() => confirmDelete(doc.id, doc.name, true)} title="Remove this document">✕</button>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 12, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 4 }}>Document Name</label>
                <input 
                  type="text" 
                  className="field-input" 
                  value={doc.name}
                  onChange={(e) => updateCustomDoc(doc.id, 'name', e.target.value)}
                  placeholder="e.g., Transfer Certificate"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 4 }}>Upload Document</label>
                <button type="button" className="doc-upload-btn" style={{ width: '100%' }} onClick={() => customFileRefs.current[doc.id]?.click()}>
                  {doc.fileName ? `✓ ${doc.fileName}` : '↑ Choose file'}
                </button>
                <input
                  type="file"
                  ref={(el) => { customFileRefs.current[doc.id] = el; }}
                  className="doc-hidden-input"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleCustomFileChange(e, doc.id)}
                />
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="doc-preview-link" style={{ fontSize: 11, marginTop: 4, display: 'inline-block' }}>Preview</a>
                )}
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 4 }}>Short Note (optional)</label>
                <textarea 
                  className="field-input" 
                  value={doc.note || ''}
                  onChange={(e) => updateCustomDoc(doc.id, 'note', e.target.value)}
                  placeholder="Additional details..."
                  rows={2}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, resize: 'vertical' }}
                />
              </div>
              {isDelCustom && (
                <div className="doc-delete-confirm" style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                  <span>Remove custom doc <strong>{doc.name}</strong>?</span>
                  <div className="doc-delete-btns">
                    <button type="button" className="doc-delete-cancel" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                    <button type="button" className="doc-delete-remove" onClick={executeDelete}>Remove</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {customDocs.length < 10 && (
          <button type="button" className="doc-upload-btn" onClick={addCustomDoc} style={{ marginTop: 8 }}>
            + Add Custom Document
          </button>
        )}
        {newDocError && <p style={{ color:'#dc2626', fontSize:12, marginTop:4 }}>{newDocError}</p>}
      </div>

      {/* Previous Academic Marksheets Section */}
      <div className="doc-subsection">
        <h4 className="doc-subsection-title">Previous Academic Marksheets</h4>
        <p className="doc-subsection-note">Upload previous year marksheets (PDF or image, max 10)</p>
        <label className="doc-upload-btn" style={{ display: 'inline-flex' }}>
          + Add Marksheets
          <input type="file" accept="application/pdf,image/*" multiple style={{ display:'none' }}
            onChange={(e) => e.target.files && addMarksheets(e.target.files)} />
        </label>
        {marksheetPreviews.length > 0 && (
          <div className="marksheet-grid">
            {marksheetPreviews.map((url, idx) => (
              <div key={idx} className="marksheet-item">
                {marksheetFiles[idx]?.type.startsWith('image/') ? (
                  <img src={url} alt={`Marksheet ${idx+1}`} className="marksheet-thumb" />
                ) : (
                  <div className="marksheet-pdf-icon">📄 {marksheetFiles[idx]?.name}</div>
                )}
                <button type="button" className="marksheet-remove" onClick={() => removeMarksheet(idx)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {customDocs.length > 0 && (
        <div className="doc-custom-list" style={{ display: 'none' /* Replaced by new custom docs section above */ }}>
          {customDocs.map((doc) => {
            const isDelCustom = deleteConfirm?.key === doc.id && deleteConfirm.isCustom;
            return (
              <div key={doc.id} className="doc-custom-row">
                <div className="doc-custom-info">
                  <span className="doc-badge doc-badge-custom">Custom</span>
                  <span className="doc-custom-name">{doc.name}</span>
                  {doc.dueDate && <span className="doc-custom-due">Due: {doc.dueDate}</span>}
                  {doc.fileName && <span className="doc-status-filename">{doc.fileName}</span>}
                </div>
                <div className="doc-custom-actions">
                  <button type="button" className="doc-action" onClick={() => customFileRefs.current[doc.id]?.click()}>
                    {doc.fileName ? "↩ Replace" : "↑ Upload"}
                  </button>
                  <button type="button" className="doc-icon-btn doc-icon-btn-danger" title="Remove" onClick={() => confirmDelete(doc.id, doc.name, true)}>
                    ✕
                  </button>
                  <input
                    type="file"
                    ref={(el) => { customFileRefs.current[doc.id] = el; }}
                    className="doc-hidden-input"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleCustomFileChange(e, doc.id)}
                  />
                </div>
                {isDelCustom && (
                  <div className="doc-delete-confirm" style={{ width: "100%" }}>
                    <span>Remove custom doc <strong>{doc.name}</strong>?</span>
                    <div className="doc-delete-btns">
                      <button type="button" className="doc-delete-cancel" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                      <button type="button" className="doc-delete-remove" onClick={executeDelete}>Remove</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="doc-add-custom" style={{ display: 'none' /* Replaced by enhanced custom docs section */ }}>
        <input
          type="text"
          className="doc-add-input"
          placeholder="Document name"
          value={newDocName}
          onChange={(e) => setNewDocName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addCustomDoc(); }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>Submission deadline</label>
          <input type="date" className="doc-add-date" value={newDocDue} onChange={(e) => setNewDocDue(e.target.value)} title="Required by date" placeholder="Required by date" />
        </div>
        <button type="button" className="doc-add-btn" onClick={addCustomDoc}>+ Add</button>
      </div>
      {newDocError && <p style={{ color:'#dc2626', fontSize:12, marginTop:4, marginBottom:0, display: 'none' }}>{newDocError}</p>}

      <div className="doc-callout doc-rte">
        <span className="doc-rte-icon" aria-hidden="true">🛡️</span>
        <div>
          <h4 className="doc-rte-title">RTE Act 2009 compliance</h4>
          <p className="doc-rte-text">
            Students admitted under the 25% EWS/DG quota must have their income or caste certificate verified within 30 days.
            All personal data is stored per the Digital Personal Data Protection Act, 2023 and is never shared with third parties
            without parental consent.{" "}
            <a href="#" className="doc-rte-link">Read our data policy →</a>
          </p>
        </div>
      </div>

      <div className="doc-callout doc-consent">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <input
            type="checkbox"
            id="consent-checkbox"
            className="doc-consent-checkbox"
            checked={consentChecked}
            onChange={(e) => { e.stopPropagation(); onConsentChange(e.target.checked); }}
            onClick={(e) => e.stopPropagation()}
            style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#6c3ce1', marginTop: 3, flexShrink: 0 }}
          />
          <div>
            <label htmlFor="consent-checkbox" style={{ cursor: 'pointer' }}>
              <div className="doc-consent-title">Parent / Guardian consent <span style={{ color: '#dc2626', fontWeight: 700 }}>*</span></div>
            </label>
            <p className="doc-consent-text">
              I confirm that the student&apos;s parent or legal guardian has authorized me to submit these documents and has consented
              to their storage for school records, admissions, fee management, and legally required reporting. I understand that
              withdrawing consent requires a written request.
            </p>
          </div>
        </div>
        {consentError ? <p className="doc-error-msg">{consentError}</p> : null}
      </div>

      {navButtonsSlot}

      {previewEntry && (
        <div className="doc-preview-backdrop" onClick={() => setPreviewEntry(null)}>
          <aside className="doc-preview-panel doc-preview-open" onClick={(e) => e.stopPropagation()}>
            <div className="doc-preview-header">
              <span className="doc-preview-title">{previewEntry.title}</span>
              <button type="button" className="doc-preview-close" onClick={() => setPreviewEntry(null)} aria-label="Close preview">
                ✕
              </button>
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
        .doc-shell {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 32px;
          scroll-margin-top: 108px;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #111827;
          transition: outline 150ms ease, background 150ms ease;
        }
        .doc-shell.drag-over { outline: 2px dashed var(--purple, #6c3ce1); background: rgba(91,79,232,.03); }
        .doc-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 28px; }
        .doc-header-text { flex: 1; min-width: 0; }
        .doc-title { margin: 0; font-size: 28px; font-weight: 700; line-height: 1.15; letter-spacing: -0.015em; color: #111827; font-family: var(--font-playfair-display), Georgia, "Times New Roman", serif; font-style: normal; }
        .doc-title-em { color: #5b3df5; font-style: italic; font-family: var(--font-playfair-display), Georgia, "Times New Roman", serif; font-weight: 400; }
        .doc-subtitle { margin: 8px 0 0; font-size: 14px; color: #6b7280; line-height: 1.5; max-width: 68ch; }
        .doc-counter { font-size: 13px; color: #9ca3af; white-space: nowrap; padding-top: 6px; font-variant-numeric: tabular-nums; }
        .doc-hidden-input { display: none; }
        .doc-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 16px; align-items: stretch; }
        .doc-card { display: flex; flex-direction: column; gap: 12px; min-height: 176px; padding: 20px 22px; background: #ffffff; border: 1px solid #e7eaf1; border-radius: 20px; transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease, background-color 180ms ease; }
        .doc-card:hover { border-color: #c7bcfb; box-shadow: 0 0 0 4px rgba(91,61,245,.06), 0 8px 20px rgba(17,24,39,.05); transform: translateY(-1px); }
        .doc-card-top { display: flex; flex-direction: column; gap: 10px; min-width: 0; flex: 1; }
        .doc-card-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .doc-icon { width: 40px; height: 40px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; line-height: 1; }
        .doc-icon-purple { background: #f3eeff; color: #5b3df5; }
        .doc-icon-pill { background: #fdeff0; color: #be123c; }
        .doc-badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; font-size: 10.5px; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase; line-height: 1.4; white-space: nowrap; }
        .doc-badge-req    { background: #fee2e2; color: #b91c1c; }
        .doc-badge-mask   { background: #ffedd5; color: #9a3412; }
        .doc-badge-opt    { background: #f3f4f6; color: #6b7280; }
        .doc-badge-custom { background: #ede9fe; color: #6c3ce1; }
        .doc-card-title { margin: 0; font-size: 16px; font-weight: 700; color: #111827; letter-spacing: -0.005em; line-height: 1.25; }
        .doc-card-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .doc-card-desc { margin: 0; font-size: 14px; color: #6b7280; line-height: 1.5; }
        .doc-status-ok { margin: 0; font-size: 14px; color: #047857; font-weight: 600; }
        .doc-status-filename { margin: 0; font-size: 13px; color: #047857; font-weight: 500; word-break: break-word; overflow-wrap: anywhere; line-height: 1.4; }
        .doc-status-ts { margin: 0; font-size: 11px; color: #6b7280; }
        .doc-status-bad { margin: 0; font-size: 14px; color: #b91c1c; font-weight: 600; }
        .doc-status-error-detail { margin: 0; font-size: 13px; color: #7f1d1d; word-break: break-word; overflow-wrap: anywhere; line-height: 1.4; }
        .doc-status-run { margin: 0; font-size: 14px; color: #1d4ed8; font-weight: 600; }
        .upload-progress { width: 100%; height: 4px; background: #dbeafe; border-radius: 999px; overflow: hidden; margin-top: 4px; }
        .upload-progress-bar { height: 100%; width: 60%; background: #3b82f6; border-radius: 999px; animation: doc-progress 1.4s ease-in-out infinite; }
        @keyframes doc-progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
        .doc-actions-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .doc-action { display: inline-flex; align-items: center; gap: 6px; padding: 0; border: none; background: transparent; color: #5b3df5; cursor: pointer; font-size: 14px; font-weight: 500; font-family: inherit; transition: color 140ms ease; }
        .doc-action:hover:not(:disabled) { color: #4c33e6; text-decoration: underline; }
        .doc-action:disabled { cursor: not-allowed; opacity: 0.7; }
        .doc-icon-btn { border: none; background: transparent; cursor: pointer; font-size: 16px; padding: 2px 4px; border-radius: 6px; line-height: 1; color: #6b7280; transition: background 120ms ease; }
        .doc-icon-btn:hover { background: #f3f4f6; }
        .doc-icon-btn-danger:hover { background: #fee2e2; color: #b91c1c; }
        .doc-delete-confirm { padding: 10px 14px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 10px; font-size: 13px; color: #7f1d1d; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
        .doc-delete-btns { display: flex; gap: 6px; }
        .doc-delete-cancel { padding: 5px 12px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; cursor: pointer; font-size: 12px; color: #374151; }
        .doc-delete-remove { padding: 5px 12px; border: 1px solid #dc2626; border-radius: 6px; background: #dc2626; color: #fff; cursor: pointer; font-size: 12px; }
        .doc-pending-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 2px; }
        .doc-pending-label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #6b7280; cursor: pointer; user-select: none; }
        .doc-pending-check { width: 14px; height: 14px; accent-color: #5b3df5; cursor: pointer; flex-shrink: 0; }
        .doc-pending-date { font-size: 12px; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 6px; color: #374151; background: #fff; }
        .doc-card.is-success { background: #ecfdf5; border-color: #a7f3d0; }
        .doc-card.is-success .doc-icon { background: #10b981; color: #ffffff; font-size: 22px; font-weight: 600; }
        .doc-card.is-success .doc-action { color: #059669; }
        .doc-card.is-success .doc-action:hover:not(:disabled) { color: #047857; }
        .doc-card.is-error { background: #fef2f2; border-color: #fca5a5; }
        .doc-card.is-error .doc-icon { background: #dc2626; color: #ffffff; font-size: 22px; font-weight: 600; }
        .doc-card.is-error .doc-action { color: #dc2626; }
        .doc-card.is-error .doc-action:hover:not(:disabled) { color: #991b1b; }
        .doc-card.is-uploading { background: #eff6ff; border-color: #93c5fd; }
        .doc-card.is-uploading .doc-icon { background: #3b82f6; color: #ffffff; font-size: 22px; animation: doc-spin 1s linear infinite; }
        .doc-card.is-uploading .doc-action { color: #3b82f6; }
        @keyframes doc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .doc-custom-list { margin: 4px 0 12px; display: flex; flex-direction: column; gap: 10px; }
        .doc-custom-row { padding: 12px 16px; border: 1px solid #e5e7eb; border-radius: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; background: #fafafa; }
        .doc-custom-info { flex: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; }
        .doc-custom-name { font-size: 14px; font-weight: 500; color: #111827; }
        .doc-custom-due  { font-size: 12px; color: #6b7280; }
        .doc-custom-actions { display: flex; align-items: center; gap: 8px; }
        .doc-add-custom { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 4px 0 16px; padding: 14px 16px; border: 1px dashed #d1d5db; border-radius: 12px; background: #fafafa; }
        .doc-add-input { flex: 1; min-width: 160px; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; font-family: inherit; color: #111827; background: #fff; }
        .doc-add-input:focus { outline: none; border-color: #6c3ce1; box-shadow: 0 0 0 3px rgba(108,60,225,.08); }
        .doc-add-date { padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; color: #374151; background: #fff; }
        .doc-add-btn { padding: 8px 18px; border: 1px solid #6c3ce1; border-radius: 8px; background: #6c3ce1; color: #fff; cursor: pointer; font-size: 14px; font-weight: 500; white-space: nowrap; transition: background 120ms ease; }
        .doc-add-btn:hover:not(:disabled) { background: #5a2ee0; border-color: #5a2ee0; }
        .doc-add-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .doc-callout { margin-top: 12px; padding: 18px 22px; border-radius: 16px; display: flex; gap: 14px; align-items: flex-start; }
        .doc-rte { background: #fffbeb; border: 1px solid #fde68a; }
        .doc-rte-icon { font-size: 22px; line-height: 1; flex-shrink: 0; margin-top: 2px; }
        .doc-rte-title { margin: 0 0 6px; font-size: 14px; font-weight: 600; color: #92400e; }
        .doc-rte-text { margin: 0; font-size: 13px; color: #78350f; line-height: 1.6; }
        .doc-rte-link { color: #b45309; text-decoration: underline; font-weight: 500; }
        .doc-rte-link:hover { color: #92400e; }
        .doc-consent { background: #f7f5ff; border: 1px solid #c4b5fd; }
        .doc-consent-label { display: flex; gap: 12px; align-items: flex-start; cursor: pointer; width: 100%; }
        .doc-consent-checkbox { width: 18px; height: 18px; margin-top: 3px; cursor: pointer; flex-shrink: 0; accent-color: #5b3df5; }
        .doc-consent-title { margin: 0 0 6px; font-size: 14px; font-weight: 600; color: #111827; }
        .doc-consent-text { margin: 0; font-size: 13px; color: #4b5563; line-height: 1.6; }
        .doc-error-msg { font-size: 12px; color: #dc2626; margin: 8px 0 0; }
        .doc-preview-backdrop { position: fixed; inset: 0; z-index: 849; background: rgba(15,23,42,.3); }
        .doc-preview-panel { position: fixed; top: 0; right: 0; bottom: 0; width: min(720px,90vw); background: #fff; z-index: 850; box-shadow: -12px 0 32px rgba(15,23,42,.12); display: flex; flex-direction: column; transform: translateX(100%); transition: transform 240ms ease; }
        .doc-preview-panel.doc-preview-open { transform: translateX(0); }
        .doc-preview-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; }
        .doc-preview-title { font-size: 15px; font-weight: 600; color: #111827; }
        .doc-preview-close { width: 32px; height: 32px; border-radius: 8px; border: 1px solid #d1d5db; background: #fff; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; }
        .doc-preview-body { flex: 1; overflow: auto; display: flex; align-items: center; justify-content: center; padding: 16px; background: #f8fafc; }
        .doc-preview-img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; }
        .doc-preview-iframe { width: 100%; height: 100%; border: none; border-radius: 8px; background: #fff; min-height: 60vh; }
        .doc-preview-link { font-size: 11px; color: #6c3ce1; margin-left: 8px; text-decoration: underline; cursor: pointer; }
        .doc-preview-link:hover { color: #5a2fc0; }
        .doc-subsection { margin: 20px 0; padding: 16px; background: #f8f7ff; border-radius: 8px; border: 1px solid #e9e4ff; }
        .doc-subsection-title { font-size: 14px; font-weight: 700; color: #1f2937; margin-bottom: 4px; }
        .doc-subsection-note { font-size: 12px; color: #6b7280; margin-bottom: 10px; }
        .doc-upload-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; background: #6c3ce1; color: #fff; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 120ms ease; }
        .doc-upload-btn:hover { background: #5a2fc0; }
        .marksheet-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; margin-top: 12px; }
        .marksheet-item { position: relative; border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden; background: #fff; }
        .marksheet-thumb { width: 100%; height: 90px; object-fit: cover; display: block; }
        .marksheet-pdf-icon { height: 90px; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #374151; padding: 8px; text-align: center; word-break: break-word; }
        .marksheet-remove { position: absolute; top: 4px; right: 4px; background: rgba(220,38,38,0.85); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .marksheet-remove:hover { background: rgba(220,38,38,1); }
        .doc-custom-entry { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 12px; background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 8px; position: relative; }
        .doc-custom-remove { position: absolute; top: 8px; right: 8px; background: none; border: none; color: #dc2626; font-size: 16px; cursor: pointer; z-index: 1; padding: 4px; line-height: 1; }
        .doc-custom-remove:hover { color: #991b1b; }
        @media (max-width: 1024px) { .doc-shell { padding: 28px; } }
        @media (max-width: 768px) {
          .doc-shell { padding: 20px; border-radius: 14px; }
          .doc-header { flex-direction: column; gap: 6px; margin-bottom: 20px; }
          .doc-counter { padding-top: 0; }
          .doc-title { font-size: 22px; }
          .doc-grid { grid-template-columns: 1fr; gap: 14px; }
          .doc-card { min-height: 168px; }
          .doc-callout { padding: 16px 18px; }
          .doc-custom-entry { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}

export default StudentDocumentsUpload;
