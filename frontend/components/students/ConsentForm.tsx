"use client";
import React, { useState, useEffect, useRef } from "react";

const SCHOOL_HEADER_KEY = 'eskoolia:school:header:v2';

type HeaderLayout = 'classic' | 'centered' | 'banner' | 'minimal' | 'letterhead';

interface SchoolHeaderData {
  schoolName: string;
  schoolAddress: string;
  schoolPhone: string;
  schoolEmail: string;
  schoolWebsite: string;
  logoDataUrl: string;        // base64 uploaded file (preferred)
  logoUrl: string;            // fallback URL
  principalName: string;
  schoolMotto: string;
  affiliationNo: string;
  letterheadBg: string;       // base64 background image for "letterhead" layout
  headerLayout: HeaderLayout;
  headerBgColor: string;
  headerTextColor: string;
  declarationText: string;    // editable declaration / T&C text
}

const DEFAULT_DECLARATION = `I, the undersigned parent / legal guardian of {studentName}, hereby confirm that all information provided in this admission form is accurate and complete to the best of my knowledge. I consent to the school collecting, storing, and using the student's personal data exclusively for educational, administrative, and legally mandated purposes in accordance with the Digital Personal Data Protection Act, 2023. I understand that any withdrawal of consent must be submitted in writing to the school administration.`;

const DEFAULT_HEADER: SchoolHeaderData = {
  schoolName: 'Eskoolia School',
  schoolAddress: '123 School Lane, City — 000000',
  schoolPhone: '',
  schoolEmail: 'admissions@eskoolia.in',
  schoolWebsite: '',
  logoDataUrl: '',
  logoUrl: '',
  principalName: 'Principal',
  schoolMotto: '',
  affiliationNo: '',
  letterheadBg: '',
  headerLayout: 'classic',
  headerBgColor: '#ffffff',
  headerTextColor: '#111827',
  declarationText: DEFAULT_DECLARATION,
};

function loadHeaderSettings(): SchoolHeaderData {
  if (typeof window === 'undefined') return DEFAULT_HEADER;
  try {
    const raw = localStorage.getItem(SCHOOL_HEADER_KEY);
    if (!raw) return DEFAULT_HEADER;
    return { ...DEFAULT_HEADER, ...JSON.parse(raw) };
  } catch { return DEFAULT_HEADER; }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result as string);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

export interface ConsentFormStudent {
  // DB identity
  studentId?: string | number;   // backend PK — needed for document upload
  // Identity (Step 1)
  firstName: string;
  lastName: string;
  middleName?: string;
  admissionNo: string;
  dateOfBirth: string;
  gender?: string;
  bloodGroup?: string;
  photo?: string;
  statusValue?: string;
  motherTongue?: string;
  religion?: string;
  nationality?: string;
  // Academic (Step 2)
  classId: string;
  sectionId: string;
  className: string;
  sectionName: string;
  academicYearName?: string;
  admissionType?: string;
  categoryName?: string;
  streamId?: string;
  previousSchoolName?: string;
  // Contact (Step 3)
  phone?: string;
  email?: string;
  addressLine?: string;
  city?: string;
  district?: string;
  stateName?: string;
  pincode?: string;
  // Guardians (Step 4)
  guardians?: Array<{ full_name: string; relation: string; phone: string; email?: string; occupation?: string; isPrimary?: boolean; }>;
  // APAAR (Step 5)
  pen?: string;
  abcId?: string;
  // Documents (Step 6)
  documents?: {
    birth_certificate?: { status: string; fileName: string; };
    aadhaar_card?: { status: string; fileName: string; };
    medical_information?: { status: string; fileName: string; };
    caste_certificate?: { status: string; fileName: string; };
    udid_card?: { status: string; fileName: string; };
  };
  consentChecked?: boolean;
  // Medical (Step 7)
  heightCm?: string;
  weightKg?: string;
  vision?: string;
  medicalConditions?: string[];
  allergies?: string[];
  currentMedications?: string;
  treatingDoctor?: string;
  checkedVaccinations?: string[];
  emergencyName?: string;
  emergencyPhone?: string;
  // Specially abled (Step 8)
  isPwD?: boolean;
  disabilityTypes?: string[];
  disabilityPercent?: number;
  udid?: string;
  accommodations?: string[];
  // Identity marks (Step 9)
  identityMarks?: Array<{ location: string; description: string; }>;
  eyeColour?: string;
  hairColour?: string;
  complexion?: string;
  build?: string;
}

interface ConsentFormProps {
  onClose: () => void;
  student: ConsentFormStudent;
  openWithSettings?: boolean;
  onOcrApply?: (results: Record<string, string>) => void;
  initialAction?: 'upload-signed' | 'blank-form' | 'scan-fill' | 'print-pdf' | null;
}

const DOC_LABELS: Record<string, string> = {
  birth_certificate: 'Birth Certificate',
  aadhaar_card: 'Aadhaar Card',
  medical_information: 'Medical Records',
  caste_certificate: 'Caste Certificate',
  udid_card: 'UDID / Disability Certificate',
};

const VAC_LABELS: Record<string, string> = {
  bcg: 'BCG', opv: 'OPV', hepb: 'Hepatitis B', dpt: 'DPT',
  mmr: 'MMR', tdap: 'Tdap booster', hpv: 'HPV',
};

function val(v: string | undefined | null): string {
  return v && v.trim() ? v.trim() : '—';
}

