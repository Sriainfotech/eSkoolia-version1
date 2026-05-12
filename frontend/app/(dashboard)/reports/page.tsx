// "use client";
// 
// import Link from "next/link";
// 
// const reportModules = [
//   {
//     group: "Student Reports",
//     color: "#3b82f6",
//     icon: "👤",
//     items: [
//       { name: "Student List Report", route: "/reports/student-list", desc: "Filter students by class, section, gender" },
//       { name: "Student Attendance Report", route: "/reports/student-attendance", desc: "Attendance by date range, class, section" },
//     ],
//   },
//   {
//     group: "Examination Reports",
//     color: "#8b5cf6",
//     icon: "📝",
//     items: [
//       { name: "Exam Result Report", route: "/reports/exam-result", desc: "Marks per student per subject" },
//       { name: "Merit List Report", route: "/reports/exam-merit", desc: "Students ranked by total marks" },
//     ],
//   },
//   {
//     group: "Fees Reports",
//     color: "#10b981",
//     icon: "💰",
//     items: [
//       { name: "Fees Collection Report", route: "/reports/fees-collection", desc: "Payment records by date range and class" },
//       { name: "Fees Due Report", route: "/reports/fees-due", desc: "Unpaid and partial fee assignments" },
//     ],
//   },
//   {
//     group: "Accounts Reports",
//     color: "#f59e0b",
//     icon: "📊",
//     items: [
//       { name: "Ledger Report", route: "/reports/accounts-ledger", desc: "Income and expense entries by date range" },
//     ],
//   },
//   {
//     group: "HR Reports",
//     color: "#ef4444",
//     icon: "👥",
//     items: [
//       { name: "Staff List Report", route: "/reports/staff-list", desc: "Staff filtered by department, gender, status" },
//       { name: "Staff Attendance Report", route: "/reports/staff-attendance", desc: "Staff attendance by date range" },
//     ],
//   },
//   {
//     group: "Library Reports",
//     color: "#06b6d4",
//     icon: "📚",
//     items: [
//       { name: "Book Issue Report", route: "/reports/library-issue", desc: "Book issues and returns by date and status" },
//     ],
//   },
//   {
//     group: "Transport Reports",
//     color: "#6366f1",
//     icon: "🚌",
//     items: [
//       { name: "Student Transport Report", route: "/reports/transport", desc: "Students assigned to routes and vehicles" },
//     ],
//   },
//   {
//     group: "Inventory Reports",
//     color: "#84cc16",
//     icon: "📦",
//     items: [
//       { name: "Stock Report", route: "/reports/inventory-stock", desc: "Item stock levels with low-stock alerts" },
//     ],
//   },
// ];
// 
// export default function ReportsHubPage() {
//   return (
//     <div>
//       {/* Breadcrumb */}
//       <section style={{ background: "#fff", padding: "12px 20px", borderRadius: 8, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//         <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Reports</h1>
//         <div style={{ fontSize: 13, color: "#6b7280", display: "flex", gap: 6 }}>
//           <Link href="/dashboard" style={{ color: "#6b7280", textDecoration: "none" }}>Dashboard</Link>
//           <span>/</span>
//           <span style={{ color: "var(--primary, #3b82f6)" }}>Reports</span>
//         </div>
//       </section>
// 
//       {/* Module Cards Grid */}
//       <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
//         {reportModules.map((mod) => (
//           <div key={mod.group} style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,.08)", overflow: "hidden" }}>
//             {/* Group Header */}
//             <div style={{ background: mod.color, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
//               <span style={{ fontSize: 22 }}>{mod.icon}</span>
//               <h3 style={{ margin: 0, color: "#fff", fontSize: 15, fontWeight: 600 }}>{mod.group}</h3>
//             </div>
//             {/* Links */}
//             <div style={{ padding: "8px 0" }}>
//               {mod.items.map((item) => (
//                 <Link key={item.route} href={item.route} style={{ display: "block", padding: "10px 16px", textDecoration: "none", borderBottom: "1px solid #f3f4f6" }}>
//                   <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{item.name}</div>
//                   <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{item.desc}</div>
//                 </Link>
//               ))}
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

import ComingSoon from '@/components/shared/ComingSoon';

export default function Page() { return <ComingSoon />; }
