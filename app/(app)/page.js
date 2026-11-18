import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { loadPortfolio } from '@/lib/portfolio';
import TopBar from '@/components/TopBar';
import Icon from '@/components/Icon';
import { FlashFromSearch, fmtDate } from '@/components/ui';

export const metadata = { title: 'My SSL · CertDesk' };

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'ok', label: 'Protected' },
  { key: 'action', label: 'Needs you' },
  { key: 'progress', label: 'In progress' }
];
// old links (?view=… / ?tab=…) still land somewhere sensible
const LEGACY = { cert: 'all', auto: 'all', ended: 'closed', due: 'action', validation: 'action', active: 'ok' };

function dateLine(i) {
  if (!i.date?.at) return { main: i.group === 'progress' ? 'Waiting' : '—', sub: null };
  const d = i.date.days;
  return {
    main: `${i.date.label} ${fmtDate(i.date.at)}`,
    sub: d < 0 ? `${-d} days ago` : d === 0 ? 'today' : `in ${d} days`,
    urgent: d !== null && d <= 30
  };
}

export default async function Dashboard({ searchParams }) {
  const sp = await searchParams;
  const ctx = await requireWorkspace();
  const p = await loadPortfolio(ctx.workspaceId);
  const raw = sp.show || sp.view || sp.tab;
  const show = FILTERS.some((f) => f.key === raw) || raw === 'closed' ? raw : LEGACY[raw] || 'all';
  const term = String(sp.q || '').trim().toLowerCase();

  const live = p.live;
  const closed = p.items.filter((i) => i.group === 'ended');
  const count = { all: live.length, ok: live.filter((i) => i.group === 'ok').length, action: p.action.length, progress: p.progress.length };
  const base = show === 'closed' ? closed : show === 'all' ? live : live.filter((i) => i.group === show);
  const rows = term ? base.filter((i) => [i.domain, i.product, ...i.tags].join(' ').toLowerCase().includes(term)) : base;
  const link = (key, withTerm = true) => {
    const q = new URLSearchParams({ ...(key !== 'all' ? { show: key } : {}), ...(term && withTerm ? { q: term } : {}) }).toString();
    return '/' + (q ? '?' + q : '');
  };

  return (
    <>
      <TopBar crumbs={[{ label: ctx.workspace.name }, { label: 'My SSL' }]}>
        <Link className="btn primary" href="/order"><Icon name="plus" stroke="#fff" width={2.4} />Order SSL</Link>
      </TopBar>
      <main className="page dash">
        <header className="dash-head">
          <div>
            <h1 className="title">My SSL</h1>
            <p className="sub">
              {live.length === 0
                ? 'Your certificates and automated subscriptions will appear here.'
                : `${p.domains} domain${p.domains === 1 ? '' : 's'} · ${p.certs} certificate${p.certs === 1 ? '' : 's'} · ${p.autos} automated`}
            </p>
          </div>
          {live.length ? (
            <form action="/" className="dash-search">
              {show !== 'all' ? <input type="hidden" name="show" value={show} /> : null}
              <label className="search">
                <Icon name="search" stroke="var(--muted)" />
                <span className="sr">Search your SSL</span>
                <input name="q" defaultValue={term} type="search" placeholder="Search domains" />
              </label>
            </form>
          ) : null}
        </header>

        <FlashFromSearch searchParams={sp} />

        {live.length === 0 && closed.length === 0 ? (
          <section className="welcome">
            <span className="welcome-icon"><Icon name="lock" size={26} stroke="var(--accent-ink)" /></span>
            <h2>Secure your first website</h2>
            <p>Order a certificate you install yourself, or an automated subscription that renews and installs on its own.</p>
            <Link className="btn primary" href="/order">Order SSL</Link>
          </section>
        ) : (
          <>
            {p.action.length ? (
              <section className="attention" aria-label="Needs your attention">
                <div className="attention-head">
                  <Icon name="alert" stroke="var(--red-strong)" />
                  <strong>{p.action.length === 1 ? '1 thing needs your attention' : `${p.action.length} things need your attention`}</strong>
                </div>
                <ul>
                  {p.action.slice(0, 5).map((i) => (
                    <li key={i.type + i.id}>
                      <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                        <Link href={i.href} className="mono attention-domain">{i.domain}</Link>
                        <div className="small" style={{ color: 'var(--ink-2)' }}>{i.next.text}</div>
                      </div>
                      {i.next.cta ? <Link className="btn sm primary" href={i.next.href}>{i.next.cta}</Link> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : live.length ? (
              <div className="all-good">
                <span className="ok-circle"><Icon name="tick" stroke="#fff" width={3} size={14} /></span>
                <span><strong>Everything is in order.</strong> Nothing needs your attention right now.</span>
              </div>
            ) : null}

            <nav className="filters" aria-label="Filter">
              {FILTERS.map((f) => (
                <Link key={f.key} href={link(f.key)} className={`filter ${f.key} ${show === f.key ? 'on' : ''}`} aria-current={show === f.key ? 'page' : undefined}>
                  <span className="filter-num">{count[f.key]}</span>
                  <span className="filter-label">{f.label}</span>
                </Link>
              ))}
            </nav>

            <section className="ssl-list" aria-label="Your SSL">
              {rows.length === 0 ? (
                <div className="ssl-empty">
                  {term ? <>No results for “{term}”. <Link href={link(show, false)}>Clear search</Link></> : 'Nothing here right now.'}
                </div>
              ) : (
                rows.map((i) => {
                  const dl = dateLine(i);
                  return (
                    <Link key={i.type + i.id} href={i.href} className="ssl-row">
                      <span className={`ssl-icon ${i.type}`}><Icon name={i.type === 'auto' ? 'loop' : 'lock'} size={18} /></span>
                      <span className="ssl-main">
                        <span className="ssl-domain mono">{i.domain}{i.extra ? <span className="ssl-extra"> {i.extra}</span> : null}</span>
                        <span className="ssl-product">{i.type === 'auto' ? 'Automated' : 'Certificate'} · {i.product}</span>
                      </span>
                      <span className="ssl-status"><span className={`badge tone-${i.status.tone}`}>{i.status.label}</span></span>
                      <span className="ssl-date">
                        <span style={{ color: dl.urgent ? 'var(--red-strong)' : undefined }}>{dl.main}</span>
                        {dl.sub ? <span className="small muted">{dl.sub}</span> : null}
                      </span>
                      <span className="ssl-go" aria-hidden="true"><Icon name="arrow" size={16} /></span>
                    </Link>
                  );
                })
              )}
            </section>

            {closed.length > 0 && show !== 'closed' ? (
              <Link className="small muted" href="/?show=closed" style={{ alignSelf: 'center' }}>Show {closed.length} closed</Link>
            ) : show === 'closed' ? (
              <Link className="small" href="/" style={{ alignSelf: 'center' }}>Back to active</Link>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}
