import { requireWorkspace } from '@/lib/auth';
import { q } from '@/lib/db';
import { getOrderForWorkspace } from '@/lib/orders';
import BuyWizard from './BuyWizard';
import TopBar from '@/components/TopBar';
import Link from 'next/link';
import Icon from '@/components/Icon';

export const metadata = { title: 'Buy certificate · CertDesk' };

export default async function BuyPage({ searchParams }) {
  const sp = await searchParams;
  const ctx = await requireWorkspace();
  const products = await q(
    `select id, name, brand, validation, wildcard, multidomain, san_included, san_max, prices
       from console.products where enabled order by validation, wildcard, multidomain, name`
  );
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
        tags: o.tags || []
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
      <TopBar crumbs={[{ label: ctx.workspace.name }, { label: renewal ? `Renew ${renewal.commonName}` : 'New certificate' }]}>
        <Link className="btn" href={renewal ? `/certificates/${renewal.id}` : '/'} aria-label="Close"><Icon name="x" />Close</Link>
      </TopBar>
      {products.length === 0 ? (
        <main className="page">
          <div className="card pad">
            <h1 className="title" style={{ fontSize: 22 }}>No certificates are available to order yet</h1>
            <p className="sub">{ctx.isAdmin ? 'Turn on products in Partner → Catalogue first.' : 'Your partner has not enabled any products for this workspace yet.'}</p>
            {ctx.isAdmin ? <Link className="btn primary" href="/partner/catalogue" style={{ marginTop: 12 }}>Open catalogue</Link> : null}
          </div>
        </main>
      ) : (
        <BuyWizard products={products} renewal={renewal} defaults={defaults} />
      )}
    </>
  );
}
