import Link from 'next/link';
import BrandLogo from '@/components/site/BrandLogo';
import { BRANDS, brandOf } from '@/components/site/SiteChrome';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'dv', label: 'Domain (DV)' },
  { key: 'ov', label: 'Business (OV)' },
  { key: 'ev', label: 'Extended (EV)' },
  { key: 'wildcard', label: 'Wildcard' },
  { key: 'multi', label: 'Multi-domain' },
  { key: 'code', label: 'Code signing' },
  { key: 'auto', label: 'Automated' }
];

const LEVEL = { dv: 'DV', ov: 'OV', ev: 'EV', code: 'Code signing' };

function kindOf(p) {
  if (p.automation) return 'auto';
  if (p.validation === 'code') return 'code';
  return p.validation;
}

function matches(p, tab) {
  if (tab === 'all') return true;
  if (tab === 'wildcard') return p.wildcard && !p.automation;
  if (tab === 'multi') return p.multidomain && !p.automation;
  return kindOf(p) === tab;
}

function tags(p) {
  const t = [];
  if (p.automation) t.push('Automated');
  else t.push(LEVEL[p.validation] || String(p.validation || '').toUpperCase());
  if (p.wildcard) t.push('Wildcard');
  if (p.multidomain) t.push(p.san_max ? `Up to ${p.san_max} domains` : 'Multi-domain');
  return t;
}

/** Customer view of the order page while ordering is closed: every product, no prices, nothing to buy. */
export default function ComingSoonCatalogue({ products, tab = 'all', brand = '' }) {
  const counts = Object.fromEntries(TABS.map((t) => [t.key, products.filter((p) => matches(p, t.key)).length]));
  const list = products.filter((p) => matches(p, tab) && (!brand || brandOf(p).slug === brand));
  const groups = BRANDS.map((b) => ({ b, items: list.filter((p) => brandOf(p).slug === b.slug) })).filter((g) => g.items.length);
  const q = (o) => {
    const v = { type: tab, brand, ...o };
    const sp = new URLSearchParams();
    if (v.type && v.type !== 'all') sp.set('type', v.type);
    if (v.brand) sp.set('brand', v.brand);
    const str = sp.toString();
    return str ? `?${str}` : '/buy';
  };

  return (
    <main className="cx3-page cx3-wide">
      <section className="cs-hero">
        <div>
          <span className="cs-badge"><i />Coming soon</span>
          <h1>Ordering opens soon</h1>
          <p>Here is everything you will be able to order from this account: SSL/TLS certificates from every validation level, code signing and automated SSL. Prices and checkout will appear here when ordering opens. Until then, your existing certificates keep working and can be reissued as usual.</p>
        </div>
        <div className="cs-hero-stats">
          <span><b>{products.length}</b>products</span>
          <span><b>{groups.length || BRANDS.length}</b>brands</span>
          <span><b>{counts.code}</b>code signing</span>
        </div>
      </section>

      <nav className="cs-tabs" aria-label="Product type">
        {TABS.filter((t) => t.key === 'all' || counts[t.key]).map((t) => (
          <Link key={t.key} href={q({ type: t.key })} className={tab === t.key ? 'on' : ''} aria-current={tab === t.key ? 'page' : undefined}>
            {t.label}<em>{counts[t.key]}</em>
          </Link>
        ))}
      </nav>

      <div className="cs-brands">
        <Link href={q({ brand: '' })} className={!brand ? 'on' : ''}>All brands</Link>
        {BRANDS.filter((b) => products.some((p) => brandOf(p).slug === b.slug)).map((b) => (
          <Link key={b.slug} href={q({ brand: b.slug })} className={brand === b.slug ? 'on' : ''}>{b.name}</Link>
        ))}
      </div>

      {groups.length === 0 ? <div className="cx3-card cx3-pad"><p className="cx3-muted">No products in this view.</p></div> : groups.map(({ b, items }) => (
        <section key={b.slug} className="cs-group">
          <div className="cs-group-head">
            <span className="cs-logo"><BrandLogo slug={b.slug} name={b.name} height={22} /></span>
            <span className="cx3-muted">{items.length} product{items.length === 1 ? '' : 's'}</span>
          </div>
          <div className="cs-grid">
            {items.map((p) => (
              <article key={p.id} className={`cs-card k-${kindOf(p)}`}>
                <div className="cs-card-top">
                  <span className="cs-kind">{kindOf(p) === 'auto' ? 'AUTO' : kindOf(p) === 'code' ? 'CS' : String(p.validation).toUpperCase()}</span>
                  <span className="cs-soon">Coming soon</span>
                </div>
                <h3>{p.name}</h3>
                <div className="cs-tags">{tags(p).map((t) => <span key={t}>{t}</span>)}</div>
                <button type="button" className="cx3-btn sm cs-btn" disabled aria-disabled="true">Available soon</button>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
