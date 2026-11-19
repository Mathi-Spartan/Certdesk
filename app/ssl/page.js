import Link from 'next/link';
import { getContext } from '@/lib/auth';
import { q } from '@/lib/db';
import { supportEmail } from '@/lib/support';
import SignInDialog from '@/components/SignInDialog';
import BrandLogo from '@/components/site/BrandLogo';
import { SiteHeader, SiteFooter, UtilityBar, BRANDS, TYPES, brandOf } from '@/components/site/SiteChrome';
import '../landing.css';

export const metadata = {
  title: 'All SSL & code signing certificates · CertDesk',
  description: 'DV, OV, EV, wildcard, multi-domain and code signing certificates from DigiCert, Sectigo, GeoTrust, Thawte, RapidSSL and more.'
};

const LEVEL = {
  dv: { label: 'DV', time: 'Minutes', checks: 'Domain only' },
  ov: { label: 'OV', time: '1–3 days', checks: 'Domain + company' },
  ev: { label: 'EV', time: '3–5 days', checks: 'Full legal entity' },
  code: { label: 'Code signing', time: '1–5 days', checks: 'Company or individual' }
};

const SECTIONS = [
  { key: 'dv', title: 'Domain Validation (DV)', text: 'Fast, low-cost encryption for websites, blogs and internal tools.' },
  { key: 'ov', title: 'Organisation Validation (OV)', text: 'Your company name is verified and shown in the certificate.' },
  { key: 'ev', title: 'Extended Validation (EV)', text: 'The strictest checks, for payments, banking and high-trust brands.' },
  { key: 'code', title: 'Code Signing', text: 'Sign software, drivers and scripts so users know they come from you.' },
  { key: 'auto', title: 'Automated SSL', text: 'Subscriptions that issue, install and renew certificates on their own.' }
];

const COMPARE = [
  ['What is checked', 'Domain only', 'Domain + company', 'Full legal entity'],
  ['Issued in', 'Minutes', '1–3 days', '3–5 days'],
  ['Company name in certificate', '—', '✓', '✓'],
  ['Best for', 'Blogs, tools, most sites', 'Business sites, portals', 'Payments, banking'],
  ['Wildcard available', '✓', '✓', '—']
];

function section(p) {
  if (p.automation) return 'auto';
  return p.validation;
}

function features(p) {
  const out = [];
  if (p.validation === 'code') {
    if (/\bev\b/i.test(p.name)) out.push('EV code signing');
    out.push('Windows, macOS, Java');
    return out;
  }
  if (p.automation) out.push(/acme|caas/i.test(p.name) ? 'Unlimited certificates' : 'Auto-install & renew');
  if (p.wildcard) out.push('Wildcard *.domain');
  if (p.multidomain) out.push(p.san_max ? `Up to ${p.san_max} domains` : 'Multiple domains');
  if (!p.wildcard && !p.multidomain && !p.automation) out.push('www + non-www');
  return out;
}

