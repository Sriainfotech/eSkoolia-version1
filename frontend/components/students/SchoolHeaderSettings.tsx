"use client";
import { useState, useEffect } from "react";

const SETTINGS_KEY = 'eskoolia:school:header:v1';

export interface SchoolHeaderData {
  schoolName: string;
  schoolAddress: string;
  schoolPhone: string;
  schoolEmail: string;
  logoUrl: string;
  principalName: string;
}

const DEFAULT_SETTINGS: SchoolHeaderData = {
  schoolName: 'Eskoolia School',
  schoolAddress: '123 School Lane, City — 000000',
  schoolPhone: '',
  schoolEmail: 'admissions@eskoolia.in',
  logoUrl: '',
  principalName: 'Principal',
};

export function getSchoolHeaderSettings(): SchoolHeaderData {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { return DEFAULT_SETTINGS; }
}

interface SchoolHeaderSettingsProps {
  onClose: () => void;
}

export function SchoolHeaderSettings({ onClose }: SchoolHeaderSettingsProps) {
  const [form, setForm] = useState<SchoolHeaderData>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(getSchoolHeaderSettings());
  }, []);

  const handleSave = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(form));
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1000);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:12, padding:28, maxWidth:500, width:'90%', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:18, fontWeight:700, color:'#111827' }}>PDF Header Settings</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#6b7280' }}>✕</button>
        </div>
        <p style={{ margin:'0 0 16px', fontSize:13, color:'#6b7280' }}>These details appear on all printed/downloaded enrollment forms.</p>
        {[
          { key:'schoolName' as const, label:'School Name', placeholder:'e.g. Sunshine Public School' },
          { key:'schoolAddress' as const, label:'School Address', placeholder:'Street, City, PIN' },
          { key:'schoolPhone' as const, label:'Phone', placeholder:'+91 XXXXX XXXXX' },
          { key:'schoolEmail' as const, label:'Email', placeholder:'admissions@school.in' },
          { key:'logoUrl' as const, label:'Logo URL', placeholder:'https://... (or leave blank for emoji 🏫)' },
          { key:'principalName' as const, label:'Principal Name', placeholder:'Full name' },
        ].map(({ key, label, placeholder }) => (
          <div key={key} style={{ marginBottom:12 }}>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4 }}>{label}</label>
            <input
              style={{ width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13, boxSizing:'border-box' }}
              value={form[key]}
              onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
              placeholder={placeholder}
            />
          </div>
        ))}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20 }}>
          <button onClick={onClose} style={{ padding:'9px 18px', border:'1px solid #d1d5db', background:'#fff', borderRadius:8, cursor:'pointer', fontSize:14 }}>Cancel</button>
          <button onClick={handleSave} style={{ padding:'9px 18px', background:'#6c3ce1', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:14, fontWeight:600 }}>
            {saved ? '✓ Saved!' : 'Save settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
