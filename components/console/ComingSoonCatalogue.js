import Link from 'next/link';
import BrandLogo from '@/components/site/BrandLogo';
import { BRANDS, brandOf } from '@/components/site/SiteChrome';

const TABS = [
  { key: 'all', label: 'All products' },
  { key: 'dv', label: 'Domain (DV)' },
  { key: 'ov', label: 'Business (OV)' },
  { key: 'ev', label: 'Extended (EV)' },
  { key: 'wildcard', label: 'Wildcard' },
  { key: 'multi', label: 'Multi-domain' },
  { key: 'code', label: 'Code signing' },
  { key: 'auto', label: 'Automated' }
];

// Display order inside each brand, and what each level means.
const LEVELS = [
  { key: 'dv', label: 'Domain Validation', short: 'DV', speed: 'Issued in minutes', checks: 'Domain ownership' },
  { key: 'ov', label: 'Organisation Validation', short: 'OV', speed: 'Issued in 1–3 days', checks: 'Domain + company' },
  { key: 'ev', label: 'Extended Validation', short: 'EV', speed: 'Issued in 3–5 days', checks: 'Full legal entity' },
  { key: 'code', label: 'Code Signing', short: 'CS', speed: 'Issued in 1–5 days', checks: 'Publisher identity' },
  { key: 'auto', label: 'Automated SSL', short: 'AUTO', speed: 'Installs and renews itself', checks: 'Domain ownership' }
];
const LEVEL_OF = Object.fromEntries(LEVELS.map((l, i) => [l.key, { ...l, rank: i }]));

const ICON = {
  dv: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.6 9h16.8M3.6 15h16.8M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />,
  ov: <><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" /><path d="M16 9h2a2 2 0 0 1 2 2v10M2 21h20M8 7h4M8 11h4M8 15h4" /></>,
  ev: <><path d="M12 3 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6z" /><path d="m9 12 2 2 4-4" /></>,
  code: <><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 4l-4 16" /></>,
  auto: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
};
const Ico = ({ k }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[k]}</svg>;

const kindOf = (p) => (p.automation ? 'auto' : p.validation === 'code' ? 'code' : p.validation);
const shapeRank = (p) => (p.multidomain && p.wildcard ? 3 : p.multidomain ? 2 : p.wildcard ? 1 : 0);

function matches(p, tab) {
  if (tab === 'all') return true;
  if (tab === 'wildcard') return p.wildcard && !p.automation;
  if (tab === 'multi') return p.multidomain && !p.automation;
  return kindOf(p) === tab;
}

function features(p) {
  const k = kindOf(p);
  const f = [LEVEL_OF[k]?.speed];
  if (k === 'code') f.push(/ev/i.test(p.name) ? 'EV hardware token' : 'Sign apps, drivers and scripts');
  else if (k === 'auto') f.push('Agent or ACME client');
  else if (p.multidomain) f.push(p.san_max ? `Up to ${p.san_max} domains` : 'Several domains');
  else if (p.wildcard) f.push('All first-level subdomains');
  else f.push('One domain, www included');
  if (p.wildcard && p.multidomain) f.push('Wildcard names allowed');
  return f.filter(Boolean);
}

