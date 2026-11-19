import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireWorkspace } from '@/lib/auth';
import { q } from '@/lib/db';
import { loadPortfolio } from '@/lib/portfolio';
import { brandOf } from '@/components/site/SiteChrome';
import TopBar from '@/components/TopBar';
import { FlashFromSearch, fmtDate } from '@/components/ui';

export const metadata = { title: 'Overview · CertDesk' };

const DAY = 86400000;
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
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
  const [p, products] = await Promise.all([
    loadPortfolio(ctx.workspaceId),
    q('select id, name, brand, validation from console.products')
  ]);
  const prod = Object.fromEntries(products.map((x) => [x.id, x]));
  const live = p.live;
  const certs = live.filter((i) => i.type === 'cert');
  const issued = certs.filter((i) => i.date?.at);
  const domains = new Set(live.map((i) => i.domain)).size;

  const expiring = issued.filter((i) => i.date.days <= 30);
  const autoOff = expiring.filter((i) => !i.autoRenew).length;
  const validating = live.filter((i) => i.type === 'cert' && i.status && i.next?.cta === 'Validate');
  const oldest = validating.length ? Math.max(...validating.map((i) => Math.floor((Date.now() - new Date(i.ordered)) / DAY))) : 0;
  const automated = live.filter((i) => i.type === 'auto' || i.autoRenew).length;
  const coverage = pct(automated, live.length);

  // 12-week expiry horizon (certificates and subscription renewals)
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const weeks = Array.from({ length: 12 }, (_, w) => {
    const from = start.getTime() + w * 7 * DAY;
    const n = live.filter((i) => i.date?.at && new Date(i.date.at).getTime() >= from && new Date(i.date.at).getTime() < from + 7 * DAY).length;
    return { from, n, tone: w < 2 ? 'red' : w < 4 ? 'amber' : 'soft' };
  });
  const maxW = Math.max(1, ...weeks.map((w) => w.n));

  // health: share of live items that renew without a person, use reusable validation, and need nothing now
  const reusable = live.filter((i) => i.type === 'auto' || i.method === 'dns').length;
  const calm = live.filter((i) => i.group !== 'action').length;
  const health = live.length ? Math.round((pct(automated, live.length) + pct(reusable, live.length) + pct(calm, live.length)) / 3) : 0;
  const healthWord = health >= 85 ? 'Good' : health >= 60 ? 'Fair' : 'Needs work';
  const emailOrHttp = certs.filter((i) => i.method && i.method !== 'dns').length;

  // portfolio mix
  const levels = { dv: 0, ov: 0, ev: 0 };
  const cas = {};
  for (const i of live) {
    const pr = prod[i.productId];
    const lvl = String(pr?.validation || (i.type === 'auto' ? 'dv' : '')).toLowerCase();
    if (lvl in levels) levels[lvl] += 1;
    const b = brandOf({ name: pr?.name || i.product, brand: pr?.brand }).name;
    cas[b] = (cas[b] || 0) + 1;
  }
  const caList = Object.entries(cas).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const lvlTotal = levels.dv + levels.ov + levels.ev;

  // SC-081: 100-day maximum from 15 Mar 2027
  const to100 = Math.max(0, Math.ceil((new Date('2027-03-15T00:00:00Z') - Date.now()) / DAY));
  const methods = { dns: 0, email: 0, http: 0 };
  for (const i of certs) if (i.method) methods[i.method.startsWith('http') ? 'http' : i.method] = (methods[i.method.startsWith('http') ? 'http' : i.method] || 0) + 1;
  const autoSubs = live.filter((i) => i.type === 'auto').length;

  const attention = [...p.action, ...p.progress].slice(0, 5);
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

  return (
    <>
      {ctx.isAdmin ? <TopBar crumbs={[{ label: ctx.workspace.name }, { label: 'Overview' }]} /> : null}
      <main className="cx3-page">
        <div className="cx3-head">
          <div>
            <h1>Overview</h1>
            <p>{live.length} active item{live.length === 1 ? '' : 's'} across {domains} domain{domains === 1 ? '' : 's'} · updated {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
        <FlashFromSearch searchParams={sp} />

        <div className="cx3-kpis">
          <Kpi label="Certificates" value={live.length} href="/orders" icon={ic(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>)} foot={`${certs.length} manual · ${autoSubs} automated`} />
          <Kpi label="Expiring in 30 days" value={expiring.length} tone={expiring.length ? 'red' : null} href="/renewals" icon={ic(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, '#B91C1C')} foot={expiring.length ? `${autoOff} with auto-renew off` : 'Nothing close to expiry'} />
          <Kpi label="Awaiting validation" value={validating.length} tone={validating.length ? 'amber' : null} href="/validation" icon={ic(<><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></>, '#B45309')} foot={validating.length ? `Oldest waiting ${oldest} day${oldest === 1 ? '' : 's'}` : 'All validated'} />
          <Kpi label="Auto-renew coverage" value={`${coverage}%`} href="/renewals" icon={ic(<><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></>, 'var(--cx-accent)')}>
            <div className="cx3-meter"><span style={{ width: `${coverage}%` }} /></div>
          </Kpi>
        </div>

        <div className="cx3-grid">
          <section className="cx3-card cx3-pad span2">
            <div className="cx3-card-head">
              <div><h2>Expiry horizon</h2><p>Certificates expiring or renewing, per week</p></div>
              <div className="cx3-legend"><span><i className="red" />Under 2 weeks</span><span><i className="amber" />2–4 weeks</span><span><i className="soft" />Later</span></div>
            </div>
            <div className="cx3-bars" role="img" aria-label={`Items per week for the next 12 weeks: ${weeks.map((w) => w.n).join(', ')}`}>
              {weeks.map((w) => (
                <div key={w.from}><span className={w.n ? '' : 'zero'}>{w.n}</span><i className={w.n ? w.tone : 'none'} style={{ height: w.n ? `${Math.max(8, (w.n / maxW) * 88)}%` : 2 }} /></div>
              ))}
            </div>
            <div className="cx3-axis" aria-hidden="true">{weeks.map((w, i) => <span key={w.from}>{i % 2 === 0 ? short(w.from) : ''}</span>)}</div>
          </section>

          <section className="cx3-card cx3-pad">
            <div className="cx3-card-head"><div><h2>Certificate health</h2><p>How little your certificates depend on manual work</p></div></div>
            <div className="cx3-health">
              <div className="cx3-ring">
                <svg width="104" height="104" viewBox="0 0 108 108" role="img" aria-label={`Health score ${health} out of 100`}>
                  <circle cx="54" cy="54" r="46" fill="none" stroke="var(--cx-accent-soft)" strokeWidth="10" />
                  <circle cx="54" cy="54" r="46" fill="none" stroke="var(--cx-accent)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(health / 100) * 289} 289`} transform="rotate(-90 54 54)" />
                </svg>
                <div><b>{health}</b><small>of 100</small></div>
              </div>
              <p><strong>{healthWord}.</strong> {emailOrHttp ? `Moving ${emailOrHttp} certificate${emailOrHttp === 1 ? '' : 's'} to DNS validation or automation would raise this.` : automated < live.length ? 'Automating the remaining certificates would raise this.' : 'Everything renews without manual steps.'}</p>
            </div>
            <dl className="cx3-dl">
              <div><dt>Renews automatically</dt><dd>{automated} / {live.length}</dd></div>
              <div><dt>DNS or ACME validation (reusable)</dt><dd>{reusable} / {live.length}</dd></div>
              <div><dt>No action needed</dt><dd className={calm === live.length ? 't-green' : ''}>{calm} / {live.length}</dd></div>
            </dl>
          </section>

          <section className="cx3-card span2">
            <div className="cx3-card-head cx3-pad-h"><h2>Needs your attention</h2><span className="cx3-muted">{attention.length ? `${p.action.length} open` : 'All clear'}</span></div>
            {attention.length === 0 ? (
              <div className="cx3-clear">{ic(<path d="m5 12 5 5 9-10" />, '#15803D')}<span><strong>Nothing needs you right now.</strong> We will flag validation, renewals and setup steps here.</span></div>
            ) : (
              <ul className="cx3-list">
                {attention.map((i) => (
                  <li key={i.type + i.id}>
                    <span className={`cx3-dot ${i.group === 'action' ? (i.date?.days != null && i.date.days <= 14 ? 'red' : 'amber') : 'accent'}`} />
                    <div>
                      <div className="cx3-li-title"><span className="mono">{i.domain}</span> {i.date?.at && i.date.days <= 30 ? `${i.date.label === 'Renews' ? 'renews' : 'expires'} in ${i.date.days} day${i.date.days === 1 ? '' : 's'}` : i.detail?.label?.toLowerCase() || i.status.label.toLowerCase()}</div>
                      <div className="cx3-li-sub">{i.next.text}</div>
                    </div>
                    {i.next.cta ? <Link className={`cx3-btn sm ${i.group === 'action' ? 'dark' : ''}`} href={i.next.href}>{i.next.cta}</Link> : <Link className="cx3-btn sm" href={i.href}>Open</Link>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="cx3-card cx3-dark">
            <div className="cx3-kicker">INDUSTRY CHANGE · CA/B FORUM SC-081</div>
            <h2>Maximum certificate life drops to 100 days on 15 Mar 2027</h2>
            <div className="cx3-big"><b>{to100}</b><span>days to go</span></div>
            <div className="cx3-ready">
              <div className="cx3-ready-top"><span>Your readiness</span><span>{automated} of {live.length} automated</span></div>
              <div className="cx3-stack">
                <i className="a" style={{ width: `${pct(automated, live.length)}%` }} />
                <i className="b" style={{ width: `${pct(live.length - automated, live.length)}%` }} />
              </div>
              <div className="cx3-ready-keys"><span>Automated {autoSubs}</span><span>DNS {methods.dns || 0}</span><span>Email {methods.email || 0}</span><span>HTTP {methods.http || 0}</span></div>
            </div>
            <Link href="/renewals" className="cx3-btn light">Get ready</Link>
          </section>

          <section className="cx3-card cx3-pad">
            <div className="cx3-card-head"><h2>Portfolio</h2></div>
            <div className="cx3-mix">
              <div className="cx3-mix-top"><span>By validation level</span><span>{lvlTotal}</span></div>
              <div className="cx3-stack tall">
                <i className="l1" style={{ width: `${pct(levels.dv, lvlTotal)}%` }} />
                <i className="l2" style={{ width: `${pct(levels.ov, lvlTotal)}%` }} />
                <i className="l3" style={{ width: `${pct(levels.ev, lvlTotal)}%` }} />
              </div>
              <div className="cx3-mix-keys"><span><i className="l1" /><strong>{levels.dv}</strong> DV</span><span><i className="l2" /><strong>{levels.ov}</strong> OV</span><span><i className="l3" /><strong>{levels.ev}</strong> EV</span></div>
            </div>
            <div className="cx3-mix">
              <div className="cx3-mix-top"><span>By certificate authority</span><span>{live.length}</span></div>
              <div className="cx3-stack tall">{caList.map(([n, c], k) => <i key={n} className={`g${k}`} style={{ width: `${pct(c, live.length)}%` }} />)}</div>
              <div className="cx3-mix-keys">{caList.map(([n, c], k) => <span key={n}><i className={`g${k}`} /><strong>{c}</strong> {n}</span>)}</div>
            </div>
          </section>

          <section className="cx3-card cx3-pad span2">
            <div className="cx3-card-head"><h2>Coming up</h2><Link href="/renewals" className="cx3-link-sm">All renewals</Link></div>
            {p.upcoming.length === 0 ? <p className="cx3-muted">No expiry or renewal dates in the future.</p> : (
              <ol className="cx3-timeline">
                {p.upcoming.map((i) => (
                  <li key={i.type + i.id}>
                    <span className="mono cx3-when">{fmtDate(i.date.at)}</span>
                    <span><strong>{i.date.label}</strong> <Link href={i.href} className="mono">{i.domain}</Link> · {i.product}</span>
                    <span className={`cx3-in ${i.date.days <= 14 && i.date.label !== 'Renews' ? 't-red' : ''}`}>in {i.date.days} days</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
