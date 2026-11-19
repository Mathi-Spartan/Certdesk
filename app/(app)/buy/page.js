import { requireWorkspace } from '@/lib/auth';
import { q } from '@/lib/db';
import { getOrderForWorkspace } from '@/lib/orders';
import BuyWizard from './BuyWizard';
import TopBar from '@/components/TopBar';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { customerPrices, fmtMoney } from '@/lib/pricing';
import { allowedProductIds, customerOrderingOpen } from '@/lib/ordering';
import { redirect } from 'next/navigation';
import { SUBSCRIPTION_PRODUCTS } from '@/lib/subscriptions';
import ComingSoonCatalogue from '@/components/console/ComingSoonCatalogue';

export const metadata = { title: 'Buy certificate · CertDesk' };

export default async function BuyPage({ searchParams }) {
  const sp = await searchParams;
  const ctx = await requireWorkspace();
  let rows;
  if (ctx.isAdmin || customerOrderingOpen()) {
    rows = await q(
      `select id, name, brand, validation, wildcard, multidomain, san_included, san_max, prices
         from console.products where enabled and not automation order by validation, wildcard, multidomain, name`
    );
  } else {
    // Customers: the master account decides which products they can order.
    const allowed = await allowedProductIds(ctx.workspaceId);
    let pick = Number(sp.product) || null;
    if (sp.renew && !pick) {
      const o = await getOrderForWorkspace(sp.renew, ctx.workspaceId);
      if (o && allowed.has(Number(o.product_id))) pick = Number(o.product_id);
    }
    if (pick && allowed.has(pick) && SUBSCRIPTION_PRODUCTS.some((p) => p.id === pick)) redirect(`/subscriptions/new?product=${pick}`);
    if (!pick || !allowed.has(pick)) {
      const all = await q('select id, name, brand, validation, wildcard, multidomain, san_max, automation, prices from console.products order by automation, validation, wildcard, multidomain, name');
      const mine = await customerPrices(ctx.workspaceId);
      const products = all.map(({ prices, ...p }) => {
        const vals = Object.values(mine[p.id] || {}).filter((v) => v && v.price > 0).sort((a, b) => a.price - b.price);
        return { ...p, orderable: allowed.has(Number(p.id)), fromPrice: vals[0] ? fmtMoney(vals[0].price, vals[0].currency) : null };
      });
      return <ComingSoonCatalogue products={products} tab={String(sp.type || 'all')} brand={String(sp.brand || '')} notice={sp.renew ? 'Renewing this certificate is not available on your account yet. Ask your provider.' : null} />;
    }
    rows = await q('select id, name, brand, validation, wildcard, multidomain, san_included, san_max, prices from console.products where id = $1 and not automation', [pick]);
  }
  const mine = await customerPrices(ctx.workspaceId);
  const products = rows.map(({ prices, ...p }) => ({
    ...p,
    prices: (prices || []).map((x) => ({ months: x.months, yours: mine[p.id]?.[x.months] || null }))
  }));
  let renewal = null;
  if (sp.renew) {
    const o = await getOrderForWorkspace(sp.renew, ctx.workspaceId);
    if (o) {
      renewal = {
        id: o.id,
        productId: o.product_id,
        commonName: o.common_name,
        sans: o.sans || [],
        period: o.period_months || 12,
        dcvMethod: String(o.dcv_method || 'dns').toLowerCase().includes('mail') ? 'dns' : String(o.dcv_method || 'dns').toLowerCase(),
        tags: o.tags || [],
        subscriptionEnds: o.order_expires_at || null,
        subscriptionDays: o.order_expires_at ? Math.ceil((new Date(o.order_expires_at) - Date.now()) / 86400000) : null
      };
    }
  }
  const contact = ctx.workspace.contact || {};
  const [first, ...rest] = String(ctx.user.name || '').split(' ');
  const defaults = {
    firstname: contact.firstname || first || '',
    lastname: contact.lastname || rest.join(' ') || '',
    email: contact.email || ctx.user.email,
    phone: contact.phone || '',
    title: contact.title || 'IT Manager',
    org: contact.org || {}
  };

  return (
    <>
      {ctx.isAdmin ? (
        <TopBar crumbs={[{ label: 'Order SSL', href: '/order' }, { label: renewal ? `Renew order · ${renewal.commonName}` : 'New certificate' }]}>
          <Link className="btn" href={renewal ? `/certificates/${renewal.id}` : '/dashboard'} aria-label="Close"><Icon name="x" />Close</Link>
        </TopBar>
      ) : null}
      {products.length === 0 ? (
        <main className="page">
          <div className="card pad">
            <h1 className="title" style={{ fontSize: 22 }}>No certificates are available to order yet</h1>
            <p className="sub">{ctx.isAdmin ? 'Turn on products in Partner → Catalogue first.' : 'Your partner has not enabled any products for this workspace yet.'}</p>
            {ctx.isAdmin ? <Link className="btn primary" href="/partner/catalogue" style={{ marginTop: 12 }}>Open catalogue</Link> : null}
          </div>
        </main>
      ) : (
        <>
          {renewal?.subscriptionDays > 60 ? (
            <div className="cx3-alert amber" style={{ margin: '16px 24px 0' }}>
              <div>
                <strong>No renewal needed yet.</strong> The subscription for {renewal.commonName} runs until{' '}
                {new Date(renewal.subscriptionEnds).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} ({renewal.subscriptionDays} days left).
                If the certificate is expiring, <Link href={`/certificates/${renewal.id}/reissue`}>reissue it free</Link> instead.
              </div>
            </div>
          ) : null}
          <BuyWizard products={products} renewal={renewal} defaults={defaults} />
        </>
      )}
    </>
  );
}
