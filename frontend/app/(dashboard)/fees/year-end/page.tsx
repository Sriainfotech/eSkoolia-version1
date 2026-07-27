'use client';
import { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react';
import { feesApi, listData, DueStudent, DuesClassGroup, FeesSummary, FeesGroup, YearEndFeeAmountRow, AcademicYear } from '@/lib/fees-api';

type EditModalState = { groupId: number; groupName: string } | null;

type Resolution = 'carry' | 'writeoff' | 'scholarship' | 'legal' | 'archive' | 'offboard';
type WizardStep = 1 | 2 | 3 | 4;

const RESOLUTION_GROUPS = [
  {
    group: 'Continue enrollment',
    options: [
      { value: 'carry',       label: 'Carry dues to next year' },
      { value: 'writeoff',    label: 'Write off balance' },
      { value: 'scholarship', label: 'Mark as scholarship / waiver' },
      { value: 'legal',       label: 'Legal follow-up' },
    ],
  },
  {
    group: 'Discontinue student',
    options: [
      { value: 'archive',  label: 'Discontinue — Archive student' },
      { value: 'offboard', label: 'Discontinue — Offboard & generate TC' },
    ],
  },
];

const REPORTS = [
  { name: 'Fee Collection Summary',   type: 'fee_collection_summary' },
  { name: 'Class-wise Report',        type: 'class_wise_report' },
  { name: 'Outstanding Dues Report',  type: 'outstanding_dues' },
  { name: 'Concession Report',        type: 'concession_report' },
  { name: 'Payment Method Breakdown', type: 'payment_method_breakdown' },
];

const WIZARD_STEPS = [
  { n: 1, label: 'Confirm totals' },
  { n: 2, label: 'Set year & date' },
  { n: 3, label: 'Copy structures' },
  { n: 4, label: 'Execute rollover' },
];

const TH: CSSProperties = {
  padding: '10px 20px', fontSize: 10.5, fontWeight: 700,
  letterSpacing: '0.07em', color: '#A0A3B8', textAlign: 'left',
  borderBottom: '1px solid #E8E8EE', background: '#F8F8FB',
};

const BTN_OUTLINE: CSSProperties = {
  height: 32, padding: '0 14px', background: '#fff', color: '#181B2A',
  border: '1px solid #E8E8EE', borderRadius: 8, fontSize: 13,
  fontWeight: 500, cursor: 'pointer',
};

export default function YearEndPage() {
  const [groups,      setGroups]      = useState<DuesClassGroup[]>([]);
  const [summary,     setSummary]     = useState<FeesSummary | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [applied,     setApplied]     = useState<Set<string>>(new Set());
  const [wizardStep,  setWizardStep]  = useState<WizardStep>(1);
  const [saving,      setSaving]      = useState(false);
  const [csvLoading,  setCsvLoading]  = useState('');
  const [pdfLoading,  setPdfLoading]  = useState('');
  const [toast,       setToast]       = useState('');
  const [feeGroups,   setFeeGroups]   = useState<FeesGroup[]>([]);
  const [grpLoading,  setGrpLoading]  = useState(false);
  const [editModal,   setEditModal]   = useState<EditModalState>(null);
  const [modalRows,   setModalRows]   = useState<YearEndFeeAmountRow[]>([]);
  const [modalLoading,setModalLoading]= useState(false);
  const [hikePercent, setHikePercent] = useState('');
  const [savingModal, setSavingModal] = useState(false);

  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null);
  const [nextYearName, setNextYearName] = useState('');
  const [rolloverDate, setRolloverDate] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number>>(new Set());
  const [rollingOver, setRollingOver] = useState(false);
  const [schoolName, setSchoolName] = useState('School');

  const currentYearLabel = currentYear?.name || '—';

  useEffect(() => {
    feesApi.listAcademicYears()
      .then(data => {
        const years = listData<AcademicYear>(data);
        const current = years.find(y => y.is_current) || years[0] || null;
        setCurrentYear(current);
        if (current) {
          const m = /^(\d{4})-(\d{2,4})$/.exec(current.name);
          if (m) {
            const startYear = parseInt(m[1]!, 10);
            const suffixLen = m[2]!.length;
            const nextStart = startYear + 1;
            const nextSuffix = suffixLen === 4 ? String(nextStart + 1) : String((nextStart + 1) % 100).padStart(2, '0');
            setNextYearName(`${nextStart}-${nextSuffix}`);
          }
          if (current.end_date) {
            const end = new Date(current.end_date);
            end.setDate(end.getDate() + 1);
            setRolloverDate(end.toISOString().slice(0, 10));
          }
        }
      })
      .catch(() => {});

    feesApi.getMySchoolInfo()
      .then(data => {
        const name = (data as { name?: string })?.name?.trim();
        if (name) setSchoolName(name);
      })
      .catch(() => {});
  }, []);

  const toggleGroupSelected = (id: number) =>
    setSelectedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const executeRollover = async () => {
    if (!nextYearName.trim() || !rolloverDate) {
      toast_('Set the next academic year and rollover date first.');
      return;
    }
    setRollingOver(true);
    try {
      const res = await feesApi.yearEndRollover({
        next_year_name: nextYearName.trim(),
        rollover_date: rolloverDate,
        group_ids: Array.from(selectedGroupIds),
      });
      toast_(res.message);
      setWizardStep(1);
      setFeeGroups([]);
      setSelectedGroupIds(new Set());
    } catch (err) {
      toast_(err instanceof Error ? err.message : 'Rollover failed.');
    } finally {
      setRollingOver(false);
    }
  };

  const toast_ = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3200); };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [t1, t2, t3, sum] = await Promise.allSettled([
        feesApi.getDuesByClass('1'),
        feesApi.getDuesByClass('2'),
        feesApi.getDuesByClass('3'),
        feesApi.assignmentsSummary(),
      ] as const);

      const seen   = new Set<string>();
      const clsMap = new Map<string, DueStudent[]>();
      for (const res of [t1, t2, t3]) {
        if (res.status !== 'fulfilled') continue;
        for (const g of (res.value as DuesClassGroup[])) {
          for (const st of g.students) {
            if (seen.has(st.id)) continue;
            seen.add(st.id);
            if (!clsMap.has(g.cls)) clsMap.set(g.cls, []);
            clsMap.get(g.cls)!.push(st);
          }
        }
      }
      const merged: DuesClassGroup[] = [];
      clsMap.forEach((students, cls) =>
        merged.push({ cls, total_students: students.length, assigned_students: students.length, students })
      );
      setGroups(merged);
      if (sum.status === 'fulfilled') setSummary(sum.value as FeesSummary);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (wizardStep === 3 && feeGroups.length === 0 && !grpLoading) {
      setGrpLoading(true);
      feesApi.listGroups()
        .then(data => {
          const arr: FeesGroup[] = Array.isArray(data)
            ? data
            : ((data as { results?: FeesGroup[] }).results ?? []);
          // Deduplicate by name — keep the highest ID (most recently created,
          // i.e. the current academic year's group)
          const seen = new Map<string, FeesGroup>();
          for (const g of arr) {
            const existing = seen.get(g.name);
            if (!existing || g.id > existing.id) seen.set(g.name, g);
          }
          const sorted = Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
          setFeeGroups(sorted);
          setSelectedGroupIds(new Set(sorted.map(g => g.id)));
        })
        .catch(() => {})
        .finally(() => setGrpLoading(false));
    }
  }, [wizardStep, feeGroups.length, grpLoading]);

  const openEditModal = async (groupId: number, groupName: string) => {
    setEditModal({ groupId, groupName });
    setModalLoading(true);
    setHikePercent('');
    try {
      const data = await feesApi.yearEndGroupAmounts(groupId);
      setModalRows(data.fee_types ?? []);
    } catch {
      toast_('Failed to load fee types.');
      setEditModal(null);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => { setEditModal(null); setModalRows([]); setHikePercent(''); };

  const updateModalRow = (id: number, val: string) =>
    setModalRows(prev => prev.map(r => r.id === id ? { ...r, new_amount: val } : r));

  const applyHike = () => {
    const pct = parseFloat(hikePercent);
    if (isNaN(pct)) { toast_('Enter a valid percentage.'); return; }
    setModalRows(prev => prev.map(r => {
      const cur = parseFloat(r.current_total) || 0;
      return { ...r, new_amount: String(Math.round(cur * (1 + pct / 100))) };
    }));
  };

  const saveModalAmounts = async () => {
    if (!editModal) return;
    setSavingModal(true);
    try {
      await feesApi.yearEndSaveGroupAmounts(
        editModal.groupId,
        modalRows.map(r => ({ fee_type_id: r.id, new_amount: r.new_amount }))
      );
      toast_(`New amounts staged for ${editModal.groupName}.`);
      closeModal();
    } catch { toast_('Failed to save amounts.'); }
    finally { setSavingModal(false); }
  };

  const allStudents   = useMemo(() => groups.flatMap(g => g.students), [groups]);
  const pendingCount  = allStudents.filter(s => !applied.has(s.id)).length;
  const resolvedCount = applied.size;

  const collected   = summary ? parseFloat(summary.total_paid)     : 0;
  const outstanding = summary ? parseFloat(summary.total_due)      : 0;
  const concessions = summary ? parseFloat(summary.total_concession) : 0;

  const applyOne = (st: DueStudent) => {
    const res = resolutions[st.id] ?? 'carry';
    const allOpts = RESOLUTION_GROUPS.flatMap(g => g.options);
    const label = allOpts.find(o => o.value === res)?.label ?? '';
    setApplied(p => new Set([...p, st.id]));
    toast_(`${label} — applied for ${st.name}.`);
  };

  const carryAllForward = () => {
    setSaving(true);
    const next = new Set(applied);
    allStudents.forEach(s => next.add(s.id));
    setApplied(next);
    toast_(`Carried forward dues for all ${allStudents.length} students.`);
    setSaving(false);
  };

  const exportCSV = async (reportType: string, reportName: string) => {
    setCsvLoading(reportType);
    try {
      const res = await feesApi.yearEndReportCSV(reportType);
      if (!res.ok) throw new Error('Server error');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast_(`${reportName} CSV downloaded.`);
    } catch { toast_('Failed to export CSV. Please try again.'); }
    finally { setCsvLoading(''); }
  };

  const generatePDF = async (reportName: string, reportType: string) => {
    setPdfLoading(reportType);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();

      // Purple header band
      doc.setFillColor(109, 74, 255);
      doc.rect(0, 0, W, 52, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(`${schoolName} - Year-End Report`, 28, 26);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(reportName, 28, 42);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}`, W - 180, 42);

      let y = 76;

      if (reportType === 'outstanding_dues' && allStudents.length > 0) {
        // Summary row
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(24, 27, 42);
        doc.text(`Total outstanding students: ${allStudents.length}  |  Total amount: ₹${allStudents.reduce((s, st) => s + Number(st.amount_due), 0).toLocaleString('en-IN')}`, 28, y);
        y += 18;

        // Table header
        const COLS: [string, number][] = [['STUDENT', 160], ['CLASS', 80], ['AMOUNT DUE', 110], ['DAYS OVERDUE', 110], ['STATUS', 110]];
        doc.setFillColor(109, 74, 255);
        doc.rect(28, y, W - 56, 18, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        let x = 36;
        COLS.forEach(([col, w]) => { doc.text(col, x, y + 12); x += w; });
        y += 18;

        allStudents.forEach((st, i) => {
          if (y > H - 32) { doc.addPage(); y = 30; }
          doc.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 251 : 255);
          doc.rect(28, y, W - 56, 16, 'F');
          doc.setTextColor(24, 27, 42); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
          const vals: [string, number][] = [
            [st.name.length > 22 ? st.name.slice(0, 21) + '…' : st.name, 160],
            [st.cls, 80],
            [`Rs.${Number(st.amount_due).toLocaleString('en-IN')}`, 110],
            [`${st.days_overdue} days`, 110],
            [st.status, 110],
          ];
          let vx = 36;
          vals.forEach(([txt, w]) => { doc.text(txt, vx, y + 11); vx += w; });
          y += 16;
        });

      } else if (reportType === 'class_wise_report' && groups.length > 0) {
        const COLS: [string, number][] = [['CLASS', 150], ['STUDENTS WITH DUES', 160], ['TOTAL OUTSTANDING', 160]];
        doc.setFillColor(109, 74, 255);
        doc.rect(28, y, W - 56, 18, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        let x = 36;
        COLS.forEach(([col, w]) => { doc.text(col, x, y + 12); x += w; });
        y += 18;

        groups.forEach((g, i) => {
          const clsTotal = g.students.reduce((s, st) => s + Number(st.amount_due), 0);
          doc.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 251 : 255);
          doc.rect(28, y, W - 56, 18, 'F');
          doc.setTextColor(24, 27, 42); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
          let vx = 36;
          [[g.cls, 150], [String(g.students.length), 160], [`Rs.${clsTotal.toLocaleString('en-IN')}`, 160]].forEach(([txt, w]) => {
            doc.text(String(txt), vx, y + 12); vx += Number(w);
          });
          y += 18;
        });

      } else {
        // Summary stats page for other report types
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(24, 27, 42);
        doc.text(`${currentYearLabel} Academic Year Summary`, 28, y); y += 24;

        const STATS: [string, string, [number,number,number]][] = [
          ['COLLECTED',   `Rs. ${collected.toLocaleString('en-IN')}`,          [16, 185, 129]],
          ['OUTSTANDING', `Rs. ${outstanding.toLocaleString('en-IN')}`,        [220, 38,  38]],
          ['CONCESSIONS', `Rs. ${Math.max(0,concessions).toLocaleString('en-IN')}`, [109, 74, 255]],
          ['STUDENTS WITH DUES', String(allStudents.length),                   [24, 27,  42]],
        ];
        STATS.forEach(([label, value, [r,g,b]], i) => {
          const bx = 28 + (i % 2) * 180;
          const by = y + Math.floor(i / 2) * 60;
          doc.setFillColor(r, g, b); doc.rect(bx, by, 160, 50, 'F');
          doc.setTextColor(255,255,255);
          doc.setFontSize(8); doc.setFont('helvetica', 'bold');
          doc.text(label, bx + 10, by + 16);
          doc.setFontSize(15); doc.setFont('helvetica', 'bold');
          doc.text(value, bx + 10, by + 36);
        });
      }

      // Footer
      doc.setFillColor(248, 248, 251);
      doc.rect(0, H - 22, W, 22, 'F');
      doc.setTextColor(160, 163, 184);
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
      doc.text(`${schoolName} ERP - Confidential`, 28, H - 8);
      doc.text(`Page 1 of ${doc.getNumberOfPages()}`, W - 80, H - 8);

      doc.save(`${reportType}.pdf`);
      toast_(`${reportName} PDF downloaded.`);
    } catch (err) {
      console.error(err);
      toast_('Failed to generate PDF.');
    } finally { setPdfLoading(''); }
  };

  return (
    <div style={{ display: 'flex', gap: 20, padding: '24px 24px 48px', alignItems: 'flex-start' }}>

      {/* ── LEFT: main content ─────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Page header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: '#6D4AFF', marginBottom: 5, textTransform: 'uppercase' as const }}>Academic Year Close</div>
            <h1 style={{ margin: '0 0 6px', fontSize: 32, fontWeight: 800, color: '#181B2A', lineHeight: 1.1 }}>Year-End</h1>
            <p style={{ margin: 0, fontSize: 14, color: '#A0A3B8' }}>Resolve carry-forward dues, generate reports, and roll fee structures into the next academic year.</p>
          </div>
          <button
            onClick={() => toast_('Year-end review saved.')}
            style={{ height: 40, padding: '0 20px', background: '#6D4AFF', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 10px rgba(109,74,255,0.25)', whiteSpace: 'nowrap' as const, marginTop: 6 }}
          >Save Year-End Review</button>
        </div>

        {/* ── Carry Forward ────────────────────────────── */}
        <div style={{ background: '#fff', border: '1px solid #E8E8EE', borderRadius: 12, overflow: 'hidden' }}>

          {/* Section header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E8E8EE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#181B2A' }}>Carry Forward </span>
              <span style={{ fontSize: 12.5, color: '#A0A3B8', fontWeight: 500 }}>{currentYearLabel} outstanding balances</span>
              <div style={{ marginTop: 4, fontSize: 12.5 }}>
                <span style={{ color: '#D97706', fontWeight: 600 }}>{pendingCount} pending resolution</span>
                <span style={{ color: '#E8E8EE', margin: '0 8px' }}>·</span>
                <span style={{ color: '#16a34a', fontWeight: 600 }}>{resolvedCount} resolved</span>
              </div>
            </div>
            <button
              onClick={carryAllForward} disabled={saving || pendingCount === 0}
              style={{ height: 34, padding: '0 16px', background: '#fff', color: '#6D4AFF', border: '1px solid #c4b5fd', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: pendingCount === 0 ? 'not-allowed' : 'pointer', opacity: pendingCount === 0 ? 0.5 : 1 }}
            >Carry all forward →</button>
          </div>

          {/* Sub-header */}
          <div style={{ padding: '8px 20px', background: '#FAFAFF', borderBottom: '1px solid #E8E8EE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12.5, color: '#A0A3B8' }}>
              <span style={{ color: '#181B2A', fontWeight: 600 }}>{pendingCount} pending</span>
              <span style={{ margin: '0 6px', color: '#E8E8EE' }}>·</span>
              <span style={{ color: '#16a34a', fontWeight: 600 }}>{resolvedCount} resolved</span>
            </div>
            <button
              onClick={carryAllForward} disabled={saving || pendingCount === 0}
              style={{ height: 26, padding: '0 12px', background: '#fff', color: '#6D4AFF', border: '1px solid #c4b5fd', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: pendingCount === 0 ? 'not-allowed' : 'pointer', opacity: pendingCount === 0 ? 0.5 : 1 }}
            >Carry all forward →</button>
          </div>

          {loading ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: '#A0A3B8', fontSize: 14 }}>Loading outstanding balances…</div>
          ) : allStudents.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: '#16a34a', fontSize: 14, fontWeight: 600 }}>✓ No outstanding dues — all balances resolved.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' as const }}>
              <colgroup>
                <col style={{ width: 40 }}/>
                <col style={{ width: '22%' }}/>
                <col style={{ width: '14%' }}/>
                <col style={{ width: '11%' }}/>
                <col/>
                <col style={{ width: 90 }}/>
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...TH, width: 40 }}><input type="checkbox"/></th>
                  <th style={TH}>STUDENT</th>
                  <th style={TH}>OUTSTANDING</th>
                  <th style={TH}>STATUS</th>
                  <th style={TH}>RESOLUTION</th>
                  <th style={TH}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {allStudents.map((st, i) => {
                  const isApplied = applied.has(st.id);
                  return (
                    <tr key={st.id} style={{ borderBottom: i < allStudents.length - 1 ? '1px solid #E8E8EE' : 'none', background: isApplied ? '#F0FDF4' : '#fff' }}>
                      <td style={{ padding: '12px 20px' }}><input type="checkbox" disabled={isApplied}/></td>
                      <td style={{ padding: '12px 20px', overflow: 'hidden' }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#181B2A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.name}</div>
                        <div style={{ fontSize: 12, color: '#A0A3B8', marginTop: 2 }}>Class {st.cls}</div>
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: 14, fontWeight: 700, color: '#DC2626' }}>
                        ₹{Number(st.amount_due).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        {isApplied
                          ? <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#DCFCE7', color: '#16a34a' }}>Resolved</span>
                          : <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#FEF3C7', color: '#D97706' }}>Pending</span>
                        }
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ position: 'relative', display: 'block' }}>
                          <select
                            value={resolutions[st.id] ?? 'carry'}
                            onChange={e => setResolutions(p => ({ ...p, [st.id]: e.target.value as Resolution }))}
                            disabled={isApplied}
                            style={{ height: 32, width: '100%', border: '1px solid #E8E8EE', borderRadius: 8, padding: '0 28px 0 10px', fontSize: 13, background: '#fff', color: isApplied ? '#9CA3AF' : '#181B2A', cursor: isApplied ? 'default' : 'pointer', appearance: 'none' as const, boxSizing: 'border-box' as const }}
                          >
                            {RESOLUTION_GROUPS.map(grp => (
                              <optgroup key={grp.group} label={grp.group}>
                                {grp.options.map(o => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          <svg style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#A0A3B8" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <button
                          onClick={() => applyOne(st)} disabled={isApplied}
                          style={{ height: 30, padding: '0 10px', background: isApplied ? '#F3F4F6' : '#6D4AFF', color: isApplied ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: isApplied ? 'default' : 'pointer', whiteSpace: 'nowrap' as const }}
                        >{isApplied ? '✓ Applied' : 'Apply'}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Year-End Reports ──────────────────────────── */}
        <div style={{ background: '#fff', border: '1px solid #E8E8EE', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E8E8EE' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#181B2A', marginBottom: 3 }}>Year-End Reports</div>
            <div style={{ fontSize: 13, color: '#A0A3B8' }}>Generate PDF or CSV for audit, board review, and statutory filing.</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...TH, width: '55%' }}>REPORT NAME</th>
                <th style={{ ...TH, width: '22.5%' }}>PDF</th>
                <th style={{ ...TH, width: '22.5%' }}>CSV</th>
              </tr>
            </thead>
            <tbody>
              {REPORTS.map((r, i) => (
                <tr key={r.type} style={{ borderBottom: i < REPORTS.length - 1 ? '1px solid #E8E8EE' : 'none' }}>
                  <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 600, color: '#181B2A' }}>{r.name}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <button
                      onClick={() => generatePDF(r.name, r.type)}
                      disabled={pdfLoading === r.type}
                      style={{ ...BTN_OUTLINE, opacity: pdfLoading === r.type ? 0.6 : 1 }}
                    >{pdfLoading === r.type ? 'Generating…' : 'Generate PDF'}</button>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <button
                      onClick={() => exportCSV(r.type, r.name)}
                      disabled={csvLoading === r.type}
                      style={{ ...BTN_OUTLINE, opacity: csvLoading === r.type ? 0.6 : 1 }}
                    >{csvLoading === r.type ? 'Exporting…' : 'Export CSV'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── RIGHT: Archive & Rollover wizard ─────────── */}
      <div style={{ width: 340, flexShrink: 0, position: 'sticky', top: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #E8E8EE', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>

          {/* Header */}
          <div style={{ padding: '18px 20px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#181B2A' }}>Archive & Rollover</span>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#F5F3FF', border: '1.5px solid #c4b5fd', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#6D4AFF', lineHeight: 1 }}>!</span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#A0A3B8' }}>Step-through wizard with confirmation gates.</div>
          </div>

          {/* Horizontal bar step indicators */}
          <div style={{ padding: '0 20px 16px' }}>
            {/* Progress bars row */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
              {WIZARD_STEPS.map(s => (
                <div
                  key={s.n}
                  style={{
                    flex: 1, height: s.n === wizardStep ? 5 : 3,
                    borderRadius: 4,
                    background: s.n < wizardStep ? '#6D4AFF' : s.n === wizardStep ? '#6D4AFF' : '#E8E8EE',
                    transition: 'all 0.25s',
                    alignSelf: 'flex-end',
                    opacity: s.n < wizardStep ? 0.5 : 1,
                  }}
                />
              ))}
            </div>
            {/* Step labels row */}
            <div style={{ display: 'flex', gap: 4 }}>
              {WIZARD_STEPS.map(s => (
                <div key={s.n} style={{ flex: 1, fontSize: 10, lineHeight: 1.35, fontWeight: s.n === wizardStep ? 700 : 400, color: s.n === wizardStep ? '#6D4AFF' : '#A0A3B8' }}>
                  {s.n}. {s.label}
                </div>
              ))}
            </div>
          </div>

          {/* Step content card */}
          <div style={{ margin: '0 14px 14px', border: '1px solid #E8E8EE', borderRadius: 12, overflow: 'hidden' }}>

            {wizardStep === 1 && (
              <div style={{ padding: '16px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#181B2A', marginBottom: 14 }}>Review {currentYearLabel} final totals</div>

                {/* 3 stat boxes side-by-side */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {[
                    { label: 'COLLECTED',   value: collected,              color: '#16a34a' },
                    { label: 'OUTSTANDING', value: outstanding,            color: '#DC2626' },
                    { label: 'CONCESSIONS', value: Math.max(0,concessions),color: '#7C3AED' },
                  ].map(s => (
                    <div key={s.label} style={{ flex: 1, padding: '10px 8px', background: '#F8F8FB', border: '1px solid #E8E8EE', borderRadius: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em', color: s.color, marginBottom: 5 }}>{s.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: s.color, lineHeight: 1 }}>Rs.</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: s.color, lineHeight: 1.2, marginTop: 2, wordBreak: 'break-all' as const }}>
                        {s.value.toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 12, color: '#A0A3B8', lineHeight: 1.55 }}>
                  These figures are locked for review. Confirm they match your accounts before proceeding.
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div style={{ padding: '16px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#181B2A', marginBottom: 14 }}>Set next academic year & date</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: '#A0A3B8', marginBottom: 6 }}>NEXT ACADEMIC YEAR</div>
                    <input value={nextYearName} onChange={e => setNextYearName(e.target.value)} style={{ width: '100%', height: 38, border: '1px solid #E8E8EE', borderRadius: 8, padding: '0 12px', fontSize: 13, boxSizing: 'border-box' as const, outline: 'none' }}/>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: '#A0A3B8', marginBottom: 6 }}>ROLLOVER DATE</div>
                    <input type="date" value={rolloverDate} onChange={e => setRolloverDate(e.target.value)} style={{ width: '100%', height: 38, border: '1px solid #E8E8EE', borderRadius: 8, padding: '0 12px', fontSize: 13, boxSizing: 'border-box' as const, outline: 'none' }}/>
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div style={{ padding: '16px' }}>
                <div style={{ fontSize: 11.5, color: '#A0A3B8', marginBottom: 12, lineHeight: 1.55 }}>
                  Select groups to roll over, then click <strong style={{ color: '#181B2A' }}>Edit Amounts</strong> to hike fees for next year.
                </div>
                {grpLoading ? (
                  <div style={{ padding: '12px 0', color: '#A0A3B8', fontSize: 12 }}>Loading groups…</div>
                ) : feeGroups.length === 0 ? (
                  <div style={{ padding: '12px 0', color: '#A0A3B8', fontSize: 12 }}>No fee groups found.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {feeGroups.map(group => (
                      <div key={group.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', border: '1px solid #E8E8EE', borderRadius: 8 }}>
                        <input type="checkbox" checked={selectedGroupIds.has(group.id)} onChange={() => toggleGroupSelected(group.id)} style={{ accentColor: '#6D4AFF', width: 14, height: 14, flexShrink: 0, cursor: 'pointer' }}/>
                        <span style={{ fontSize: 11.5, color: '#A0A3B8', flexShrink: 0 }}>Copy</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#181B2A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group.name}</div>
                          <div style={{ fontSize: 10.5, color: '#A0A3B8', marginTop: 1 }}>schedules & concessions</div>
                        </div>
                        <button
                          onClick={() => openEditModal(group.id, group.name)}
                          style={{ flexShrink: 0, height: 28, padding: '0 9px', background: '#fff', border: '1px solid #E8E8EE', borderRadius: 6, fontSize: 11.5, fontWeight: 500, cursor: 'pointer', color: '#181B2A', whiteSpace: 'nowrap' as const }}
                        >Edit Amounts</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {wizardStep === 4 && (
              <div style={{ padding: '16px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#181B2A', marginBottom: 10 }}>Execute rollover</div>
                <div style={{ padding: '11px 13px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, fontSize: 12, color: '#92400E', lineHeight: 1.6, marginBottom: 14 }}>
                  ⚠️ This will archive {currentYearLabel} and create the {nextYearName || '—'} academic year. This action cannot be undone.
                </div>
                <button onClick={executeRollover} disabled={rollingOver}
                  style={{ width: '100%', height: 38, background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: rollingOver ? 'not-allowed' : 'pointer', opacity: rollingOver ? 0.6 : 1, boxShadow: '0 2px 8px rgba(220,38,38,0.2)' }}>
                  {rollingOver ? 'Executing…' : 'Execute Rollover'}
                </button>
              </div>
            )}
          </div>

          {/* Back / Next footer */}
          <div style={{ padding: '0 14px 16px', display: 'flex', gap: 10 }}>
            <button
              onClick={() => setWizardStep(p => Math.max(1, p - 1) as WizardStep)}
              disabled={wizardStep === 1}
              style={{ flex: 1, height: 38, background: '#fff', color: '#181B2A', border: '1.5px solid #E8E8EE', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: wizardStep === 1 ? 'not-allowed' : 'pointer', opacity: wizardStep === 1 ? 0.4 : 1 }}
            >← Back</button>
            <button
              onClick={() => wizardStep < 4 && setWizardStep(p => (p + 1) as WizardStep)}
              disabled={wizardStep === 4}
              style={{ flex: 1.4, height: 38, background: wizardStep === 4 ? '#E8E8EE' : '#6D4AFF', color: wizardStep === 4 ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: wizardStep === 4 ? 'not-allowed' : 'pointer', boxShadow: wizardStep < 4 ? '0 2px 10px rgba(109,74,255,0.3)' : 'none' }}
            >Next →</button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#1e293b', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 13.5, fontWeight: 500, boxShadow: '0 8px 28px rgba(0,0,0,0.22)', zIndex: 9999, maxWidth: 420 }}>
          {toast}
        </div>
      )}

      {/* Edit Amounts modal */}
      {editModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.42)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div style={{ background: '#fff', borderRadius: 16, width: 780, maxWidth: '96vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>

            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E8E8EE', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#181B2A' }}>Edit Fee Amounts — {editModal.groupName}</div>
                <div style={{ fontSize: 13, color: '#A0A3B8', marginTop: 3 }}>New-year ({nextYearName || 'next year'}) amounts. Changes are staged and applied when rollover executes.</div>
              </div>
              <button onClick={closeModal} style={{ width: 32, height: 32, border: 'none', background: '#F3F4F6', borderRadius: 8, cursor: 'pointer', fontSize: 18, color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

              {/* % hike quick-apply */}
              <div style={{ background: '#F5F3FF', border: '1px solid #c4b5fd', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6D4AFF', marginBottom: 10 }}>Apply</div>
                <input
                  type="number"
                  placeholder="e.g. 10"
                  value={hikePercent}
                  onChange={e => setHikePercent(e.target.value)}
                  style={{ width: '100%', height: 42, border: '1px solid #c4b5fd', borderRadius: 8, padding: '0 14px', fontSize: 14, boxSizing: 'border-box' as const, outline: 'none', marginBottom: 12, background: '#fff' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
                  <span style={{ fontSize: 13, color: '#6D4AFF', fontWeight: 500 }}>% hike to all amounts</span>
                  <button
                    onClick={applyHike}
                    style={{ height: 32, padding: '0 14px', background: '#6D4AFF', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >Apply →</button>
                  <span style={{ fontSize: 12, color: '#A0A3B8' }}>Quick shortcut — you can still edit individual rows below</span>
                </div>
              </div>

              {/* Fee types table */}
              {modalLoading ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#A0A3B8', fontSize: 14 }}>Loading fee types…</div>
              ) : modalRows.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#A0A3B8', fontSize: 14 }}>No fee types found for this group.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH, width: '22%' }}>FEE TYPE</th>
                      <th style={{ ...TH, width: '30%' }}>CURRENT BREAKDOWN</th>
                      <th style={{ ...TH, width: '16%' }}>CURRENT TOTAL</th>
                      <th style={{ ...TH, width: '20%' }}>NEW AMOUNT ({nextYearName || 'next year'})</th>
                      <th style={{ ...TH, width: '12%', textAlign: 'center' }}>CHANGE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalRows.map((row, i) => {
                      const current = parseFloat(row.current_total) || 0;
                      const newAmt  = parseFloat(row.new_amount) || 0;
                      const diff    = current > 0 ? (((newAmt - current) / current) * 100) : null;
                      const changeLabel = diff === null || newAmt === current
                        ? '—'
                        : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`;
                      const changeColor = diff === null || diff === 0 ? '#A0A3B8' : diff > 0 ? '#16a34a' : '#DC2626';
                      return (
                        <tr key={row.id} style={{ borderBottom: i < modalRows.length - 1 ? '1px solid #E8E8EE' : 'none' }}>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                              <span style={{ fontSize: 13.5, fontWeight: 600, color: row.is_deleted ? '#9CA3AF' : '#181B2A' }}>{row.name}</span>
                              {row.is_deleted && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#FEE2E2', color: '#DC2626' }}>Inactive</span>}
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: row.schedule_type === 'term_wise' ? '#EDE9FE' : row.schedule_type === 'monthly' ? '#E0F2FE' : '#FEF3C7', color: row.schedule_type === 'term_wise' ? '#7C3AED' : row.schedule_type === 'monthly' ? '#0369A1' : '#D97706' }}>
                              {({'term_wise':'Term-wise', 'monthly':'Monthly', 'quarterly':'Quarterly', 'half_yearly':'Half-yearly', 'yearly':'Yearly', 'one_time':'One-time'} as Record<string,string>)[row.schedule_type] ?? 'Custom'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: 13, color: '#6B7280' }}>{row.breakdown}</td>
                          <td style={{ padding: '14px 16px', fontSize: 13.5, fontWeight: 600, color: '#181B2A' }}>₹{current.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '14px 16px' }}>
                            <input
                              type="number"
                              value={row.new_amount}
                              onChange={e => updateModalRow(row.id, e.target.value)}
                              style={{ width: '100%', height: 36, border: '1px solid #E8E8EE', borderRadius: 8, padding: '0 12px', fontSize: 13, boxSizing: 'border-box' as const, outline: 'none' }}
                            />
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: changeColor, textAlign: 'center' }}>{changeLabel}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E8E8EE', display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0 }}>
              <button
                onClick={closeModal}
                style={{ height: 42, padding: '0 20px', background: '#fff', color: '#181B2A', border: '1.5px solid #E8E8EE', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
              >Cancel</button>
              <button
                onClick={saveModalAmounts}
                disabled={savingModal || modalLoading}
                style={{ height: 42, padding: '0 24px', background: '#6D4AFF', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: savingModal ? 'not-allowed' : 'pointer', opacity: savingModal ? 0.7 : 1, boxShadow: '0 2px 10px rgba(109,74,255,0.3)' }}
              >{savingModal ? 'Saving…' : `Save Amounts for ${editModal.groupName}`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
