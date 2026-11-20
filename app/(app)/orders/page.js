import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { q } from '@/lib/db';
import TopBar from '@/components/TopBar';
import { itemFromOrder, itemFromSub } from '@/lib/portfolio';
import { fmtDate, FlashFromSearch } from '@/components/ui';
import { fmtMoney } from '@/lib/pricing';
import { certFacts } from '@/lib/certs';
import { brandOf } from '@/components/site/SiteChrome';
import CertTable from './CertTable';

export const metadata = { title: 'Certificates · CertDesk' };

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'action', label: 'Needs action' },
  { key: 'expiring', label: 'Expiring in 30 days' },
  { key: 'pending', label: 'In progress' },
  { key: 'auto', label: 'Automated' },
  { key: 'closed', label: 'Closed' }
];

const TEST = {
  '': (i) => i.group !== 'ended',
  action: (i) => i.group === 'action',
  expiring: (i) => i.group !== 'ended' && i.type === 'cert' && i.date?.at && i.date.days <= 30,
  pending: (i) => i.group === 'progress',
  auto: (i) => i.type === 'auto' && i.group !== 'ended',
  closed: (i) => i.group === 'ended'
};

const METHOD = { dns: 'DNS', email: 'Email', http: 'HTTP', https: 'HTTPS', acme: 'ACME', auto: 'AutoInstall' };

export default async function Certificates({ searchParams }) {
  const sp = await searchParams;
  const ctx = await requireWorkspace();
  const f = sp.f in TEST ? sp.f : '';
  const term = String(sp.q || '').trim().toLowerCase();
  const [orders, subs, products] = await Promise.all([
    q(`select * from console.orders where workspace_id = $1 and status <> 'draft'`, [ctx.workspaceId]),
    q(`select * from console.subscriptions where workspace_id = $1`, [ctx.workspaceId]),
    q('select id, validation, wildcard, multidomain from console.products')
  ]);
  const prod = Object.fromEntries(products.map((x) => [x.id, x]));
  const kind = (i) => {
    const pr = prod[i.productId];
    if (i.type === 'auto') return i.kind === 'caas' ? 'ACME · multi-domain' : 'Plan + Automate';
    return [String(pr?.validation || '').toUpperCase(), pr?.wildcard ? 'Wildcard' : null, pr?.multidomain ? 'Multi-domain' : null].filter(Boolean).join(' · ') || 'Certificate';
  };
  const all = [
    ...orders.map((o) => {
      const f = o.status === 'issued' ? certFacts(o) : null;
      return {
        ...itemFromOrder(o),
        price: fmtMoney(o.customer_price, o.customer_currency || 'USD'),
        cost: o.order_amount != null ? `${o.order_amount} ${o.currency || ''}` : null,
        facts: f ? { issuer: f.issuer, key: f.key, sans: f.san.length, serial: String(f.serial || '').slice(0, 20) } : null,
        certFrom: o.valid_from, synced: o.last_synced_at, canDownload: o.status === 'issued' && !!o.crt_code
      };
    }),
    ...subs.map((s) => ({ ...itemFromSub(s), price: null, cost: null }))
  ].sort((a, b) => {
    const ad = a.date?.at ? new Date(a.date.at).getTime() : Infinity;
    const bd = b.date?.at ? new Date(b.date.at).getTime() : Infinity;
    return ad !== bd ? ad - bd : new Date(b.ordered) - new Date(a.ordered);
  });
  const counts = Object.fromEntries(FILTERS.map((x) => [x.key, all.filter(TEST[x.key]).length]));
  const rows = all.filter(TEST[f]).filter((i) => !term || [i.domain, i.product, String(i.ref || ''), ...(i.tags || [])].join(' ').toLowerCase().includes(term));
  const href = (key, withTerm = true) => {
    const qs = new URLSearchParams({ ...(key ? { f: key } : {}), ...(term && withTerm ? { q: term } : {}) }).toString();
    return '/orders' + (qs ? '?' + qs : '');
  };

  return (
    <>
      {ctx.isAdmin ? <TopBar crumbs={[{ label: ctx.workspace.name }, { label: 'Certificates' }]} /> : null}
      <main className="cx3-page">
        <div className="cx3-head">
          <div>
            <h1>Certificates</h1>
            <p>{counts['']} active · {counts.action} need action · {counts.expiring} expiring in 30 days</p>
          </div>
          <Link className="cx3-btn primary" href="/order">Buy certificate</Link>
        </div>
        <FlashFromSearch searchParams={sp} />

        <div className="cx3-tabs" aria-label="Filter certificates">
          {FILTERS.map((x) => (
            <Link key={x.key || 'all'} href={href(x.key)} className={f === x.key ? 'on' : ''} aria-current={f === x.key ? 'page' : undefined}>
              {x.label}<span>{counts[x.key]}</span>
            </Link>
          ))}
        </div>

        <form action="/orders" className="cx3-filterbar" role="search">
          {f ? <input type="hidden" name="f" value={f} /> : null}
          <label className="cx3-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <span className="sr">Filter certificates</span>
            <input type="search" name="q" defaultValue={term} placeholder="Filter by domain, product, order ID or tag" />
          </label>
          {term ? <Link href={href(f, false)} className="cx3-chip on">“{term}” ×</Link> : null}
        </form>

        <CertTable
          rows={rows.map((r) => ({
            key: r.type + r.id, id: r.id, type: r.type, href: r.href, domain: r.domain, extra: r.extra || null, ref: r.ref || null,
            product: r.product, kind: kind(r), brand: brandOf({ name: r.product || '', brand: r.brand || '' })?.slug || 'sectigo',
            status: r.detail?.label && r.group !== 'ok' ? r.detail.label : r.status.label, group: r.group, method: METHOD[r.method] || null,
            cert: r.cert || null, certFrom: r.certFrom || null, sub: r.sub || null, autoDate: r.type === 'auto' && r.date?.at ? r.date : null,
            autoRenew: !!r.autoRenew, price: r.price || null, cost: r.cost || null, next: r.next?.cta ? { cta: r.next.cta, href: r.next.href } : null,
            facts: r.facts || null, synced: r.synced || null, canDownload: !!r.canDownload, tags: r.tags || []
          }))}
          admin={!!ctx.isAdmin}
          back={href(f)}
          empty={all.length ? 'none' : 'first'}
        />
      </main>
    </>
  );
}
