// HIDDEN - no backend yet
// "use client";
//
// import Link from "next/link";
// import { useState } from "react";
// import { API_BASE_URL } from "@/lib/api";
// import { getAccessToken } from "@/lib/auth";
//
// type IssueRow = {
//   id: number;
//   book_title: string;
//   member_name: string;
//   member_type: string;
//   issue_date: string;
//   due_date: string;
//   return_date: string | null;
//   fine_amount: string;
//   status: string;
// };
//
// const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
//   issued: { bg: "#dbeafe", color: "#1e40af" },
//   returned: { bg: "#d1fae5", color: "#065f46" },
//   lost: { bg: "#fee2e2", color: "#991b1b" },
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
// export default function LibraryIssueReportPage() {
//   const [filters, setFilters] = useState({ date_from: "", date_to: "", status: "", member_type: "" });
//   const [rows, setRows] = useState<IssueRow[]>([]);
//   const [total, setTotal] = useState(0);
//   const [loading, setLoading] = useState(false);
//   const [searched, setSearched] = useState(false);
//   const [error, setError] = useState("");
//
//   const buildParams = () => {
//     const p = new URLSearchParams();
//     if (filters.date_from) p.set("date_from", filters.date_from);
//     if (filters.date_to) p.set("date_to", filters.date_to);
//     if (filters.status) p.set("status", filters.status);
//     if (filters.member_type) p.set("member_type", filters.member_type);
//     return p.toString();
//   };
//
//   const search = async () => {
//     setLoading(true);
//     setError("");
//     try {
//       const data = await apiFetch<{ count: number; results: IssueRow[] }>(`/api/v1/reports/library-issue/?${buildParams()}`);
//       setRows(data.results ?? []);
//       setTotal(data.count ?? 0);
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
//     window.open(`${API_BASE_URL}/api/v1/reports/library-issue/?${buildParams()}&format=csv&token=${token ?? ""}`, "_blank");
//   };
//
//   return (
//     <div>
//       <section style={{ background: "#fff", padding: "12px 20px", borderRadius: 8, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//         <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Book Issue Report</h1>
//         <div style={{ fontSize: 13, color: "#6b7280", display: "flex", gap: 6 }}>
//           <Link href="/dashboard" style={{ color: "#6b7280", textDecoration: "none" }}>Dashboard</Link>
//           <span>/</span>
//           <Link href="/reports" style={{ color: "#6b7280", textDecoration: "none" }}>Reports</Link>
//           <span>/</span>
//           <span style={{ color: "var(--primary, #3b82f6)" }}>Book Issue Report</span>
//         </div>
//       </section>
//
//       <section style={{ background: "#fff", borderRadius: 8, padding: 20, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
//         <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600 }}>Select Criteria</h3>
//         <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
//           <div>
//             <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Issue Date From</label>
//             <input type="date" style={field} value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
//           </div>
//           <div>
//             <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Issue Date To</label>
//             <input type="date" style={field} value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
//           </div>
//           <div>
//             <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Status</label>
//             <select style={field} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
//               <option value="">All</option>
//               <option value="issued">Issued</option>
//               <option value="returned">Returned</option>
//               <option value="lost">Lost</option>
//             </select>
//           </div>
//           <div>
//             <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Member Type</label>
//             <select style={field} value={filters.member_type} onChange={(e) => setFilters({ ...filters, member_type: e.target.value })}>
//               <option value="">All</option>
//               <option value="student">Student</option>
//               <option value="staff">Staff</option>
//             </select>
//           </div>
//           <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
//             <button style={btn()} onClick={() => void search()} disabled={loading}>{loading ? "Loading…" : "Search"}</button>
//             {searched && <button style={btn("#10b981")} onClick={exportCsv}>Export CSV</button>}
//           </div>
//         </div>
//         {error && <p style={{ color: "#ef4444", marginTop: 10, fontSize: 13 }}>{error}</p>}
//       </section>
//
//       {searched && (
//         <section style={{ background: "#fff", borderRadius: 8, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
//           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
//             <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Issue Records</h3>
//             <span style={{ fontSize: 13, color: "#6b7280" }}>Total: {total}</span>
//           </div>
//           <div style={{ overflowX: "auto" }}>
//             <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
//               <thead>
//                 <tr style={{ background: "#f9fafb" }}>
//                   {["#", "Book Title", "Member Name", "Type", "Issue Date", "Due Date", "Return Date", "Fine", "Status"].map((h) => (
//                     <th key={h} style={{ padding: "10px 12px", border: "1px solid #e5e7eb", textAlign: "left", fontWeight: 600 }}>{h}</th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody>
//                 {rows.length === 0 ? (
//                   <tr><td colSpan={9} style={{ padding: 16, color: "#9ca3af", textAlign: "center" }}>No issue records found.</td></tr>
//                 ) : rows.map((r, i) => {
//                   const st = STATUS_STYLE[r.status] ?? { bg: "#f3f4f6", color: "#374151" };
//                   const overdue = r.status === "issued" && new Date(r.due_date) < new Date();
//                   return (
//                     <tr key={r.id} style={{ background: overdue ? "#fff7ed" : i % 2 === 0 ? "#fff" : "#f9fafb" }}>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{i + 1}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", fontWeight: 500 }}>{r.book_title}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.member_name}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", textTransform: "capitalize" }}>{r.member_type}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.issue_date}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", color: overdue ? "#991b1b" : undefined, fontWeight: overdue ? 600 : undefined }}>{r.due_date}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.return_date || "-"}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", color: parseFloat(r.fine_amount) > 0 ? "#991b1b" : undefined }}>{r.fine_amount}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>
//                         <span style={{ background: st.bg, color: st.color, padding: "2px 8px", borderRadius: 12, fontSize: 12, textTransform: "capitalize" }}>
//                           {overdue && r.status === "issued" ? "Overdue" : r.status}
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
