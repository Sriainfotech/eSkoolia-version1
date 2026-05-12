// HIDDEN - no backend yet
// "use client";
//
// import Link from "next/link";
// import { useEffect, useState } from "react";
// import { API_BASE_URL } from "@/lib/api";
// import { getAccessToken } from "@/lib/auth";
//
// type Route = { id: number; title: string };
// type Vehicle = { id: number; vehicle_no: string };
//
// type TransportRow = {
//   id: number;
//   admission_no: string;
//   student_name: string;
//   class_name: string;
//   route_title: string;
//   vehicle_no: string;
//   is_active: boolean;
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
// export default function TransportReportPage() {
//   const [routes, setRoutes] = useState<Route[]>([]);
//   const [vehicles, setVehicles] = useState<Vehicle[]>([]);
//   const [filters, setFilters] = useState({ route_id: "", vehicle_id: "", is_active: "true" });
//   const [rows, setRows] = useState<TransportRow[]>([]);
//   const [total, setTotal] = useState(0);
//   const [loading, setLoading] = useState(false);
//   const [searched, setSearched] = useState(false);
//   const [error, setError] = useState("");
//
//   useEffect(() => {
//     apiFetch<{ routes: Route[]; vehicles: Vehicle[] }>("/api/v1/reports/criteria/")
//       .then((d) => { setRoutes(d.routes); setVehicles(d.vehicles); })
//       .catch(() => setError("Failed to load criteria."));
//   }, []);
//
//   const buildParams = () => {
//     const p = new URLSearchParams();
//     if (filters.route_id) p.set("route_id", filters.route_id);
//     if (filters.vehicle_id) p.set("vehicle_id", filters.vehicle_id);
//     if (filters.is_active) p.set("is_active", filters.is_active);
//     return p.toString();
//   };
//
//   const search = async () => {
//     setLoading(true);
//     setError("");
//     try {
//       const data = await apiFetch<{ count: number; results: TransportRow[] }>(`/api/v1/reports/transport/?${buildParams()}`);
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
//     window.open(`${API_BASE_URL}/api/v1/reports/transport/?${buildParams()}&format=csv&token=${token ?? ""}`, "_blank");
//   };
//
//   return (
//     <div>
//       <section style={{ background: "#fff", padding: "12px 20px", borderRadius: 8, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//         <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Student Transport Report</h1>
//         <div style={{ fontSize: 13, color: "#6b7280", display: "flex", gap: 6 }}>
//           <Link href="/dashboard" style={{ color: "#6b7280", textDecoration: "none" }}>Dashboard</Link>
//           <span>/</span>
//           <Link href="/reports" style={{ color: "#6b7280", textDecoration: "none" }}>Reports</Link>
//           <span>/</span>
//           <span style={{ color: "var(--primary, #3b82f6)" }}>Transport Report</span>
//         </div>
//       </section>
//
//       <section style={{ background: "#fff", borderRadius: 8, padding: 20, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
//         <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600 }}>Select Criteria</h3>
//         <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
//           <div>
//             <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Route</label>
//             <select style={field} value={filters.route_id} onChange={(e) => setFilters({ ...filters, route_id: e.target.value })}>
//               <option value="">All Routes</option>
//               {routes.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
//             </select>
//           </div>
//           <div>
//             <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Vehicle</label>
//             <select style={field} value={filters.vehicle_id} onChange={(e) => setFilters({ ...filters, vehicle_id: e.target.value })}>
//               <option value="">All Vehicles</option>
//               {vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicle_no}</option>)}
//             </select>
//           </div>
//           <div>
//             <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Status</label>
//             <select style={field} value={filters.is_active} onChange={(e) => setFilters({ ...filters, is_active: e.target.value })}>
//               <option value="">All</option>
//               <option value="true">Active</option>
//               <option value="false">Inactive</option>
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
//             <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Transport Assignments</h3>
//             <span style={{ fontSize: 13, color: "#6b7280" }}>Total: {total}</span>
//           </div>
//           <div style={{ overflowX: "auto" }}>
//             <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
//               <thead>
//                 <tr style={{ background: "#f9fafb" }}>
//                   {["#", "Admission No", "Student Name", "Class", "Route", "Vehicle", "Status"].map((h) => (
//                     <th key={h} style={{ padding: "10px 12px", border: "1px solid #e5e7eb", textAlign: "left", fontWeight: 600 }}>{h}</th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody>
//                 {rows.length === 0 ? (
//                   <tr><td colSpan={7} style={{ padding: 16, color: "#9ca3af", textAlign: "center" }}>No transport records found.</td></tr>
//                 ) : rows.map((r, i) => (
//                   <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
//                     <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{i + 1}</td>
//                     <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.admission_no}</td>
//                     <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", fontWeight: 500 }}>{r.student_name}</td>
//                     <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.class_name || "-"}</td>
//                     <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.route_title || "-"}</td>
//                     <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{r.vehicle_no || "-"}</td>
//                     <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>
//                       <span style={{ background: r.is_active ? "#d1fae5" : "#fee2e2", color: r.is_active ? "#065f46" : "#991b1b", padding: "2px 8px", borderRadius: 12, fontSize: 12 }}>
//                         {r.is_active ? "Active" : "Inactive"}
//                       </span>
//                     </td>
//                   </tr>
//                 ))}
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
