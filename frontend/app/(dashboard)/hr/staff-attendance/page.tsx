// HIDDEN - no backend yet
// import { HrStaffAttendancePanel } from "@/components/hr/HrPanels";
//
// export default function HrStaffAttendancePage() {
//   return <HrStaffAttendancePanel />;
// }

import { redirect } from 'next/navigation';
export default function Page() { redirect('/hr/attendance'); }
