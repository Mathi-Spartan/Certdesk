import { requireAdmin } from '@/lib/auth';
import { q } from '@/lib/db';
import TopBar from '@/components/TopBar';
import { FlashFromSearch } from '@/components/ui';
import { savePrices } from '@/app/actions/pricing';

export const metadata = { title: 'Customer prices · CertDesk' };

export default async function Pricing({ searchParams }) {
  const sp = await searchParams;
  await requireAdmin();
  const workspaces = await q('select id, name from console.workspaces order by name');
  const ws = workspaces.find((w) => w.id === sp.ws) || null;
  const products = await q(`select id, name, brand, validation, prices from console.products where enabled order by brand, name`);
  const rows = await q(
    `select product_id, months, price, currency from console.customer_prices where coalesce(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce($1::uuid, '00000000-0000-0000-0000-000000000000'::uuid)`,
    [ws?.id || null]
  );
  const set = Object.fromEntries(rows.map((r) => [`${r.product_id}_${r.months}`, r]));
  const currency = rows[0]?.currency || 'USD';
  const terms = (p) => [...new Set((p.prices || []).map((x) => Number(x.months)).filter((m) => m > 0))].sort((a, b) => a - b);

  return (
    <>
      <TopBar crumbs={[{ label: 'Partner' }, { label: 'Customer prices' }]} />
      <main className="page">
        <div>
          <h1 className="title">Customer prices</h1>
          <p className="sub">What customers pay you. Customers see only these prices, never your GoGetSSL cost. A workspace price overrides the price for all customers. Leave a field empty for “price on request”.</p>
        </div>
        <FlashFromSearch searchParams={sp} />
        <form method="get" className="card pad" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ minWidth: 260 }}>
            <label htmlFor="ws">Prices for</label>
            <select className="input" id="ws" name="ws" defaultValue={ws?.id || ''}>
              <option value="">All customers (default)</option>
              {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <button className="btn" type="submit">Show</button>
        </form>
        {products.length === 0 ? <div className="card pad muted">Turn on products in Partner → Catalogue first.</div> : (
          <form action={savePrices} className="card">
            <input type="hidden" name="workspace_id" value={ws?.id || ''} />
            <div className="card-head" style={{ gap: 12, flexWrap: 'wrap' }}>
              <h2>{ws ? ws.name : 'All customers'} · {products.length} enabled products</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label className="small muted" htmlFor="cur">Currency</label>
                <select className="input" id="cur" name="currency" defaultValue={currency} style={{ height: 36, width: 100 }}>
                  {['USD', 'INR', 'EUR', 'GBP'].map((c) => <option key={c}>{c}</option>)}
                </select>
                <button className="btn primary" type="submit">Save prices</button>
              </div>
            </div>
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>Product</th><th>Prices by order term</th></tr></thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td><div style={{ fontWeight: 600 }}>{p.name}</div><div className="small muted">{p.brand} · {String(p.validation).toUpperCase()}</div></td>
                      <td>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {terms(p).map((m) => (
                            <label key={m} className="small" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <span className="muted">{m % 12 === 0 ? `${m / 12} yr` : `${m} mo`}</span>
                              <input className="input" name={`p_${p.id}_${m}`} inputMode="decimal" defaultValue={set[`${p.id}_${m}`]?.price ?? ''} placeholder="—" style={{ width: 100, height: 36 }} />
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </form>
        )}
      </main>
    </>
  );
}
