// HIDDEN - no backend yet
// import { HrLeaveTypesPanel } from "@/components/hr/HrPanels";
//
// export default function HrLeaveTypesPage() {
//   return <HrLeaveTypesPanel />;
// }

import { redirect } from 'next/navigation';
export default function Page() { redirect('/hr/leave'); }
