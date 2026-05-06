import { redirect } from 'next/navigation';

export default function AdministrationRoot() {
  redirect('/administration/visitor-book');
}
