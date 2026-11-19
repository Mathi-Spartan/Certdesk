import Link from 'next/link';
import BrandLogo from './BrandLogo';

export const BRANDS = [
  { slug: 'digicert', name: 'DigiCert', match: ['digicert'] },
  { slug: 'sectigo', name: 'Sectigo', match: ['sectigo'] },
  { slug: 'comodo', name: 'Comodo', match: ['comodo', 'positivessl', 'essential', 'instantssl'] },
  { slug: 'geotrust', name: 'GeoTrust', match: ['geotrust'] },
  { slug: 'thawte', name: 'Thawte', match: ['thawte'] },
  { slug: 'rapidssl', name: 'RapidSSL', match: ['rapidssl'] },
  { slug: 'gogetssl', name: 'GoGetSSL', match: ['gogetssl'] }
];

/** Which brand a product shows under. Comodo-branded Sectigo products (PositiveSSL, EssentialSSL, InstantSSL) go under Comodo. */
export function brandOf(p) {
  const s = `${p.name} ${p.brand}`.toLowerCase();
  for (const b of ['gogetssl', 'digicert', 'geotrust', 'thawte', 'rapidssl']) if (s.includes(b)) return BRANDS.find((x) => x.slug === b);
  if (/positivessl|essential|instantssl|comodo/.test(s)) return BRANDS.find((x) => x.slug === 'comodo');
  return BRANDS.find((x) => x.slug === 'sectigo');
}

export const TYPES = [
  { key: 'dv', label: 'Domain Validation', short: 'DV', icon: '🌐', note: 'Issued in minutes' },
  { key: 'ov', label: 'Organisation Validation', short: 'OV', icon: '🏢', note: 'Company verified' },
  { key: 'ev', label: 'Extended Validation', short: 'EV', icon: '🛡️', note: 'Highest trust' },
  { key: 'wildcard', label: 'Wildcard', short: '*.', icon: '✳️', note: 'All subdomains' },
  { key: 'multi', label: 'Multi-Domain (SAN)', short: 'SAN', icon: '🔗', note: 'Many domains, one cert' },
  { key: 'code', label: 'Code Signing', short: 'CS', icon: '✍️', note: 'Sign software and drivers' },
  { key: 'auto', label: 'Automated SSL', short: 'AUTO', icon: '⚡', note: 'Renews by itself' }
];

export function SiteHeader({ signedIn, consoleHref }) {
  const consoleProps = signedIn ? { href: consoleHref } : { href: '#signin', 'data-signin': '' };
  return (
    <header className="lp-head">
      <div className="lp-wrap lp-head-in">
        <Link href="/" className="lp-brand" aria-label="CertDesk home">
          <span className="lp-logo" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" /><path d="m9 12 2 2 4-4" /></svg>
          </span>
          <span>
            <span className="lp-brand-name">CertDesk</span>
            <span className="lp-brand-tag">Certificate lifecycle console</span>
          </span>
        </Link>
        <nav className="lp-nav" aria-label="Main">
          <Link href="/ssl">Certificates</Link>
          <div className="lp-menu">
            <button type="button" aria-haspopup="true">Brands <span aria-hidden="true">▾</span></button>
            <div className="lp-menu-panel lp-menu-brands">
              {BRANDS.map((b) => (
                <Link key={b.slug} href={`/ssl?brand=${b.slug}`} className="lp-brand-tile" aria-label={`${b.name} certificates`}>
                  <BrandLogo slug={b.slug} name={b.name} height={24} />
                </Link>
              ))}
            </div>
          </div>
          <div className="lp-menu">
            <button type="button" aria-haspopup="true">Types <span aria-hidden="true">▾</span></button>
            <div className="lp-menu-panel lp-menu-types">
              {TYPES.map((t) => (
                <Link key={t.key} href={`/ssl?type=${t.key}`}>
                  <span className="lp-type-icon" aria-hidden="true">{t.icon}</span>
                  <span><strong>{t.label}</strong><span>{t.note}</span></span>
                </Link>
              ))}
            </div>
          </div>
          <Link href="/finder" className="lp-nav-new">SSL Finder</Link>
          <Link href="/#automation">Automation</Link>
        </nav>
        <div className="lp-head-actions">
          {signedIn ? null : <a href="#signin" data-signin="" className="lp-link">Sign in</a>}
          <a {...consoleProps} className="lp-btn lp-btn-primary">{signedIn ? 'Open console' : 'Get started'}</a>
        </div>
      </div>
    </header>
  );
}

export function UtilityBar({ email }) {
  return (
    <div className="lp-util">
      <div className="lp-wrap lp-util-in">
        <span>SSL certificates and automation, managed in one console</span>
        <nav aria-label="Utility">
          <Link href="/ssl">All certificates</Link>
          <Link href="/#how">How it works</Link>
          <Link href="/#faq">FAQ</Link>
          {email ? <a href={`mailto:${email}`}>Support</a> : null}
        </nav>
      </div>
    </div>
  );
}

export function SiteFooter({ email, contact }) {
  return (
    <footer className="lp-foot">
      <div className="lp-wrap lp-foot-in">
        <div>
          <div className="lp-brand-name" style={{ color: '#fff' }}>CertDesk</div>
          <p>Certificate lifecycle console for SSL/TLS, code signing and automated subscriptions.</p>
        </div>
        <div>
          <h4>Certificates</h4>
          <Link href="/ssl?type=dv">Domain Validation</Link>
          <Link href="/ssl?type=ov">Organisation Validation</Link>
          <Link href="/ssl?type=ev">Extended Validation</Link>
          <Link href="/ssl?type=code">Code Signing</Link>
        </div>
        <div>
          <h4>Brands</h4>
          {BRANDS.slice(0, 5).map((b) => <Link key={b.slug} href={`/ssl?brand=${b.slug}`}>{b.name}</Link>)}
        </div>
        <div>
          <h4>Account</h4>
          <a href="#signin" data-signin="">Sign in</a>
          <a href={contact}>Request an account</a>
          {email ? <a href={`mailto:${email}`}>Support</a> : null}
        </div>
      </div>
      <div className="lp-wrap lp-copy">© {new Date().getFullYear()} CertDesk. Certificates are issued by globally trusted certificate authorities.</div>
    </footer>
  );
}
