import { requireAdmin } from '@/lib/auth';
import { q } from '@/lib/db';
import { syncCatalogueAction, setProductEnabled } from '@/app/actions/admin';
import TopBar from '@/components/TopBar';
import { Empty, FlashFromSearch, timeAgo } from '@/components/ui';

export const metadata = { title: 'Catalogue · CertDesk' };

const VAL = { dv: 'DV', ov: 'OV', ev: 'EV', code: 'Code signing' };

export default async function Catalogue({ searchParams }) {
  const sp = await searchParams;
  await requireAdmin();
  const products = await q('select * from console.products order by enabled desc, brand, validation, name');
  const enabled = products.filter((p) => p.enabled).length;
  const synced = products.reduce((m, p) => (!m || p.synced_at > m ? p.synced_at : m), null);
  return (
    <>
      <TopBar crumbs={[{ label: 'Partner account' }, { label: 'Catalogue' }]}>
        <form action={syncCatalogueAction}><button className="btn primary" type="submit">Sync from GoGetSSL</button></form>
      </TopBar>
      <main className="page">
        <div>
          <h1 className="title">Catalogue</h1>
          <p className="sub">Turn on the certificates customers can order. {products.length ? `${enabled} of ${products.length} on · synced ${timeAgo(synced)}` : ''}</p>
        </div>
        <FlashFromSearch searchParams={sp} />
        <div className="card">
          {products.length === 0 ? (
            <Empty title="No products yet">
              <span>Pull the product list from your GoGetSSL account.</span>
              <form action={syncCatalogueAction}><button className="btn primary" type="submit">Sync from GoGetSSL</button></form>
            </Empty>
          ) : (
            <div className="table-wrap">
              <table className="t" style={{ minWidth: 820 }}>
                <thead><tr><th>Offered</th><th>Product</th><th>Brand</th><th>Type</th><th>Periods</th><th>Partner price</th><th>ID</th></tr></thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <form action={setProductEnabled}>
                          <input type="hidden" name="product_id" value={p.id} />
                          <input type="hidden" name="enabled" value={p.enabled ? 'false' : 'true'} />
                          <button type="submit" className="switch" role="switch" aria-checked={p.enabled ? 'true' : 'false'} aria-label={`Offer ${p.name}`} />
                        </form>
                      </td>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td>{p.brand}</td>
                      <td>{VAL[p.validation] || p.validation}{p.wildcard ? ' · Wildcard' : ''}{p.multidomain ? ' · Multi-domain' : ''}</td>
                      <td>{(p.prices || []).map((x) => `${x.months}m`).join(', ') || '—'}</td>
                      <td className="mono">{(p.prices || [])[0] ? `${p.prices[0].price} / ${p.prices[0].months}m` : '—'}</td>
                      <td className="mono small muted">{p.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
