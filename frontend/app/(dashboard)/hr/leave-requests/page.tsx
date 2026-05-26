// HIDDEN - no backend yet
// import { HrLeaveRequestsPanel } from "@/components/hr/HrPanels";
//
// export default function HrLeaveRequestsPage() {
//   return <HrLeaveRequestsPanel />;
// }

import { redirect } from 'next/navigation';
export default function Page() { redirect('/hr/leave'); }
