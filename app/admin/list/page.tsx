import { redirect } from 'next/navigation';

export default function LegacyListRedirect() {
  redirect('/admin');
}
