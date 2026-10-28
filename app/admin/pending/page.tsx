import { redirect } from 'next/navigation';

export default function LegacyPendingRedirect() {
  redirect('/admin');
}
