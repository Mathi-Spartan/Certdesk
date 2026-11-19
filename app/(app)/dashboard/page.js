import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { loadPortfolio } from '@/lib/portfolio';
import { supportEmail, helpHref } from '@/lib/support';
import TopBar from '@/components/TopBar';
import Icon from '@/components/Icon';
import { FlashFromSearch, fmtDate } from '@/components/ui';
import { redirect } from 'next/navigation';

export const metadata = { title: 'My SSL · CertDesk' };

function when(i) {
  if (!i.date?.at) return { main: i.group === 'progress' ? 'Waiting' : '—', sub: null, tone: '' };
  const d = i.date.days;
  return {
    main: `${i.date.label} ${fmtDate(i.date.at)}`,
    sub: d < 0 ? `${-d} days ago` : d === 0 ? 'today' : `in ${d} days`,
    tone: d !== null && d <= 30 && i.date.label !== 'Renews' ? 'bad' : d !== null && d <= 60 ? 'mid' : ''
  };
}

/** Donut showing the share of live items that are fully protected. */
function Ring({ pct }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden="true" className="db-ring">
      <circle cx="34" cy="34" r={r} fill="none" stroke="#E7EEF5" strokeWidth="8" />
      <circle cx="34" cy="34" r={r} fill="none" stroke="url(#dbg)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 34 34)" />
      <defs><linearGradient id="dbg" x1="0" x2="1"><stop offset="0" stopColor="#0174C3" /><stop offset="1" stopColor="#2AA8E8" /></linearGradient></defs>
      <text x="34" y="38" textAnchor="middle" fontSize="13" fontWeight="800" fill="#0F172A">{pct}%</text>
    </svg>
  );
}

