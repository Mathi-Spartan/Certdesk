import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { q } from '@/lib/db';
import { syncStale, primaryMethod } from '@/lib/orders';
import { lockRemaining, revalidatePath, resendPath } from '@/lib/gogetssl';
import TopBar from '@/components/TopBar';
import Icon from '@/components/Icon';
import DcvPanel from '@/components/DcvPanel';
import { StatusBadge, Empty, FlashFromSearch, timeAgo } from '@/components/ui';

export const metadata = { title: 'Validation · CertDesk' };

function basicEmails(domain) {
  const base = String(domain || '').replace(/^\*\./, '');
  return ['admin', 'administrator', 'hostmaster', 'postmaster', 'webmaster'].map((p) => `${p}@${base}`);
}

export default async function Validation({ searchParams }) {
  const sp = await searchParams;
  const ctx = await requireWorkspace();
  await syncStale(ctx.workspaceId, 3);
  const pending = await q(
    `select * from console.orders where workspace_id = $1 and status in ('validating','incomplete','reissuing','payment_needed')
      order by created_at asc`,
    [ctx.workspaceId]
  );
  const locks = {};
  for (const o of pending) {
    if (o.gg_order_id) locks[o.id] = { revalidate: await lockRemaining(revalidatePath(o.gg_order_id)), resend: await lockRemaining(resendPath(o.gg_order_id)) };
  }
  const methods = await q(
    `select count(*) filter (where lower(coalesce(dcv_method,'')) like '%dns%')::int as dns, count(*)::int as total
       from console.orders where workspace_id = $1 and status = 'issued'`,
    [ctx.workspaceId]
  );
  return (
    <>
      <TopBar crumbs={[{ label: ctx.workspace.name }, { label: 'Validation' }]} />
      <main className="page">
        <div>
          <h1 className="title">Validation center</h1>
          <p className="sub">Everything the certificate authority is waiting on, in one place. Pending orders refresh each time you open this page.</p>
        </div>
        <FlashFromSearch searchParams={sp} />
        {pending.length === 0 ? (
          <div className="card"><Empty title="Nothing waiting for validation">New orders and reissues show up here until they're issued.</Empty></div>
        ) : (
          pending.map((o) => (
            <section key={o.id} className="card">
              <div className="card-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <StatusBadge order={o} />
                  <Link href={`/certificates/${o.id}`} className="mono" style={{ fontWeight: 500, color: 'var(--ink)', textDecoration: 'none', fontSize: 15 }}>{o.common_name}</Link>
                  <span className="small muted">{o.product_name} · {primaryMethod(o)} · ordered {timeAgo(o.created_at)}</span>
                </div>
                <span className="small muted">{o.gg_status_description || ''}</span>
              </div>
              <div style={{ padding: '18px 20px' }}>
                <DcvPanel order={o} back="/validation" approverEmails={basicEmails(o.common_name)} locks={locks[o.id] || {}} />
              </div>
            </section>
          ))
        )}
        <section className="alert violet">
          <Icon name="renew" stroke="var(--accent)" size={20} />
          <div style={{ flex: '1 1 420px' }}>
            <strong>How long a validation can be reused is getting shorter every year, down to 10 days by 2029.</strong> Leaving your DNS record in place makes every reissue faster.
            {methods[0]?.total ? ` ${methods[0].dns} of ${methods[0].total} active certificates use DNS today.` : ''}
          </div>
          <Link href="/renewals" style={{ fontWeight: 600 }}>Reissue schedule →</Link>
        </section>
      </main>
    </>
  );
}
