import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { q, one } from '@/lib/db';
import { saveWorkspaceProducts } from '@/app/actions/admin';
import TopBar from '@/components/TopBar';
import SubmitButton from '@/components/SubmitButton';
import BrandLogo from '@/components/site/BrandLogo';
import { BRANDS, brandOf } from '@/components/site/SiteChrome';
import { FlashFromSearch } from '@/components/ui';
import { GroupToggle, Counter } from './Pickers';

export const metadata = { title: 'Products for sale · CertDesk' };

const LEVELS = [['dv', 'DV'], ['ov', 'OV'], ['ev', 'EV'], ['code', 'Code signing'], ['auto', 'Automated']];
const kindOf = (p) => (p.automation ? 'auto' : p.validation === 'code' ? 'code' : p.validation);

export default async function WorkspaceProducts({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ws = await one('select id, name, contact_email from console.workspaces where id = $1', [id]);
  if (!ws) notFound();
  const [products, picked] = await Promise.all([
    q('select id, name, brand, validation, wildcard, multidomain, san_max, automation from console.products order by name'),
    q('select product_id from console.workspace_products where workspace_id = $1', [id])
  ]);
  const on = new Set(picked.map((r) => Number(r.product_id)));
  const rank = Object.fromEntries(LEVELS.map(([k], i) => [k, i]));
  const groups = BRANDS.map((b) => ({
    b,
    items: products.filter((p) => brandOf(p).slug === b.slug).sort((x, y) => (rank[kindOf(x)] ?? 9) - (rank[kindOf(y)] ?? 9) || x.name.localeCompare(y.name))
  })).filter((g) => g.items.length);

  return (
    <>
      <TopBar crumbs={[{ label: 'Customer workspaces', href: '/partner' }, { label: ws.name, href: `/partner/workspaces/${ws.id}` }, { label: 'Products for sale' }]} />
      <main className="cx3-page cx3-wide">
        <div className="cx3-head">
          <div>
            <h1>Products {ws.name} can order</h1>
            <p>Tick the certificates this customer can buy. They see them as <b>Available</b> with an Order button; everything else stays <b>Coming soon</b>. Prices come from Customer prices.</p>
          </div>
          <Link className="cx3-btn" href={`/partner/workspaces/${ws.id}`}>Back to workspace</Link>
        </div>
        <FlashFromSearch searchParams={sp} />

        <form action={saveWorkspaceProducts} id="wp-form" className="wp">
          <input type="hidden" name="workspace_id" value={ws.id} />
          <div className="wp-bar">
            <Counter formId="wp-form" total={products.length} />
            <div className="cx3-row">
              <GroupToggle formId="wp-form" group="all" label="Select all" />
              <GroupToggle formId="wp-form" group="all" label="Clear all" off />
              <SubmitButton className="cx3-btn primary" pendingText="Saving…">Save products</SubmitButton>
            </div>
          </div>

          {groups.map(({ b, items }) => (
            <section key={b.slug} className="wp-brand">
              <header>
                <span className="cs-brand-logo"><BrandLogo slug={b.slug} name={b.name} height={26} /></span>
                <strong>{b.name}</strong>
                <span className="cx3-muted">{items.length} products</span>
                <div className="cx3-row" style={{ marginLeft: 'auto' }}>
                  {LEVELS.filter(([k]) => items.some((p) => kindOf(p) === k)).map(([k, l]) => (
                    <GroupToggle key={k} formId="wp-form" group={`${b.slug}-${k}`} label={`+ ${l}`} small />
                  ))}
                  <GroupToggle formId="wp-form" group={b.slug} label={`All ${b.name}`} small />
                </div>
              </header>
              <div className="wp-grid">
                {items.map((p) => (
                  <label key={p.id} className={`wp-item k-${kindOf(p)}`}>
                    <input type="checkbox" name="product_id" value={p.id} defaultChecked={on.has(Number(p.id))} data-group={`all ${b.slug} ${b.slug}-${kindOf(p)}`} />
                    <span className="wp-box" aria-hidden="true" />
                    <span className="wp-txt">
                      <strong>{p.name}</strong>
                      <small>
                        <i className="lvl">{kindOf(p) === 'auto' ? 'AUTO' : kindOf(p) === 'code' ? 'CS' : String(p.validation).toUpperCase()}</i>
                        {p.wildcard ? ' · Wildcard' : ''}{p.multidomain ? ` · ${p.san_max ? `up to ${p.san_max} domains` : 'multi-domain'}` : ''}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          ))}

          <div className="wp-bar bottom">
            <Counter formId="wp-form" total={products.length} />
            <SubmitButton className="cx3-btn primary" pendingText="Saving…">Save products</SubmitButton>
          </div>
        </form>
      </main>
    </>
  );
}
