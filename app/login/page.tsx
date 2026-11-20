import { redirect } from 'next/navigation';
import { reviewSession } from '../review-access';
import LoginForm from './form';
export const dynamic = 'force-dynamic';
export default async function Login() {
  const s = await reviewSession();
  if (s) redirect(s.must_reset ? '/setup-password' : '/');
  return <LoginForm />;
}
