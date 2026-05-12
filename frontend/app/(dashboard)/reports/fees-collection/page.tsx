// HIDDEN - no backend yet
// "use client";
//
// import Link from "next/link";
// import { useEffect, useState } from "react";
// import { API_BASE_URL } from "@/lib/api";
// import { getAccessToken } from "@/lib/auth";
//
// type SchoolClass = { id: number; name: string };
//
// type CollectionRow = {
//   payment_id: number;
//   admission_no: string;
//   student_name: string;
//   class_name: string;
//   fees_type: string;
//   amount_paid: string;
//   method: string;
//   paid_at: string;
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
// export default function FeesCollectionReportPage() {
//   const [classes, setClasses] = useState<SchoolClass[]>([]);
//   const [filters, setFilters] = useState({ class_id: "", date_from: "", date_to: "", method: "" });
//   const [rows, setRows] = useState<CollectionRow[]>([]);
//   const [total, setTotal] = useState(0);
//   const [totalCollected, setTotalCollected] = useState("0");
//   const [loading, setLoading] = useState(false);
//   const [searched, setSearched] = useState(false);
//   const [error, setError] = useState("");
//
//   useEffect(() => {
//     apiFetch<{ classes: SchoolClass[] }>("/api/v1/reports/criteria/")
//       .then((d) => setClasses(d.classes))
//       .catch(() => setError("Failed to load criteria."));
//   }, []);
//
//   const buildParams = () => {
//     const p = new URLSearchParams();
//     if (filters.class_id) p.set("class_id", filters.class_id);
//     if (filters.date_from) p.set("date_from", filters.date_from);
//     if (filters.date_to) p.set("date_to", filters.date_to);
//     if (filters.method) p.set("method", filters.method);
//     return p.toString();
//   };
//
//   const search = async () => {
//     setLoading(true);
//     setError("");
//     try {
//       const data = await apiFetch<{ count: number; total_collected: string; results: CollectionRow[] }>(`/api/v1/reports/fees-collection/?${buildParams()}`);
//       setRows(data.results ?? []);
//       setTotal(data.count ?? 0);
//       setTotalCollected(data.total_collected ?? "0");
//       setSearched(true);
//     } catch {
//       setError("Failed to load report.");
//     } finally {
//       setLoading(false);
//     }
//   };
//
//   const resetFilters = () => {
//     setFilters({ class_id: "", date_from: "", date_to: "", method: "" });
//     setRows([]);
//     setTotal(0);
//     setTotalCollected("0");
//     setSearched(false);
//     setError("");
//   };
//
//   const exportReport = (format: "csv" | "excel" | "pdf") => {
//     const token = getAccessToken();
//     window.open(`${API_BASE_URL}/api/v1/reports/fees-collection/?${buildParams()}&format=${format}&token=${token ?? ""}`, "_blank");
//   };
//
//   return (
//     <div>
//       <section style={{ background: "#fff", padding: "12px 20px", borderRadius: 8, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//         <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Fees Collection Report</h1>
//         <div style={{ fontSize: 13, color: "#6b7280", display: "flex", gap: 6 }}>
//           <Link href="/dashboard" style={{ color: "#6b7280", textDecoration: "none" }}>Dashboard</Link>
//           <span>/</span>
//           <Link href="/reports" style={{ color: "#6b7280", textDecoration: "none" }}>Reports</Link>
//           <span>/</span>
//           <span style={{ color: "var(--primary, #3b82f6)" }}>Fees Collection Report</span>
//         </div>
//       </section>
//
//       <section style={{ background: "#fff", borderRadius: 8, padding: 20, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
//         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
//           <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Select Criteria</h3>
//           <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
//             <button type="button" style={btn("#16a34a")} onClick={() => exportReport("csv")}>Export CSV</button>
//             <button type="button" style={btn("#2563eb")} onClick={() => exportReport("excel")}>Export Excel</button>
//             <button type="button" style={btn("#7c3aed")} onClick={() => exportReport("pdf")}>Export PDF</button>
//           </div>
//         </div>
//         <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
//           <div>
//             <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Date From</label>
//             <input type="date" style={field} value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
//           </div>
//           <div>
//             <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Date To</label>
//             <input type="date" style={field} value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
//           </div>
//           <div>
//             <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Class</label>
//             <select style={field} value={filters.class_id} onChange={(e) => setFilters({ ...filters, class_id: e.target.value })}>
//               <option value="">All Classes</option>
//               {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
//             </select>
//           </div>
//           <div>
//             <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Payment Method</label>
//             <select style={field} value={filters.method} onChange={(e) => setFilters({ ...filters, method: e.target.value })}>
//               <option value="">All</option>
//               <option value="cash">Cash</option>
//               <option value="bank">Bank</option>
//               <option value="online">Online</option>
//               <option value="cheque">Cheque</option>
//               <option value="wallet">Wallet</option>
//             </select>
//           </div>
//           <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
//             <button style={btn()} onClick={() => void search()} disabled={loading}>{loading ? "Loading…" : "Search"}</button>
//             <button type="button" style={btn("#64748b")} onClick={resetFilters} disabled={loading}>Reset</button>
//           </div>
//         </div>
//         {error && <p style={{ color: "#ef4444", marginTop: 10, fontSize: 13 }}>{error}</p>}
//       </section>
//
//       {searched && (
//         <>
//           {/* Summary */}
//           <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 }}>
//             <div style={{ background: "#fff", borderRadius: 8, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,.08)", borderLeft: "4px solid #10b981" }}>
//               <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Total Collected</div>
//               <div style={{ fontSize: 22, fontWeight: 700, color: "#065f46" }}>{totalCollected}</div>
//             </div>
//             <div style={{ background: "#fff", borderRadius: 8, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,.08)", borderLeft: "4px solid #3b82f6" }}>
//               <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Total Records</div>
//               <div style={{ fontSize: 22, fontWeight: 700, color: "#1e40af" }}>{total}</div>
//             </div>
//           </div>
//
//           <section style={{ background: "#fff", borderRadius: 8, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
//             <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600 }}>Payment Records</h3>
//             <div style={{ overflowX: "auto" }}>
//               <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
//                 <thead>
//                   <tr style={{ background: "#f9fafb" }}>
//                     {["#", "Payment ID", "Admission No", "Student Name", "Class", "Fees Type", "Amount Paid", "Method", "Paid At"].map((h) => (
//                       <th key={h} style={{ padding: "10px 12px", border: "1px solid #e5e7eb", textAlign: "left", fontWeight: 600 }}>{h}</th>
//                     ))}
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {rows.length === 0 ? (
//                     <tr><td colSpan={9} style={{ padding: 16, color: "#9ca3af", textAlign: "center" }}>No payment records found.</td></tr>
//                   ) : rows.map((r, i) => (
//                     <tr key={r.payment_id} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{i + 1}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>#{r.payment_id}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.admission_no}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.student_name}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.class_name || "-"}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.fees_type || "-"}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", fontWeight: 600, color: "#065f46" }}>{r.amount_paid}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>
//                         <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: 12, fontSize: 12 }}>{r.method}</span>
//                       </td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.paid_at}</td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </section>
//         </>
//       )}
//     </div>
//   );
// }

import ComingSoon from '@/components/shared/ComingSoon';

export default function Page() {
  return <ComingSoon />;
}