export function ConsentForm({ onClose, student, openWithSettings, onOcrApply, initialAction }: ConsentFormProps) {
  const [showSettings, setShowSettings] = useState<boolean>(openWithSettings ?? false);
  const [declarationText, setDeclarationText] = useState(DEFAULT_DECLARATION);
  const [showAI, setShowAI] = useState(false);
  const [header, setHeader] = useState<SchoolHeaderData>(DEFAULT_HEADER);
  const [settingsForm, setSettingsForm] = useState<SchoolHeaderData>(DEFAULT_HEADER);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'identity' | 'layout' | 'import' | 'declaration'>('identity');
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(new Set());
  const [accentColor, setAccentColor] = useState('#6c3ce1');
  const [layoutPreset, setLayoutPreset] = useState<'official' | 'minimal' | 'detailed'>('official');
  const [inlineEditing, setInlineEditing] = useState(false);
  const [inlineHeader, setInlineHeader] = useState<SchoolHeaderData>(DEFAULT_HEADER);
  const modalRef = useRef<HTMLDivElement>(null);
  const letterheadInputRef = useRef<HTMLInputElement>(null);
  const signedFormInputRef = useRef<HTMLInputElement>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);

  // ——— New-window print helper ———
  // Instead of calling window.print() on the current page (which prints the
  // whole React app — sidebar, wizard steps, etc.), we open a blank popup,
  // copy only the modal's HTML plus all existing stylesheets into it, then
  // trigger print on that isolated window and close it.
  const printFormInNewWindow = () => {
    const el = modalRef.current;
    if (!el) { window.print(); return; }

    // Collect every <style> and <link rel=stylesheet> currently active on the page.
    const styleHTML = Array.from(document.querySelectorAll<HTMLElement>('style, link[rel="stylesheet"]'))
      .map(n => n.outerHTML)
      .join('\n');

    const printWin = window.open('', '_blank', 'width=900,height=700,menubar=no,toolbar=no,status=no');
    if (!printWin) { window.print(); return; } // popup blocked — fall back

    // Clone the modal so we can strip toolbar/action buttons before printing
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll<HTMLElement>(
      '.cf-toolbar, .cf-settings-panel, .cf-ai-panel, .cf-inline-edit-trigger, ' +
      '.cf-inline-actions, .cf-inline-edit-bar, .cf-upload-signed-bar, .no-print'
    ).forEach(n => n.remove());

    printWin.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Student Verification Form</title>
  ${styleHTML}
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .cf-toolbar, .cf-settings-panel, .cf-ai-panel,
    .cf-inline-edit-trigger, .cf-inline-actions, .cf-inline-edit-bar,
    .cf-upload-signed-bar, .no-print { display: none !important; }
    .cf-modal {
      position: static !important; margin: 0 !important; max-width: 100% !important;
      width: 100% !important; box-shadow: none !important; border-radius: 0 !important;
      overflow: visible !important; max-height: none !important;
    }
    .cf-section { page-break-inside: avoid; break-inside: avoid; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; break-inside: avoid; }
  </style>
</head>
<body>${clone.outerHTML}</body>
</html>`);

    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
      printWin.close();
    }, 600);
  };

  // ——— Signed consent form upload state ———
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');

  // ——— OCR / blank form state ———
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrResults, setOcrResults] = useState<Record<string, string>>({});
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [ocrImageUrl, setOcrImageUrl] = useState<string>('');
  const [scanPickerOpen, setScanPickerOpen] = useState(false);
  const scanFileInputRef = useRef<HTMLInputElement>(null);
  const [editedOcrResults, setEditedOcrResults] = useState<Record<string, string>>({});
  const [ocrMissingFields, setOcrMissingFields] = useState<string[]>([]);

  useEffect(() => {
    const h = loadHeaderSettings();
    setHeader(h);
    setSettingsForm(h);
    setInlineHeader(h);
    if (h.declarationText) setDeclarationText(h.declarationText);
  }, []);

  useEffect(() => {
    setShowSettings(openWithSettings ?? false);
  }, [openWithSettings]);

  // Auto-run an initial action when the modal opens
  useEffect(() => {
    if (!initialAction) return;
    if (initialAction === 'blank-form') {
      // Download blank form (no admission number, with parent instructions and document checklist), then close.
      setTimeout(() => { downloadBlankForm({ blank: true }); onClose(); }, 50);
    } else if (initialAction === 'upload-signed') {
      setTimeout(() => { signedFormInputRef.current?.click(); }, 100);
    } else if (initialAction === 'scan-fill') {
      setTimeout(() => { setScanPickerOpen(true); }, 100);
    } else if (initialAction === 'print-pdf') {
      // Wait a beat so the modal/PDF content fully renders, then trigger native print
      setTimeout(() => { printFormInNewWindow(); }, 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAction]);

  const saveSettings = () => {
    localStorage.setItem(SCHOOL_HEADER_KEY, JSON.stringify(settingsForm));
    setHeader(settingsForm);
    setInlineHeader(settingsForm);
    if (settingsForm.declarationText) setDeclarationText(settingsForm.declarationText);
    setSettingsSaved(true);
    setTimeout(() => { setSettingsSaved(false); setShowSettings(false); }, 1000);
  };

  const saveInlineHeader = () => {
    localStorage.setItem(SCHOOL_HEADER_KEY, JSON.stringify(inlineHeader));
    setHeader(inlineHeader);
    setSettingsForm(inlineHeader);
    setInlineEditing(false);
  };

  const handleLogoUpload = async (file: File, target: 'settings' | 'inline') => {
    const dataUrl = await fileToBase64(file);
    if (target === 'settings') setSettingsForm(p => ({ ...p, logoDataUrl: dataUrl, logoUrl: '' }));
    else { const updated = { ...inlineHeader, logoDataUrl: dataUrl, logoUrl: '' }; setInlineHeader(updated); setHeader(updated); localStorage.setItem(SCHOOL_HEADER_KEY, JSON.stringify(updated)); }
  };

  const handleLetterheadUpload = async (file: File) => {
    const dataUrl = await fileToBase64(file);
    setSettingsForm(p => ({ ...p, letterheadBg: dataUrl, headerLayout: 'letterhead' as HeaderLayout }));
  };

  const clearLogo = (target: 'settings' | 'inline') => {
    if (target === 'settings') setSettingsForm(p => ({ ...p, logoDataUrl: '', logoUrl: '' }));
    else { const updated = { ...inlineHeader, logoDataUrl: '', logoUrl: '' }; setInlineHeader(updated); setHeader(updated); localStorage.setItem(SCHOOL_HEADER_KEY, JSON.stringify(updated)); }
  };

  const clearLetterhead = () => setSettingsForm(p => ({ ...p, letterheadBg: '', headerLayout: 'classic' as HeaderLayout }));

  const resetToDefault = () => {
    setSettingsForm(DEFAULT_HEADER);
  };

  const handleSignedFormUpload = async (file: File) => {
    if (!student.studentId) {
      setUploadError('Student must be saved before uploading a signed form.');
      return;
    }
    setUploadStatus('uploading');
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('student_id', String(student.studentId));
      formData.append('document_type', 'consent_form');
      formData.append('title', `Signed Consent Form — ${student.firstName} ${student.lastName}`);
      formData.append('file', file);

      const res = await fetch('/api/students/documents/upload_document/', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string,string>).error || `Upload failed (${res.status})`);
      }
      const data = await res.json() as { file?: string; original_name?: string };
      setUploadedFileUrl(data.file || '');
      setUploadedFileName(file.name);
      setUploadStatus('done');
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed. Please try again.');
      setUploadStatus('error');
    }
  };

  // ——— Blank form download ———
  const downloadBlankForm = (opts?: { blank?: boolean }) => {
    const blankMode = opts?.blank === true;
    const admNo = blankMode ? 'TO BE ASSIGNED' : (student.admissionNo || 'PENDING');
    const schoolName = header.schoolName || 'Your School';
    const schoolAddress = header.schoolAddress || '';
    const schoolPhone = header.schoolPhone || '';
    const schoolEmail = header.schoolEmail || '';
    const affiliationNo = header.affiliationNo || '';
    const fields = [
      { label: 'Student First Name', name: 'firstName', hint: 'As per Birth Certificate' },
      { label: 'Student Last Name', name: 'lastName', hint: '' },
      { label: 'Date of Birth (DD / MM / YYYY)', name: 'dateOfBirth', hint: '' },
      { label: 'Gender', name: 'gender', hint: 'MALE / FEMALE / OTHER' },
      { label: 'Blood Group', name: 'bloodGroup', hint: 'e.g. A+ / B- / O+' },
      { label: 'Religion', name: 'religion', hint: '' },
      { label: 'Nationality', name: 'nationality', hint: '' },
      { label: 'Mother Tongue', name: 'motherTongue', hint: '' },
      { label: 'Aadhaar Number (student)', name: 'aadhaarNo', hint: '12-digit number' },
      { label: 'Mobile Phone', name: 'phone', hint: '10-digit number' },
      { label: 'Email Address', name: 'email', hint: '' },
      { label: 'Address Line', name: 'addressLine', hint: 'House No, Street, Area' },
      { label: 'City', name: 'city', hint: '' },
      { label: 'District', name: 'district', hint: '' },
      { label: 'State', name: 'stateName', hint: '' },
      { label: 'Pincode', name: 'pincode', hint: '6-digit pincode' },
      { label: 'Guardian Full Name', name: 'guardianName', hint: 'Father / Mother / Guardian' },
      { label: 'Guardian Relationship', name: 'guardianRelation', hint: 'e.g. Father, Mother, Guardian' },
      { label: 'Guardian Mobile', name: 'guardianPhone', hint: '10-digit number' },
      { label: 'Guardian Email', name: 'guardianEmail', hint: '' },
      { label: 'Guardian Aadhaar', name: 'guardianAadhaar', hint: '12-digit number' },
      { label: 'Guardian Occupation', name: 'guardianOccupation', hint: '' },
      { label: 'Previous School Name (if any)', name: 'previousSchool', hint: '' },
    ];

    const fieldRows = fields.map(f => `
      <tr>
        <td class="f-label">${f.label}${f.hint ? `<span class="f-hint">${f.hint}</span>` : ''}</td>
        <td class="f-box"><div class="write-box" data-field="${f.name}"></div></td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Blank Intake Form — ${admNo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#111;font-size:12px;padding:24px}
  .page{max-width:750px;margin:0 auto}
  .top-bar{background:#1a0540;color:#fff;padding:10px 16px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center}
  .school-name{font-size:15px;font-weight:700;display:block}
  .school-meta{font-size:10px;color:#c4b5fd;display:block;margin-top:2px}
  .adm-badge{background:#f59e0b;color:#111;font-weight:800;font-size:13px;padding:4px 12px;border-radius:20px;letter-spacing:0.5px;white-space:nowrap;flex-shrink:0}
  .instruction-box{border:2.5px solid #dc2626;background:#fff5f5;padding:12px 16px;margin:12px 0;border-radius:6px}
  .instruction-box h2{color:#dc2626;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
  .instruction-box ol{padding-left:20px;line-height:2}
  .instruction-box li{font-size:11.5px;color:#374151}
  .form-title{text-align:center;font-size:18px;font-weight:800;color:#1a0540;margin:14px 0 2px;text-transform:uppercase;letter-spacing:1px}
  .form-sub{text-align:center;font-size:11px;color:#6b7280;margin-bottom:12px}
  table{width:100%;border-collapse:collapse;margin-top:4px}
  .f-label{width:38%;padding:7px 10px;background:#f8f7ff;border:1px solid #e5e7eb;font-weight:600;font-size:11.5px;vertical-align:top;color:#1f2937;line-height:1.4}
  .f-hint{display:block;font-weight:400;color:#9ca3af;font-size:10px;margin-top:2px}
  .f-box{padding:4px 6px;border:1px solid #e5e7eb;border-left:none}
  .write-box{height:32px;border:1.5px dashed #6c3ce1;border-radius:4px;background:#fafafe;width:100%}
  .section-head{background:#6c3ce1;color:#fff;font-weight:700;font-size:11.5px;text-transform:uppercase;letter-spacing:0.8px;padding:5px 10px;border-radius:3px;margin:12px 0 0}
  .sig-row{display:flex;gap:20px;margin-top:20px;padding-top:12px;border-top:1px solid #e5e7eb}
  .sig-block{flex:1;text-align:center}
  .sig-line{border-bottom:1.5px solid #374151;height:36px;margin-bottom:4px}
  .sig-label{font-size:10px;color:#6b7280}
  .ocr-marker{display:none}
  .barcode-area{text-align:center;margin:10px 0}
  .barcode-text{font-family:monospace;font-size:9px;letter-spacing:3px;color:#6b7280}
  @media print{body{padding:0}.page{max-width:100%}}
</style>
</head>
<body>
<div class="page">
  <div class="top-bar">
    <div>
      <span class="school-name">📚 ${schoolName}</span>
      ${schoolAddress ? `<span class="school-meta">${schoolAddress}</span>` : ''}
      ${(schoolPhone || schoolEmail) ? `<span class="school-meta">${[schoolPhone, schoolEmail].filter(Boolean).join(' · ')}</span>` : ''}
      ${affiliationNo ? `<span class="school-meta">Affiliation No: ${affiliationNo}</span>` : ''}
    </div>
    <span class="adm-badge">${blankMode ? 'BLANK COPY' : `ADM #${admNo}`}</span>
  </div>

  <div class="instruction-box">
    <h2>⚠ Important Instructions — Read Before Filling</h2>
    <ol>
      <li><strong>Fill all fields in BLOCK LETTERS ONLY</strong> (e.g. JOHN, not John)</li>
      <li>Use <strong>black or dark blue ballpoint pen</strong> only — do not use pencil</li>
      <li>Do <strong>NOT</strong> fold, staple, or crease this form</li>
      <li>${blankMode ? 'The <strong>Admission Number</strong> will be assigned by the school office at the time of submission' : `Keep the <strong>Admission Number (${admNo})</strong> at the top clearly visible`}</li>
      <li>Write <strong>NA</strong> (Not Applicable) for any field that does not apply — do not leave blank</li>
      <li>For dates, use <strong>DD / MM / YYYY</strong> format (e.g. 14 / 03 / 2018)</li>
      <li>Scan or photograph the completed form clearly in <strong>good lighting</strong>, all 4 corners visible</li>
      <li>Submit the scanned form via the <em>Upload Signed</em> button in the system, or hand it back to the admission office</li>
    </ol>
  </div>
  ${blankMode ? `
  <div class="instruction-box" style="border-color:#0891b2;background:#ecfeff">
    <h2 style="color:#0891b2">📋 Documents to Bring at Submission</h2>
    <ol>
      <li>Original <strong>Birth Certificate</strong> + 1 photocopy (mandatory)</li>
      <li>Student's <strong>Aadhaar Card</strong> (front &amp; back) + photocopy</li>
      <li><strong>Parent/Guardian Aadhaar</strong> (both parents if available) + photocopies</li>
      <li>Recent <strong>passport-size photographs</strong> (4 copies of student, 2 each of both parents)</li>
      <li>Previous school <strong>Transfer Certificate (TC)</strong> + last attended report card / marksheet</li>
      <li><strong>Caste / Income / Disability certificate</strong> (only if applicable for reservation/RTE)</li>
      <li>Student's <strong>Vaccination / Immunisation record</strong></li>
      <li><strong>Blood group report</strong> (if available) and any allergy / medical certificate</li>
      <li>Proof of <strong>residence</strong> (Aadhaar / Ration card / Utility bill)</li>
      <li>Two recent <strong>passport photos of the local emergency contact</strong></li>
    </ol>
    <p style="margin-top:8px;font-size:11px;color:#0e7490"><strong>Tip:</strong> Bring originals for verification and self-attested photocopies for office records.</p>
  </div>` : ''}

  <div class="form-title">Student Admission Intake Form</div>
  <div class="form-sub">${blankMode ? 'Admission No: <strong>To be assigned by school office</strong>' : `Admission No: <strong>${admNo}</strong>`} &nbsp;|&nbsp; For office use only — do not submit without school stamp</div>

  <div class="barcode-area">
    <div class="barcode-text">||||| ${blankMode ? 'BLANK-INTAKE-FORM' : `ADM-${admNo}`} INTAKE-FORM-V1 |||||</div>
  </div>

  <div class="section-head">Section A — Student Personal Details</div>
  <table>
    ${fields.slice(0, 8).map(f => `
    <tr>
      <td class="f-label">${f.label}${f.hint ? `<span class="f-hint">${f.hint}</span>` : ''}</td>
      <td class="f-box"><div class="write-box" data-field="${f.name}"></div></td>
    </tr>`).join('')}
  </table>

  <div class="section-head">Section B — Contact & Address</div>
  <table>
    ${fields.slice(8, 16).map(f => `
    <tr>
      <td class="f-label">${f.label}${f.hint ? `<span class="f-hint">${f.hint}</span>` : ''}</td>
      <td class="f-box"><div class="write-box" data-field="${f.name}"></div></td>
    </tr>`).join('')}
  </table>

  <div class="section-head">Section C — Parent / Guardian Details</div>
  <table>
    ${fields.slice(16).map(f => `
    <tr>
      <td class="f-label">${f.label}${f.hint ? `<span class="f-hint">${f.hint}</span>` : ''}</td>
      <td class="f-box"><div class="write-box" data-field="${f.name}"></div></td>
    </tr>`).join('')}
  </table>

  <div class="section-head">Section D — Government Identity</div>
  <table>
    <tr>
      <td class="f-label">Student Aadhaar Number<span class="f-hint">12-digit</span></td>
      <td class="f-box"><div class="write-box" data-field="studentAadhaar"></div></td>
    </tr>
    <tr>
      <td class="f-label">PEN (UDISE Student ID)<span class="f-hint">Alphanumeric</span></td>
      <td class="f-box"><div class="write-box" data-field="pen"></div></td>
    </tr>
    <tr>
      <td class="f-label">ABC ID<span class="f-hint">12-digit Academic Bank of Credits ID</span></td>
      <td class="f-box"><div class="write-box" data-field="abcId"></div></td>
    </tr>
    <tr>
      <td class="f-label">Birth Certificate Number<span class="f-hint">As issued by municipal authority</span></td>
      <td class="f-box"><div class="write-box" data-field="birthCertNo"></div></td>
    </tr>
    <tr>
      <td class="f-label">Caste Category<span class="f-hint">GENERAL / OBC / SC / ST / OTHER</span></td>
      <td class="f-box"><div class="write-box" data-field="casteCategory"></div></td>
    </tr>
  </table>

  <div class="section-head">Section E — Medical Information</div>
  <table>
    <tr>
      <td class="f-label">Known Medical Conditions<span class="f-hint">e.g. Asthma, Diabetes (write NONE if none)</span></td>
      <td class="f-box"><div class="write-box" data-field="medicalConditions"></div></td>
    </tr>
    <tr>
      <td class="f-label">Known Allergies<span class="f-hint">e.g. Nuts, Penicillin (write NONE if none)</span></td>
      <td class="f-box"><div class="write-box" data-field="allergies"></div></td>
    </tr>
    <tr>
      <td class="f-label">Current Medications<span class="f-hint">Name and dosage (write NONE if none)</span></td>
      <td class="f-box"><div class="write-box" data-field="currentMedications"></div></td>
    </tr>
    <tr>
      <td class="f-label">Treating Doctor Name<span class="f-hint">If any</span></td>
      <td class="f-box"><div class="write-box" data-field="doctorName"></div></td>
    </tr>
    <tr>
      <td class="f-label">Treating Doctor Phone<span class="f-hint">10-digit</span></td>
      <td class="f-box"><div class="write-box" data-field="doctorPhone"></div></td>
    </tr>
  </table>

  <div class="section-head">Section F — Emergency Contact</div>
  <table>
    <tr>
      <td class="f-label">Emergency Contact Name<span class="f-hint"></span></td>
      <td class="f-box"><div class="write-box" data-field="emergencyContactName"></div></td>
    </tr>
    <tr>
      <td class="f-label">Emergency Contact Relationship<span class="f-hint">e.g. Uncle, Aunt, Family Friend</span></td>
      <td class="f-box"><div class="write-box" data-field="emergencyContactRelation"></div></td>
    </tr>
    <tr>
      <td class="f-label">Emergency Contact Mobile<span class="f-hint">10-digit</span></td>
      <td class="f-box"><div class="write-box" data-field="emergencyContactMobile"></div></td>
    </tr>
  </table>

  <div class="section-head">Section G — Physical Description (Identity Marks)</div>
  <table>
    <tr>
      <td class="f-label">Height (cm)<span class="f-hint">Approximate</span></td>
      <td class="f-box"><div class="write-box" data-field="heightCm"></div></td>
    </tr>
    <tr>
      <td class="f-label">Weight (kg)<span class="f-hint">Approximate</span></td>
      <td class="f-box"><div class="write-box" data-field="weightKg"></div></td>
    </tr>
    <tr>
      <td class="f-label">Identity Mark 1<span class="f-hint">e.g. Mole on right cheek</span></td>
      <td class="f-box"><div class="write-box" data-field="identityMark1"></div></td>
    </tr>
    <tr>
      <td class="f-label">Identity Mark 2<span class="f-hint">If any</span></td>
      <td class="f-box"><div class="write-box" data-field="identityMark2"></div></td>
    </tr>
  </table>

  <div class="section-head">Section H — Specially Abled (if applicable)</div>
  <table>
    <tr>
      <td class="f-label">Disability Type<span class="f-hint">Write NA if not applicable</span></td>
      <td class="f-box"><div class="write-box" data-field="disabilityType"></div></td>
    </tr>
    <tr>
      <td class="f-label">UDID Number<span class="f-hint">Unique Disability ID (write NA if not applicable)</span></td>
      <td class="f-box"><div class="write-box" data-field="udidNumber"></div></td>
    </tr>
    <tr>
      <td class="f-label">Special Accommodations Required<span class="f-hint">Write NA if not applicable</span></td>
      <td class="f-box"><div class="write-box" data-field="specialAccommodations"></div></td>
    </tr>
  </table>

  <div class="section-head" style="margin-top:20px">Declaration &amp; Terms</div>
  <div style="font-size:11.5px;line-height:1.75;color:#374151;padding:10px 12px;background:#fafafa;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:12px">
    ${(declarationText || DEFAULT_DECLARATION).replace('{studentName}', '_____________________________ (Student Name)')}
  </div>

  <div class="sig-row">
    <div class="sig-block"><div class="sig-line"></div><div class="sig-label">Parent / Guardian Signature</div></div>
    <div class="sig-block"><div class="sig-line"></div><div class="sig-label">Date</div></div>
    <div class="sig-block"><div class="sig-line"></div><div class="sig-label">School Stamp &amp; Signature</div></div>
  </div>
</div>
<script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  // ——— OCR / Scan to auto-fill ———
  const handleOcrUpload = async (file: File) => {
    setOcrStatus('scanning');
    setOcrProgress(5);
    setOcrResults({});
    const url = URL.createObjectURL(file);
    setOcrImageUrl(url);

    try {
      // For PDFs, render first page to a canvas using pdfjs-dist before OCR
      let ocrSource: File | HTMLCanvasElement = file;
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const pdfjsLib = await import('pdfjs-dist');
        // Use CDN worker to avoid Next.js bundling complications
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        setOcrProgress(10);
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        const page = await pdfDoc.getPage(1);
        // Scale 2x for better OCR accuracy
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');
        await page.render({ canvasContext: ctx, viewport }).promise;
        ocrSource = canvas;
        // Replace the PDF blob URL with a canvas image for the preview pane
        setOcrImageUrl(canvas.toDataURL('image/png'));
        setOcrProgress(15);
      }

      // Dynamically import Tesseract.js to avoid SSR issues
      const Tesseract = await import('tesseract.js');
      setOcrProgress(20);

      const worker = await Tesseract.createWorker('eng', 1, {
        logger: (m: { status: string; progress?: number }) => {
          if (m.status === 'recognizing text' && m.progress) {
            setOcrProgress(20 + Math.round(m.progress * 70));
          }
        },
      });
      const result = await worker.recognize(ocrSource);
      await worker.terminate();
      setOcrProgress(95);

      const text = result.data.text;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      // Heuristic field extraction from block-letters text
      const extracted: Record<string, string> = {};
      const findAfterLabel = (label: string): string => {
        const idx = lines.findIndex(l => l.toUpperCase().includes(label.toUpperCase()));
        if (idx >= 0 && idx + 1 < lines.length) {
          const val = lines[idx + 1].replace(/^[-:_\s]+/, '').trim();
          if (val && val.length > 0 && !val.toUpperCase().includes('SECTION') && !val.toUpperCase().includes('STUDENT')) return val;
        }
        return '';
      };

      extracted.firstName = findAfterLabel('FIRST NAME');
      extracted.lastName = findAfterLabel('LAST NAME');
      extracted.dateOfBirth = findAfterLabel('DATE OF BIRTH');
      extracted.gender = findAfterLabel('GENDER');
      extracted.bloodGroup = findAfterLabel('BLOOD GROUP');
      extracted.religion = findAfterLabel('RELIGION');
      extracted.nationality = findAfterLabel('NATIONALITY');
      extracted.motherTongue = findAfterLabel('MOTHER TONGUE');
      extracted.aadhaarNo = findAfterLabel('AADHAAR');
      extracted.phone = findAfterLabel('MOBILE');
      extracted.email = findAfterLabel('EMAIL');
      extracted.addressLine = findAfterLabel('ADDRESS LINE');
      extracted.city = findAfterLabel('CITY');
      extracted.district = findAfterLabel('DISTRICT');
      extracted.stateName = findAfterLabel('STATE');
      extracted.pincode = findAfterLabel('PINCODE');
      extracted.guardianName = findAfterLabel('GUARDIAN FULL NAME');
      extracted.guardianPhone = findAfterLabel('GUARDIAN MOBILE');
      extracted.guardianEmail = findAfterLabel('GUARDIAN EMAIL');

      // Remove empty entries
      Object.keys(extracted).forEach(k => { if (!extracted[k]) delete extracted[k]; });

      setOcrResults(extracted);
      setEditedOcrResults(extracted);
      setOcrProgress(100);
      setOcrStatus('done');
    } catch (e) {
      console.error('OCR error:', e);
      setOcrStatus('error');
      setOcrProgress(0);
      // Still open the modal so the user sees the error clearly
      setOcrModalOpen(true);
    }
  };

  const applyPreset = (preset: 'official' | 'minimal' | 'detailed') => {
    setLayoutPreset(preset);
    if (preset === 'official') setHiddenSections(new Set());
    if (preset === 'minimal') setHiddenSections(new Set(['govt', 'documents', 'medical', 'pwd', 'marks']));
    if (preset === 'detailed') setHiddenSections(new Set());
  };

  const toggleSection = (id: string) => {
    setHiddenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isVisible = (id: string) => !hiddenSections.has(id);

  // ——— AI completeness analysis ———
  type TipTone = 'warn' | 'info' | 'success';
  interface AiTip { tone: TipTone; icon: string; title: string; body: string; action?: { label: string; run: () => void }; }
  const aiTips: AiTip[] = [];

  if (!header.logoDataUrl && !header.logoUrl) aiTips.push({ tone: 'info', icon: '🖼️', title: 'Add a school logo', body: 'Upload your logo (PNG/JPG) or paste a URL. It appears at the top of every printed form.', action: { label: 'Upload logo', run: () => { setShowAI(false); setShowSettings(true); setSettingsTab('identity'); } } });
  if (header.schoolName === DEFAULT_HEADER.schoolName) aiTips.push({ tone: 'warn', icon: '🏫', title: 'Update school name', body: 'Still showing the default "Eskoolia School". Set your real school name in header settings.', action: { label: 'Open settings', run: () => { setShowAI(false); setShowSettings(true); setSettingsTab('identity'); } } });
  if (!header.principalName || header.principalName === 'Principal') aiTips.push({ tone: 'info', icon: '✍️', title: "Set principal's name", body: 'The signature line reads "Principal". Add the full name for a polished, official document.', action: { label: 'Open settings', run: () => { setShowAI(false); setShowSettings(true); setSettingsTab('identity'); } } });
  if (!student.photo) aiTips.push({ tone: 'warn', icon: '📷', title: 'No student photo', body: 'A photo in Section 1 helps verify identity. Upload one in the Documents step of the enrollment form.' });
  if (!student.firstName || !student.lastName) aiTips.push({ tone: 'warn', icon: '👤', title: 'Student name incomplete', body: 'First or last name is missing. Go back to Identity step to fill it in.' });
  if (!student.admissionNo) aiTips.push({ tone: 'warn', icon: '🔢', title: 'No admission number', body: 'Admission number is required for official records. It should be auto-generated in Step 1.' });
  if (!student.guardians || student.guardians.length === 0) aiTips.push({ tone: 'warn', icon: '👨‍👩‍👧', title: 'No guardian details', body: 'At least one guardian is required. Fill in the Guardians step of the enrollment form.' });
  if (!student.emergencyName) aiTips.push({ tone: 'info', icon: '🚨', title: 'Emergency contact missing', body: 'An emergency contact is important for safety. Fill it in the Medical step.' });
  if (hiddenSections.size > 0) aiTips.push({ tone: 'info', icon: '👁', title: `${hiddenSections.size} section(s) hidden`, body: 'Some sections are hidden and won\'t appear in print. Use section toggles to adjust.', action: { label: 'Show all', run: () => setHiddenSections(new Set()) } });

  // Completeness score
  const checks = [
    !!(header.logoDataUrl || header.logoUrl), header.schoolName !== DEFAULT_HEADER.schoolName,
    !!(header.principalName && header.principalName !== 'Principal'),
    !!student.photo, !!(student.firstName && student.lastName),
    !!student.admissionNo, !!student.dateOfBirth, !!student.classId,
    !!student.phone, !!(student.guardians && student.guardians.length > 0),
    !!student.emergencyName,
  ];
  const pdfPct = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const pdfTone = pdfPct >= 80 ? 'high' : pdfPct >= 50 ? 'mid' : 'low';

  const SECTION_LIST = [
    { id: 'identity', label: '1. Student Identity' }, { id: 'academic', label: '2. Academic Placement' },
    { id: 'contact', label: '3. Contact & Address' }, { id: 'guardians', label: '4. Guardians' },
    { id: 'govt', label: '5. Government Identity' }, { id: 'documents', label: '6. Documents' },
    { id: 'medical', label: '7. Medical & Emergency' }, { id: 'pwd', label: '8. Specially Abled' },
    { id: 'marks', label: '9. Identity Marks' }, { id: 'declaration', label: '10. Declaration' },
  ];

  const ACCENT_COLORS = ['#6c3ce1', '#0ea5e9', '#059669', '#dc2626', '#ea580c', '#7c3aed', '#0f172a'];

  const dobFormatted = student.dateOfBirth
    ? new Date(student.dateOfBirth + "T00:00:00").toLocaleDateString("en-IN", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : "—";

  const generatedOn = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <div className="cf-backdrop" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div ref={modalRef} className="cf-modal consent-form" onClick={(e) => e.stopPropagation()}>
        {/* Non-printed toolbar */}
        <div className="cf-toolbar modal-header">
          <button type="button" className="cf-close-btn" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Close
          </button>
          <span className="cf-title">Student Verification Form</span>
          <div className="cf-toolbar-actions">
            <button type="button" className={`cf-tb-btn cf-tb-ai${showAI ? ' cf-tb-ai-active' : ''}`} onClick={() => { setShowAI(s => !s); setShowSettings(false); }} title="AI layout assistant">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l1.9 5.8L20 9.7l-5 3.6L16.5 19 12 15.7 7.5 19 9 13.3l-5-3.6 6.1-1.9L12 2z"/></svg>
              AI Assist
              {aiTips.some(t => t.tone === 'warn') && <span className="cf-tb-dot" aria-hidden="true"/>}
            </button>
            <button type="button" className={`cf-tb-btn cf-tb-settings${showSettings ? ' cf-tb-settings-active' : ''}`} onClick={() => { setShowSettings(s => !s); setShowAI(false); }} title="Customize school header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Header
            </button>
            <button type="button" className="cf-tb-btn cf-tb-print" onClick={() => printFormInNewWindow()} title="Print this form">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print
            </button>
            <button type="button" className="cf-tb-btn cf-tb-pdf" onClick={() => printFormInNewWindow()} title="Save as PDF">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Save PDF
            </button>
          </div>
        </div>

        {/* ——— AI Assistant Panel ——— */}
        {showAI && (
          <div className="cf-ai-panel">
            <div className="cf-ai-head">
              <div className="cf-ai-head-left">
                <div className="cf-ai-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l1.9 5.8L20 9.7l-5 3.6L16.5 19 12 15.7 7.5 19 9 13.3l-5-3.6 6.1-1.9L12 2z"/></svg>
                </div>
                <div>
                  <h4 className="cf-ai-title">AI Layout Assistant <span className="cf-ai-beta">BETA</span></h4>
                  <p className="cf-ai-sub">Real-time suggestions to make your form official and complete.</p>
                </div>
              </div>
              <div className="cf-ai-score-ring" title={`PDF readiness: ${pdfPct}%`}>
                <svg width="52" height="52" viewBox="0 0 52 52">
                  <circle cx="26" cy="26" r="21" fill="none" stroke="#f1f5f9" strokeWidth="5"/>
                  <circle cx="26" cy="26" r="21" fill="none" stroke={pdfTone === 'high' ? '#10b981' : pdfTone === 'mid' ? '#f59e0b' : '#8b5cf6'} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(pdfPct / 100) * 132} 132`} transform="rotate(-90 26 26)"/>
                </svg>
                <span className="cf-ai-score-text" data-tone={pdfTone}>{pdfPct}%</span>
              </div>
            </div>

            <div className="cf-ai-body">
              {/* Layout Presets */}
              <div className="cf-ai-section">
                <p className="cf-ai-section-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                  LAYOUT PRESET
                </p>
                <div className="cf-preset-row">
                  {([
                    { id: 'official' as const, icon: '🏛️', label: 'Official', desc: 'All 10 sections — full record' },
                    { id: 'minimal' as const, icon: '✦', label: 'Minimal', desc: 'Core 5 sections only' },
                    { id: 'detailed' as const, icon: '📋', label: 'Detailed', desc: 'All sections + full data' },
                  ]).map(p => (
                    <button key={p.id} type="button" className={`cf-preset-card${layoutPreset === p.id ? ' active' : ''}`} onClick={() => applyPreset(p.id)}>
                      <span className="cf-preset-icon">{p.icon}</span>
                      <span className="cf-preset-name">{p.label}</span>
                      <span className="cf-preset-desc">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent Color */}
              <div className="cf-ai-section">
                <p className="cf-ai-section-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
                  ACCENT COLOUR
                </p>
                <div className="cf-color-row">
                  {ACCENT_COLORS.map(c => (
                    <button key={c} type="button" className={`cf-color-swatch${accentColor === c ? ' active' : ''}`} style={{ background: c }} onClick={() => setAccentColor(c)} title={c} aria-label={`Use colour ${c}`}/>
                  ))}
                  <div className="cf-color-custom">
                    <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} title="Custom colour" aria-label="Custom accent colour"/>
                  </div>
                </div>
              </div>

              {/* Section Visibility */}
              <div className="cf-ai-section">
                <p className="cf-ai-section-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  SECTION VISIBILITY
                </p>
                <div className="cf-sections-grid">
                  {SECTION_LIST.map(s => (
                    <label key={s.id} className="cf-section-toggle">
                      <input type="checkbox" checked={isVisible(s.id)} onChange={() => toggleSection(s.id)}/>
                      <span className="cf-toggle-track"><span className="cf-toggle-thumb"/></span>
                      <span className="cf-toggle-label">{s.label}</span>
                    </label>
                  ))}
                </div>
                <div className="cf-vis-quick">
                  <button type="button" className="cf-vis-btn" onClick={() => setHiddenSections(new Set())}>Show all</button>
                  <button type="button" className="cf-vis-btn" onClick={() => setHiddenSections(new Set(SECTION_LIST.map(s => s.id)))}>Hide all</button>
                </div>
              </div>

              {/* Smart Tips */}
              {aiTips.length > 0 && (
                <div className="cf-ai-section">
                  <p className="cf-ai-section-label">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    SMART SUGGESTIONS ({aiTips.length})
                  </p>
                  <div className="cf-tips-list">
                    {aiTips.map((t, i) => (
                      <div key={i} className={`cf-tip cf-tip-${t.tone}`}>
                        <span className="cf-tip-icon">{t.icon}</span>
                        <div className="cf-tip-content">
                          <p className="cf-tip-title">{t.title}</p>
                          <p className="cf-tip-body">{t.body}</p>
                        </div>
                        {t.action && <button type="button" className="cf-tip-action" onClick={t.action.run}>{t.action.label}</button>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {aiTips.length === 0 && (
                <div className="cf-ai-all-good">
                  <span>🎉</span>
                  <p>Everything looks great! This form is ready to print or save as PDF.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== Settings Panel ===== */}
        {showSettings && (
          <div className="cf-settings-panel">
            {/* Hidden file inputs */}
            <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleLogoUpload(e.target.files[0], 'settings'); e.target.value = ''; }} />
            <input ref={letterheadInputRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleLetterheadUpload(e.target.files[0]); e.target.value = ''; }} />

            <div className="cf-sp-header">
              <div>
                <h4 className="cf-settings-title">Header Settings</h4>
                <p className="cf-settings-desc">Changes save to this browser and appear on every printed form.</p>
              </div>
              <div className="cf-sp-tabs">
                {(['identity', 'layout', 'import', 'declaration'] as const).map(tab => (
                  <button key={tab} type="button" className={`cf-sp-tab${settingsTab === tab ? ' active' : ''}`} onClick={() => setSettingsTab(tab)}>
                    {tab === 'identity' ? '🏫 School Info' : tab === 'layout' ? '🎨 Logo & Layout' : tab === 'import' ? '📄 Import Letterhead' : '📝 Declaration'}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Tab: School Info ── */}
            {settingsTab === 'identity' && (
              <div className="cf-settings-grid">
                {([
                  { key: 'schoolName',    label: 'School Name *',    placeholder: 'e.g. Sunshine Public School', span: 2 },
                  { key: 'schoolAddress', label: 'Address',          placeholder: 'Street, City, PIN',           span: 2 },
                  { key: 'schoolPhone',   label: 'Phone',            placeholder: '+91 98765 43210'              },
                  { key: 'schoolEmail',   label: 'Email',            placeholder: 'admissions@school.in'         },
                  { key: 'schoolWebsite', label: 'Website',          placeholder: 'www.schoolname.in'            },
                  { key: 'principalName', label: 'Principal Name *', placeholder: 'Full name for signature line' },
                  { key: 'affiliationNo',label: 'Affiliation / Reg No.', placeholder: 'CBSE / State board ref'  },
                  { key: 'schoolMotto',  label: 'Motto / Tagline',  placeholder: 'Shown under school name'      },
                ] as Array<{key:string;label:string;placeholder:string;span?:number}>).map(({ key, label, placeholder, span }) => (
                  <div key={key} className="cf-settings-field" style={span === 2 ? { gridColumn: '1 / -1' } : {}}>
                    <label className="cf-settings-label">{label}</label>
                    <input className="cf-settings-input" value={(settingsForm as Record<string,string>)[key] ?? ''} onChange={e => setSettingsForm(prev => ({ ...prev, [key]: e.target.value }))} placeholder={placeholder} />
                  </div>
                ))}
              </div>
            )}

            {/* ── Tab: Logo & Layout ── */}
            {settingsTab === 'layout' && (
              <div className="cf-layout-tab">
                {/* Logo upload zone */}
                <div className="cf-field-group">
                  <p className="cf-field-group-label">SCHOOL LOGO</p>
                  <div className="cf-logo-zone" onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file && file.type.startsWith('image/')) handleLogoUpload(file, 'settings'); }} onDragOver={e => e.preventDefault()}>
                    {settingsForm.logoDataUrl || settingsForm.logoUrl ? (
                      <div className="cf-logo-preview-wrap">
                        <img src={settingsForm.logoDataUrl || settingsForm.logoUrl} alt="Logo preview" className="cf-logo-preview-img" />
                        <div className="cf-logo-preview-actions">
                          <button type="button" className="cf-logo-change-btn" onClick={() => logoInputRef.current?.click()}>Change</button>
                          <button type="button" className="cf-logo-remove-btn" onClick={() => clearLogo('settings')}>Remove</button>
                        </div>
                      </div>
                    ) : (
                      <div className="cf-logo-empty" onClick={() => logoInputRef.current?.click()}>
                        <span className="cf-logo-upload-icon">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        </span>
                        <p className="cf-logo-empty-title">Drag &amp; drop or click to upload</p>
                        <p className="cf-logo-empty-hint">PNG, JPG, SVG, WebP — transparent background recommended</p>
                        <button type="button" className="cf-logo-browse-btn" onClick={e => { e.stopPropagation(); logoInputRef.current?.click(); }}>Browse files</button>
                      </div>
                    )}
                  </div>
                  <div className="cf-logo-url-row">
                    <span className="cf-logo-url-or">or paste URL</span>
                    <input className="cf-settings-input cf-logo-url-input" value={settingsForm.logoUrl} onChange={e => setSettingsForm(p => ({ ...p, logoUrl: e.target.value, logoDataUrl: '' }))} placeholder="https://yourschool.in/logo.png" />
                  </div>
                </div>

                {/* Header layout picker */}
                <div className="cf-field-group">
                  <p className="cf-field-group-label">HEADER LAYOUT <span className="cf-field-group-hint">— previews update with your chosen colours</span></p>
                  <div className="cf-layout-picker">
                    {((): Array<{id:HeaderLayout;label:string;desc:string;preview:(bg:string,tx:string)=>React.ReactNode}> => {
                      const bg = settingsForm.headerBgColor || '#ffffff';
                      const tx = settingsForm.headerTextColor || '#111827';
                      return [
                        {
                          id: 'classic',
                          label: 'Classic',
                          desc: 'Logo left · text right',
                          preview: (b,t) => (
                            <svg viewBox="0 0 84 44" width="76" height="40" style={{display:'block',borderRadius:4}}>
                              <rect width="84" height="44" fill={b} rx="4"/>
                              {/* logo box */}
                              <rect x="6" y="9" width="17" height="17" fill={t} opacity="0.15" rx="2.5"/>
                              <rect x="9" y="12" width="11" height="11" fill={t} opacity="0.2" rx="1.5"/>
                              {/* text lines */}
                              <rect x="29" y="10" width="42" height="5" fill={t} opacity="0.65" rx="2"/>
                              <rect x="29" y="19" width="30" height="3.5" fill={t} opacity="0.35" rx="1.5"/>
                              <rect x="29" y="25.5" width="22" height="3" fill={t} opacity="0.2" rx="1.5"/>
                            </svg>
                          ),
                        },
                        {
                          id: 'centered',
                          label: 'Centered',
                          desc: 'Logo top · text below centered',
                          preview: (b,t) => (
                            <svg viewBox="0 0 84 44" width="76" height="40" style={{display:'block',borderRadius:4}}>
                              <rect width="84" height="44" fill={b} rx="4"/>
                              {/* logo centered */}
                              <rect x="33" y="4" width="18" height="16" fill={t} opacity="0.15" rx="2.5"/>
                              <rect x="36" y="7" width="12" height="10" fill={t} opacity="0.2" rx="1.5"/>
                              {/* centered text */}
                              <rect x="12" y="24" width="60" height="5" fill={t} opacity="0.65" rx="2"/>
                              <rect x="20" y="32.5" width="44" height="3.5" fill={t} opacity="0.3" rx="1.5"/>
                            </svg>
                          ),
                        },
                        {
                          id: 'banner',
                          label: 'Banner',
                          desc: 'Full-width colour band',
                          preview: (b,t) => (
                            <svg viewBox="0 0 84 44" width="76" height="40" style={{display:'block',borderRadius:4}}>
                              {/* full colored bg */}
                              <rect width="84" height="44" fill={b === '#ffffff' ? '#6c3ce1' : b} rx="4"/>
                              {/* subtle inner glow */}
                              <rect x="0" y="0" width="84" height="44" fill="white" opacity="0.05" rx="4"/>
                              {/* logo */}
                              <rect x="7" y="12" width="15" height="15" fill={t === '#111827' ? '#fff' : t} opacity="0.25" rx="2.5"/>
                              <rect x="10" y="15" width="9" height="9" fill={t === '#111827' ? '#fff' : t} opacity="0.35" rx="1.5"/>
                              {/* text */}
                              <rect x="28" y="13" width="40" height="5" fill={t === '#111827' ? '#fff' : t} opacity="0.85" rx="2"/>
                              <rect x="28" y="22" width="28" height="3.5" fill={t === '#111827' ? '#fff' : t} opacity="0.5" rx="1.5"/>
                            </svg>
                          ),
                        },
                        {
                          id: 'minimal',
                          label: 'Minimal',
                          desc: 'Clean text only · no logo',
                          preview: (b,t) => (
                            <svg viewBox="0 0 84 44" width="76" height="40" style={{display:'block',borderRadius:4}}>
                              <rect width="84" height="44" fill={b} rx="4"/>
                              {/* just lines, clean */}
                              <rect x="8" y="12" width="54" height="5.5" fill={t} opacity="0.7" rx="2"/>
                              <rect x="8" y="21" width="40" height="3.5" fill={t} opacity="0.4" rx="1.5"/>
                              <rect x="8" y="28" width="28" height="3" fill={t} opacity="0.22" rx="1.5"/>
                              {/* thin bottom rule */}
                              <rect x="8" y="36" width="68" height="1" fill={t} opacity="0.12" rx="0.5"/>
                            </svg>
                          ),
                        },
                        {
                          id: 'letterhead',
                          label: 'Letterhead',
                          desc: 'Imported school image',
                          preview: (_b,_t) => (
                            <svg viewBox="0 0 84 44" width="76" height="40" style={{display:'block',borderRadius:4}}>
                              <defs>
                                <linearGradient id="lh-thumb-grad" x1="0" y1="0" x2="1" y2="1">
                                  <stop offset="0%" stopColor="#ede9fe"/>
                                  <stop offset="60%" stopColor="#f3e8ff"/>
                                  <stop offset="100%" stopColor="#fce7f3"/>
                                </linearGradient>
                              </defs>
                              <rect width="84" height="44" fill="url(#lh-thumb-grad)" rx="4"/>
                              {/* photo frame icon */}
                              <rect x="18" y="6" width="48" height="28" fill="none" stroke="#7c3aed" strokeWidth="1.5" rx="3" opacity="0.5"/>
                              {/* mountain + sun like real photo */}
                              <circle cx="30" cy="17" r="5" fill="#7c3aed" opacity="0.2"/>
                              <path d="M18 28 L30 20 L40 26 L50 18 L66 28" fill="#7c3aed" opacity="0.18" strokeWidth="0" fillRule="nonzero"/>
                              {/* image icon symbol */}
                              <path d="M38 13 L44 13 L46 10 L48 13 L54 13" fill="none" stroke="#7c3aed" strokeWidth="1" opacity="0.3"/>
                              {/* "your letterhead" label */}
                              <rect x="20" y="37" width="44" height="3" fill="#7c3aed" opacity="0.15" rx="1"/>
                            </svg>
                          ),
                        },
                      ];
                    })().map(l => (
                      <button key={l.id} type="button" className={`cf-layout-option${settingsForm.headerLayout === l.id ? ' active' : ''}`} onClick={() => { setSettingsForm(p => ({ ...p, headerLayout: l.id })); setHeader(prev => ({ ...prev, headerLayout: l.id })); }}>
                        <span className="cf-layout-thumb">{l.preview(settingsForm.headerBgColor || '#ffffff', settingsForm.headerTextColor || '#111827')}</span>
                        <span className="cf-layout-name">{l.label}</span>
                        <span className="cf-layout-desc">{l.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Colors */}
                <div className="cf-field-group">
                  <p className="cf-field-group-label">HEADER COLOURS</p>
                  <div className="cf-color-pair">
                    <div className="cf-color-item">
                      <label className="cf-settings-label">Background</label>
                      <div className="cf-color-input-wrap">
                        <input type="color" value={settingsForm.headerBgColor} onChange={e => setSettingsForm(p => ({ ...p, headerBgColor: e.target.value }))} />
                        <span>{settingsForm.headerBgColor}</span>
                      </div>
                    </div>
                    <div className="cf-color-item">
                      <label className="cf-settings-label">Text</label>
                      <div className="cf-color-input-wrap">
                        <input type="color" value={settingsForm.headerTextColor} onChange={e => setSettingsForm(p => ({ ...p, headerTextColor: e.target.value }))} />
                        <span>{settingsForm.headerTextColor}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Import Letterhead ── */}
            {settingsTab === 'import' && (
              <div className="cf-import-tab">
                <div className="cf-import-info">
                  <p className="cf-import-how-title">How it works</p>
                  <ol className="cf-import-steps">
                    <li>Upload a scan or photo of your school&apos;s official letterhead (top portion).</li>
                    <li>We&apos;ll set it as the header background image.</li>
                    <li>The header layout automatically switches to <strong>Letterhead</strong> mode — your image fills the top, then student data flows below.</li>
                    <li>On print, the letterhead is preserved exactly as-is.</li>
                  </ol>
                  <p className="cf-import-tip">💡 Tip — crop the image to show just the top 80–120px header strip for best results.</p>
                </div>

                <div className="cf-lh-zone" onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file) handleLetterheadUpload(file); }} onDragOver={e => e.preventDefault()}>
                  {settingsForm.letterheadBg ? (
                    <div className="cf-lh-preview-wrap">
                      <img src={settingsForm.letterheadBg} alt="Letterhead preview" className="cf-lh-preview-img" />
                      <div className="cf-lh-preview-actions">
                        <button type="button" className="cf-logo-change-btn" onClick={() => letterheadInputRef.current?.click()}>Replace</button>
                        <button type="button" className="cf-logo-remove-btn" onClick={clearLetterhead}>Remove</button>
                      </div>
                    </div>
                  ) : (
                    <div className="cf-logo-empty" onClick={() => letterheadInputRef.current?.click()}>
                      <span className="cf-logo-upload-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
                      </span>
                      <p className="cf-logo-empty-title">Upload your official letterhead</p>
                      <p className="cf-logo-empty-hint">PNG, JPG, or PDF page screenshot • Any size — we&apos;ll scale it</p>
                      <button type="button" className="cf-logo-browse-btn" onClick={e => { e.stopPropagation(); letterheadInputRef.current?.click(); }}>Browse files</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Tab: Declaration / T&C ── */}
            {settingsTab === 'declaration' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: '#f5f3ff', border: '1px solid #ede9fe', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#6d28d9', lineHeight: 1.6 }}>
                  <strong>💡 Tips:</strong>
                  <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
                    <li>Use <code style={{ background: '#ede9fe', padding: '1px 4px', borderRadius: 3 }}>{'{studentName}'}</code> — it will be replaced with the student's full name when printed.</li>
                    <li>You can add school-specific terms, fee policies, conduct clauses, or data privacy notices.</li>
                    <li>Changes are saved with your header settings and applied to all future printed forms.</li>
                  </ul>
                </div>

                <div className="cf-settings-field" style={{ gridColumn: '1 / -1' }}>
                  <label className="cf-settings-label" style={{ marginBottom: 6 }}>
                    Declaration / Terms &amp; Conditions
                    <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 8, fontSize: 11 }}>
                      ({(settingsForm.declarationText || '').length} chars)
                    </span>
                  </label>
                  <textarea
                    className="cf-settings-input"
                    rows={12}
                    style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.7, fontSize: 13 }}
                    value={settingsForm.declarationText ?? DEFAULT_DECLARATION}
                    onChange={e => setSettingsForm(prev => ({ ...prev, declarationText: e.target.value }))}
                    placeholder="Enter your school's declaration text, terms and conditions, or consent statement..."
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    onClick={() => setSettingsForm(prev => ({ ...prev, declarationText: DEFAULT_DECLARATION }))}
                  >
                    ↺ Reset to default declaration
                  </button>
                </div>

                {/* Live preview */}
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 16px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Preview</p>
                  <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>
                    {(settingsForm.declarationText || DEFAULT_DECLARATION).replace('{studentName}', student.firstName ? `${student.firstName} ${student.lastName}` : '[Student Name]')}
                  </p>
                </div>
              </div>
            )}

            <div className="cf-settings-actions">
              <button type="button" onClick={resetToDefault} className="cf-settings-reset" title="Reset all header settings to defaults">Reset defaults</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setShowSettings(false)} className="cf-settings-cancel">Cancel</button>
                <button type="button" onClick={saveSettings} className="cf-settings-save">
                  {settingsSaved ? '✓ Applied!' : 'Apply & save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Printable body */}
        <div className="cf-body">
          {/* Generated-on note (print only) */}
          <p className="cf-print-date">Generated on: {generatedOn}</p>

          {/* School header */}
          {header.headerLayout === 'letterhead' && header.letterheadBg ? (
            <div className="cf-lh-header-wrap">
              <img src={header.letterheadBg} alt="School letterhead" className="cf-lh-header-img" />
              {inlineEditing && (
                <div className="cf-inline-edit-bar">
                  <span className="cf-inline-badge">✏️ Editing letterhead info</span>
                  <button type="button" className="cf-inline-save-btn" onClick={saveInlineHeader}>Save</button>
                  <button type="button" className="cf-inline-cancel-btn" onClick={() => { setInlineEditing(false); setInlineHeader(header); }}>Cancel</button>
                </div>
              )}
            </div>
          ) : (
            <div
              className={`cf-school-header cf-header-${header.headerLayout}`}
              style={{ background: header.headerBgColor || '#fff', color: header.headerTextColor || '#111827' }}
            >
              {/* Logo zone */}
              {header.headerLayout !== 'minimal' && (
                <div className="cf-logo-zone-header" onClick={() => inlineEditing && logoInputRef.current?.click()} title={inlineEditing ? 'Click to change logo' : ''} style={{ cursor: inlineEditing ? 'pointer' : 'default' }}>
                  {(inlineEditing ? inlineHeader : header).logoDataUrl || (inlineEditing ? inlineHeader : header).logoUrl ? (
                    <img
                      src={(inlineEditing ? inlineHeader : header).logoDataUrl || (inlineEditing ? inlineHeader : header).logoUrl}
                      alt="School logo"
                      className="cf-school-logo-img"
                    />
                  ) : (
                    <div className="cf-school-logo-placeholder" style={{ color: header.headerTextColor }}>
                      {inlineEditing ? <span title="Click to upload logo">🖼️<span style={{fontSize:10,display:'block'}}>Upload</span></span> : '🏫'}
                    </div>
                  )}
                  {inlineEditing && <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleLogoUpload(e.target.files[0], 'inline'); e.target.value = ''; }} />}
                </div>
              )}

              {/* Text zone */}
              <div className="cf-header-text-zone">
                {inlineEditing ? (
                  <>
                    <input className="cf-inline-input cf-inline-name" value={inlineHeader.schoolName} onChange={e => setInlineHeader(p => ({ ...p, schoolName: e.target.value }))} placeholder="School name" style={{ color: inlineHeader.headerTextColor }} />
                    {inlineHeader.schoolMotto && <input className="cf-inline-input cf-inline-motto" value={inlineHeader.schoolMotto} onChange={e => setInlineHeader(p => ({ ...p, schoolMotto: e.target.value }))} placeholder="Motto" style={{ color: inlineHeader.headerTextColor, opacity: 0.75 }} />}
                    <input className="cf-inline-input cf-inline-addr" value={inlineHeader.schoolAddress} onChange={e => setInlineHeader(p => ({ ...p, schoolAddress: e.target.value }))} placeholder="Address" style={{ color: inlineHeader.headerTextColor, opacity: 0.75 }} />
                    <div className="cf-inline-row">
                      <input className="cf-inline-input" value={inlineHeader.schoolPhone} onChange={e => setInlineHeader(p => ({ ...p, schoolPhone: e.target.value }))} placeholder="Phone" style={{ color: inlineHeader.headerTextColor, opacity: 0.75, flex:1 }} />
                      <input className="cf-inline-input" value={inlineHeader.schoolEmail} onChange={e => setInlineHeader(p => ({ ...p, schoolEmail: e.target.value }))} placeholder="Email" style={{ color: inlineHeader.headerTextColor, opacity: 0.75, flex:2 }} />
                    </div>
                  </>
                ) : (
                  <>
                    <h1 className="cf-school-name" style={{ color: header.headerTextColor }}>{header.schoolName}</h1>
                    {header.schoolMotto && <p className="cf-school-motto" style={{ color: header.headerTextColor }}>{header.schoolMotto}</p>}
                    <p className="cf-school-address" style={{ color: header.headerTextColor, opacity: 0.75 }}>
                      {header.schoolAddress}
                      {header.schoolPhone ? ` · ${header.schoolPhone}` : ''}
                      {header.schoolEmail ? ` · ${header.schoolEmail}` : ''}
                      {header.affiliationNo ? ` · Affil. No: ${header.affiliationNo}` : ''}
                    </p>
                  </>
                )}
              </div>

              {/* Inline edit toggle (screen only, not printed) */}
              {!inlineEditing ? (
                <button type="button" className="cf-inline-edit-trigger" onClick={() => { setInlineEditing(true); setInlineHeader(header); }} title="Edit header directly">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit header
                </button>
              ) : (
                <div className="cf-inline-actions">
                  <button type="button" className="cf-inline-save-btn" onClick={saveInlineHeader}>✓ Save</button>
                  <button type="button" className="cf-inline-cancel-btn" onClick={() => { setInlineEditing(false); setInlineHeader(header); }}>✕</button>
                </div>
              )}
            </div>
          )}

          <hr className="cf-divider" />

          <h2 className="cf-form-title">Student Verification Form</h2>
          <p className="cf-form-subtitle">Please verify all details. Contact the school if any information is incorrect.</p>

          {/* Section 1: Student Identity */}
          {isVisible('identity') && (
          <div className="cf-section">
            <h3 className="cf-section-heading" style={{ color: accentColor, borderColor: accentColor + '33' }}>1. Student Identity</h3>
            <div className="cf-detail-grid">
              {student.photo ? (
                <img src={student.photo} alt="Student photo" className="cf-student-photo" />
              ) : (
                <div className="cf-photo-placeholder">Photo</div>
              )}
              <table className="cf-table">
                <tbody>
                  <tr><th>Full Name</th><td>{[student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ') || '—'}</td></tr>
                  <tr><th>Admission No.</th><td>{val(student.admissionNo)}</td></tr>
                  <tr><th>Date of Birth</th><td>{dobFormatted}</td></tr>
                  <tr><th>Gender</th><td>{student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : '—'}</td></tr>
                  <tr><th>Blood Group</th><td>{val(student.bloodGroup)}</td></tr>
                  <tr><th>Mother Tongue</th><td>{val(student.motherTongue)}</td></tr>
                  <tr><th>Religion</th><td>{(!student.religion || student.religion === 'Prefer not to say') ? '—' : val(student.religion)}</td></tr>
                  <tr><th>Nationality</th><td>{val(student.nationality)}</td></tr>
                  <tr><th>Status</th><td>{student.statusValue ? student.statusValue.charAt(0).toUpperCase() + student.statusValue.slice(1) : '—'}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          )}

          {/* Section 2: Academic Placement */}
          {isVisible('academic') && (
          <div className="cf-section">
            <h3 className="cf-section-heading" style={{ color: accentColor, borderColor: accentColor + '33' }}>2. Academic Placement</h3>
            <table className="cf-table">
              <tbody>
                <tr><th>Academic Year</th><td>{val(student.academicYearName)}</td></tr>
                <tr><th>Class &amp; Section</th><td>{student.className || '—'}{student.sectionName ? ` – ${student.sectionName}` : ''}</td></tr>
                <tr><th>Admission Type</th><td>{val(student.admissionType)}</td></tr>
                <tr><th>Category</th><td>{val(student.categoryName)}</td></tr>
                {student.streamId ? <tr><th>Stream</th><td>{student.streamId}</td></tr> : null}
                {student.previousSchoolName ? <tr><th>Previous School</th><td>{student.previousSchoolName}</td></tr> : null}
              </tbody>
            </table>
          </div>
          )}

          {/* Section 3: Contact & Address */}
          {isVisible('contact') && (
          <div className="cf-section">
            <h3 className="cf-section-heading" style={{ color: accentColor, borderColor: accentColor + '33' }}>3. Contact &amp; Address</h3>
            <table className="cf-table">
              <tbody>
                <tr><th>Phone</th><td>{val(student.phone)}</td></tr>
                <tr><th>Email</th><td>{val(student.email)}</td></tr>
                <tr><th>Address</th><td>{val(student.addressLine)}</td></tr>
                <tr><th>City</th><td>{val(student.city)}</td></tr>
                <tr><th>District</th><td>{val(student.district)}</td></tr>
                <tr><th>State</th><td>{val(student.stateName)}</td></tr>
                <tr><th>Pincode</th><td>{val(student.pincode)}</td></tr>
              </tbody>
            </table>
          </div>
          )}

          {/* Section 4: Guardians */}
          {isVisible('guardians') && (
          <div className="cf-section">
            <h3 className="cf-section-heading" style={{ color: accentColor, borderColor: accentColor + '33' }}>4. Guardians</h3>
            {student.guardians && student.guardians.length > 0 ? (
              student.guardians.map((g, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  {g.isPrimary && <span className="cf-primary-badge">PRIMARY</span>}
                  <table className="cf-table">
                    <tbody>
                      <tr><th>Name</th><td>{val(g.full_name)}</td></tr>
                      <tr><th>Relation</th><td>{val(g.relation)}</td></tr>
                      <tr><th>Phone</th><td>{val(g.phone)}</td></tr>
                      {g.email ? <tr><th>Email</th><td>{g.email}</td></tr> : null}
                      {g.occupation ? <tr><th>Occupation</th><td>{g.occupation}</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              ))
            ) : (
              <p className="cf-empty">No guardian details provided.</p>
            )}
          </div>
          )}

          {/* Section 5: Government Identity */}
          {isVisible('govt') && (
          <div className="cf-section">
            <h3 className="cf-section-heading" style={{ color: accentColor, borderColor: accentColor + '33' }}>5. Government Identity</h3>
            <table className="cf-table">
              <tbody>
                <tr><th>PEN / UDISE+</th><td>{val(student.pen)}</td></tr>
                <tr><th>ABC Portal ID</th><td>{val(student.abcId)}</td></tr>
              </tbody>
            </table>
            <p className="cf-security-note">🔒 Aadhaar number and APAAR ID are encrypted and not displayed for security.</p>
          </div>
          )}

          {/* Section 6: Documents Checklist */}
          {isVisible('documents') && (
          <div className="cf-section">
            <h3 className="cf-section-heading" style={{ color: accentColor, borderColor: accentColor + '33' }}>6. Documents Checklist</h3>
            {student.documents && Object.keys(student.documents).length > 0 ? (
              <table className="cf-table">
                <tbody>
                  {(Object.entries(student.documents) as Array<[string, { status: string; fileName: string }]>).map(([key, doc]) => (
                    <tr key={key}>
                      <th>{DOC_LABELS[key] || key}</th>
                      <td>
                        <span className={doc.status === 'success' ? 'cf-status-ok' : 'cf-status-pending'}>
                          {doc.status === 'success' ? '✓ Submitted' : '○ Pending'}
                        </span>
                        {doc.status === 'success' && doc.fileName ? ` — ${doc.fileName}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="cf-empty">No documents uploaded yet.</p>
            )}
          </div>
          )}

          {/* Section 7: Medical & Emergency */}
          {isVisible('medical') && (
          <div className="cf-section">
            <h3 className="cf-section-heading" style={{ color: accentColor, borderColor: accentColor + '33' }}>7. Medical &amp; Emergency</h3>
            <table className="cf-table">
              <tbody>
                <tr><th>Height</th><td>{student.heightCm ? `${student.heightCm} cm` : '—'}</td></tr>
                <tr><th>Weight</th><td>{student.weightKg ? `${student.weightKg} kg` : '—'}</td></tr>
                <tr><th>Vision</th><td>{val(student.vision)}</td></tr>
                <tr><th>Known Conditions</th><td>{student.medicalConditions?.length ? student.medicalConditions.join(', ') : '—'}</td></tr>
                <tr><th>Allergies</th><td>{student.allergies?.length ? student.allergies.join(', ') : '—'}</td></tr>
                <tr><th>Current Medications</th><td>{val(student.currentMedications)}</td></tr>
                <tr><th>Treating Doctor</th><td>{val(student.treatingDoctor)}</td></tr>
                <tr>
                  <th>Vaccinations</th>
                  <td>{student.checkedVaccinations?.length
                    ? student.checkedVaccinations.map(v => VAC_LABELS[v] || v).join(', ')
                    : '—'}
                  </td>
                </tr>
                <tr><th>Emergency Contact</th><td>{val(student.emergencyName)}</td></tr>
                <tr><th>Emergency Phone</th><td>{val(student.emergencyPhone)}</td></tr>
              </tbody>
            </table>
          </div>
          )}
          {/* Section 8: Specially Abled */}
          {isVisible('pwd') && (
          <div className="cf-section">
            <h3 className="cf-section-heading" style={{ color: accentColor, borderColor: accentColor + '33' }}>8. Specially Abled (PwD)</h3>
            <table className="cf-table">
              <tbody>
                <tr><th>PwD Disclosure</th><td>{student.isPwD ? 'Yes — disclosed' : 'Not Disclosed'}</td></tr>
                {student.isPwD && <>
                  <tr><th>Disability Types</th><td>{student.disabilityTypes?.length ? student.disabilityTypes.join(', ') : '—'}</td></tr>
                  <tr><th>Disability %</th><td>{student.disabilityPercent != null ? `${student.disabilityPercent}%` : '—'}</td></tr>
                  <tr><th>UDID No.</th><td>{val(student.udid)}</td></tr>
                  <tr><th>Accommodations</th><td>{student.accommodations?.length ? student.accommodations.join(', ') : '—'}</td></tr>
                </>}
              </tbody>
            </table>
          </div>
          )}

          {/* Section 9: Physical Identity Marks */}
          {isVisible('marks') && (
          <div className="cf-section">
            <h3 className="cf-section-heading" style={{ color: accentColor, borderColor: accentColor + '33' }}>9. Physical Identity Marks</h3>
            <table className="cf-table">
              <tbody>
                <tr><th>Eye Colour</th><td>{val(student.eyeColour)}</td></tr>
                <tr><th>Hair Colour</th><td>{val(student.hairColour)}</td></tr>
                <tr><th>Complexion</th><td>{val(student.complexion)}</td></tr>
                <tr><th>Build</th><td>{val(student.build)}</td></tr>
              </tbody>
            </table>
            {student.identityMarks && student.identityMarks.length > 0 ? (
              <ol className="cf-marks-list">
                {student.identityMarks.map((m, i) => (
                  <li key={i}><strong>{m.location}:</strong> {m.description}</li>
                ))}
              </ol>
            ) : (
              <p className="cf-empty" style={{ marginTop: 8 }}>None recorded.</p>
            )}
          </div>
          )}

          {/* Section 10: Declaration */}
          {isVisible('declaration') && (
          <div className="cf-section">
            <h3 className="cf-section-heading" style={{ color: accentColor, borderColor: accentColor + '33' }}>10. Declaration</h3>
            {inlineEditing ? (
              <div style={{ position: 'relative' }}>
                <textarea
                  className="field-input"
                  rows={6}
                  style={{ width: '100%', resize: 'vertical', fontSize: 13, lineHeight: 1.6 }}
                  value={declarationText.replace('{studentName}', `${student.firstName} ${student.lastName}`)}
                  onChange={(e) => {
                    const studentName = `${student.firstName} ${student.lastName}`;
                    setDeclarationText(e.target.value.replace(studentName, '{studentName}'));
                  }}
                />
                <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Tip: The student name will be inserted automatically.</p>
              </div>
            ) : (
              <p className="cf-declaration">
                {declarationText.replace('{studentName}', `${student.firstName} ${student.lastName}`)}
              </p>
            )}
          </div>
          )}

          {/* Signature lines */}
          <div className="cf-signatures">
            <div className="cf-sig-block">
              <div className="cf-sig-line"></div>
              <p className="cf-sig-label">Guardian / Parent Signature</p>
            </div>
            <div className="cf-sig-block">
              <div className="cf-sig-line"></div>
              <p className="cf-sig-label">{header.principalName} / Authorised Signatory</p>
            </div>
            <div className="cf-sig-block">
              <div className="cf-sig-line"></div>
              <p className="cf-sig-label">Date</p>
            </div>
          </div>

          {/* ——— Upload Signed Form footer (screen only) ——— */}
          <div className="cf-upload-signed-bar no-print">
            <input
              ref={signedFormInputRef}
              type="file"
              accept="application/pdf,image/*"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleSignedFormUpload(file);
                e.target.value = '';
              }}
            />

            <div className="cf-upload-signed-left">
              <div className="cf-upload-signed-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
              </div>
              <div>
                <p className="cf-upload-signed-title">Upload signed copy</p>
                <p className="cf-upload-signed-hint">
                  {uploadStatus === 'done'
                    ? `✓ Saved: ${uploadedFileName}`
                    : 'Print this form → get it signed → upload the scanned PDF or photo here to save it permanently.'}
                </p>
              </div>
            </div>

            <div className="cf-upload-signed-right">
              {uploadStatus === 'done' ? (
                <>
                  {uploadedFileUrl && (
                    <a href={uploadedFileUrl} target="_blank" rel="noopener noreferrer" className="cf-upload-view-btn">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      View saved
                    </a>
                  )}
                  <button type="button" className="cf-upload-replace-btn" onClick={() => { setUploadStatus('idle'); setUploadedFileUrl(''); setUploadedFileName(''); signedFormInputRef.current?.click(); }}>Replace</button>
                </>
              ) : uploadStatus === 'uploading' ? (
                <span className="cf-upload-spinner">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></path></svg>
                  Uploading…
                </span>
              ) : (
                <button
                  type="button"
                  className="cf-upload-signed-btn"
                  onClick={() => {
                    if (!student.studentId) {
                      setUploadError('Student record must be enrolled first before uploading a signed form.');
                      return;
                    }
                    signedFormInputRef.current?.click();
                  }}
                  title={!student.studentId ? 'Enroll the student first' : 'Upload the scanned signed form'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Upload signed form
                </button>
              )}
            </div>

            {uploadStatus === 'error' && (
              <p className="cf-upload-error">⚠ {uploadError}</p>
            )}
          </div>
        </div>
      </div>

      {/* ——— Scan File Picker Modal ——— */}
      {scanPickerOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:20000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setScanPickerOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:14, padding:0, maxWidth:520, width:'100%', boxShadow:'0 24px 64px rgba(0,0,0,0.3)', overflow:'hidden' }}>
            <div style={{ background:'linear-gradient(135deg,#1e3a8a,#3b82f6)', padding:'18px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <h3 style={{ margin:0, color:'#fff', fontSize:17, fontWeight:700 }}>📷 Scan &amp; Fill</h3>
                <p style={{ margin:'4px 0 0', color:'rgba(255,255,255,0.8)', fontSize:12 }}>Upload a scanned filled form — we&apos;ll read it and pre-fill the enrollment fields</p>
              </div>
              <button type="button" onClick={() => setScanPickerOpen(false)} style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', borderRadius:'50%', width:30, height:30, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
            </div>
            <div style={{ padding:'28px 24px' }}>
              <div style={{ border:'2px dashed #93c5fd', borderRadius:12, padding:'32px 20px', textAlign:'center', background:'#eff6ff', cursor:'pointer', transition:'border-color 0.2s' }}
                onClick={() => scanFileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); }}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) { setScanPickerOpen(false); void handleOcrUpload(f).then(() => setOcrModalOpen(true)); } }}>
                <div style={{ fontSize:40, marginBottom:10 }}>🖼️</div>
                <p style={{ fontWeight:700, fontSize:15, color:'#1e40af', margin:'0 0 6px' }}>Click to select a scanned form</p>
                <p style={{ fontSize:12, color:'#6b7280', margin:0 }}>Accepted: JPG, PNG, PDF &nbsp;·&nbsp; Max 20MB</p>
                <p style={{ fontSize:11, color:'#9ca3af', marginTop:8 }}>Or drag &amp; drop the file here</p>
              </div>
              <input
                ref={scanFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                style={{ display:'none' }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setScanPickerOpen(false);
                  void handleOcrUpload(f).then(() => setOcrModalOpen(true));
                  e.target.value = '';
                }}
              />
              <div style={{ marginTop:20, padding:'12px 16px', background:'#fef9c3', borderRadius:8, border:'1px solid #fde047' }}>
                <p style={{ margin:0, fontSize:12, color:'#78350f', fontWeight:600 }}>📋 For best results:</p>
                <ul style={{ margin:'6px 0 0', paddingLeft:18, fontSize:11.5, color:'#92400e', lineHeight:1.8 }}>
                  <li>Photograph in good lighting — all 4 corners of the form visible</li>
                  <li>Form must be filled in <strong>BLOCK LETTERS</strong> with dark pen</li>
                  <li>Avoid shadows, folds, or glare on the form</li>
                  <li>Scan at 300 DPI or higher for best accuracy</li>
                </ul>
              </div>
            </div>
            <div style={{ padding:'14px 24px', borderTop:'1px solid #e5e7eb', background:'#f9fafb', display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button type="button" onClick={() => setScanPickerOpen(false)} style={{ padding:'9px 20px', background:'#fff', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', color:'#374151' }}>Cancel</button>
              <button type="button" onClick={() => scanFileInputRef.current?.click()} style={{ padding:'9px 20px', background:'#3b82f6', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>📁 Browse files</button>
            </div>
          </div>
        </div>
      )}

      {/* ——— OCR Scanning Progress Overlay ——— */}
      {ocrStatus === 'scanning' && !ocrModalOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:20000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:14, padding:'32px 40px', textAlign:'center', minWidth:300 }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🔍</div>
            <p style={{ fontWeight:700, fontSize:16, color:'#111827', margin:'0 0 8px' }}>Scanning your form…</p>
            <p style={{ fontSize:13, color:'#6b7280', margin:'0 0 16px' }}>Reading text from the image. This takes a few seconds.</p>
            <div style={{ background:'#e5e7eb', borderRadius:999, height:8, overflow:'hidden' }}>
              <div style={{ background:'#3b82f6', height:'100%', borderRadius:999, width:`${ocrProgress}%`, transition:'width 0.3s' }} />
            </div>
            <p style={{ fontSize:12, color:'#9ca3af', marginTop:8 }}>{ocrProgress}% complete</p>
          </div>
        </div>
      )}

      {/* ——— OCR Review Modal ——— */}
      {ocrModalOpen && (
        <div className="ocr-modal-backdrop">
          <div className="ocr-modal">
            <div className="ocr-modal-head">
              <div>
                <h3>🔍 Scan Results — Review &amp; Edit</h3>
                <p>Fields extracted from the uploaded form. Edit any incorrect values before applying.</p>
              </div>
              <button type="button" className="ocr-modal-close" onClick={() => { setOcrModalOpen(false); setOcrStatus('idle'); }}>✕</button>
            </div>
            {ocrStatus === 'error' ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'48px 24px', textAlign:'center' }}>
                <div style={{ fontSize:48, marginBottom:16 }}>❌</div>
                <p style={{ fontWeight:700, fontSize:16, color:'#dc2626', margin:'0 0 10px' }}>OCR Scan Failed</p>
                <p style={{ fontSize:13, color:'#6b7280', margin:'0 0 20px', maxWidth:360, lineHeight:1.8 }}>
                  Unable to read text from this file. For best results:<br/>
                  • Use a clear photograph or high-resolution scan<br/>
                  • Form must be filled in <strong>BLOCK LETTERS</strong> with dark ink<br/>
                  • Ensure all 4 corners are visible — no glare or shadows<br/>
                  • PDFs are rendered from page 1; try uploading a JPG/PNG for cleaner results
                </p>
                <button type="button" onClick={() => { setOcrModalOpen(false); setOcrStatus('idle'); setScanPickerOpen(true); }}
                  style={{ padding:'10px 22px', background:'#3b82f6', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  Try Again
                </button>
              </div>
            ) : (
              <>
                <div className="ocr-modal-body">
                  {ocrImageUrl && (
                    <div className="ocr-image-pane" style={{ width:'38%', flexShrink:0 }}>
                      <img src={ocrImageUrl} alt="Scanned form" style={{ width:'100%', borderRadius:8, border:'1px solid #e5e7eb' }} />
                    </div>
                  )}
                  <div className="ocr-fields-pane" style={{ flex:1, overflowY:'auto', maxHeight:480, paddingRight:8 }}>
                    <h4>Extracted Values — correct any mistakes below:</h4>
                    {Object.entries({
                      firstName: 'First Name',
                      lastName: 'Last Name',
                      dateOfBirth: 'Date of Birth',
                      gender: 'Gender',
                      bloodGroup: 'Blood Group',
                      religion: 'Religion',
                      nationality: 'Nationality',
                      motherTongue: 'Mother Tongue',
                      aadhaarNo: 'Aadhaar Number',
                      phone: 'Mobile Phone',
                      email: 'Email',
                      addressLine: 'Address Line',
                      city: 'City',
                      district: 'District',
                      stateName: 'State',
                      pincode: 'Pincode',
                      guardianName: 'Guardian Name',
                      guardianPhone: 'Guardian Mobile',
                      guardianEmail: 'Guardian Email',
                    }).map(([field, label]) => (
                      editedOcrResults[field] !== undefined ? (
                        <div key={field} className="ocr-field-row">
                          <label className="ocr-field-label">{label}</label>
                          <input
                            type="text"
                            className="ocr-field-input"
                            value={editedOcrResults[field] || ''}
                            onChange={e => setEditedOcrResults(prev => ({ ...prev, [field]: e.target.value }))}
                          />
                        </div>
                      ) : null
                    ))}
                    {Object.keys(editedOcrResults).length === 0 && (
                      <p style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>
                        ⚠ No fields were detected. The image may be unclear. Please ensure:<br/>
                        • Good lighting and all 4 corners visible<br/>
                        • Text filled in BLOCK LETTERS<br/>
                        • No folds or shadows on the form
                      </p>
                    )}
                  </div>
                </div>
                <div className="ocr-modal-footer">
                  <span className="ocr-note">
                    {Object.keys(editedOcrResults).length} field{Object.keys(editedOcrResults).length !== 1 ? 's' : ''} detected.
                    Review and correct any errors — then click Apply to fill the form.
                  </span>
                  <button type="button" className="ocr-discard-btn" onClick={() => { setOcrModalOpen(false); setOcrResults({}); setEditedOcrResults({}); setOcrImageUrl(''); setOcrStatus('idle'); }}>
                    Discard
                  </button>
                  <button
                    type="button"
                    className="ocr-apply-btn"
                    onClick={() => {
                      if (onOcrApply) {
                        onOcrApply(editedOcrResults);
                        const REQUIRED = ['firstName','lastName','dateOfBirth','gender','phone','addressLine','pincode','city','stateName'];
                        const missing = REQUIRED.filter(f => !editedOcrResults[f]?.trim());
                        if (missing.length > 0) {
                          const labels: Record<string,string> = { firstName:'First Name', lastName:'Last Name', dateOfBirth:'Date of Birth', gender:'Gender', phone:'Mobile Number', addressLine:'Address Line', pincode:'Pincode', city:'City', stateName:'State' };
                          setOcrMissingFields(missing.map(f => labels[f] || f));
                        }
                      }
                      setOcrModalOpen(false);
                      setOcrResults({});
                      setEditedOcrResults({});
                      setOcrImageUrl('');
                      setOcrStatus('done');
                    }}
                  >
                    ✓ Apply to Form ({Object.keys(editedOcrResults).length} fields)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {ocrMissingFields.length > 0 && (
        <div style={{ position:'fixed', bottom:24, right:24, background:'#fff', border:'2px solid #f59e0b', borderRadius:12, padding:'16px 20px', maxWidth:340, zIndex:20001, boxShadow:'0 8px 24px rgba(0,0,0,0.15)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <strong style={{ fontSize:14, color:'#92400e' }}>⚠ Fields not detected</strong>
            <button type="button" onClick={() => setOcrMissingFields([])} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#9ca3af' }}>×</button>
          </div>
          <p style={{ fontSize:12, color:'#6b7280', margin:'0 0 10px' }}>These required fields were not found in the scan — please fill them manually:</p>
          <ul style={{ margin:0, paddingLeft:18, fontSize:13, color:'#1f2937', lineHeight:2 }}>
            {ocrMissingFields.map(f => <li key={f}>{f}</li>)}
          </ul>
          <button type="button" onClick={() => setOcrMissingFields([])} style={{ marginTop:12, width:'100%', padding:'8px', background:'#f59e0b', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>Got it</button>
        </div>
      )}

      <style jsx>{`
        .cf-backdrop {
          position: fixed;
          inset: 0;
          z-index: 900;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(3px);
          overflow-y: auto;
        }

        .cf-modal {
          background: #fff;
          max-width: 860px;
          margin: 24px auto;
          border-radius: 12px;
          box-shadow: 0 16px 60px rgba(0, 0, 0, 0.2);
          overflow: hidden;
        }

        .cf-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 18px;
          border-bottom: 1px solid #e5e7eb;
          background: #fff;
          flex-wrap: wrap;
        }

        .cf-close-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          background: #fafafa;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .cf-close-btn:hover { background: #f3f4f6; border-color: #d1d5db; }

        .cf-title {
          flex: 1;
          font-size: 14.5px;
          font-weight: 600;
          color: #111827;
          text-align: center;
          min-width: 120px;
        }

        .cf-toolbar-actions {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
        }

        /* Unified toolbar button */
        .cf-tb-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 16px;
          border-radius: 9px;
          border: 1px solid transparent;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
          position: relative;
        }
        .cf-tb-dot {
          position: absolute;
          top: 7px;
          right: 7px;
          width: 7px;
          height: 7px;
          background: #f59e0b;
          border-radius: 50%;
          border: 1.5px solid #fff;
        }
        .cf-tb-settings {
          background: #fafafa;
          border-color: #e5e7eb;
          color: #374151;
        }
        .cf-tb-settings:hover, .cf-tb-settings-active {
          background: #f5f3ff;
          border-color: #c4b5fd;
          color: #6c3ce1;
        }
        .cf-tb-ai {
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          color: #fff;
          box-shadow: 0 3px 12px -3px rgba(139,92,246,0.45);
        }
        .cf-tb-ai:hover {
          box-shadow: 0 6px 18px -4px rgba(236,72,153,0.55);
          transform: translateY(-1px);
        }
        .cf-tb-ai-active {
          box-shadow: 0 0 0 3px rgba(139,92,246,0.25), 0 6px 18px -4px rgba(139,92,246,0.45);
        }
        .cf-tb-print {
          background: #fafafa;
          border-color: #e5e7eb;
          color: #374151;
        }
        .cf-tb-print:hover { background: #f3f4f6; border-color: #d1d5db; }
        .cf-tb-pdf {
          background: #6c3ce1;
          color: #fff;
          border-color: transparent;
          box-shadow: 0 3px 10px -3px rgba(108,60,225,0.4);
        }
        .cf-tb-pdf:hover {
          background: #5a2ee0;
          transform: translateY(-1px);
          box-shadow: 0 6px 16px -4px rgba(108,60,225,0.5);
        }
        /* Upload signed form button */
        .cf-tb-upload {
          background: #f0fdf4;
          border-color: #86efac;
          color: #16a34a;
        }
        .cf-tb-upload:hover { background: #dcfce7; border-color: #4ade80; }
        .cf-tb-upload-done {
          background: #16a34a;
          color: #fff;
          border-color: #15803d;
        }
        /* Blank form download */
        .cf-tb-blank {
          background: #fffbeb;
          border-color: #fcd34d;
          color: #b45309;
        }
        .cf-tb-blank:hover { background: #fef3c7; border-color: #f59e0b; }
        /* OCR scan & fill button */
        .cf-tb-ocr {
          background: linear-gradient(135deg, #0ea5e9, #6366f1);
          color: #fff;
          border-color: transparent;
          box-shadow: 0 3px 10px -3px rgba(14,165,233,0.4);
        }
        .cf-tb-ocr:hover { transform: translateY(-1px); box-shadow: 0 6px 16px -4px rgba(99,102,241,0.5); }
        .cf-tb-ocr-active { opacity: 0.8; cursor: wait; }
        .cf-tb-ocr:disabled { cursor: wait; }

        /* ——— OCR Review Modal ——— */
        .ocr-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1100;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .ocr-modal {
          background: #fff;
          border-radius: 14px;
          width: 100%;
          max-width: 860px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0,0,0,0.25);
          overflow: hidden;
        }
        .ocr-modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 22px;
          border-bottom: 1px solid #e5e7eb;
          background: linear-gradient(135deg, #0ea5e9, #6366f1);
          color: #fff;
        }
        .ocr-modal-head h3 { font-size: 16px; font-weight: 700; }
        .ocr-modal-head p { font-size: 12px; opacity: 0.85; margin-top: 2px; }
        .ocr-modal-close { background: rgba(255,255,255,0.2); border: none; color: #fff; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; }
        .ocr-modal-close:hover { background: rgba(255,255,255,0.35); }
        .ocr-modal-body {
          display: flex;
          gap: 0;
          overflow: hidden;
          flex: 1;
          min-height: 0;
        }
        .ocr-image-pane {
          width: 40%;
          border-right: 1px solid #e5e7eb;
          overflow: auto;
          background: #f8fafc;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 12px;
        }
        .ocr-image-pane img { max-width: 100%; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .ocr-fields-pane {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
        }
        .ocr-fields-pane h4 { font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 10px; }
        .ocr-field-row { display: flex; flex-direction: column; gap: 3px; margin-bottom: 10px; }
        .ocr-field-label { font-size: 11.5px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
        .ocr-field-input { width: 100%; border: 1.5px solid #d1d5db; border-radius: 7px; padding: 7px 10px; font-size: 13px; color: #111; background: #fff; transition: border-color 0.15s; }
        .ocr-field-input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
        .ocr-field-input.ocr-low-conf { border-color: #fbbf24; background: #fffbeb; }
        .ocr-modal-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          border-top: 1px solid #e5e7eb;
          background: #fafafa;
          gap: 10px;
          flex-wrap: wrap;
        }
        .ocr-note { font-size: 12px; color: #9ca3af; flex: 1; }
        .ocr-discard-btn { padding: 8px 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; color: #6b7280; font-size: 13px; cursor: pointer; }
        .ocr-discard-btn:hover { background: #f3f4f6; }
        .ocr-apply-btn { padding: 9px 22px; border: none; border-radius: 8px; background: linear-gradient(135deg, #6366f1, #0ea5e9); color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 3px 10px -3px rgba(99,102,241,0.5); }
        .ocr-apply-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px -4px rgba(99,102,241,0.6); }
        /* OCR scanning progress overlay inside toolbar */
        .ocr-scan-progress {
          height: 3px;
          background: linear-gradient(90deg, #6366f1, #0ea5e9);
          transition: width 0.3s;
          border-radius: 2px;
        }

        /* ——— AI PANEL ——— */
        .cf-ai-panel {
          background: linear-gradient(180deg, #faf5ff 0%, #fff 60%);
          border-bottom: 1px solid #e9d5ff;
          overflow: hidden;
          animation: cfSlide 0.2s ease;
        }
        @keyframes cfSlide { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

        .cf-ai-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px 12px;
          gap: 12px;
        }
        .cf-ai-head-left {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .cf-ai-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .cf-ai-title {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .cf-ai-beta {
          font-size: 9px;
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          color: #fff;
          padding: 2px 7px;
          border-radius: 999px;
          letter-spacing: 0.6px;
          font-weight: 700;
        }
        .cf-ai-sub {
          margin: 3px 0 0;
          font-size: 12.5px;
          color: #64748b;
        }

        .cf-ai-score-ring {
          position: relative;
          width: 52px;
          height: 52px;
          flex-shrink: 0;
        }
        .cf-ai-score-text {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
        }
        .cf-ai-score-text[data-tone="high"] { color: #059669; }
        .cf-ai-score-text[data-tone="mid"] { color: #d97706; }
        .cf-ai-score-text[data-tone="low"] { color: #8b5cf6; }

        .cf-ai-body {
          padding: 0 24px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .cf-ai-section { display: flex; flex-direction: column; gap: 8px; }
        .cf-ai-section-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: #94a3b8;
          margin: 0;
        }

        /* Presets */
        .cf-preset-row {
          display: flex;
          gap: 8px;
        }
        .cf-preset-card {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 10px 8px;
          background: #fff;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .cf-preset-card:hover { border-color: #c4b5fd; background: #faf5ff; }
        .cf-preset-card.active { border-color: #8b5cf6; background: #f5f3ff; box-shadow: 0 0 0 3px rgba(139,92,246,0.12); }
        .cf-preset-icon { font-size: 18px; }
        .cf-preset-name { font-size: 12.5px; font-weight: 700; color: #0f172a; }
        .cf-preset-desc { font-size: 11px; color: #94a3b8; text-align: center; }

        /* Colors */
        .cf-color-row {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        .cf-color-swatch {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 2.5px solid transparent;
          cursor: pointer;
          transition: transform 0.15s, border-color 0.15s;
        }
        .cf-color-swatch:hover { transform: scale(1.2); }
        .cf-color-swatch.active { border-color: #fff; box-shadow: 0 0 0 2.5px #8b5cf6; transform: scale(1.15); }
        .cf-color-custom {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          overflow: hidden;
          border: 1.5px solid #e5e7eb;
          cursor: pointer;
        }
        .cf-color-custom input { width: 200%; height: 200%; margin: -25% 0 0 -25%; cursor: pointer; border: none; padding: 0; }

        /* Section toggles */
        .cf-sections-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
        }
        .cf-section-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 12.5px;
          color: #374151;
          padding: 5px 8px;
          border-radius: 7px;
          transition: background 0.1s;
          user-select: none;
        }
        .cf-section-toggle:hover { background: rgba(139,92,246,0.06); }
        .cf-section-toggle input { display: none; }
        .cf-toggle-track {
          width: 30px;
          height: 17px;
          border-radius: 999px;
          background: #e5e7eb;
          position: relative;
          flex-shrink: 0;
          transition: background 0.2s;
        }
        .cf-section-toggle input:checked + .cf-toggle-track { background: #8b5cf6; }
        .cf-toggle-thumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 13px;
          height: 13px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          transition: left 0.2s;
        }
        .cf-section-toggle input:checked + .cf-toggle-track .cf-toggle-thumb { left: 15px; }
        .cf-toggle-label { flex: 1; }
        .cf-vis-quick {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }
        .cf-vis-btn {
          padding: 5px 12px;
          font-size: 12px;
          border-radius: 7px;
          border: 1px solid #e5e7eb;
          background: #fff;
          color: #6c3ce1;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.12s;
        }
        .cf-vis-btn:hover { background: #f5f3ff; border-color: #c4b5fd; }

        /* AI Tips */
        .cf-tips-list { display: flex; flex-direction: column; gap: 7px; }
        .cf-tip {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid transparent;
        }
        .cf-tip-warn { background: #fffbeb; border-color: #fef3c7; }
        .cf-tip-info { background: #f0f9ff; border-color: #e0f2fe; }
        .cf-tip-success { background: #f0fdf4; border-color: #dcfce7; }
        .cf-tip-icon { font-size: 16px; flex-shrink: 0; }
        .cf-tip-content { flex: 1; min-width: 0; }
        .cf-tip-title { margin: 0; font-size: 12.5px; font-weight: 600; color: #0f172a; }
        .cf-tip-body { margin: 2px 0 0; font-size: 12px; color: #475569; line-height: 1.4; }
        .cf-tip-action {
          padding: 5px 10px;
          font-size: 11.5px;
          font-weight: 600;
          color: #6c3ce1;
          background: rgba(108,60,225,0.07);
          border: 1px solid rgba(108,60,225,0.15);
          border-radius: 6px;
          cursor: pointer;
          white-space: nowrap;
          align-self: center;
          transition: background 0.12s;
        }
        .cf-tip-action:hover { background: rgba(108,60,225,0.14); }

        .cf-ai-all-good {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          background: #f0fdf4;
          border: 1px solid #dcfce7;
          border-radius: 10px;
          font-size: 13px;
          color: #166534;
          font-weight: 500;
        }
        .cf-ai-all-good span { font-size: 20px; }

        .cf-settings-panel {
          background: #faf7ff;
          border-bottom: 1px solid #e9d5ff;
          padding: 0;
          animation: cfSlide 0.2s ease;
        }

        .cf-sp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 24px 0;
          flex-wrap: wrap;
        }

        .cf-settings-title {
          margin: 0 0 2px;
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
        }

        .cf-settings-desc {
          margin: 0;
          font-size: 12.5px;
          color: #64748b;
        }

        .cf-sp-tabs {
          display: flex;
          gap: 4px;
          padding: 2px;
          background: rgba(0,0,0,0.04);
          border-radius: 10px;
        }

        .cf-sp-tab {
          padding: 6px 12px;
          border-radius: 8px;
          border: none;
          background: transparent;
          font-size: 12.5px;
          font-weight: 500;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .cf-sp-tab.active {
          background: #fff;
          color: #6c3ce1;
          font-weight: 600;
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        }

        .cf-settings-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          padding: 16px 24px;
        }

        .cf-settings-field { display: flex; flex-direction: column; gap: 4px; }

        .cf-settings-label {
          font-size: 11.5px;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .cf-settings-input {
          padding: 8px 10px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 13px;
          background: #fff;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .cf-settings-input:focus { outline: none; border-color: #c4b5fd; box-shadow: 0 0 0 3px rgba(139,92,246,0.1); }

        .cf-settings-actions {
          display: flex;
          gap: 8px;
          justify-content: space-between;
          align-items: center;
          padding: 12px 24px 16px;
          border-top: 1px solid #e9d5ff;
        }

        .cf-settings-reset {
          padding: 7px 14px;
          border: 1px solid #e5e7eb;
          background: #fff;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12.5px;
          color: #6b7280;
          transition: all 0.12s;
        }
        .cf-settings-reset:hover { background: #fef2f2; border-color: #fecaca; color: #dc2626; }

        .cf-settings-cancel {
          padding: 8px 16px;
          border: 1px solid #e5e7eb;
          background: #fff;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          color: #374151;
        }

        .cf-settings-save {
          padding: 8px 18px;
          background: linear-gradient(135deg, #6c3ce1, #8b5cf6);
          color: #fff;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 2px 8px -2px rgba(108,60,225,0.4);
          transition: all 0.15s;
        }
        .cf-settings-save:hover { box-shadow: 0 4px 14px -3px rgba(108,60,225,0.5); transform: translateY(-1px); }

        /* ── Layout tab ── */
        .cf-layout-tab { padding: 16px 24px; display: flex; flex-direction: column; gap: 20px; }
        .cf-import-tab { padding: 16px 24px; display: flex; flex-direction: column; gap: 16px; }

        .cf-field-group { display: flex; flex-direction: column; gap: 10px; }
        .cf-field-group-label {
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.8px;
          color: #94a3b8;
          text-transform: uppercase;
        }

        /* Logo upload zone */
        .cf-logo-zone {
          border: 2px dashed #ddd6fe;
          border-radius: 12px;
          overflow: hidden;
          background: #faf5ff;
          min-height: 90px;
          transition: border-color 0.15s, background 0.15s;
        }
        .cf-logo-zone:hover { border-color: #c4b5fd; background: #f5f3ff; }

        .cf-logo-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 22px 16px;
          cursor: pointer;
          gap: 6px;
        }
        .cf-logo-upload-icon { display: block; margin-bottom: 4px; }
        .cf-logo-empty-title { margin: 0; font-size: 13.5px; font-weight: 600; color: #374151; }
        .cf-logo-empty-hint { margin: 0; font-size: 11.5px; color: #94a3b8; text-align: center; }
        .cf-logo-browse-btn {
          margin-top: 4px;
          padding: 6px 16px;
          background: #8b5cf6;
          color: #fff;
          border: none;
          border-radius: 7px;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
        }

        .cf-logo-preview-wrap {
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .cf-logo-preview-img { max-height: 60px; max-width: 160px; object-fit: contain; border-radius: 4px; }
        .cf-logo-preview-actions { display: flex; gap: 8px; }
        .cf-logo-change-btn {
          padding: 5px 12px;
          background: #fff;
          border: 1px solid #ddd6fe;
          border-radius: 7px;
          font-size: 12px;
          color: #6c3ce1;
          cursor: pointer;
          font-weight: 600;
        }
        .cf-logo-remove-btn {
          padding: 5px 12px;
          background: #fff;
          border: 1px solid #fecaca;
          border-radius: 7px;
          font-size: 12px;
          color: #dc2626;
          cursor: pointer;
        }

        .cf-logo-url-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 6px;
        }
        .cf-logo-url-or { font-size: 12px; color: #94a3b8; white-space: nowrap; }
        .cf-logo-url-input { flex: 1; }

        /* Layout picker */
        .cf-layout-picker {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
        }
        .cf-layout-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          padding: 8px 6px 9px;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          background: #fff;
          cursor: pointer;
          transition: all 0.15s;
        }
        .cf-layout-option:hover { border-color: #c4b5fd; background: #faf5ff; transform: translateY(-1px); box-shadow: 0 2px 8px rgba(139,92,246,0.10); }
        .cf-layout-option.active { border-color: #8b5cf6; background: #f5f3ff; box-shadow: 0 0 0 2.5px rgba(139,92,246,0.2); }
        .cf-layout-thumb { display: flex; align-items: center; justify-content: center; border-radius: 4px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .cf-layout-option.active .cf-layout-thumb { box-shadow: 0 1px 6px rgba(139,92,246,0.25); }
        .cf-layout-name { font-size: 11px; font-weight: 700; color: #0f172a; }
        .cf-layout-desc { font-size: 9.5px; color: #94a3b8; text-align: center; line-height: 1.3; }
        .cf-field-group-hint { font-weight: 400; color: #94a3b8; font-size: 9.5px; text-transform: none; letter-spacing: 0; }

        /* Color pair */
        .cf-color-pair { display: flex; gap: 16px; }
        .cf-color-item { display: flex; flex-direction: column; gap: 6px; }
        .cf-color-input-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 4px 10px;
          background: #fff;
        }
        .cf-color-input-wrap input[type=color] { width: 28px; height: 28px; border: none; padding: 0; cursor: pointer; background: transparent; }
        .cf-color-input-wrap span { font-size: 12px; color: #374151; font-family: monospace; }

        /* Letterhead import */
        .cf-import-info { background: #f0f9ff; border: 1px solid #e0f2fe; border-radius: 10px; padding: 12px 16px; }
        .cf-import-how-title { margin: 0 0 6px; font-size: 12.5px; font-weight: 700; color: #0369a1; }
        .cf-import-steps { margin: 0 0 8px; padding-left: 18px; font-size: 12px; color: #0c4a6e; line-height: 1.6; }
        .cf-import-tip { margin: 0; font-size: 11.5px; color: #0369a1; }

        .cf-lh-zone {
          border: 2px dashed #ddd6fe;
          border-radius: 12px;
          background: #faf5ff;
          min-height: 90px;
          overflow: hidden;
          transition: border-color 0.15s;
        }
        .cf-lh-zone:hover { border-color: #c4b5fd; }
        .cf-lh-preview-wrap { padding: 12px 16px; display: flex; align-items: center; gap: 14px; }
        .cf-lh-preview-img { max-width: 100%; max-height: 80px; object-fit: contain; border-radius: 4px; border: 1px solid #e5e7eb; }
        .cf-lh-preview-actions { display: flex; gap: 8px; flex-shrink: 0; }

        /* ── Header layout variants ── */
        .cf-school-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 16px;
          padding: 14px 16px;
          border-radius: 10px;
          position: relative;
          transition: background 0.2s;
        }
        .cf-header-classic { flex-direction: row; }
        .cf-header-centered { flex-direction: column; text-align: center; align-items: center; }
        .cf-header-banner { padding: 20px 24px; border-radius: 12px; }
        .cf-header-minimal { padding: 8px 0; background: transparent !important; }
        .cf-header-letterhead { padding: 0; background: transparent !important; }

        .cf-logo-zone-header { flex-shrink: 0; }
        .cf-header-text-zone { flex: 1; min-width: 0; }
        .cf-header-centered .cf-header-text-zone { display: flex; flex-direction: column; align-items: center; }

        .cf-school-name { margin: 0; font-size: 20px; font-weight: 700; }
        .cf-school-motto { margin: 2px 0 0; font-size: 12px; font-style: italic; opacity: 0.75; }
        .cf-school-address { margin: 4px 0 0; font-size: 12px; }
        .cf-school-logo-img { width: 56px; height: 56px; object-fit: contain; }
        .cf-school-logo-placeholder { font-size: 36px; line-height: 1; }

        /* Inline edit trigger (screen only) */
        .cf-inline-edit-trigger {
          position: absolute;
          top: 8px;
          right: 8px;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(4px);
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 7px;
          font-size: 11.5px;
          color: #6c3ce1;
          font-weight: 600;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.15s;
          pointer-events: auto;
        }
        .cf-school-header:hover .cf-inline-edit-trigger { opacity: 1; }

        .cf-inline-actions {
          position: absolute;
          top: 8px;
          right: 8px;
          display: flex;
          gap: 6px;
        }
        .cf-inline-save-btn {
          padding: 5px 12px;
          background: #059669;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .cf-inline-cancel-btn {
          padding: 5px 10px;
          background: #fff;
          color: #dc2626;
          border: 1px solid #fecaca;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
        }

        .cf-inline-input {
          background: rgba(255,255,255,0.7);
          border: 1px dashed #c4b5fd;
          border-radius: 6px;
          padding: 4px 8px;
          font-family: inherit;
          outline: none;
          width: 100%;
          margin-bottom: 4px;
        }
        .cf-inline-input:focus { background: #fff; border-color: #8b5cf6; }
        .cf-inline-name { font-size: 18px; font-weight: 700; }
        .cf-inline-motto { font-size: 12px; font-style: italic; }
        .cf-inline-addr { font-size: 12px; }
        .cf-inline-row { display: flex; gap: 8px; }

        /* Letterhead header */
        .cf-lh-header-wrap { position: relative; margin-bottom: 16px; }
        .cf-lh-header-img { width: 100%; max-height: 140px; object-fit: cover; object-position: top; border-radius: 6px; display: block; }
        .cf-inline-edit-bar {
          position: absolute;
          bottom: 8px;
          right: 8px;
          display: flex;
          gap: 6px;
          align-items: center;
          background: rgba(255,255,255,0.9);
          padding: 4px 8px;
          border-radius: 8px;
          backdrop-filter: blur(4px);
        }
        .cf-inline-badge { font-size: 11px; color: #6c3ce1; font-weight: 600; }

        .cf-body {
          padding: 36px 48px;
        }

        .cf-print-date {
          font-size: 11px;
          color: #9ca3af;
          text-align: right;
          margin: 0 0 8px;
          display: none;
        }

        .cf-school-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }

        .cf-school-logo-placeholder { font-size: 40px; line-height: 1; flex-shrink: 0; }
        .cf-school-logo-img { width: 56px; height: 56px; object-fit: contain; flex-shrink: 0; }
        .cf-school-name { margin: 0; font-size: 22px; font-weight: 700; color: #111827; }
        .cf-school-address { margin: 4px 0 0; font-size: 12px; color: #6b7280; }
        .cf-divider { border: none; border-top: 2px solid #e5e7eb; margin: 16px 0; }

        .cf-form-title {
          margin: 0 0 6px;
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .cf-form-subtitle {
          text-align: center;
          font-size: 13px;
          color: #6b7280;
          margin: 0 0 24px;
        }

        .cf-section { margin-bottom: 24px; }

        .cf-section-heading {
          margin: 0 0 10px;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #6c3ce1;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 6px;
        }

        .cf-detail-grid { display: flex; gap: 20px; align-items: flex-start; }

        .cf-student-photo {
          width: 100px; height: 120px; object-fit: cover;
          border-radius: 6px; border: 1px solid #e5e7eb; flex-shrink: 0;
        }

        .cf-photo-placeholder {
          width: 100px; height: 120px;
          border: 1px dashed #d1d5db; border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; color: #9ca3af; flex-shrink: 0;
        }

        .cf-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .cf-table th { text-align: left; width: 38%; padding: 6px 8px; color: #6b7280; font-weight: 500; vertical-align: top; }
        .cf-table td { padding: 6px 8px; color: #111827; vertical-align: top; }
        .cf-table tr:not(:last-child) td,
        .cf-table tr:not(:last-child) th { border-bottom: 1px solid #f3f4f6; }

        .cf-empty { font-size: 14px; color: #9ca3af; margin: 0; }

        .cf-primary-badge {
          display: inline-block;
          background: #6c3ce1;
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 999px;
          letter-spacing: 0.05em;
          margin-bottom: 6px;
        }

        .cf-security-note {
          font-size: 12px;
          color: #92400e;
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 6px;
          padding: 8px 12px;
          margin: 8px 0 0;
        }

        .cf-status-ok { color: #047857; font-weight: 600; }
        .cf-status-pending { color: #92400e; }

        .cf-marks-list {
          margin: 8px 0 0;
          padding-left: 20px;
          font-size: 14px;
          color: #111827;
        }
        .cf-marks-list li { margin-bottom: 4px; }

        .cf-declaration {
          font-size: 13.5px;
          color: #374151;
          line-height: 1.7;
          margin: 0;
          text-align: justify;
        }

        .cf-signatures {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin-top: 40px;
        }

        .cf-sig-block { display: flex; flex-direction: column; gap: 8px; }
        .cf-sig-line { height: 1px; background: #374151; }
        .cf-sig-label { margin: 0; font-size: 11px; color: #6b7280; text-align: center; }

        /* ── Upload signed form footer ── */
        .cf-upload-signed-bar {
          margin: 24px 0 8px;
          border: 1.5px dashed #c4b5fd;
          border-radius: 12px;
          background: linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%);
          padding: 14px 18px;
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }
        .cf-upload-signed-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          min-width: 0;
        }
        .cf-upload-signed-icon {
          width: 38px;
          height: 38px;
          border-radius: 9px;
          background: #ede9fe;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #7c3aed;
          flex-shrink: 0;
        }
        .cf-upload-signed-title {
          margin: 0 0 2px;
          font-size: 13px;
          font-weight: 700;
          color: #4c1d95;
        }
        .cf-upload-signed-hint {
          margin: 0;
          font-size: 11.5px;
          color: #6d28d9;
          opacity: 0.75;
          line-height: 1.4;
        }
        .cf-upload-signed-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .cf-upload-signed-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 9px 16px;
          border-radius: 9px;
          border: 1.5px solid #7c3aed;
          background: #7c3aed;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .cf-upload-signed-btn:hover { background: #6d28d9; border-color: #6d28d9; transform: translateY(-1px); box-shadow: 0 3px 10px rgba(124,58,237,0.3); }
        .cf-upload-view-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 7px 12px;
          border-radius: 8px;
          border: 1.5px solid #10b981;
          background: #ecfdf5;
          color: #065f46;
          font-size: 12px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.15s;
        }
        .cf-upload-view-btn:hover { background: #d1fae5; }
        .cf-upload-replace-btn {
          padding: 7px 12px;
          border-radius: 8px;
          border: 1.5px solid #d1d5db;
          background: #fff;
          color: #374151;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
        }
        .cf-upload-replace-btn:hover { border-color: #7c3aed; color: #7c3aed; }
        .cf-upload-spinner {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          color: #7c3aed;
          font-weight: 500;
        }
        .cf-upload-error {
          width: 100%;
          margin: 4px 0 0;
          font-size: 12px;
          color: #dc2626;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 7px;
          padding: 6px 10px;
        }

      `}</style>
    </div>
  );
}

export default ConsentForm;