export default async function Dashboard({ searchParams }) {
  const sp = await searchParams;
  const ctx = await requireWorkspace();
  const raw = sp.show || sp.view || sp.tab;
  if ((raw && raw !== 'all') || sp.q) {
    const f = { action: 'action', due: 'action', validation: 'action', closed: 'closed', ended: 'closed', progress: 'pending', auto: 'auto' }[raw] || '';
    const qs = new URLSearchParams({ ...(f ? { f } : {}), ...(sp.q ? { q: String(sp.q) } : {}), ...(sp.err ? { err: String(sp.err) } : {}), ...(sp.ok ? { ok: String(sp.ok) } : {}) }).toString();
    redirect('/orders' + (qs ? '?' + qs : ''));
  }
  const p = await loadPortfolio(ctx.workspaceId);

  const live = p.live;
  const closed = p.items.filter((i) => i.group === 'ended');
  const count = { all: live.length, ok: live.filter((i) => i.group === 'ok').length, action: p.action.length, progress: p.progress.length, closed: closed.length };
  const coverage = live.length ? Math.round((count.ok / live.length) * 100) : 0;
  const certsLive = live.filter((i) => i.type === 'cert' && i.date?.at);
  const inRange = (lo, hi) => certsLive.filter((i) => i.date.days >= lo && i.date.days <= hi).length;
  const buckets = [
    { label: 'Expired', n: certsLive.filter((i) => i.date.days < 0).length, tone: 'red' },
    { label: '0–30 days', n: inRange(0, 30), tone: 'red' },
    { label: '31–60 days', n: inRange(31, 60), tone: 'amber' },
    { label: '61–90 days', n: inRange(61, 90), tone: 'amber' },
    { label: '90+ days', n: certsLive.filter((i) => i.date.days > 90).length, tone: 'green' }
  ];
  const soon = buckets[0].n + buckets[1].n;
  const maxB = Math.max(...buckets.map((b) => b.n));
  const statusRows = [
    { key: 'ok', label: 'Protected', n: count.ok, href: '/orders' },
    { key: 'action', label: 'Needs action', n: count.action, href: '/orders?f=action' },
    { key: 'progress', label: 'In progress', n: count.progress, href: '/orders?f=pending' },
    { key: 'ended', label: 'Closed', n: count.closed, href: '/orders?f=closed' }
  ];
  const totalAll = p.items.length;
  const recent = [...p.items].sort((a, b) => new Date(b.created) - new Date(a.created)).slice(0, 6);
  const first = String(ctx.user.name || '').split(' ')[0];
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const help = helpHref(await supportEmail(), { subject: `Help with CertDesk · ${ctx.workspace?.name || ''}` });

  return (
    <>
      {ctx.isAdmin ? (
        <TopBar crumbs={[{ label: ctx.workspace.name }, { label: 'My SSL' }]}>
          <Link className="btn primary" href="/order"><Icon name="plus" stroke="#fff" width={2.4} />Order SSL</Link>
        </TopBar>
      ) : null}
      <main className="page db">
        <header className="cc-page-head">
          <div>
            <p className="cc-eyebrow">{today}</p>
            <h1>{ctx.isAdmin ? ctx.workspace.name : `Welcome back${first ? `, ${first}` : ''}`}</h1>
            <p>
              {live.length === 0
                ? 'Nothing here yet. Request a certificate to get started.'
                : p.action.length
                  ? `${p.action.length} order${p.action.length === 1 ? ' needs' : 's need'} your attention.`
                  : 'Everything is protected. Nothing needs you right now.'}
            </p>
          </div>
          <Link className="btn primary" href="/order">Request certificate</Link>
        </header>

        <FlashFromSearch searchParams={sp} />

        {live.length === 0 && closed.length === 0 ? (
          <section className="db-empty">
            <div className="db-empty-text">
              <span className="db-empty-icon"><Icon name="lock" size={28} stroke="#fff" /></span>
              <h2>Secure your first website</h2>
              <p>Order a certificate you install yourself, or an automated subscription that installs and renews on its own. </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link className="btn primary" href="/order"><Icon name="plus" stroke="#fff" width={2.4} />Order SSL</Link>
              </div>
            </div>
            <ol className="db-empty-steps">
              <li><b>1</b><span><strong>Choose</strong>a certificate or automated SSL</span></li>
              <li><b>2</b><span><strong>Validate</strong>with one DNS record or file</span></li>
              <li><b>3</b><span><strong>Install</strong>and we track every date for you</span></li>
            </ol>
          </section>
        ) : (
          <>
            <section className="cc-kpis">
              <Link href="/orders" className="cc-kpi"><span>Active orders</span><b>{live.length}</b><small>{p.certs} certificate{p.certs === 1 ? '' : 's'} · {p.autos} automated</small></Link>
              <Link href="/orders?f=action" className={`cc-kpi ${count.action ? 'red' : ''}`}><span>Needs action</span><b>{count.action}</b><small>{count.action ? 'Validate, renew or finish setup' : 'All clear'}</small></Link>
              <Link href="/orders?f=expiring" className={`cc-kpi ${soon ? 'amber' : ''}`}><span>Expiring in 30 days</span><b>{soon}</b><small>Manual certificates</small></Link>
              <div className="cc-kpi cc-kpi-ring"><Ring pct={coverage} /><div><span>Protected</span><b>{count.ok}<i>/{live.length}</i></b><small>{coverage === 100 ? 'Fully covered' : 'Of active orders'}</small></div></div>
            </section>

            <div className="cc-widgets">
              <section className="cc-card cc-widget">
                <header><h2>Certificate expiration</h2><Link href="/orders?f=expiring">View</Link></header>
                <div className="cc-buckets">
                  {buckets.map((b) => (
                    <div key={b.label} className={`cc-bucket ${b.tone}`}>
                      <b>{b.n}</b><span>{b.label}</span>
                      <i style={{ height: `${maxB ? Math.max(6, (b.n / maxB) * 100) : 6}%` }} />
                    </div>
                  ))}
                </div>
                <p className="small muted">Manual certificates by days until expiry. Automated SSL renews on its own.</p>
              </section>

              <section className="cc-card cc-widget">
                <header><h2>Orders by status</h2><Link href="/orders">All orders</Link></header>
                <ul className="cc-bars">
                  {statusRows.map((r) => (
                    <li key={r.key}>
                      <Link href={r.href}><span className={`cc-sw ${r.key}`} />{r.label}<b>{r.n}</b></Link>
                      <div className="cc-bar"><span className={r.key} style={{ width: `${totalAll ? (r.n / totalAll) * 100 : 0}%` }} /></div>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="cc-card cc-widget">
                <header><h2>Action center</h2>{p.action.length ? <span className="cc-n red">{p.action.length}</span> : null}</header>
                {p.action.length === 0 && p.progress.length === 0 ? (
                  <div className="db-clear"><span className="ok-circle"><Icon name="tick" stroke="#fff" width={3} size={14} /></span><div><strong>All clear</strong><span>Nothing needs you right now.</span></div></div>
                ) : (
                  <ul className="db-actions">
                    {[...p.action, ...p.progress].slice(0, 4).map((i) => (
                      <li key={i.type + i.id}>
                        <span className={`db-dot ${i.group === 'action' ? 'red' : 'amber'}`} />
                        <div><Link href={i.href} className="mono">{i.domain}</Link><span>{i.next.text}</span></div>
                        {i.next.cta ? <Link className="btn sm primary" href={i.next.href}>{i.next.cta}</Link> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className="cc-card">
              <div className="cc-toolbar">
                <h2 className="cc-h2">Recent orders</h2>
                <Link href="/orders" className="btn sm">View all orders</Link>
              </div>
              <div className="table-wrap">
                <table className="cc-table">
                  <thead><tr><th>Order #</th><th>Common name</th><th>Product</th><th>Status</th><th>Expires / renews</th><th><span className="sr">Actions</span></th></tr></thead>
                  <tbody>
                    {recent.map((r) => {
                      const w = when(r);
                      return (
                        <tr key={r.type + r.id}>
                          <td className="mono small"><Link href={r.href}>{r.ref || '—'}</Link></td>
                          <td><Link href={r.href} className="cc-cn">{r.domain}</Link>{r.extra ? <span className="small muted"> {r.extra}</span> : null}</td>
                          <td><div className="cc-prod">{r.product}</div><div className="small muted">{r.type === 'auto' ? 'Automated SSL' : 'Certificate'}</div></td>
                          <td><span className={`db-pill ${r.group}`}><i />{r.status.label}</span></td>
                          <td><div className={w.tone === 'bad' ? 'cc-hot' : ''} style={{ fontWeight: 600 }}>{w.main}</div>{w.sub ? <div className="small muted">{w.sub}</div> : null}</td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{r.next?.cta ? <Link className="btn sm primary" href={r.next.href}>{r.next.cta}</Link> : <Link className="btn sm" href={r.href}>Manage</Link>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="cc-tiles">
              <Link href="/tools/csr" className="cc-tile"><strong>CSR generator</strong><span>Create a CSR and key in your browser.</span><em>Open →</em></Link>
              <Link href="/tools/ssl-checker" className="cc-tile"><strong>SSL checker</strong><span>Test a live site's certificate and chain.</span><em>Open →</em></Link>
              <Link href="/tools/converter" className="cc-tile"><strong>Certificate converter</strong><span>PFX, JKS, PEM, P7B and server packs.</span><em>Open →</em></Link>
              {help ? <a href={help} className="cc-tile"><strong>Need help?</strong><span>Email your SSL team.</span><em>Contact →</em></a> : <Link href="/tools" className="cc-tile"><strong>All tools</strong><span>More utilities coming soon.</span><em>Open →</em></Link>}
            </section>
          </>
        )}
      </main>
    </>
  );
}
