import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { loadPortfolio } from '@/lib/portfolio';
import TopBar from '@/components/TopBar';
import Icon from '@/components/Icon';
import ItemRow from '@/components/ItemRow';
import { Empty, FlashFromSearch } from '@/components/ui';

export const metadata = { title: 'My SSL · CertDesk' };

const VIEWS = [
  { key: 'all', label: 'All' },
  { key: 'action', label: 'Needs action' },
  { key: 'cert', label: 'Certificates' },
  { key: 'auto', label: 'Automated' },
  { key: 'ended', label: 'Closed' }
];

function inView(i, view) {
  if (view === 'ended') return i.group === 'ended';
  if (i.group === 'ended') return false;
  if (view === 'action') return i.group === 'action';
  if (view === 'cert' || view === 'auto') return i.type === view;
  return true;
}

export default async function MySsl({ searchParams }) {
  const sp = await searchParams;
  const ctx = await requireWorkspace();
  const p = await loadPortfolio(ctx.workspaceId);
  // old links: ?tab=due|validation etc. land on Needs action
  const legacy = { due: 'action', validation: 'action', active: 'all', closed: 'ended', caas: 'auto', ais: 'auto', automated: 'auto' };
  const requested = sp.view || legacy[sp.tab];
  const view = VIEWS.some((v) => v.key === requested) ? requested : 'all';
  const term = String(sp.q || '').trim().toLowerCase();
  const counts = Object.fromEntries(VIEWS.map((v) => [v.key, p.items.filter((i) => inView(i, v.key)).length]));
  const rows = p.items.filter((i) => {
    if (!inView(i, view)) return false;
    if (!term) return true;
    return [i.domain, i.product, String(i.ref || ''), ...i.tags].join(' ').toLowerCase().includes(term);
  });
  const href = (v) => {
    const params = new URLSearchParams({ ...(v !== 'all' ? { view: v } : {}), ...(term ? { q: term } : {}) }).toString();
    return '/certificates' + (params ? '?' + params : '');
  };

  return (
    <>
      <TopBar crumbs={[{ label: ctx.workspace.name }, { label: 'My SSL' }]}>
        <Link className="btn primary" href="/order"><Icon name="plus" stroke="#fff" width={2.4} />Order SSL</Link>
      </TopBar>
      <main className="page" style={{ gap: 16 }}>
        <div>
          <h1 className="title">My SSL</h1>
          <p className="sub">All your certificates and automated subscriptions in one list. Anything that needs you is at the top.</p>
        </div>
        <FlashFromSearch searchParams={sp} />

        <div className="between" style={{ gap: 12, flexWrap: 'wrap' }}>
          <nav className="pills" aria-label="Show">
            {VIEWS.map((v) => (
              <Link key={v.key} href={href(v.key)} className={view === v.key ? 'on' : ''} aria-current={view === v.key ? 'page' : undefined}>
                {v.label}
                {counts[v.key] ? <span className={`pill-count ${v.key === 'action' ? 'alert' : ''}`}>{counts[v.key]}</span> : null}
              </Link>
            ))}
          </nav>
          <form action="/certificates" style={{ flex: '0 1 320px' }}>
            {view !== 'all' ? <input type="hidden" name="view" value={view} /> : null}
            <label className="search">
              <Icon name="search" stroke="var(--muted)" />
              <span className="sr">Search</span>
              <input name="q" defaultValue={term} type="search" placeholder="Search domain or product" />
            </label>
          </form>
        </div>

        <div className="card">
          {rows.length === 0 ? (
            p.items.length === 0 ? (
              <Empty title="Nothing here yet">
                <span>Order your first certificate or automated subscription. It shows up here straight away.</span>
                <Link className="btn primary" href="/order">Order SSL</Link>
              </Empty>
            ) : view === 'action' ? (
              <Empty title="You're all set">Nothing needs your attention right now.</Empty>
            ) : (
              <Empty title="Nothing matches">
                <Link href="/certificates">Show everything</Link>
              </Empty>
            )
          ) : (
            <div className="table-wrap">
              <table className="t list" style={{ minWidth: 900 }}>
                <thead>
                  <tr><th>Domain</th><th>Type</th><th>Status</th><th>Date</th><th>Next step</th></tr>
                </thead>
                <tbody>
                  {rows.map((i) => <ItemRow key={i.type + i.id} item={i} showRef={ctx.isAdmin} />)}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
