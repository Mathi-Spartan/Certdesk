import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { q } from '@/lib/db';
import { daysLeft, primaryMethod, lifecycle } from '@/lib/orders';
import TopBar from '@/components/TopBar';
import { fmtDate, Empty } from '@/components/ui';

export const metadata = { title: 'Reissues & renewals · CertDesk' };

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const iso = (d) => new Date(d).toISOString().slice(0, 10);

export default async function Renewals({ searchParams }) {
  const sp = await searchParams;
  const ctx = await requireWorkspace();
  const orders = await q(
    `select * from console.orders where workspace_id = $1 and status in ('issued','validating','reissuing','incomplete') order by valid_till nulls last`,
    [ctx.workspaceId]
  );
  const now = new Date();
  const m = /^\d{4}-\d{2}$/.test(sp.m || '') ? sp.m : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const [yy, mm] = m.split('-').map(Number);
  const first = new Date(Date.UTC(yy, mm - 1, 1));
  const start = new Date(first.getTime() - ((first.getUTCDay() + 6) % 7) * 86400000);
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * 86400000));
  const prev = new Date(Date.UTC(yy, mm - 2, 1));
  const next = new Date(Date.UTC(yy, mm, 1));
  const mKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

  const byDay = {};
  const push = (k, item) => ((byDay[k] ||= []).push(item));
  for (const o of orders) {
    const l = lifecycle(o);
    if (o.status === 'issued' && o.valid_till) push(iso(o.valid_till), { kind: l.canReissue ? 'reissue' : 'renew', label: l.canReissue ? 'Reissue' : 'Renew', o });
    if (o.order_expires_at && (!o.valid_till || iso(o.order_expires_at) !== iso(o.valid_till) || l.canReissue)) push(iso(o.order_expires_at), { kind: 'renew', label: 'Order ends', o });
  }

  const reissues = orders
    .filter((o) => o.status === 'issued' && lifecycle(o).canReissue && daysLeft(o.valid_till) <= 60)
    .sort((a, b) => new Date(a.valid_till) - new Date(b.valid_till));
  const renewals = orders
    .filter((o) => {
      const l = lifecycle(o);
      return (o.order_expires_at && daysLeft(o.order_expires_at) <= 90) || (o.status === 'issued' && !l.canReissue && daysLeft(o.valid_till) <= 60);
    })
    .sort((a, b) => new Date(a.order_expires_at || a.valid_till) - new Date(b.order_expires_at || b.valid_till));
  const today = iso(now);

  return (
    <>
      <TopBar crumbs={[{ label: ctx.workspace.name }, { label: 'Reissues & renewals' }]} />
      <main className="page">
        <div>
          <h1 className="title">Reissues &amp; renewals</h1>
          <p className="sub">
            <strong>Reissue</strong> when a certificate is about to expire. It's free while the order is active.{' '}
            <strong>Renew</strong> when the order itself ends, which means buying a new one.
          </p>
        </div>

        <div className="row top">
          <section className="card pad" style={{ flex: '2 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="between">
              <h2>{first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2>
              <div style={{ display: 'flex', gap: 6 }}>
                <Link className="btn sm" href={`/renewals?m=${mKey(prev)}`} aria-label="Previous month">‹</Link>
                <Link className="btn sm" href="/renewals">Today</Link>
                <Link className="btn sm" href={`/renewals?m=${mKey(next)}`} aria-label="Next month">›</Link>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span className="dot" style={{ borderRadius: 3, background: 'var(--accent)' }} />Certificate expires: reissue</span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span className="dot" style={{ borderRadius: 3, background: '#F59E0B' }} />Order ends: renew</span>
            </div>
            <div className="cal">
              {DOW.map((d) => <div key={d} className="h">{d}</div>)}
              {days.map((d) => {
                const k = iso(d);
                const items = byDay[k] || [];
                return (
                  <div key={k} className={`d ${d.getUTCMonth() !== mm - 1 ? 'out' : ''} ${k === today ? 'today' : ''}`}>
                    <span>{d.getUTCDate()}</span>
                    {items.slice(0, 3).map((it, i) => (
                      <Link key={i} href={`/certificates/${it.o.id}`} className={`chip ${it.kind === 'reissue' ? 'ren' : 'exp'}`}
                        style={it.kind === 'renew' ? { background: '#FEF3C7', color: '#92400E' } : undefined} title={`${it.label}: ${it.o.common_name}`}>
                        {it.o.common_name}
                      </Link>
                    ))}
                    {items.length > 3 ? <span className="small muted">+{items.length - 3} more</span> : null}
                  </div>
                );
              })}
            </div>
          </section>

          <section style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h2>How this works</h2>
              <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--ink-2)' }}>
                <li>Each certificate lasts at most 200 days (100 days from 15 Mar 2027).</li>
                <li>Before it expires, <strong>reissue</strong> it with a new key. That costs nothing while the order is active.</li>
                <li>When the order term ends, <strong>renew</strong> it by buying a new order.</li>
                <li>Install each new certificate on your servers yourself. CertDesk tracks the dates for you.</li>
              </ol>
            </div>
            <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h2>Reminders</h2>
              <div className="small muted">Each certificate is marked as due a set number of days before it expires. Change that on the certificate page.</div>
              <div className="between"><span><strong>Email reminders</strong><br /><span className="small muted">{ctx.workspace.contact?.email || ctx.workspace.contact_email || ctx.user.email}</span></span><span className="badge tone-gray">Coming next</span></div>
            </div>
          </section>
        </div>

        <section className="card">
          <div className="card-head"><h2>Certificates to reissue</h2><span className="small muted">Expiring in the next 60 days, order still active</span></div>
          {reissues.length === 0 ? <Empty title="Nothing to reissue in the next 60 days" /> : (
            <div className="table-wrap">
              <table className="t" style={{ minWidth: 760 }}>
                <thead><tr><th>Certificate</th><th>Certificate expires</th><th>Order active until</th><th>Validation</th><th /></tr></thead>
                <tbody>
                  {reissues.map((o) => {
                    const d = daysLeft(o.valid_till);
                    return (
                      <tr key={o.id}>
                        <td><Link className="cn" href={`/certificates/${o.id}`}>{o.common_name}</Link><div className="small muted">{o.product_name}</div></td>
                        <td><strong style={{ color: d <= (o.reminder_days || 30) ? 'var(--red-strong)' : undefined }}>{d < 0 ? `${-d} days ago` : `${d} days`}</strong><div className="small muted">{fmtDate(o.valid_till)}</div></td>
                        <td>{fmtDate(o.order_expires_at)}</td>
                        <td>{primaryMethod(o)}</td>
                        <td style={{ textAlign: 'right' }}><Link className="btn sm primary" href={`/certificates/${o.id}/reissue`}>Reissue</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h2>Orders to renew</h2><span className="small muted">Order ending in the next 90 days</span></div>
          {renewals.length === 0 ? <Empty title="No orders end in the next 90 days" /> : (
            <div className="table-wrap">
              <table className="t" style={{ minWidth: 760 }}>
                <thead><tr><th>Certificate</th><th>Order ends</th><th>Term</th><th>Product</th><th /></tr></thead>
                <tbody>
                  {renewals.map((o) => {
                    const end = o.order_expires_at || o.valid_till;
                    const d = daysLeft(end);
                    return (
                      <tr key={o.id}>
                        <td><Link className="cn" href={`/certificates/${o.id}`}>{o.common_name}</Link></td>
                        <td><strong style={{ color: d <= 30 ? 'var(--red-strong)' : undefined }}>{d < 0 ? 'Ended' : `${d} days`}</strong><div className="small muted">{fmtDate(end)}</div></td>
                        <td>{o.period_months ? `${o.period_months} months` : '—'}</td>
                        <td>{o.product_name}</td>
                        <td style={{ textAlign: 'right' }}><Link className="btn sm" href={`/buy?renew=${o.id}`}>Renew order</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
