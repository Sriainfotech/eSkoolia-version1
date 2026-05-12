// HIDDEN - no backend yet
// "use client";
//
// import Link from "next/link";
// import { useEffect, useState } from "react";
// import { API_BASE_URL } from "@/lib/api";
// import { getAccessToken } from "@/lib/auth";
//
// type SchoolClass = { id: number; name: string };
// type Section = { id: number; name: string; class_id: number };
// type ExamOption = { id: number; name: string };
//
// type MeritRow = {
//   position: number;
//   student_id: number;
//   admission_no: string;
//   student_name: string;
//   class_name: string;
//   section_name: string;
//   total_obtained: string;
//   total_full: string;
//   percentage: string;
// };
//
// function authHeaders(): Record<string, string> {
//   const token = getAccessToken();
//   const h: Record<string, string> = { "Content-Type": "application/json" };
//   if (token) h.Authorization = `Bearer ${token}`;
//   return h;
// }
//
// async function apiFetch<T>(path: string): Promise<T> {
//   const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", headers: authHeaders() });
//   if (!res.ok) throw new Error(`Request failed ${res.status}`);
//   return (await res.json()) as T;
// }
//
// const field: React.CSSProperties = { width: "100%", height: 36, border: "1px solid var(--line, #e5e7eb)", borderRadius: 6, padding: "0 10px", fontSize: 13, fontFamily: "inherit" };
// const btn = (bg = "var(--primary, #3b82f6)"): React.CSSProperties => ({ height: 36, background: bg, border: `1px solid ${bg}`, color: "#fff", borderRadius: 6, padding: "0 14px", cursor: "pointer", fontSize: 13 });
//
// function badgeForPosition(pos: number) {
//   if (pos === 1) return { bg: "#fef3c7", color: "#92400e", label: "🥇 1st" };
//   if (pos === 2) return { bg: "#f3f4f6", color: "#374151", label: "🥈 2nd" };
//   if (pos === 3) return { bg: "#fde8d8", color: "#7c3f00", label: "🥉 3rd" };
//   return { bg: "#fff", color: "#374151", label: String(pos) };
// }
//
// export default function ExamMeritReportPage() {
//   const [classes, setClasses] = useState<SchoolClass[]>([]);
//   const [sections, setSections] = useState<Section[]>([]);
//   const [exams, setExams] = useState<ExamOption[]>([]);
//   const [filters, setFilters] = useState({ exam_id: "", class_id: "", section_id: "" });
//   const [rows, setRows] = useState<MeritRow[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [searched, setSearched] = useState(false);
//   const [error, setError] = useState("");
//
//   useEffect(() => {
//     apiFetch<{ classes: SchoolClass[]; sections: Section[]; exams: ExamOption[] }>("/api/v1/reports/criteria/")
//       .then((d) => { setClasses(d.classes); setSections(d.sections); setExams(d.exams); })
//       .catch(() => setError("Failed to load criteria."));
//   }, []);
//
//   const filteredSections = sections.filter((s) => !filters.class_id || s.class_id === Number(filters.class_id));
//
//   const buildParams = () => {
//     const p = new URLSearchParams();
//     if (filters.exam_id) p.set("exam_id", filters.exam_id);
//     if (filters.class_id) p.set("class_id", filters.class_id);
//     if (filters.section_id) p.set("section_id", filters.section_id);
//     return p.toString();
//   };
//
//   const search = async () => {
//     if (!filters.exam_id) { setError("Please select an exam."); return; }
//     setLoading(true);
//     setError("");
//     try {
//       const data = await apiFetch<{ count: number; results: MeritRow[] }>(`/api/v1/reports/exam-merit/?${buildParams()}`);
//       setRows(data.results ?? []);
//       setSearched(true);
//     } catch {
//       setError("Failed to load report.");
//     } finally {
//       setLoading(false);
//     }
//   };
//
//   const exportCsv = () => {
//     const token = getAccessToken();
//     window.open(`${API_BASE_URL}/api/v1/reports/exam-merit/?${buildParams()}&format=csv&token=${token ?? ""}`, "_blank");
//   };
//
//   return (
//     <div>
//       <section style={{ background: "#fff", padding: "12px 20px", borderRadius: 8, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//         <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Merit List Report</h1>
//         <div style={{ fontSize: 13, color: "#6b7280", display: "flex", gap: 6 }}>
//           <Link href="/dashboard" style={{ color: "#6b7280", textDecoration: "none" }}>Dashboard</Link>
//           <span>/</span>
//           <Link href="/reports" style={{ color: "#6b7280", textDecoration: "none" }}>Reports</Link>
//           <span>/</span>
//           <span style={{ color: "var(--primary, #3b82f6)" }}>Merit List Report</span>
//         </div>
//       </section>
//
//       <section style={{ background: "#fff", borderRadius: 8, padding: 20, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
//         <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600 }}>Select Criteria</h3>
//         <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
//           <div>
//             <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Exam *</label>
//             <select style={field} value={filters.exam_id} onChange={(e) => setFilters({ ...filters, exam_id: e.target.value })}>
//               <option value="">Select Exam</option>
//               {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
//             </select>
//           </div>
//           <div>
//             <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Class</label>
//             <select style={field} value={filters.class_id} onChange={(e) => setFilters({ ...filters, class_id: e.target.value, section_id: "" })}>
//               <option value="">All Classes</option>
//               {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
//             </select>
//           </div>
//           <div>
//             <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Section</label>
//             <select style={field} value={filters.section_id} onChange={(e) => setFilters({ ...filters, section_id: e.target.value })}>
//               <option value="">All Sections</option>
//               {filteredSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
//             </select>
//           </div>
//           <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
//             <button style={btn()} onClick={() => void search()} disabled={loading}>{loading ? "Loading…" : "Generate"}</button>
//             {searched && <button style={btn("#10b981")} onClick={exportCsv}>Export CSV</button>}
//           </div>
//         </div>
//         {error && <p style={{ color: "#ef4444", marginTop: 10, fontSize: 13 }}>{error}</p>}
//       </section>
//
//       {searched && (
//         <section style={{ background: "#fff", borderRadius: 8, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
//           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
//             <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Merit List</h3>
//             <span style={{ fontSize: 13, color: "#6b7280" }}>Total Students: {rows.length}</span>
//           </div>
//           <div style={{ overflowX: "auto" }}>
//             <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
//               <thead>
//                 <tr style={{ background: "#f9fafb" }}>
//                   {["Position", "Admission No", "Student Name", "Class", "Section", "Obtained", "Full Marks", "Percentage"].map((h) => (
//                     <th key={h} style={{ padding: "10px 12px", border: "1px solid #e5e7eb", textAlign: "left", fontWeight: 600 }}>{h}</th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody>
//                 {rows.length === 0 ? (
//                   <tr><td colSpan={8} style={{ padding: 16, color: "#9ca3af", textAlign: "center" }}>No data found. Ensure marks are entered for the selected exam.</td></tr>
//                 ) : rows.map((r) => {
//                   const badge = badgeForPosition(r.position);
//                   return (
//                     <tr key={r.student_id} style={{ background: r.position <= 3 ? "#fffbeb" : r.position % 2 === 0 ? "#f9fafb" : "#fff" }}>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>
//                         <span style={{ background: badge.bg, color: badge.color, padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{badge.label}</span>
//                       </td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.admission_no}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", fontWeight: 500 }}>{r.student_name}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.class_name || "-"}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.section_name || "-"}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", fontWeight: 600 }}>{r.total_obtained}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.total_full}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>
//                         <span style={{ fontWeight: 600, color: Number(r.percentage) >= 80 ? "#065f46" : Number(r.percentage) >= 60 ? "#1d4ed8" : "#991b1b" }}>
//                           {r.percentage}%
//                         </span>
//                       </td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>
//         </section>
//       )}
//     </div>
//   );
// }

import ComingSoon from '@/components/shared/ComingSoon';

export default function Page() {
  return <ComingSoon />;
}