/** Customer view of the order page while ordering is closed: every product, no prices, nothing to buy. */
export default function ComingSoonCatalogue({ products, tab = 'all', brand = '' }) {
  const counts = Object.fromEntries(TABS.map((t) => [t.key, products.filter((p) => matches(p, t.key)).length]));
  const list = products.filter((p) => matches(p, tab) && (!brand || brandOf(p).slug === brand));
  const brandsWith = BRANDS.filter((b) => products.some((p) => brandOf(p).slug === b.slug));
  const groups = BRANDS.map((b) => {
    const items = list.filter((p) => brandOf(p).slug === b.slug)
      .sort((x, y) => (LEVEL_OF[kindOf(x)]?.rank ?? 9) - (LEVEL_OF[kindOf(y)]?.rank ?? 9) || shapeRank(x) - shapeRank(y) || x.name.localeCompare(y.name));
    const levels = LEVELS.map((l) => ({ l, items: items.filter((p) => kindOf(p) === l.key) })).filter((x) => x.items.length);
    return { b, items, levels };
  }).filter((g) => g.items.length);

  const href = (o) => {
    const v = { type: tab, brand, ...o };
    const sp = new URLSearchParams();
    if (v.type && v.type !== 'all') sp.set('type', v.type);
    if (v.brand) sp.set('brand', v.brand);
    const s = sp.toString();
    return s ? `/buy?${s}` : '/buy';
  };

  return (
    <main className="cx3-page cx3-wide cs">
      <section className="cs-hero">
        <div className="cs-hero-copy">
          <span className="cs-badge"><i />Coming soon</span>
          <h1>Certificate catalogue</h1>
          <p>Every SSL/TLS, code signing and automated certificate you will be able to order from this account. Prices and checkout open soon; your current certificates keep working and can be reissued as usual.</p>
        </div>
        <div className="cs-hero-logos" aria-label="Certificate authorities">
          {brandsWith.map((b) => (
            <Link key={b.slug} href={href({ brand: brand === b.slug ? '' : b.slug })} className={`cs-hero-logo ${brand === b.slug ? 'on' : ''}`} title={`${b.name} products`}>
              <BrandLogo slug={b.slug} name={b.name} height={20} />
            </Link>
          ))}
        </div>
      </section>

      <div className="cs-bar">
        <nav className="cs-tabs" aria-label="Product type">
          {TABS.filter((t) => t.key === 'all' || counts[t.key]).map((t) => (
            <Link key={t.key} href={href({ type: t.key })} className={tab === t.key ? 'on' : ''} aria-current={tab === t.key ? 'page' : undefined}>
              {t.key !== 'all' && LEVEL_OF[t.key] ? <Ico k={t.key} /> : null}{t.label}<em>{counts[t.key]}</em>
            </Link>
          ))}
        </nav>
        {brand ? <Link href={href({ brand: '' })} className="cs-clear">Showing {BRANDS.find((b) => b.slug === brand)?.name} · show all brands ×</Link> : null}
      </div>

      {groups.length === 0 ? <div className="cx3-card cx3-pad"><p className="cx3-muted">No products in this view.</p></div> : groups.map(({ b, items, levels }) => (
        <section key={b.slug} className="cs-brand">
          <header className="cs-brand-head">
            <span className="cs-brand-logo"><BrandLogo slug={b.slug} name={b.name} height={30} /></span>
            <div className="cs-brand-meta">
              <strong>{b.name}</strong>
              <span>{items.length} product{items.length === 1 ? '' : 's'} · {levels.map((x) => x.l.short).join(' · ')}</span>
            </div>
          </header>

          {levels.map(({ l, items: li }) => (
            <div key={l.key} className={`cs-level k-${l.key}`}>
              <div className="cs-level-head">
                <span className="cs-level-ico"><Ico k={l.key} /></span>
                <strong>{l.label}</strong>
                <span>{l.checks} · {l.speed.toLowerCase()}</span>
              </div>
              <div className="cs-grid">
                {li.map((p) => (
                  <article key={p.id} className={`cs-card k-${l.key}`}>
                    <div className="cs-card-top">
                      <span className="cs-card-logo"><BrandLogo slug={b.slug} name={b.name} height={14} /></span>
                      <span className="cs-soon">Coming soon</span>
                    </div>
                    <h3>{p.name.replace(new RegExp(`^${b.name}\\s+`, 'i'), '')}<small>{b.name}</small></h3>
                    <div className="cs-chips">
                      <span className="lvl">{l.short}</span>
                      {p.wildcard && !p.automation ? <span>Wildcard</span> : null}
                      {p.multidomain && !p.automation ? <span>Multi-domain</span> : null}
                    </div>
                    <ul className="cs-feat">{features(p).map((f) => <li key={f}>{f}</li>)}</ul>
                    <div className="cs-card-foot"><span className="cs-price">Price on launch</span><span className="cs-lock" aria-hidden="true">Available soon</span></div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
