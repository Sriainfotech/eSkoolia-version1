// HIDDEN - no backend yet
// import { HrPayrollPanel } from "@/components/hr/HrPanels";
//
// export default function HrPayrollPage() {
//   return <HrPayrollPanel />;
// }

import { redirect } from 'next/navigation';
export default function Page() { redirect('/hr/setup'); }
