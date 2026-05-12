// HIDDEN - no backend yet
// "use client";
//
// import ReportExplorer from "@/components/reports/ReportExplorer";
// import ReportNotFound from "@/components/reports/ReportNotFound";
// import { getReportDefinition } from "@/lib/reports-config";
//
// export default function StudentReportPage() {
//   const definition = getReportDefinition("student");
//   if (!definition) {
//     return <ReportNotFound title="Student Report" />;
//   }
//   return <ReportExplorer definition={definition} />;
// }

import ComingSoon from '@/components/shared/ComingSoon';

export default function Page() {
  return <ComingSoon />;
}
