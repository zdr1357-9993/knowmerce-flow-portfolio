import { redirect } from 'next/navigation';
import { reviewSession } from '../review-access';
import PasswordSetup from './form';
export const dynamic = 'force-dynamic';
export default async function Setup() {
  const s = await reviewSession();
  if (!s) redirect('/login');
  if (!s.must_reset) redirect('/');
  return <PasswordSetup />;
}
