import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireWorkspace } from '@/lib/auth';
import { q } from '@/lib/db';
import { loadPortfolio } from '@/lib/portfolio';
import { posture } from '@/lib/posture';
import TopBar from '@/components/TopBar';
import { FlashFromSearch, fmtDate } from '@/components/ui';

export const metadata = { title: 'Overview · CertDesk' };

const DAY = 86400000;
const short = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function Kpi({ label, value, tone, foot, icon, href, children }) {
  const body = (
    <>
      <div className="cx3-kpi-top"><span>{label}</span>{icon}</div>
      <b className={tone ? `t-${tone}` : ''}>{value}</b>
      {children || <small>{foot}</small>}
    </>
  );
  return href ? <Link href={href} className="cx3-kpi">{body}</Link> : <div className="cx3-kpi">{body}</div>;
}

const ic = (d, c = 'currentColor') => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;

export default async function Overview({ searchParams }) {
  const sp = await searchParams;
  const ctx = await requireWorkspace();
  const raw = sp.show || sp.view || sp.tab;
  if ((raw && raw !== 'all') || sp.q) {
    const f = { action: 'action', due: 'action', validation: 'action', closed: 'closed', ended: 'closed', progress: 'pending', auto: 'auto' }[raw] || '';
    const qs = new URLSearchParams({ ...(f ? { f } : {}), ...(sp.q ? { q: String(sp.q) } : {}) }).toString();
    redirect('/orders' + (qs ? '?' + qs : ''));
  }
  const p = await loadPortfolio(ctx.workspaceId);
  const [products, events] = await Promise.all([
    q('select id, validation from console.products'),
    q(`select e.kind, e.message, e.created_at, o.common_name, o.id as order_id, u.name as actor
         from console.order_events e join console.orders o on o.id = e.order_id left join console.users u on u.id = e.actor_user_id
        where o.workspace_id = $1 order by e.created_at desc limit 8`, [ctx.workspaceId])
  ]);
  const pos = posture(p.orders, products);
  const live = p.live;
  const certs = live.filter((i) => i.type === 'cert');
  const domains = new Set(live.map((i) => i.domain)).size;
  const autoSubs = live.filter((i) => i.type === 'auto');

  // Lanes: what the customer has to do, split by the two clocks.
  const byCert = (a, b) => (a.cert?.days ?? 9999) - (b.cert?.days ?? 9999);
  const bySub = (a, b) => (a.sub?.days ?? 9999) - (b.sub?.days ?? 9999);
  const reissue = live.filter((i) => i.next?.cta === 'Reissue').sort(byCert);
  const renew = live.filter((i) => i.next?.cta === 'Renew').sort(bySub);
  const validate = live.filter((i) => i.next?.cta === 'Validate').sort((a, b) => new Date(a.ordered) - new Date(b.ordered));
  const active = certs.filter((i) => i.group === 'ok');

  // Both clocks on one list for the next 90 days.
  const upcoming = [
    ...certs.filter((i) => i.cert?.at && i.cert.days >= 0 && i.cert.days <= 90 && i.next?.cta !== 'Validate').map((i) => ({
      key: 'c' + i.id, i, at: i.cert.at, days: i.cert.days,
      what: i.sub && !i.sub.ended && i.sub.coversBeyondCert ? 'Certificate expires' : 'Certificate and subscription end',
      action: i.sub && !i.sub.ended && i.sub.coversBeyondCert ? 'Reissue free' : 'Renew'
    })),
    ...certs.filter((i) => i.sub && i.sub.days >= 0 && i.sub.days <= 90 && i.sub.coversBeyondCert).map((i) => ({ key: 's' + i.id, i, at: i.sub.end, days: i.sub.days, what: 'Subscription ends', action: 'Renew' })),
    ...autoSubs.filter((i) => i.date?.at && i.date.days >= 0 && i.date.days <= 90).map((i) => ({ key: 'a' + i.id, i, at: i.date.at, days: i.date.days, what: i.date.label, action: 'Automatic' }))
  ].sort((a, b) => a.days - b.days).slice(0, 8);

  const to100 = Math.max(0, Math.ceil((new Date('2027-03-15T00:00:00Z') - Date.now()) / DAY));
  const first = String(ctx.user.name || '').split(' ')[0];

  if (live.length === 0 && p.items.length === 0) {
    return (
      <main className="cx3-page">
        <div className="cx3-head"><div><h1>Welcome{first ? `, ${first}` : ''}</h1><p>Your certificates will appear here once you place your first order.</p></div></div>
        <section className="cx3-card cx3-empty">
          <span className="cx3-empty-ico">{ic(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>)}</span>
          <h2>Secure your first website</h2>
          <p>Order a certificate you install yourself, or an automation plan that installs and renews on its own.</p>
          <div className="cx3-row"><Link className="cx3-btn primary" href="/buy">Buy a certificate</Link><Link className="cx3-btn" href="/subscriptions/new">Start automation</Link></div>
        </section>
      </main>
    );
  }

  const Dates = ({ i }) => (
    <div className="cx3-lane-dates">
      {i.cert?.at ? <span className={i.cert.days <= 14 ? 'hot' : i.cert.days <= 30 ? 'warm' : ''}>Cert {i.cert.days < 0 ? `expired ${short(i.cert.at)}` : `${short(i.cert.at)} · ${i.cert.days}d`}</span> : <span>Not issued yet</span>}
      {i.sub ? <span className={i.sub.ended || i.sub.days <= 30 ? 'hot' : i.sub.days <= 60 ? 'warm' : ''}>Subscription {i.sub.ended ? `ended ${fmtDate(i.sub.end)}` : `until ${fmtDate(i.sub.end)}`}</span> : null}
    </div>
  );

  const Lane = ({ title, hint, items, tone, href, empty, cta }) => (
    <section className={`cx3-card cx3-lane ${tone}`}>
      <div className="cx3-lane-head">
        <div><h2>{title} <em>{items.length}</em></h2><p>{hint}</p></div>
        {items.length > 5 ? <Link href={href} className="cx3-link-sm">View all</Link> : null}
      </div>
      {items.length === 0 ? (
        <div className="cx3-lane-empty">{ic(<path d="m5 12 5 5 9-10" />, '#15803D')}<span>{empty}</span></div>
      ) : (
        <ul className="cx3-lane-list">
          {items.slice(0, 5).map((i) => (
            <li key={i.type + i.id}>
              <div className="cx3-lane-main">
                <Link href={i.href} className="mono cx3-lane-cn">{i.domain}</Link>
                <div className="cx3-lane-prod">{i.product}{i.ref ? ` · #${i.ref}` : ''}{i.detail?.label === 'Reissue in validation' ? ' · reissue' : ''}</div>
                <Dates i={i} />
              </div>
              <Link className={`cx3-btn sm ${tone === 'red' || tone === 'amber' ? 'dark' : 'primary'}`} href={i.next.href}>{cta}</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const todo = reissue.length + renew.length + validate.length;

  return (
    <>
      {ctx.isAdmin ? <TopBar crumbs={[{ label: ctx.workspace.name }, { label: 'Overview' }]} /> : null}
      <main className="cx3-page">
        <div className="cx3-head">
          <div>
            <h1>{first ? `Hello, ${first}` : 'Overview'}</h1>
            <p>{todo ? `${todo} thing${todo === 1 ? '' : 's'} to do` : 'Everything is up to date'} · {certs.length} certificate{certs.length === 1 ? '' : 's'} across {domains} domain{domains === 1 ? '' : 's'}</p>
          </div>
          <div className="cx3-row">
            <a className="cx3-btn" href="/api/orders/export">{ic(<path d="M12 3v12M7 10l5 5 5-5M5 21h14" />)}Export CSV</a>
            <Link className="cx3-btn primary" href="/buy">Order new certificate</Link>
          </div>
        </div>
        <FlashFromSearch searchParams={sp} />

        <div className="cx3-kpis">
          <Kpi label="Active" value={active.length} href="/orders" icon={ic(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>)} foot="Nothing to do" />
          <Kpi label="Reissue due" value={reissue.length} tone={reissue.length ? 'amber' : null} href="/renewals" icon={ic(<><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></>, '#B45309')} foot="Free, inside the subscription" />
          <Kpi label="Renewal due" value={renew.length} tone={renew.length ? 'red' : null} href="/renewals" icon={ic(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, '#B91C1C')} foot="Subscription ending" />
          <Kpi label="Awaiting validation" value={validate.length} tone={validate.length ? 'amber' : null} href="/validation" icon={ic(<><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></>, 'var(--cx-accent)')} foot="Prove domain control" />
        </div>

        <div className="cx3-lanes">
          <Lane title="Renew" tone="red" items={renew} href="/renewals" cta="Renew" hint="The whole subscription is ending. Renew to stay covered." empty="No subscriptions ending soon." />
          <Lane title="Reissue" tone="amber" items={reissue} href="/renewals" cta="Reissue" hint="Certificate expiring, subscription still running. No cost." empty="No certificates need a reissue." />
          <Lane title="Validate" tone="violet" items={validate} href="/validation" cta="Validate" hint="Add the DNS record or file so the CA can issue." empty="Nothing waiting for validation." />
        </div>

        <section className="cx3-card">
          <div className="cx3-card-head cx3-pad-h"><div><h2>Next 90 days</h2><p className="cx3-muted">Certificate expiries and subscription ends, in date order</p></div><Link href="/orders" className="cx3-link-sm">All certificates</Link></div>
          {upcoming.length === 0 ? <div className="cx3-clear"><span><strong>Nothing in the next 90 days.</strong></span></div> : (
            <div className="cx3-table-wrap flush">
              <table className="cx3-table">
                <thead><tr><th>Date</th><th>Common name</th><th>What happens</th><th>Subscription</th><th>Action</th></tr></thead>
                <tbody>
                  {upcoming.map((u) => (
                    <tr key={u.key}>
                      <td><div style={{ fontWeight: 600 }} className={u.days <= 14 && u.action !== 'Reissue free' ? 't-red' : ''}>{fmtDate(u.at)}</div><div className="cx3-sub">in {u.days} day{u.days === 1 ? '' : 's'}</div></td>
                      <td><Link href={u.i.href} className="cx3-cn">{u.i.domain}</Link><div className="cx3-sub">{u.i.product}</div></td>
                      <td>{u.what}</td>
                      <td className="cx3-sub">{u.i.sub ? `${u.i.sub.months ? `${u.i.sub.months} mo · ` : ''}until ${fmtDate(u.i.sub.end)}` : '—'}</td>
                      <td><span className={`cx3-pill ${u.action === 'Renew' ? 'action' : u.action === 'Automatic' ? 'ok' : 'progress'}`}>{u.action}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="cx3-pki">
          <section className="cx3-card cx3-pad">
            <div className="cx3-card-head"><div><h2>Security checks</h2><p>{pos.passed} of {pos.checks.length} passing</p></div><span className={`cx3-score ${pos.passed === pos.checks.length ? 'ok' : pos.checks.some((c) => c.bad && !c.soft) ? 'bad' : 'warn'}`}>{pos.passed}/{pos.checks.length}</span></div>
            <ul className="cx3-checks">
              {pos.checks.map((c) => (
                <li key={c.id} className={c.bad ? (c.soft ? 'warn' : 'bad') : 'ok'}>
                  <span className="cx3-check-ico" aria-hidden="true">{c.bad ? (c.soft ? '!' : '×') : '✓'}</span>
                  <span className="cx3-check-label">{c.label}</span>
                  {c.bad ? <Link href={c.href} className="cx3-check-fix">{c.bad} · {c.fix}</Link> : <span className="cx3-check-ok">Pass</span>}
                </li>
              ))}
            </ul>
          </section>

          <section className="cx3-card cx3-pad">
            <div className="cx3-card-head"><div><h2>Inventory</h2><p>{pos.total} certificate{pos.total === 1 ? '' : 's'} in use · {pos.issuedCount} issued</p></div></div>
            {[['Validation', pos.level], ['Type', pos.shape], ['Key', pos.keys], ['Issuer', pos.issuers]].map(([t, m]) => {
              const list = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 4);
              const tot = list.reduce((n, [, v]) => n + v, 0) || 1;
              return (
                <div key={t} className="cx3-inv">
                  <span className="cx3-inv-k">{t}</span>
                  <div className="cx3-inv-bar" aria-hidden="true">{list.map(([k, v], n) => <i key={k} className={`g${n}`} style={{ width: `${(v / tot) * 100}%` }} />)}</div>
                  <div className="cx3-inv-keys">{list.length ? list.map(([k, v], n) => <span key={k}><i className={`g${n}`} />{k} <b>{v}</b></span>) : <span className="cx3-muted">—</span>}</div>
                </div>
              );
            })}
          </section>

          <section className="cx3-card cx3-pad">
            <div className="cx3-card-head"><div><h2>Recent activity</h2><p>Audit trail for this account</p></div></div>
            {events.length === 0 ? <p className="cx3-muted">No activity yet.</p> : (
              <ol className="cx3-audit">
                {events.map((e, n) => (
                  <li key={n}>
                    <span className={`cx3-audit-dot ${e.kind}`} />
                    <div>
                      <div><Link href={`/certificates/${e.order_id}`} className="mono">{e.common_name || 'Order'}</Link> · {e.message}</div>
                      <time dateTime={new Date(e.created_at).toISOString()} title={new Date(e.created_at).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'}>
                        {new Date(e.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST{e.actor ? ` · ${e.actor}` : ' · system'}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="cx3-note">
          <strong>Heads up:</strong> from 15 Mar 2027 certificates last at most 100 days ({to100} days from now), so reissues come more often. Your subscription still covers them at no cost.
        </div>
      </main>
    </>
  );
}
