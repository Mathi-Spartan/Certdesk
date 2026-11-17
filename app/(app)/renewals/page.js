import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { q } from '@/lib/db';
import { daysLeft, primaryMethod } from '@/lib/orders';
import { toggleAutoRenew } from '@/app/actions/orders';
import TopBar from '@/components/TopBar';
import Icon from '@/components/Icon';
import { fmtDate, Empty } from '@/components/ui';

export const metadata = { title: 'Renewals · CertDesk' };

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const iso = (d) => d.toISOString().slice(0, 10);

export default async function Renewals({ searchParams }) {
  const sp = await searchParams;
  const ctx = await requireWorkspace();
  const orders = await q(
    `select * from console.orders where workspace_id = $1 and status = 'issued' and valid_till is not null order by valid_till`,
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
    const exp = new Date(o.valid_till);
    push(iso(exp), { kind: 'exp', o });
    if (o.auto_renew) push(iso(new Date(exp.getTime() - o.renew_lead_days * 86400000)), { kind: 'ren', o });
  }
  const live = await q(`select auto_renew, dcv_method from console.orders where workspace_id = $1 and status not in ('cancelled','draft')`, [ctx.workspaceId]);
  const autoOn = live.filter((o) => o.auto_renew).length;
  const emailCount = live.filter((o) => primaryMethod(o) === 'Email').length;
  const upcoming = orders.filter((o) => daysLeft(o.valid_till) <= 90);
  const today = iso(now);
  const autoRunner = process.env.AUTO_RENEW_ENABLED === 'true';

  return (
    <>
      <TopBar crumbs={[{ label: ctx.workspace.name }, { label: 'Renewals & automation' }]} />
      <main className="page">
        <div>
          <h1 className="title">Renewals &amp; automation</h1>
          <p className="sub">See what expires when, and which certificates renew without anyone touching them.</p>
        </div>
        {!autoRunner ? (
          <div className="alert amber"><Icon name="info" /><span>Automatic renewal orders are switched off while CertDesk is in testing. Auto-renew settings are saved, and you'll get reminders, but renewals are placed with “Renew now”.</span></div>
        ) : null}

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
            <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--muted)' }}>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span className="dot" style={{ borderRadius: 3, background: 'var(--red-dot)' }} />Expires</span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span className="dot" style={{ borderRadius: 3, background: 'var(--accent)' }} />Renewal starts</span>
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
                      <Link key={i} href={`/certificates/${it.o.id}`} className={`chip ${it.kind}`} title={`${it.kind === 'exp' ? 'Expires' : 'Renewal starts'}: ${it.o.common_name}`}>
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
            <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2>Automation coverage</h2>
              <div style={{ fontSize: 32, fontWeight: 600 }}>{autoOn} <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--muted)' }}>of {live.length} on auto-renew</span></div>
              <div className="bar"><span style={{ width: `${live.length ? (autoOn / live.length) * 100 : 0}%` }} /></div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <li className="between"><span>Auto-renew off</span><Link href="/certificates" style={{ fontWeight: 600 }}>{live.length - autoOn}</Link></li>
                <li className="between"><span>Needs manual approval (email)</span><Link href="/certificates" style={{ fontWeight: 600 }}>{emailCount}</Link></li>
              </ul>
            </div>
            <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2>Alerts</h2>
              <div className="small muted">Reminders go to your workspace contact at 30, 14, 7, 3 and 1 days before expiry.</div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['Email', ctx.workspace.contact?.email || ctx.workspace.contact_email || ctx.user.email, 'Coming next'],
                  ['Slack', 'Incoming webhook', 'Coming next'],
                  ['Webhook', 'For your own tooling', 'Coming next']
                ].map(([n, d, s]) => (
                  <li key={n} className="between"><span><strong>{n}</strong><br /><span className="small muted">{d}</span></span><span className="badge tone-gray">{s}</span></li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <section className="card">
          <div className="card-head"><h2>Expiring in the next 90 days</h2><span className="small muted">{upcoming.length}</span></div>
          {upcoming.length === 0 ? <Empty title="Nothing expires in the next 90 days" /> : (
            <div className="table-wrap">
              <table className="t" style={{ minWidth: 760 }}>
                <thead><tr><th>Certificate</th><th>Expires</th><th>Renewal starts</th><th>Validation</th><th>Auto-renew</th><th /></tr></thead>
                <tbody>
                  {upcoming.map((o) => {
                    const d = daysLeft(o.valid_till);
                    return (
                      <tr key={o.id}>
                        <td><Link className="cn" href={`/certificates/${o.id}`}>{o.common_name}</Link><div className="small muted">{o.product_name}</div></td>
                        <td><strong style={{ color: d <= 30 ? 'var(--red-strong)' : undefined }}>{d} days</strong><div className="small muted">{fmtDate(o.valid_till)}</div></td>
                        <td>{o.renew_lead_days} days before</td>
                        <td>{primaryMethod(o)}</td>
                        <td>
                          <form action={toggleAutoRenew}>
                            <input type="hidden" name="order_id" value={o.id} />
                            <button type="submit" className="switch" role="switch" aria-checked={o.auto_renew ? 'true' : 'false'} aria-label={`Auto-renew for ${o.common_name}`} />
                          </form>
                        </td>
                        <td style={{ textAlign: 'right' }}><Link className="btn sm" href={`/buy?renew=${o.id}`}>Renew now</Link></td>
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
