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
          <Link href="/#pki">PKI consulting</Link>
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

const FI = {
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3.6 9h16.8M3.6 15h16.8M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" /></>,
  shield: <><path d="M12 3 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6z" /><path d="m9 12 2 2 4-4" /></>
};
const Fi = ({ n }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{FI[n]}</svg>;

export function SiteFooter({ email, contact }) {
  const pki = email ? `mailto:${email}?subject=${encodeURIComponent('PKI consultation')}` : '/#pki';
  return (
    <footer className="ft">
      <div className="ft-edge" aria-hidden="true" />
      <div className="lp-wrap ft-in">
        <div className="ft-brand">
          <Link href="/" className="ft-logo" aria-label="CertDesk home">
            <span className="ft-mark" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" /><path d="m9 12 2 2 4-4" /></svg></span>
            CertDesk
          </Link>
          <p>SSL certificates, automation and PKI consulting in one place.</p>
          <ul className="ft-contact">
            {email ? <li><Fi n="mail" /><a href={`mailto:${email}`}>{email}</a></li> : null}
            <li><Fi n="clock" /><span>Support hours: Mon–Sat, IST (UTC+5:30)</span></li>
            <li><Fi n="globe" /><span>Serving customers worldwide</span></li>
          </ul>
          <span className="ft-k">Certificates from</span>
          <div className="ft-brands">
            {['digicert', 'sectigo', 'geotrust', 'thawte', 'rapidssl'].map((slug) => {
              const b = BRANDS.find((x) => x.slug === slug);
              return b ? <Link key={slug} href={`/ssl?brand=${slug}`} className="ft-ca" title={b.name}><BrandLogo slug={slug} name={b.name} height={16} /></Link> : null;
            })}
          </div>
        </div>

        <nav className="ft-col" aria-label="Certificates">
          <h4>Certificates</h4>
          <Link href="/ssl?type=dv">Domain SSL (DV)</Link>
          <Link href="/ssl?type=ov">Business SSL (OV)</Link>
          <Link href="/ssl?type=ev">Extended Validation</Link>
          <Link href="/ssl?type=wildcard">Wildcard SSL</Link>
          <Link href="/ssl?type=multi">Multi-domain SSL</Link>
          <Link href="/ssl?type=code">Code signing</Link>
          <Link href="/ssl?type=auto">Automated SSL</Link>
        </nav>

        <nav className="ft-col" aria-label="Tools">
          <h4>Tools</h4>
          <Link href="/finder">SSL Finder</Link>
          <Link href="/tools/csr">CSR generator</Link>
          <Link href="/tools/csr-decoder">CSR decoder</Link>
          <Link href="/tools/cert-decoder">Certificate decoder</Link>
          <Link href="/tools/ssl-checker">SSL checker</Link>
          <Link href="/tools/converter">Certificate converter</Link>
        </nav>

        <nav className="ft-col" aria-label="Services">
          <h4>Services</h4>
          <Link href="/#pki">PKI consulting</Link>
          <Link href="/#pki">DigiCert Trust Lifecycle Manager</Link>
          <Link href="/#automation">Certificate automation</Link>
          <a href={pki}>Book a consultation</a>
        </nav>

        <nav className="ft-col" aria-label="Help">
          <h4>Help</h4>
          <Link href="/#how">How it works</Link>
          <Link href="/#faq">FAQ</Link>
          <Link href="/ssl">All certificates</Link>
          {email ? <a href={`mailto:${email}`}>Contact support</a> : null}
        </nav>

        <nav className="ft-col" aria-label="Account">
          <h4>Account</h4>
          <a href="#signin" data-signin="">Sign in</a>
          <a href={contact}>Request an account</a>
        </nav>
      </div>

      <div className="lp-wrap ft-bottom">
        <span>© {new Date().getFullYear()} CertDesk. All rights reserved.</span>
        <span className="ft-trust"><Fi n="shield" />Certificates are issued by globally trusted certificate authorities.</span>
      </div>
    </footer>
  );
}
