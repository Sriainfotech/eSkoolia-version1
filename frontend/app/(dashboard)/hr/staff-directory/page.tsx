// HIDDEN - no backend yet
// import { HrStaffDirectoryPanel } from "@/components/hr/HrPanels";
//
// export default function HrStaffDirectoryPage() {
//   return <HrStaffDirectoryPanel />;
// }

import { redirect } from 'next/navigation';
export default function Page() { redirect('/hr/directory'); }
