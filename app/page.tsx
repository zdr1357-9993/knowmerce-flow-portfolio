import { redirect } from 'next/navigation';
import { reviewSession } from './review-access';
import Workspace from './workspace';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const s = await reviewSession();
  if (!s) return <Workspace publicDemo />;
  if (s.must_reset) redirect('/setup-password');
  return <Workspace />;
}
