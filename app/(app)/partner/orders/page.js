import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { q } from '@/lib/db';
import { importFromAccount, assignOrders, unassignOrders, bulkAutoRenew } from '@/app/actions/partner-orders';
import SubmitButton from '@/components/SubmitButton';
import { FlashFromSearch, fmtDate } from '@/components/ui';
import { SelectAll } from './BulkBar';
import { SubPeriod, CertExpiry } from '@/components/SubPeriod';
import { subscriptionOf, displayStatus } from '@/lib/orders';

export const metadata = { title: 'All orders · CertDesk' };
export const maxDuration = 300;

const VIEWS = [
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'all', label: 'All' }
];
const PER = 100;
const DAY = 86400000;

function tone(s) {
  if (s === 'issued') return 'ok';
  if (['validating', 'incomplete', 'reissuing'].includes(s)) return 'action';
  if (['cancelled', 'expired', 'rejected', 'cancel_requested', 'refunded'].includes(s)) return 'ended';
  return 'progress';
}
const label = (o) => o.gg_status_description || (o.status ? o.status[0].toUpperCase() + o.status.slice(1).replace(/_/g, ' ') : '—');

export default async function PartnerOrders({ searchParams }) {
  const sp = await searchParams;
  await requireAdmin();
  const view = VIEWS.some((v) => v.key === sp.view) ? sp.view : 'unassigned';
  const term = String(sp.q || '').trim().toLowerCase();
  const wsFilter = /^[0-9a-f-]{36}$/i.test(sp.ws || '') ? sp.ws : '';
  const page = Math.max(1, Number(sp.page) || 1);

  const where = ["o.status <> 'draft'"];
  const args = [];
  if (view === 'unassigned') where.push('o.workspace_id is null');
  if (view === 'assigned') where.push('o.workspace_id is not null');
  if (wsFilter) { args.push(wsFilter); where.push(`o.workspace_id = $${args.length}`); }
  if (term) {
    args.push(`%${term}%`);
    where.push(`(lower(coalesce(o.common_name,'')) like $${args.length} or lower(coalesce(o.product_name,'')) like $${args.length} or o.gg_order_id::text like $${args.length} or array_to_string(o.sans, ' ') ilike $${args.length})`);
  }
  const W = where.join(' and ');
  const [rows, [{ n }], counts, workspaces] = await Promise.all([
    q(`select o.*, w.name as ws_name from console.orders o left join console.workspaces w on w.id = o.workspace_id
        where ${W} order by o.created_at desc nulls last limit ${PER} offset ${(page - 1) * PER}`, args),
    q(`select count(*)::int as n from console.orders o where ${W}`, args),
    q(`select count(*) filter (where workspace_id is null)::int as unassigned, count(*) filter (where workspace_id is not null)::int as assigned, count(*)::int as all
         from console.orders where status <> 'draft'`),
    q('select id, name from console.workspaces order by name')
  ]);
  const c = counts[0];
  const pages = Math.max(1, Math.ceil(n / PER));
  const qs = (over) => {
    const p = new URLSearchParams({ view, ...(term ? { q: term } : {}), ...(wsFilter ? { ws: wsFilter } : {}), ...(page > 1 ? { page: String(page) } : {}), ...over });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return '/partner/orders?' + p.toString();
  };
  const keep = new URLSearchParams({ view, ...(term ? { q: term } : {}), ...(wsFilter ? { ws: wsFilter } : {}) }).toString();

  return (
    <main className="cx3-page">
      <div className="cx3-head">
        <div>
          <h1>All orders</h1>
          <p>Every order from your GoGetSSL account. Customers only see orders you assign to their workspace.</p>
        </div>
        <form action={importFromAccount}>
          <SubmitButton className="cx3-btn primary" pendingText="Importing from GoGetSSL… this can take a few minutes">Import from GoGetSSL</SubmitButton>
        </form>
      </div>
      <FlashFromSearch searchParams={sp} />

      <div className="cx3-tabs">
        {VIEWS.map((v) => (
          <Link key={v.key} href={qs({ view: v.key, page: '' , ws: v.key === 'unassigned' ? '' : wsFilter })} className={view === v.key ? 'on' : ''} aria-current={view === v.key ? 'page' : undefined}>
            {v.label}<span>{c[v.key]}</span>
          </Link>
        ))}
      </div>

      <form action="/partner/orders" className="cx3-filterbar" role="search">
        <input type="hidden" name="view" value={view} />
        <label className="cx3-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <span className="sr">Filter orders</span>
          <input type="search" name="q" defaultValue={term} placeholder="Domain, product or GoGetSSL order ID" />
        </label>
        {view !== 'unassigned' ? (
          <select name="ws" defaultValue={wsFilter} className="cx3-select" aria-label="Workspace">
            <option value="">All workspaces</option>
            {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        ) : null}
        <button className="cx3-btn" type="submit">Filter</button>
      </form>

      <form id="bulk" action={assignOrders} className="cx3-card cx3-bulkform">
        <input type="hidden" name="keep" value={keep} />
        <div className="cx3-bulkbar">
          <strong data-selcount>None selected</strong>
          <span className="cx3-bulk-sep" />
          <label className="sr" htmlFor="bulk-ws">Assign to workspace</label>
          <select id="bulk-ws" name="workspace_id" className="cx3-select dark" defaultValue="">
            <option value="" disabled>Assign to workspace…</option>
            {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <button type="submit" className="cx3-btn sm light" data-needsel disabled>Assign selected</button>
          <button type="submit" formAction={bulkAutoRenew} name="auto_on" value="true" className="cx3-btn sm ghostdark" data-needsel disabled>Auto-renew on</button>
          <button type="submit" formAction={bulkAutoRenew} name="auto_on" value="false" className="cx3-btn sm ghostdark" data-needsel disabled>Auto-renew off</button>
          {view !== 'unassigned' ? <button type="submit" formAction={unassignOrders} className="cx3-btn sm ghostdark" data-needsel disabled>Move back to partner account</button> : null}
          <span className="cx3-bulk-info">{n} order{n === 1 ? '' : 's'} in this view</span>
        </div>
        {rows.length === 0 ? (
          <div className="cx3-none">
            <strong>{c.all === 0 ? 'No orders yet' : 'No orders in this view'}</strong>
            {c.all === 0 ? <span>Use “Import from GoGetSSL” to bring in every order from your account.</span> : <Link href="/partner/orders?view=all">Show all orders</Link>}
          </div>
        ) : (
          <div className="cx3-table-wrap">
            <table className="cx3-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}><SelectAll formId="bulk" /></th>
                  <th>Common name</th><th>Product</th><th>Status</th><th>Certificate expires</th><th>Subscription</th><th>Auto-renew</th><th>Workspace</th><th>Ordered</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const days = o.valid_till ? Math.ceil((new Date(o.valid_till) - Date.now()) / DAY) : null;
                  return (
                    <tr key={o.id} data-row>
                      <td><input type="checkbox" name="ids" value={o.id} aria-label={`Select ${o.common_name || o.gg_order_id}`} /></td>
                      <td>
                        <span className="cx3-cn">{o.common_name || '—'}</span>
                        <div className="cx3-sub">#{o.gg_order_id}{o.sans?.length ? ` · +${o.sans.length} names` : ''}</div>
                      </td>
                      <td><div>{o.product_name || (o.product_id ? `Product ${o.product_id}` : '—')}</div>{o.period_months ? <div className="cx3-sub">{o.period_months % 12 === 0 ? `${o.period_months / 12} yr` : `${o.period_months} mo`}</div> : null}</td>
                      <td><span className={`cx3-pill ${tone(o.status)}`}>{['issued', 'expired', 'validating', 'incomplete'].includes(o.status) ? displayStatus(o).label : label(o)}</span></td>
                      <td>{o.valid_till ? <CertExpiry at={o.valid_till} days={days} hot={days !== null && days <= 30 && !['cancelled', 'expired'].includes(o.status)} /> : <span className="cx3-sub">—</span>}</td>
                      <td>{o.status === 'cancelled' ? <span className="cx3-sub">—</span> : <SubPeriod sub={subscriptionOf(o)} />}</td>
                      <td><span className={`cx3-flag ${o.auto_renew ? 'on' : ''}`}>{o.auto_renew ? 'On' : 'Off'}</span></td>
                      <td>{o.ws_name ? <Link href={`/partner/workspaces/${o.workspace_id}`} className="cx3-wslink">{o.ws_name}</Link> : <span className="cx3-flag">Unassigned</span>}</td>
                      <td className="cx3-sub">{fmtDate(o.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </form>

      {pages > 1 ? (
        <nav className="cx3-pager" aria-label="Pages">
          {page > 1 ? <Link className="cx3-btn sm" href={qs({ page: String(page - 1) })}>← Previous</Link> : <span />}
          <span className="cx3-muted">Page {page} of {pages}</span>
          {page < pages ? <Link className="cx3-btn sm" href={qs({ page: String(page + 1) })}>Next →</Link> : <span />}
        </nav>
      ) : null}
    </main>
  );
}
