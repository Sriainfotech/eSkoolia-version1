// HIDDEN - no backend yet
// "use client";
//
// import Link from "next/link";
// import { useEffect, useState } from "react";
// import { API_BASE_URL } from "@/lib/api";
// import { getAccessToken } from "@/lib/auth";
//
// type Category = { id: number; title: string };
//
// type StockRow = {
//   id: number;
//   item_code: string;
//   name: string;
//   category_name: string;
//   unit: string;
//   quantity: string;
//   reorder_level: string;
//   unit_cost: string;
//   unit_price: string;
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
// export default function InventoryStockReportPage() {
//   const [categories, setCategories] = useState<Category[]>([]);
//   const [filters, setFilters] = useState({ category_id: "", low_stock: "" });
//   const [rows, setRows] = useState<StockRow[]>([]);
//   const [total, setTotal] = useState(0);
//   const [loading, setLoading] = useState(false);
//   const [searched, setSearched] = useState(false);
//   const [error, setError] = useState("");
//
//   useEffect(() => {
//     apiFetch<{ item_categories: Category[] }>("/api/v1/reports/criteria/")
//       .then((d) => setCategories(d.item_categories ?? []))
//       .catch(() => setError("Failed to load criteria."));
//   }, []);
//
//   const buildParams = () => {
//     const p = new URLSearchParams();
//     if (filters.category_id) p.set("category_id", filters.category_id);
//     if (filters.low_stock) p.set("low_stock", filters.low_stock);
//     return p.toString();
//   };
//
//   const search = async () => {
//     setLoading(true);
//     setError("");
//     try {
//       const data = await apiFetch<{ count: number; results: StockRow[] }>(`/api/v1/reports/inventory-stock/?${buildParams()}`);
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
//     window.open(`${API_BASE_URL}/api/v1/reports/inventory-stock/?${buildParams()}&format=csv&token=${token ?? ""}`, "_blank");
//   };
//
//   const lowStockCount = rows.filter((r) => parseFloat(r.quantity) <= parseFloat(r.reorder_level)).length;
//
//   return (
//     <div>
//       <section style={{ background: "#fff", padding: "12px 20px", borderRadius: 8, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//         <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Inventory Stock Report</h1>
//         <div style={{ fontSize: 13, color: "#6b7280", display: "flex", gap: 6 }}>
//           <Link href="/dashboard" style={{ color: "#6b7280", textDecoration: "none" }}>Dashboard</Link>
//           <span>/</span>
//           <Link href="/reports" style={{ color: "#6b7280", textDecoration: "none" }}>Reports</Link>
//           <span>/</span>
//           <span style={{ color: "var(--primary, #3b82f6)" }}>Stock Report</span>
//         </div>
//       </section>
//
//       <section style={{ background: "#fff", borderRadius: 8, padding: 20, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
//         <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600 }}>Select Criteria</h3>
//         <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
//           <div>
//             <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Category</label>
//             <select style={field} value={filters.category_id} onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}>
//               <option value="">All Categories</option>
//               {categories.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
//             </select>
//           </div>
//           <div>
//             <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Stock Level</label>
//             <select style={field} value={filters.low_stock} onChange={(e) => setFilters({ ...filters, low_stock: e.target.value })}>
//               <option value="">All Items</option>
//               <option value="true">Low Stock Only</option>
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
//         <>
//           {/* Summary */}
//           <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 }}>
//             <div style={{ background: "#fff", borderRadius: 8, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,.08)", borderLeft: "4px solid #3b82f6" }}>
//               <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Total Items</div>
//               <div style={{ fontSize: 22, fontWeight: 700, color: "#1e40af" }}>{total}</div>
//             </div>
//             {lowStockCount > 0 && (
//               <div style={{ background: "#fff", borderRadius: 8, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,.08)", borderLeft: "4px solid #ef4444" }}>
//                 <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Low Stock Alert</div>
//                 <div style={{ fontSize: 22, fontWeight: 700, color: "#991b1b" }}>{lowStockCount}</div>
//               </div>
//             )}
//           </div>
//
//           <section style={{ background: "#fff", borderRadius: 8, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
//             <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600 }}>Stock List</h3>
//             <div style={{ overflowX: "auto" }}>
//               <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
//                 <thead>
//                   <tr style={{ background: "#f9fafb" }}>
//                     {["#", "Item Code", "Name", "Category", "Unit", "Quantity", "Reorder Level", "Unit Cost", "Unit Price", "Status"].map((h) => (
//                       <th key={h} style={{ padding: "10px 12px", border: "1px solid #e5e7eb", textAlign: "left", fontWeight: 600 }}>{h}</th>
//                     ))}
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {rows.length === 0 ? (
//                     <tr><td colSpan={10} style={{ padding: 16, color: "#9ca3af", textAlign: "center" }}>No items found.</td></tr>
//                   ) : rows.map((r, i) => {
//                     const isLow = parseFloat(r.quantity) <= parseFloat(r.reorder_level);
//                     return (
//                       <tr key={r.id} style={{ background: isLow ? "#fff7ed" : i % 2 === 0 ? "#fff" : "#f9fafb" }}>
//                         <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{i + 1}</td>
//                         <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.item_code}</td>
//                         <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", fontWeight: 500 }}>{r.name}</td>
//                         <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.category_name || "-"}</td>
//                         <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.unit}</td>
//                         <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", fontWeight: 600, color: isLow ? "#991b1b" : "#065f46" }}>{r.quantity}</td>
//                         <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.reorder_level}</td>
//                         <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.unit_cost}</td>
//                         <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.unit_price}</td>
//                         <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>
//                           <span style={{ background: isLow ? "#fee2e2" : "#d1fae5", color: isLow ? "#991b1b" : "#065f46", padding: "2px 8px", borderRadius: 12, fontSize: 12 }}>
//                             {isLow ? "Low Stock" : "In Stock"}
//                           </span>
//                         </td>
//                       </tr>
//                     );
//                   })}
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
