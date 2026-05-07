import { redirect } from 'next/navigation';

// Legacy route — redirects to consolidated page
export default function LegacyRedirect() {
  redirect('/administration/postal');
}
