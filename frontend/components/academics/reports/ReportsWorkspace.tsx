"use client";

import { useState } from "react";
import { BookOpenCheck, CheckCircle2, ClipboardList, Download } from "lucide-react";
import {
  downloadReport,
  useAcademicsReportsSummary,
  useHomeworkEvaluation,
  useReportDownloadCatalog,
  useSyllabusProgress,
} from "@/hooks/useAcademicsReportsApi";

export default function ReportsWorkspace() {
  const { summary, loading: loadingSummary } = useAcademicsReportsSummary();
  const { rows: progress, loading: loadingProgress } = useSyllabusProgress();
  const { catalog } = useReportDownloadCatalog();
  const { rows: hwRows, loading: loadingHw } = useHomeworkEvaluation();
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const showToast = (message: string, tone: "success" | "error" = "success") => { setToast({ message, tone }); setTimeout(() => setToast(null), 3200); };

  const download = async (key: string) => {
    setDownloadingKey(key);
    try { await downloadReport(key, "pdf"); showToast("Report downloaded."); }
    catch { showToast("Could not generate that report.", "error"); }
    finally { setDownloadingKey(null); }
  };

  const tiles = [
    { label: "Avg Coverage", value: loadingSummary ? "—" : `${summary?.avg_coverage_pct ?? 0}%`, sub: "all classes", icon: BookOpenCheck, bg: "#EEEAFF", fg: "#4F35CC" },
    { label: "Lessons Done", value: loadingSummary ? "—" : String(summary?.lessons_done_count ?? 0), sub: "this term", icon: CheckCircle2, bg: "#DCFCE7", fg: "#15803D" },
    { label: "Homework Pending", value: loadingSummary ? "—" : String(summary?.hw_pending_count ?? 0), sub: "awaiting eval", icon: ClipboardList, bg: "#FEF3C7", fg: "#B45309" },
    { label: "Reports Ready", value: loadingSummary ? "—" : String(summary?.reports_ready_count ?? 0), sub: "", icon: Download, bg: "#DBEAFE", fg: "#1D4ED8" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--page)", padding: "20px 24px 60px" }}>
      <div className="mb-5">
        <div className="text-[11px] font-bold text-[#6F767E] tracking-[0.05em] uppercase mb-1">ACADEMICS</div>
        <h1 className="m-0 text-[28px] font-extrabold text-[#15172A]">Reports</h1>
        <p className="mt-1.5 text-[13px] text-[#5B5E72]">Syllabus coverage, homework evaluation, and downloadable reports — pulled live from Timetable and Planning Studio.</p>
      </div>

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-[#DBE4F0] bg-white shadow-sm p-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2.5" style={{ background: t.bg, color: t.fg }}>
              <t.icon size={17} />
            </div>
            <div className="text-[11px] font-bold text-[#5B5E72] uppercase tracking-wide">{t.label}</div>
            <div className="text-[22px] font-extrabold text-[#15172A] leading-tight">{t.value}</div>
            {t.sub && <div className="text-[11px] text-[#9EA2C4] mt-0.5">{t.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5 items-start">
        <div className="rounded-xl border border-[#DBE4F0] bg-white shadow-sm p-4">
          <div className="font-bold text-[14px] text-[#15172A] mb-3">Syllabus Progress by Class</div>
          {loadingProgress && <p className="text-[12px] text-[#9EA2C4]">Loading…</p>}
          {progress.map((p) => {
            const color = p.pct >= 80 ? "#15803D" : p.pct >= 60 ? "#B45309" : "#B91C1C";
            return (
              <div key={p.class_id} className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-semibold text-[#15172A]">{p.class_name}</span>
                  <span className="text-[13px] font-bold" style={{ color }}>{p.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#E8ECF5] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${p.pct}%`, background: color }} />
                </div>
                <div className="text-[10.5px] text-[#9EA2C4] mt-0.5">{p.done} of {p.total} chapters</div>
              </div>
            );
          })}
          {!loadingProgress && progress.length === 0 && <p className="text-[12px] text-[#9EA2C4] italic">No syllabus data recorded yet.</p>}
        </div>

        <div className="rounded-xl border border-[#DBE4F0] bg-white shadow-sm p-4">
          <div className="font-bold text-[14px] text-[#15172A] mb-3">Reports &amp; Downloads</div>
          {catalog.map((r) => (
            <button
              key={r.key}
              onClick={() => void download(r.key)}
              disabled={downloadingKey === r.key}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#F5F5FB] hover:bg-[#EEEAFF] mb-1.5 text-left disabled:opacity-50"
            >
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-[#15172A]">{r.name}</div>
                <div className="text-[11px] text-[#9EA2C4]">{r.description}</div>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-white text-[#5B5E72] uppercase">{r.format}</span>
              <Download size={14} className="text-[#9EA2C4]" />
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[#DBE4F0] bg-white shadow-sm p-4">
        <div className="font-bold text-[14px] text-[#15172A] mb-3">Homework Evaluation Tracker</div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[640px]">
            <thead>
              <tr className="text-[11px] text-[#9EA2C4] uppercase tracking-wide text-left">
                <th className="py-2 pr-3">Assignment</th><th className="py-2 pr-3">Class</th><th className="py-2 pr-3">Subject</th>
                <th className="py-2 pr-3">Due</th><th className="py-2 pr-3">Submitted</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {hwRows.map((r) => (
                <tr key={r.id} className="border-t border-[#F5F5FB] text-[13px]">
                  <td className="py-2 pr-3 font-semibold text-[#15172A]">{r.title}</td>
                  <td className="py-2 pr-3">{r.class_name}{r.section_name ? ` – ${r.section_name}` : ""}</td>
                  <td className="py-2 pr-3">{r.subject_name}</td>
                  <td className="py-2 pr-3">{r.due_date}</td>
                  <td className="py-2 pr-3">{r.submitted_count}</td>
                  <td className="py-2 pr-3">
                    <span className={["text-[10px] font-bold px-2 py-1 rounded-full", r.status === "Evaluated" ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#FEF3C7] text-[#B45309]"].join(" ")}>{r.status}</span>
                  </td>
                  <td className="py-2 pr-3">{r.avg_score_pct !== null ? `${r.avg_score_pct}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {loadingHw && <p className="text-[12px] text-[#9EA2C4] mt-2">Loading…</p>}
          {!loadingHw && hwRows.length === 0 && <p className="text-[12px] text-[#9EA2C4] italic mt-2">No homework recorded yet.</p>}
        </div>
      </div>

      {toast && (
        <div className={["fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold shadow-2xl max-w-sm", toast.tone === "success" ? "bg-[#15172A] text-white" : "bg-[#E0463A] text-white"].join(" ")}>
          <span>{toast.tone === "success" ? "✓" : "✕"}</span><span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
