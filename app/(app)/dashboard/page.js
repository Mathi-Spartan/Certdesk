import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { loadPortfolio } from '@/lib/portfolio';
import { supportEmail, helpHref } from '@/lib/support';
import TopBar from '@/components/TopBar';
import Icon from '@/components/Icon';
import { FlashFromSearch, fmtDate } from '@/components/ui';

export const metadata = { title: 'My SSL · CertDesk' };

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'action', label: 'Needs you' },
  { key: 'ok', label: 'Protected' },
  { key: 'progress', label: 'In progress' },
  { key: 'closed', label: 'Closed' }
];
// old links (?view=… / ?tab=…) still land somewhere sensible
const LEGACY = { cert: 'all', auto: 'all', ended: 'closed', due: 'action', validation: 'action', active: 'ok' };

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
      <defs><linearGradient id="dbg" x1="0" x2="1"><stop offset="0" stopColor="#146C47" /><stop offset="1" stopColor="#78A22E" /></linearGradient></defs>
      <text x="34" y="38" textAnchor="middle" fontSize="13" fontWeight="800" fill="#0F172A">{pct}%</text>
    </svg>
  );
}

export default async function Dashboard({ searchParams }) {
  const sp = await searchParams;
  const ctx = await requireWorkspace();
  const p = await loadPortfolio(ctx.workspaceId);
  const raw = sp.show || sp.view || sp.tab;
  const show = TABS.some((f) => f.key === raw) ? raw : LEGACY[raw] || 'all';
  const term = String(sp.q || '').trim().toLowerCase();

  const live = p.live;
  const closed = p.items.filter((i) => i.group === 'ended');
  const count = { all: live.length, ok: live.filter((i) => i.group === 'ok').length, action: p.action.length, progress: p.progress.length, closed: closed.length };
  const base = show === 'closed' ? closed : show === 'all' ? live : live.filter((i) => i.group === show);
  const rows = term ? base.filter((i) => [i.domain, i.product, ...i.tags].join(' ').toLowerCase().includes(term)) : base;
  const link = (key) => {
    const qs = new URLSearchParams({ ...(key !== 'all' ? { show: key } : {}), ...(term ? { q: term } : {}) }).toString();
    return '/dashboard' + (qs ? '?' + qs : '');
  };
  const coverage = live.length ? Math.round((count.ok / live.length) * 100) : 0;
  const soon = live.filter((i) => i.date?.at && i.date.days >= 0 && i.date.days <= 30 && i.date.label !== 'Renews').length;
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
        <header className="db-head">
          <div>
            <p className="db-date">{today}</p>
            <h1>{ctx.isAdmin ? ctx.workspace.name : `Welcome back${first ? `, ${first}` : ''}`}</h1>
            <p className="db-sub">
              {live.length === 0
                ? 'Nothing here yet. Order a certificate or ask us to assign your existing ones.'
                : p.action.length
                  ? `${p.action.length} item${p.action.length === 1 ? ' needs' : 's need'} your attention.`
                  : 'Everything is protected. Nothing needs you right now.'}
            </p>
          </div>
          {live.length ? (
            <form action="/dashboard" className="db-search">
              {show !== 'all' ? <input type="hidden" name="show" value={show} /> : null}
              <label className="search">
                <Icon name="search" stroke="var(--muted)" />
                <span className="sr">Search your certificates</span>
                <input name="q" defaultValue={term} type="search" placeholder="Search domains, products, tags" />
              </label>
            </form>
          ) : null}
        </header>

        <FlashFromSearch searchParams={sp} />

        {live.length === 0 && closed.length === 0 ? (
          <section className="db-empty">
            <div className="db-empty-text">
              <span className="db-empty-icon"><Icon name="lock" size={28} stroke="#fff" /></span>
              <h2>Secure your first website</h2>
              <p>Order a certificate you install yourself, or an automated subscription that installs and renews on its own. Already have certificates with us? Ask and we&apos;ll add them here.</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link className="btn primary" href="/order"><Icon name="plus" stroke="#fff" width={2.4} />Order SSL</Link>
                {help ? <a className="btn" href={help}>Ask us to add my certificates</a> : null}
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
            <section className="db-kpis">
              <div className="db-kpi db-kpi-ring">
                <Ring pct={coverage} />
                <div><span className="db-kpi-label">Protected</span><b>{count.ok} of {live.length}</b><small>{live.length - count.ok ? `${live.length - count.ok} not yet` : 'All covered'}</small></div>
              </div>
              <Link href={link('action')} className={`db-kpi ${count.action ? 'alert' : ''}`}>
                <span className="db-kpi-icon red"><Icon name="alert" stroke="currentColor" /></span>
                <div><span className="db-kpi-label">Needs you</span><b>{count.action}</b><small>{count.action ? 'Action required' : 'All clear'}</small></div>
              </Link>
              <div className="db-kpi">
                <span className="db-kpi-icon amber"><Icon name="clock" stroke="currentColor" /></span>
                <div><span className="db-kpi-label">Expiring in 30 days</span><b>{soon}</b><small>Manual certificates</small></div>
              </div>
              <div className="db-kpi">
                <span className="db-kpi-icon green"><Icon name="loop" stroke="currentColor" /></span>
                <div><span className="db-kpi-label">Automated</span><b>{p.autos}</b><small>{p.certs} manual certificate{p.certs === 1 ? '' : 's'}</small></div>
              </div>
            </section>

            <div className="db-grid">
              <section className="db-card db-list" aria-label="Your certificates">
                <div className="db-card-head">
                  <h2>Certificates</h2>
                  <nav className="db-tabs" aria-label="Filter">
                    {TABS.map((t) => (
                      <Link key={t.key} href={link(t.key)} className={show === t.key ? 'on' : ''} aria-current={show === t.key ? 'page' : undefined}>
                        {t.label}{count[t.key] ? <span className={t.key === 'action' ? 'red' : ''}>{count[t.key]}</span> : null}
                      </Link>
                    ))}
                  </nav>
                </div>
                {rows.length === 0 ? (
                  <div className="db-none">{term ? <>No results for “{term}”. <Link href={link(show).replace(/[?&]q=[^&]*/, '')}>Clear search</Link></> : 'Nothing in this view.'}</div>
                ) : (
                  <ul className="db-rows">
                    {rows.map((i) => {
                      const w = when(i);
                      return (
                        <li key={i.type + i.id}>
                          <Link href={i.href} className="db-row">
                            <span className={`db-ico ${i.type}`}><Icon name={i.type === 'auto' ? 'loop' : 'lock'} size={18} /></span>
                            <span className="db-main">
                              <span className="db-dom mono">{i.domain}{i.extra ? <em> {i.extra}</em> : null}</span>
                              <span className="db-prod">{i.type === 'auto' ? 'Automated' : 'Certificate'} · {i.product}</span>
                            </span>
                            <span className={`db-pill ${i.group}`}><i />{i.status.label}</span>
                            <span className="db-when">
                              <span className={w.tone}>{w.main}</span>
                              {i.life != null ? <span className={`db-life ${w.tone}`}><span style={{ width: `${100 - i.life}%` }} /></span> : null}
                              {w.sub ? <small>{w.sub}</small> : null}
                            </span>
                            <span className="db-go" aria-hidden="true"><Icon name="arrow" size={16} /></span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <aside className="db-side">
                <section className="db-card">
                  <div className="db-card-head"><h2>Action center</h2>{p.action.length ? <span className="db-count red">{p.action.length}</span> : null}</div>
                  {p.action.length === 0 && p.progress.length === 0 ? (
                    <div className="db-clear"><span className="ok-circle"><Icon name="tick" stroke="#fff" width={3} size={14} /></span><div><strong>All clear</strong><span>Nothing needs you right now.</span></div></div>
                  ) : (
                    <ul className="db-actions">
                      {[...p.action, ...p.progress].slice(0, 5).map((i) => (
                        <li key={i.type + i.id}>
                          <span className={`db-dot ${i.group === 'action' ? 'red' : 'amber'}`} />
                          <div>
                            <Link href={i.href} className="mono">{i.domain}</Link>
                            <span>{i.next.text}</span>
                          </div>
                          {i.next.cta ? <Link className="btn sm primary" href={i.next.href}>{i.next.cta}</Link> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="db-card">
                  <div className="db-card-head"><h2>Coming up</h2></div>
                  {p.upcoming.length === 0 ? <div className="db-none" style={{ padding: '6px 20px 20px' }}>No dates coming up.</div> : (
                    <ul className="db-up">
                      {p.upcoming.map((i) => (
                        <li key={i.type + i.id}>
                          <span className="db-cal"><small>{new Date(i.date.at).toLocaleDateString('en-GB', { month: 'short' })}</small><b>{new Date(i.date.at).getDate()}</b></span>
                          <div><Link href={i.href} className="mono">{i.domain}</Link><span>{i.date.label} · in {i.date.days} days</span></div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="db-card db-quick">
                  <div className="db-card-head"><h2>Quick actions</h2></div>
                  <Link href="/buy"><span className="db-q-ico green"><Icon name="lock" stroke="currentColor" /></span><span><strong>Order a certificate</strong><small>DV, OV, EV, wildcard</small></span></Link>
                  <Link href="/subscriptions/new"><span className="db-q-ico amber"><Icon name="loop" stroke="currentColor" /></span><span><strong>Start automated SSL</strong><small>Renews and installs itself</small></span></Link>
                  {help ? <a href={help}><span className="db-q-ico blue"><Icon name="info" stroke="currentColor" /></span><span><strong>Get help</strong><small>Email your SSL team</small></span></a> : null}
                </section>
              </aside>
            </div>
          </>
        )}
      </main>
    </>
  );
}
