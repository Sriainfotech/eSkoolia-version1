// HIDDEN - no backend yet
// "use client";
//
// import Link from "next/link";
// import { useState } from "react";
// import { API_BASE_URL } from "@/lib/api";
// import { getAccessToken } from "@/lib/auth";
//
// type LedgerRow = {
//   id: number;
//   date: string;
//   account_name: string;
//   account_type: string;
//   entry_type: string;
//   amount: string;
//   reference_no: string;
//   description: string;
// };
//
// const ACCOUNT_TYPES = ["asset", "liability", "equity", "income", "expense"];
// const ENTRY_TYPES = ["debit", "credit"];
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
// export default function AccountsLedgerReportPage() {
//   const [filters, setFilters] = useState({ date_from: "", date_to: "", account_type: "", entry_type: "" });
//   const [rows, setRows] = useState<LedgerRow[]>([]);
//   const [total, setTotal] = useState(0);
//   const [totalDebit, setTotalDebit] = useState("0");
//   const [totalCredit, setTotalCredit] = useState("0");
//   const [balance, setBalance] = useState("0");
//   const [loading, setLoading] = useState(false);
//   const [searched, setSearched] = useState(false);
//   const [error, setError] = useState("");
//
//   const buildParams = () => {
//     const p = new URLSearchParams();
//     if (filters.date_from) p.set("date_from", filters.date_from);
//     if (filters.date_to) p.set("date_to", filters.date_to);
//     if (filters.account_type) p.set("account_type", filters.account_type);
//     if (filters.entry_type) p.set("entry_type", filters.entry_type);
//     return p.toString();
//   };
//
//   const search = async () => {
//     setLoading(true);
//     setError("");
//     try {
//       const data = await apiFetch<{ count: number; total_debit: string; total_credit: string; balance: string; results: LedgerRow[] }>(`/api/v1/reports/accounts-ledger/?${buildParams()}`);
//       setRows(data.results ?? []);
//       setTotal(data.count ?? 0);
//       setTotalDebit(data.total_debit ?? "0");
//       setTotalCredit(data.total_credit ?? "0");
//       setBalance(data.balance ?? "0");
//       setSearched(true);
//     } catch {
//       setError("Failed to load report.");
//     } finally {
//       setLoading(false);
//     }
//   };
//
//   const resetFilters = () => {
//     setFilters({ date_from: "", date_to: "", account_type: "", entry_type: "" });
//     setRows([]);
//     setTotal(0);
//     setTotalDebit("0");
//     setTotalCredit("0");
//     setBalance("0");
//     setSearched(false);
//     setError("");
//   };
//
//   const exportReport = (format: "csv" | "excel" | "pdf") => {
//     const token = getAccessToken();
//     window.open(`${API_BASE_URL}/api/v1/reports/accounts-ledger/?${buildParams()}&format=${format}&token=${token ?? ""}`, "_blank");
//   };
//
//   const balanceNum = parseFloat(balance);
//
//   return (
//     <div>
//       <section style={{ background: "#fff", padding: "12px 20px", borderRadius: 8, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//         <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Ledger Report</h1>
//         <div style={{ fontSize: 13, color: "#6b7280", display: "flex", gap: 6 }}>
//           <Link href="/dashboard" style={{ color: "#6b7280", textDecoration: "none" }}>Dashboard</Link>
//           <span>/</span>
//           <Link href="/reports" style={{ color: "#6b7280", textDecoration: "none" }}>Reports</Link>
//           <span>/</span>
//           <span style={{ color: "var(--primary, #3b82f6)" }}>Ledger Report</span>
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
//             <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Account Type</label>
//             <select style={field} value={filters.account_type} onChange={(e) => setFilters({ ...filters, account_type: e.target.value })}>
//               <option value="">All Types</option>
//               {ACCOUNT_TYPES.map((t) => <option key={t} value={t} style={{ textTransform: "capitalize" }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
//             </select>
//           </div>
//           <div>
//             <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Entry Type</label>
//             <select style={field} value={filters.entry_type} onChange={(e) => setFilters({ ...filters, entry_type: e.target.value })}>
//               <option value="">All</option>
//               {ENTRY_TYPES.map((t) => <option key={t} value={t} style={{ textTransform: "capitalize" }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
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
//             {[
//               { label: "Total Debit", value: totalDebit, border: "#ef4444", color: "#991b1b" },
//               { label: "Total Credit", value: totalCredit, border: "#10b981", color: "#065f46" },
//               { label: "Net Balance", value: balance, border: "#3b82f6", color: balanceNum >= 0 ? "#1e40af" : "#991b1b" },
//             ].map((s) => (
//               <div key={s.label} style={{ background: "#fff", borderRadius: 8, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,.08)", borderLeft: `4px solid ${s.border}` }}>
//                 <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{s.label}</div>
//                 <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
//               </div>
//             ))}
//           </div>
//
//           <section style={{ background: "#fff", borderRadius: 8, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
//             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
//               <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Ledger Entries</h3>
//               <span style={{ fontSize: 13, color: "#6b7280" }}>Total: {total}</span>
//             </div>
//             <div style={{ overflowX: "auto" }}>
//               <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
//                 <thead>
//                   <tr style={{ background: "#f9fafb" }}>
//                     {["#", "Date", "Account", "Account Type", "Entry Type", "Amount", "Reference", "Description"].map((h) => (
//                       <th key={h} style={{ padding: "10px 12px", border: "1px solid #e5e7eb", textAlign: "left", fontWeight: 600 }}>{h}</th>
//                     ))}
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {rows.length === 0 ? (
//                     <tr><td colSpan={8} style={{ padding: 16, color: "#9ca3af", textAlign: "center" }}>No ledger entries found.</td></tr>
//                   ) : rows.map((r, i) => (
//                     <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{i + 1}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.date}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", fontWeight: 500 }}>{r.account_name}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", textTransform: "capitalize" }}>{r.account_type}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>
//                         <span style={{ background: r.entry_type === "credit" ? "#d1fae5" : "#fee2e2", color: r.entry_type === "credit" ? "#065f46" : "#991b1b", padding: "2px 8px", borderRadius: 12, fontSize: 12, textTransform: "capitalize" }}>{r.entry_type}</span>
//                       </td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", fontWeight: 600 }}>{r.amount}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.reference_no || "-"}</td>
//                       <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.description || "-"}</td>
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
