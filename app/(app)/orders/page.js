import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { q } from '@/lib/db';
import TopBar from '@/components/TopBar';
import { itemFromOrder, itemFromSub } from '@/lib/portfolio';
import { Empty, fmtDate, FlashFromSearch } from '@/components/ui';
import { fmtMoney } from '@/lib/pricing';

export const metadata = { title: 'Orders · CertDesk' };

const FILTERS = [
  { key: '', label: 'All orders' },
  { key: 'action', label: 'Needs action' },
  { key: 'expiring', label: 'Expiring in 30 days' },
  { key: 'pending', label: 'In progress' },
  { key: 'auto', label: 'Automated SSL' },
  { key: 'closed', label: 'Closed' }
];

const TEST = {
  '': () => true,
  action: (i) => i.group === 'action',
  expiring: (i) => i.group !== 'ended' && i.type === 'cert' && i.date?.at && i.date.days <= 30,
  pending: (i) => i.group === 'progress',
  auto: (i) => i.type === 'auto' && i.group !== 'ended',
  closed: (i) => i.group === 'ended'
};

export default async function Orders({ searchParams }) {
  const sp = await searchParams;
  const ctx = await requireWorkspace();
  const f = sp.f in TEST ? sp.f : '';
  const term = String(sp.q || '').trim().toLowerCase();
  const [orders, subs] = await Promise.all([
    q(`select o.*, u.name as by_name from console.orders o left join console.users u on u.id = o.created_by where o.workspace_id = $1 and o.status <> 'draft'`, [ctx.workspaceId]),
    q(`select s.*, u.name as by_name from console.subscriptions s left join console.users u on u.id = s.created_by where s.workspace_id = $1`, [ctx.workspaceId])
  ]);
  const all = [
    ...orders.map((o) => ({ ...itemFromOrder(o), at: o.created_at, by: o.by_name, term: o.period_months, price: fmtMoney(o.customer_price, o.customer_currency || 'USD'), partnerCost: o.order_amount != null ? `${o.order_amount} ${o.currency || ''}` : null })),
    ...subs.map((s) => ({ ...itemFromSub(s), at: s.created_at, by: s.by_name, term: null, price: null, partnerCost: null }))
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  const counts = Object.fromEntries(FILTERS.map((x) => [x.key, all.filter(TEST[x.key]).length]));
  const rows = all.filter(TEST[f]).filter((i) => !term || [i.domain, i.product, String(i.ref || ''), ...(i.tags || [])].join(' ').toLowerCase().includes(term));
  const href = (key) => {
    const qs = new URLSearchParams({ ...(key ? { f: key } : {}), ...(term ? { q: term } : {}) }).toString();
    return '/orders' + (qs ? '?' + qs : '');
  };
  const title = FILTERS.find((x) => x.key === f)?.label || 'All orders';

  return (
    <>
      {ctx.isAdmin ? <TopBar crumbs={[{ label: ctx.workspace.name }, { label: 'Orders' }]} /> : null}
      <main className="page cc-page">
        <header className="cc-page-head">
          <div>
            <nav className="cc-crumbs" aria-label="Breadcrumb"><Link href="/dashboard">Dashboard</Link><span>/</span><span>Certificates</span></nav>
            <h1>{title}</h1>
            <p>{rows.length} order{rows.length === 1 ? '' : 's'}{term ? ` matching “${term}”` : ''}. Open an order to validate, download, reissue or renew.</p>
          </div>
          <Link className="btn primary" href="/order">Request certificate</Link>
        </header>

        <FlashFromSearch searchParams={sp} />

        <section className="cc-card">
          <div className="cc-toolbar">
            <nav className="cc-filters" aria-label="Filter orders">
              {FILTERS.map((x) => (
                <Link key={x.key || 'all'} href={href(x.key)} className={f === x.key ? 'on' : ''} aria-current={f === x.key ? 'page' : undefined}>
                  {x.label}<span>{counts[x.key]}</span>
                </Link>
              ))}
            </nav>
            <form action="/orders" className="cc-table-search" role="search">
              {f ? <input type="hidden" name="f" value={f} /> : null}
              <label className="sr" htmlFor="oq">Search orders</label>
              <input id="oq" name="q" type="search" defaultValue={term} placeholder="Domain, product or order #" />
            </form>
          </div>
          {rows.length === 0 ? (
            <Empty title={all.length ? 'No orders in this view' : 'No orders yet'}>
              {all.length ? <Link href="/orders">Show all orders</Link> : <Link className="btn primary" href="/order">Request your first certificate</Link>}
            </Empty>
          ) : (
            <div className="table-wrap">
              <table className="cc-table">
                <thead>
                  <tr>
                    <th>Order #</th><th>Common name</th><th>Product</th><th>Status</th><th>Expires / renews</th><th>Ordered</th><th>Price</th>
                    {ctx.isAdmin ? <th>Partner cost</th> : null}
                    <th><span className="sr">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const hot = r.date?.at && r.date.days <= 30 && r.date.label !== 'Renews' && r.group !== 'ended';
                    return (
                      <tr key={r.type + r.id}>
                        <td className="mono small"><Link href={r.href}>{r.ref || '—'}</Link></td>
                        <td>
                          <Link href={r.href} className="cc-cn">{r.domain}</Link>
                          {r.extra ? <span className="small muted"> {r.extra}</span> : null}
                        </td>
                        <td>
                          <div className="cc-prod">{r.product}</div>
                          <div className="small muted">{r.type === 'auto' ? 'Automated SSL' : 'Certificate'}{r.term ? ` · ${r.term % 12 === 0 ? `${r.term / 12} yr` : `${r.term} mo`}` : ''}</div>
                        </td>
                        <td><span className={`db-pill ${r.group}`}><i />{r.status.label}</span></td>
                        <td>
                          {r.date?.at ? (
                            <>
                              <div className={hot ? 'cc-hot' : ''} style={{ fontWeight: 600 }}>{fmtDate(r.date.at)}</div>
                              <div className="small muted">{r.date.label} · {r.date.days < 0 ? `${-r.date.days} days ago` : r.date.days === 0 ? 'today' : `in ${r.date.days} days`}</div>
                            </>
                          ) : <span className="muted">—</span>}
                        </td>
                        <td><div>{fmtDate(r.at)}</div><div className="small muted">{r.by || 'Your provider'}</div></td>
                        <td style={{ fontWeight: 600 }}>{r.price || <span className="muted" style={{ fontWeight: 400 }}>—</span>}</td>
                        {ctx.isAdmin ? <td className="mono small">{r.partnerCost || '—'}</td> : null}
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {r.next?.cta ? <Link className="btn sm primary" href={r.next.href}>{r.next.cta}</Link> : <Link className="btn sm" href={r.href}>Manage</Link>}
                        </td>
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
