import { requireAdmin } from '@/lib/auth';
import * as gg from '@/lib/gogetssl';
import { balanceStatus, rowsOf, settle } from '@/lib/billing';
import { saveBillingSettings } from '@/app/actions/admin';
import TopBar from '@/components/TopBar';
import { FlashFromSearch } from '@/components/ui';

export const metadata = { title: 'Billing · CertDesk' };
export const dynamic = 'force-dynamic';

function money(v, cur = 'USD') {
  const n = Number(v);
  if (!Number.isFinite(n)) return v ?? '—';
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n); } catch { return `${n} ${cur}`; }
}

const PREFERRED = ['id', 'invoice_id', 'order_id', 'number', 'date', 'date_created', 'created', 'due_date', 'product', 'product_name', 'domain', 'subtotal', 'total', 'amount', 'status', 'type', 'description'];
const LABEL = (k) => k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

function DataTable({ rows, empty, max = 50 }) {
  if (!rows.length) return <p className="cx3-muted" style={{ margin: 0 }}>{empty}</p>;
  const keys = [...new Set(rows.slice(0, 20).flatMap((r) => Object.keys(r || {})))].filter((k) => {
    const v = rows[0]?.[k];
    return v === null || ['string', 'number', 'boolean'].includes(typeof v);
  });
  const cols = [...PREFERRED.filter((k) => keys.includes(k)), ...keys.filter((k) => !PREFERRED.includes(k))].slice(0, 7);
  return (
    <div className="bl-wrap">
      <table className="bl-table">
        <thead><tr>{cols.map((k) => <th key={k}>{LABEL(k)}</th>)}</tr></thead>
        <tbody>
          {rows.slice(0, max).map((r, i) => (
            <tr key={i}>{cols.map((k) => <td key={k} data-k={LABEL(k)}>{String(r?.[k] ?? '—')}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {rows.length > max ? <p className="cx3-muted">Showing the latest {max} of {rows.length}.</p> : null}
    </div>
  );
}

function Count({ res }) {
  if (res.error) return <span className="cx3-muted">—</span>;
  const d = res.data || {};
  const n = d.total ?? d.total_orders ?? d.count ?? d.total_transactions ?? d.amount ?? Object.values(d).find((v) => typeof v === 'number' || /^\d+(\.\d+)?$/.test(String(v)));
  return <b>{n ?? '—'}</b>;
}

export default async function Billing({ searchParams }) {
  const sp = await searchParams;
  await requireAdmin();
  const [bal, unpaidInv, invoices, unpaidOrders, totalOrders, totalTx] = await Promise.all([
    balanceStatus({ fresh: true }),
    settle(gg.getUnpaidInvoices),
    settle(gg.getInvoices),
    settle(gg.getUnpaidOrders),
    settle(gg.getTotalOrders),
    settle(gg.getTotalTransactions)
  ]);
  const unpaidInvRows = rowsOf(unpaidInv.data);
  const invRows = rowsOf(invoices.data);
  const unpaidOrderRows = rowsOf(unpaidOrders.data);
  return (
    <>
      <TopBar crumbs={[{ label: 'Partner account' }, { label: 'Billing' }]} />
      <main className="page">
        <div>
          <h1 className="title">Billing</h1>
          <p className="sub">Your GoGetSSL reseller balance, invoices and unpaid orders. Orders fail when the balance runs out, so set an alert below.</p>
        </div>
        <FlashFromSearch searchParams={sp} />

        <div className="bl-kpis">
          <section className={`cx3-card cx3-pad bl-kpi ${bal.low ? 'low' : ''}`}>
            <span className="bl-k">Balance</span>
            <b className="bl-big">{bal.error ? '—' : money(bal.amount, bal.currency)}</b>
            <span className="cx3-muted">{bal.error ? `Could not load: ${bal.error}` : bal.low ? `Below your alert of ${money(bal.threshold, bal.currency)}. Top up in GoGetSSL.` : bal.threshold !== null ? `Alert below ${money(bal.threshold, bal.currency)}` : 'No low-balance alert set'}</span>
          </section>
          <section className="cx3-card cx3-pad bl-kpi"><span className="bl-k">Unpaid invoices</span><b className="bl-big">{unpaidInv.error ? '—' : unpaidInvRows.length}</b><span className="cx3-muted">{unpaidInv.error ? unpaidInv.error : 'Waiting for payment'}</span></section>
          <section className="cx3-card cx3-pad bl-kpi"><span className="bl-k">Total orders</span><span className="bl-big"><Count res={totalOrders} /></span><span className="cx3-muted">{totalOrders.error || 'All time, GoGetSSL account'}</span></section>
          <section className="cx3-card cx3-pad bl-kpi"><span className="bl-k">Total transactions</span><span className="bl-big"><Count res={totalTx} /></span><span className="cx3-muted">{totalTx.error || 'All time'}</span></section>
        </div>

        <section className="cx3-card cx3-pad bl-sec">
          <h2>Low-balance alert</h2>
          <form action={saveBillingSettings} className="bl-form">
            <label className="cx3-field"><span>Alert me when the balance is below ({bal.currency || 'USD'})</span><input name="threshold" type="number" min="0" step="1" defaultValue={bal.threshold ?? ''} placeholder="e.g. 100" /></label>
            <button className="cx3-btn primary" type="submit">Save</button>
          </form>
          <p className="cx3-muted" style={{ margin: 0 }}>The alert shows at the top of your partner pages. Leave it empty to turn it off.</p>
        </section>

        <section className="cx3-card cx3-pad bl-sec">
          <h2>Unpaid orders</h2>
          {unpaidOrders.error ? <p className="cx3-muted">{unpaidOrders.error}</p> : <DataTable rows={unpaidOrderRows} empty="No unpaid orders." />}
        </section>

        <section className="cx3-card cx3-pad bl-sec">
          <h2>Unpaid invoices</h2>
          {unpaidInv.error ? <p className="cx3-muted">{unpaidInv.error}</p> : <DataTable rows={unpaidInvRows} empty="No unpaid invoices." />}
        </section>

        <section className="cx3-card cx3-pad bl-sec">
          <h2>All invoices</h2>
          {invoices.error ? <p className="cx3-muted">{invoices.error}</p> : <DataTable rows={[...invRows].reverse()} empty="No invoices yet." />}
        </section>
      </main>
    </>
  );
}