export default async function SslProducts({ searchParams }) {
  const sp = (await searchParams) || {};
  const [ctx, email, rows] = await Promise.all([
    getContext().catch(() => null),
    supportEmail().catch(() => null),
    q(`select id, name, brand, validation, wildcard, multidomain, san_max, automation, enabled from console.products order by name`).catch(() => [])
  ]);
  const signedIn = !!ctx;
  const consoleHref = ctx ? (ctx.isAdmin && !ctx.workspaceId ? '/partner' : '/order') : '#signin';
  const orderProps = signedIn ? { href: consoleHref } : { href: '#signin', 'data-signin': '' };
  const contact = email ? `mailto:${email}?subject=${encodeURIComponent('CertDesk account request')}` : '/';

  const products = rows
    .filter((p) => !/trial|intel vpro/i.test(p.name))
    .map((p) => ({ ...p, b: brandOf(p), sec: section(p) }));
  const brand = BRANDS.find((b) => b.slug === sp.brand) || null;
  const type = TYPES.find((t) => t.key === sp.type) || null;
  const term = String(sp.q || '').trim().toLowerCase();
  const shown = products.filter((p) => {
    if (brand && p.b.slug !== brand.slug) return false;
    if (type) {
      if (type.key === 'wildcard' && !p.wildcard) return false;
      if (type.key === 'multi' && !p.multidomain) return false;
      if (['dv', 'ov', 'ev', 'code', 'auto'].includes(type.key) && p.sec !== type.key) return false;
    }
    if (term && !p.name.toLowerCase().includes(term)) return false;
    return true;
  });
  const link = (patch) => {
    const params = { ...(brand ? { brand: brand.slug } : {}), ...(type ? { type: type.key } : {}), ...(term ? { q: term } : {}), ...patch };
    Object.keys(params).forEach((k) => params[k] == null && delete params[k]);
    const qs = new URLSearchParams(params).toString();
    return '/ssl' + (qs ? '?' + qs : '');
  };
  const countBrand = (slug) => products.filter((p) => p.b.slug === slug).length;
  const heading = [brand?.name, type?.label].filter(Boolean).join(' · ') || 'All SSL & code signing certificates';

  return (
    <div className="lp">
      <UtilityBar email={email} />
      <SiteHeader signedIn={signedIn} consoleHref={ctx ? (ctx.isAdmin && !ctx.workspaceId ? '/partner' : '/dashboard') : '#signin'} />

      <main id="main">
        <section className="lp-cat-hero">
          <div className="lp-wrap">
            <nav className="lp-crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/ssl">Certificates</Link>{brand || type ? <><span>/</span><strong>{heading}</strong></> : null}</nav>
            <div className="lp-cat-head">
              <div>
                {brand ? <div className="lp-cat-logo"><BrandLogo slug={brand.slug} name={brand.name} height={36} /></div> : null}
                <h1>{heading}</h1>
                <p>{shown.length} certificate{shown.length === 1 ? '' : 's'} from globally trusted certificate authorities. Pricing is coming soon; sign in to order.</p>
              </div>
              <form action="/ssl" className="lp-cat-search">
                {brand ? <input type="hidden" name="brand" value={brand.slug} /> : null}
                {type ? <input type="hidden" name="type" value={type.key} /> : null}
                <label className="lp-sr" htmlFor="ssl-q">Search certificates</label>
                <input id="ssl-q" name="q" type="search" defaultValue={term} placeholder="Search certificates, e.g. wildcard" />
                <button className="lp-btn lp-btn-primary" type="submit">Search</button>
              </form>
            </div>

            <div className="lp-filter-row" role="group" aria-label="Filter by brand">
              <Link href={link({ brand: null })} className={`lp-chip ${!brand ? 'on' : ''}`}>All brands</Link>
              {BRANDS.map((b) => (
                <Link key={b.slug} href={link({ brand: b.slug })} className={`lp-chip lp-chip-logo ${brand?.slug === b.slug ? 'on' : ''}`} aria-label={`${b.name} (${countBrand(b.slug)})`}>
                  <BrandLogo slug={b.slug} name={b.name} height={18} />
                  <span className="lp-chip-n">{countBrand(b.slug)}</span>
                </Link>
              ))}
            </div>
            <div className="lp-filter-row" role="group" aria-label="Filter by type">
              <Link href={link({ type: null })} className={`lp-chip ${!type ? 'on' : ''}`}>All types</Link>
              {TYPES.map((t) => (
                <Link key={t.key} href={link({ type: t.key })} className={`lp-chip ${type?.key === t.key ? 'on' : ''}`}>
                  <span aria-hidden="true">{t.icon}</span> {t.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {!brand && (!type || ['dv', 'ov', 'ev'].includes(type.key)) && !term ? (
          <section className="lp-wrap lp-compare">
            <h2>Compare validation levels</h2>
            <div className="lp-table-card">
              <table className="lp-table">
                <thead><tr><th /><th>DV<span>Domain</span></th><th>OV<span>Organisation</span></th><th>EV<span>Extended</span></th></tr></thead>
                <tbody>{COMPARE.map(([k, a, b, c]) => <tr key={k}><th scope="row">{k}</th><td>{a}</td><td>{b}</td><td>{c}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        ) : null}

        {shown.length === 0 ? (
          <div className="lp-wrap lp-empty">
            <p>No certificates match. <Link href="/ssl">See all certificates</Link></p>
          </div>
        ) : (
          SECTIONS.map((s) => {
            const list = shown.filter((p) => p.sec === s.key);
            if (!list.length) return null;
            return (
              <section key={s.key} className="lp-wrap lp-prod-section" id={s.key}>
                <div className="lp-prod-section-head">
                  <div>
                    <h2>{s.title}</h2>
                    <p>{s.text}</p>
                  </div>
                  <span className="lp-count">{list.length}</span>
                </div>
                <div className="lp-prod-grid">
                  {list.map((p) => {
                    const lv = LEVEL[p.validation] || LEVEL.dv;
                    return (
                      <article key={p.id} className="lp-prod">
                        <div className="lp-prod-top">
                          <span className="lp-prod-logo"><BrandLogo slug={p.b.slug} name={p.b.name} height={22} /></span>
                          <span className={`lp-level lp-level-${p.validation}`}>{p.automation ? 'Automated' : lv.label}</span>
                        </div>
                        <h3>{p.name}</h3>
                        <ul className="lp-ticks">
                          {features(p).map((f) => <li key={f}>{f}</li>)}
                          <li>{lv.checks}</li>
                        </ul>
                        <dl className="lp-prod-meta">
                          <div><dt>Issued in</dt><dd>{p.automation ? 'Continuous' : lv.time}</dd></div>
                          <div><dt>Price</dt><dd className="lp-muted">Coming soon</dd></div>
                        </dl>
                        <a {...orderProps} className="lp-btn lp-btn-ghost lp-btn-block">{signedIn ? 'Order in console' : 'Sign in to order'}</a>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}

        <section className="lp-final" style={{ marginTop: 40 }}>
          <div className="lp-wrap lp-final-in">
            <div>
              <h2>Not sure which certificate you need?</h2>
              <p>Tell us your domains and how you use them, and we&apos;ll recommend one.</p>
            </div>
            <div className="lp-cta">
              {email ? <a href={`mailto:${email}?subject=${encodeURIComponent('Which certificate do I need?')}`} className="lp-btn lp-btn-light lp-btn-lg">Ask us</a> : null}
              {!signedIn ? <a href="#signin" data-signin="" className="lp-btn lp-btn-outline-light lp-btn-lg">Sign in</a> : null}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter email={email} contact={contact} />
      {!signedIn ? <SignInDialog openOnLoad={sp.signin === '1'} contact={contact} /> : null}
    </div>
  );
}
