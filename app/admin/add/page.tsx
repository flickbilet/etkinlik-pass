import { redirect } from 'next/navigation';

export default function LegacyAddRedirect() {
  redirect('/admin');
}
