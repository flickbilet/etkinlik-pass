import { redirect } from 'next/navigation';

export default function LegacyScannerRedirect() {
  redirect('/admin');
}
