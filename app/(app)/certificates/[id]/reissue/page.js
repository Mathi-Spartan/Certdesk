import { notFound } from 'next/navigation';
import { requireWorkspace } from '@/lib/auth';
import Link from 'next/link';
import { getOrderForWorkspace, subscriptionOf, daysLeft } from '@/lib/orders';
import { fmtDate, FlashFromSearch } from '@/components/ui';
import TopBar from '@/components/TopBar';
import ReissueForm from './ReissueForm';

export const metadata = { title: 'Reissue · CertDesk' };

export default async function ReissuePage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireWorkspace();
  const order = await getOrderForWorkspace(id, ctx.workspaceId);
  if (!order) notFound();
  const sub = subscriptionOf(order);
  const certDays = order.valid_till ? daysLeft(order.valid_till) : null;
  return (
    <>
      {ctx.isAdmin ? <TopBar crumbs={[{ label: 'Certificates', href: '/orders' }, { label: order.common_name, href: `/certificates/${order.id}` }, { label: 'Reissue' }]} /> : null}
      <main className="page" style={{ maxWidth: 860 }}>
        <FlashFromSearch searchParams={sp} />
        <div>
          <h1 className="title">Reissue {order.common_name}</h1>
          <p className="sub">Get a new certificate on the same order, at no cost. Use this when the current certificate is expiring or expired while the subscription is still running, or when the key was lost or exposed.</p>
        </div>
        {sub ? (
          <div className={`cx3-alert ${sub.ended ? 'red' : 'amber'}`} style={{ margin: '14px 0' }}>
            <div>
              <strong>Current certificate:</strong> {order.valid_till ? `${certDays < 0 ? 'expired' : 'expires'} ${fmtDate(order.valid_till)}` : 'not issued'} ·{' '}
              <strong>Subscription:</strong> {sub.months ? `${sub.months} months, ` : ''}{fmtDate(sub.start)} – {fmtDate(sub.end)}
              {sub.ended ? <> · The subscription has ended, so a reissue is not possible. <Link href={`/buy?renew=${order.id}`}>Renew instead</Link>.</> : <> · {sub.days} days of subscription left; the new certificate is issued inside this period.</>}
            </div>
          </div>
        ) : null}
        {sub?.ended ? null : <ReissueForm orderId={order.id} commonName={order.common_name} sans={order.sans || []} wildcard={String(order.common_name || '').startsWith('*.')} multi={(order.sans || []).length > 0 || /multi|ucc|\bsan\b|flex/i.test(order.product_name || '')} />}
      </main>
    </>
  );
}
