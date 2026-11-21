import Link from 'next/link';
import { balanceStatus } from '@/lib/billing';

/** Master account banner when the GoGetSSL balance is under the alert threshold. */
export default async function LowBalance() {
  let s;
  try { s = await balanceStatus(); } catch { return null; }
  if (!s?.low) return null;
  const fmt = (n) => { try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: s.currency || 'USD' }).format(n); } catch { return n; } };
  return (
    <div className="bl-alert" role="alert">
      <span><strong>Low balance:</strong> {fmt(s.amount)} left, below your alert of {fmt(s.threshold)}. New orders and renewals will fail when it runs out.</span>
      <Link href="/partner/billing">Open billing →</Link>
    </div>
  );
}
