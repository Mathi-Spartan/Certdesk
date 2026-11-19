import Link from 'next/link';
import { getContext } from '@/lib/auth';
import { q } from '@/lib/db';
import { supportEmail } from '@/lib/support';
import SignInDialog from '@/components/SignInDialog';
import { SiteHeader, SiteFooter, UtilityBar, BRANDS, brandOf } from '@/components/site/SiteChrome';
import BrandLogo from '@/components/site/BrandLogo';
import './landing.css';

export const metadata = {
  title: 'CertDesk · SSL certificates and automation in one console',
  description: 'Order, validate, install and renew SSL/TLS certificates from one console. DV, OV, EV, wildcard and multi-domain, plus Plan + Automate and ACME subscriptions.'
};

const LEVELS = [
  {
    tag: 'DV',
    title: 'Domain Validation',
    text: 'For blogs, portfolios, internal tools and most websites.',
    points: ['Issued in minutes', 'DNS, HTTP or email validation', 'Single, wildcard or multi-domain'],
    time: 'Minutes'
  },
  {
    tag: 'OV',
    title: 'Organisation Validation',
    text: 'For business sites that need the company named in the certificate.',
    points: ['Company verified by the CA', 'Organisation details in the certificate', 'Good for portals and APIs'],
    time: '1–3 days'
  },
  {
    tag: 'EV',
    title: 'Extended Validation',
    text: 'For banking, payments and high-trust brands.',
    points: ['Strictest company checks', 'Highest assurance level', 'Ideal for checkout and login pages'],
    time: '3–7 days'
  }
];

const STEPS = [
  ['Order', 'Pick a certificate or an automated subscription.'],
  ['Create the key', 'Generate it in your browser, or paste a CSR from your server.'],
  ['Validate', 'Add one DNS record or upload a file. We guide every step.'],
  ['Issued', 'The CA issues the certificate, often within minutes.'],
  ['Install & reissue', 'Download for your server. Reissue free while the order runs.']
];

const FEATURES = [
  ['▦', 'One dashboard', 'Every certificate and subscription in one list, with what needs you at the top.'],
  ['🔑', 'Key in your browser', 'Create the private key and CSR on your own machine. The key never leaves it.'],
  ['✓', 'Guided validation', 'Exact DNS records and files to add, with checks before you order.'],
  ['⟳', 'Reissue reminders', 'Know when a certificate needs reissuing or an order needs renewing, well before it expires.'],
  ['⚡', 'Automation ready', 'Plan + Automate and ACME subscriptions renew and install certificates on their own.'],
  ['👥', 'Managed accounts', 'Your provider sets you up and can assign existing orders to your account.']
];

const COMPARE = [
  ['Who renews it', 'You reissue and renew from the console', 'Renews and reissues automatically'],
  ['Who installs it', 'You download and install it', 'AutoInstall agent or your ACME client'],
  ['Domains', 'Single, wildcard or multi-domain', 'One per plan, or many with ACME CaaS'],
  ['Best for', 'A few sites with manual control', 'Many sites and 100-day certificates']
];

const FAQ = [
  ['Who can use CertDesk?', 'CertDesk accounts are created by your SSL provider. Once you have one, sign in with your email and password to manage and order certificates.'],
  ['How fast is a DV certificate issued?', 'Usually within minutes of passing validation. Add the DNS record or file we show you and the certificate is issued as soon as the CA sees it.'],
  ['Do you see my private key?', 'No. When you create the key in the browser it is generated on your computer and downloaded straight to you. Only the CSR is sent to the CA.'],
  ['What is the difference between reissue and renew?', 'A certificate inside an active order can be reissued free of charge as often as you need. When the order itself ends, you renew by placing a new order.'],
  ['What changes with 100-day certificates?', 'From 15 March 2027 public certificates last at most 100 days, so they need replacing about every three months. Automated subscriptions handle that for you.'],
  ['Plan + Automate or ACME CaaS?', 'Plan + Automate covers one domain and can install certificates for you with the AutoInstall agent. ACME CaaS covers many domains for your own ACME client.']
];

const VLABEL = { dv: 'DV', ov: 'OV', ev: 'EV' };

export default async function Landing({ searchParams }) {
  const sp = (await searchParams) || {};
  const [ctx, products, email] = await Promise.all([
    getContext().catch(() => null),
    q(`select name, brand, validation, wildcard, multidomain from console.products where enabled order by validation, wildcard, name limit 5`).catch(() => []),
    supportEmail().catch(() => null)
  ]);
  const allProducts = await q(`select name, brand from console.products where not automation`).catch(() => []);
  const byBrand = {};
  for (const p of allProducts) { const b = brandOf(p).slug; byBrand[b] = (byBrand[b] || 0) + 1; }
  const totalProducts = allProducts.length;
  const signedIn = !!ctx;
  const consoleHref = ctx ? (ctx.isAdmin && !ctx.workspaceId ? '/partner' : '/dashboard') : '#signin';
  // signed out: these open the sign-in dialog instead of navigating
  const consoleProps = signedIn ? { href: consoleHref } : { href: '#signin', 'data-signin': '' };
  const contact = email ? `mailto:${email}?subject=${encodeURIComponent('CertDesk account request')}` : '#faq';
  const picks = [
    ...products.map((p) => ({ name: p.name, kind: `${VLABEL[p.validation] || 'SSL'}${p.wildcard ? ' · Wildcard' : p.multidomain ? ' · Multi-domain' : ''}`, note: p.validation === 'dv' ? 'Minutes' : 'Days' })),
    { name: 'Plan + Automate', kind: 'Automated · 1 domain', note: 'Auto-renews' },
    { name: 'ACME Certificate-as-a-Service', kind: 'Automated · many domains', note: 'Unlimited' }
  ].slice(0, 6);

  return (
    <div className="lp">
      <a className="lp-skip" href="#main">Skip to content</a>
      <UtilityBar email={email} />
      <SiteHeader signedIn={signedIn} consoleHref={consoleHref} />

      <main id="main">
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-in">
            <div className="lp-hero-text">
              <p className="lp-eyebrow">Trusted TLS from {BRANDS.slice(0, 6).map((c) => c.name).join(' · ')}</p>
              <h1>SSL certificates, issued and managed from one clean console.</h1>
              <p className="lp-lead">
                Order DV, OV, EV, wildcard and multi-domain certificates, follow guided validation, and keep every
                certificate&apos;s reissue and renewal dates in view. Or let an automated subscription do it all for you.
              </p>
              <div className="lp-cta">
                <a {...consoleProps} className="lp-btn lp-btn-primary lp-btn-lg">{signedIn ? 'Open your console' : 'Sign in to your console'}</a>
                <Link href="/ssl" className="lp-btn lp-btn-ghost lp-btn-lg">Browse all certificates</Link>
              </div>
              <ul className="lp-badges">
                <li><span className="lp-dot" />256-bit encryption</li>
                <li><span className="lp-dot" />99.9% browser trust</li>
                <li><span className="lp-dot" />Minutes for DV issuance</li>
                <li><span className="lp-dot" />Key stays on your machine</li>
              </ul>
            </div>

            <aside className="lp-panel" aria-label="Popular certificates">
              <div className="lp-panel-head">
                <span>Popular in the console</span>
                <span className="lp-panel-note">Issuance time</span>
              </div>
              <ul className="lp-panel-list">
                {picks.map((p) => (
                  <li key={p.name}>
                    <span>
                      <span className="lp-panel-name">{p.name}</span>
                      <span className="lp-panel-kind">{p.kind}</span>
                    </span>
                    <span className="lp-panel-time">{p.note}</span>
                  </li>
                ))}
              </ul>
              <a {...consoleProps} className="lp-btn lp-btn-primary lp-btn-block">{signedIn ? 'Order in the console →' : 'Sign in to see pricing & order →'}</a>
              <p className="lp-panel-foot">Pricing is set by your provider and shown after sign-in.</p>
            </aside>
          </div>

          <div className="lp-wrap">
            <div className="lp-marquee" aria-label="Certificate authorities">
              <ul className="lp-marquee-track">
                {[...BRANDS, ...BRANDS].map((b, i) => (
                  <li key={b.slug + i} aria-hidden={i >= BRANDS.length ? 'true' : undefined}>
                    <Link href={`/ssl?brand=${b.slug}`} className="lp-ca-link" tabIndex={i >= BRANDS.length ? -1 : undefined}>
                      <span className="lp-ca-logo"><BrandLogo slug={b.slug} name={b.name} height={26} /></span>
                      <span className="lp-ca-note">{byBrand[b.slug] ? `${byBrand[b.slug]} certificates →` : 'View certificates →'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lp-figures">
              <div><strong>{totalProducts > 20 ? `${totalProducts}+` : `${BRANDS.length} brands`}</strong><span>{totalProducts > 20 ? 'Certificate products' : 'Certificate authorities'}</span></div>
              <div><strong>DV · OV · EV</strong><span>Every validation level</span></div>
              <div><strong>Wildcard + SAN</strong><span>Multi-domain coverage</span></div>
              <div><strong>Agent + ACME</strong><span>Automation built in</span></div>
            </div>
          </div>
        </section>

        <section className="lp-section" id="certificates">
          <div className="lp-wrap">
            <p className="lp-kicker">Choose by validation level</p>
            <h2>The right certificate for every trust requirement</h2>
            <p className="lp-sub">Not sure which one? Start with the domain. The console suggests the certificates that fit.</p>
            <div className="lp-grid3">
              {LEVELS.map((l) => (
                <article key={l.tag} className="lp-card">
                  <span className="lp-tag">{l.tag}</span>
                  <h3>{l.title}</h3>
                  <p>{l.text}</p>
                  <ul className="lp-ticks">{l.points.map((x) => <li key={x}>{x}</li>)}</ul>
                  <div className="lp-card-foot">
                    <span><span className="lp-muted">Issued in</span> <strong>{l.time}</strong></span>
                    <a {...consoleProps} className="lp-btn lp-btn-ghost lp-btn-sm">Order {l.tag}</a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section lp-alt" id="how">
          <div className="lp-wrap">
            <p className="lp-kicker">How it works</p>
            <h2>From order to installed, in five guided steps</h2>
            <p className="lp-sub">Each step tells you exactly what to do next, so nothing stalls in validation.</p>
            <ol className="lp-steps">
              {STEPS.map(([t, d], i) => (
                <li key={t}>
                  <span className="lp-step-n">{i + 1}</span>
                  <strong>{t}</strong>
                  <span>{d}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-section" id="automation">
          <div className="lp-wrap lp-split">
            <div>
              <p className="lp-kicker">Automated SSL</p>
              <h2>Ready for 100-day certificates</h2>
              <p className="lp-sub" style={{ marginLeft: 0 }}>
                From 15 March 2027 public certificates last at most 100 days. Automated subscriptions replace them for you,
                so you never chase an expiry again.
              </p>
              <div className="lp-auto">
                <article>
                  <h3>Plan + Automate</h3>
                  <p>One domain, installed and renewed by the AutoInstall agent on Apache, NGINX or IIS, or by your own ACME client.</p>
                </article>
                <article>
                  <h3>ACME Certificate-as-a-Service</h3>
                  <p>Many domains, unlimited certificates. Plug the EAB keys into Certbot, acme.sh, Caddy or cert-manager.</p>
                </article>
              </div>
            </div>
            <div className="lp-table-card">
              <table className="lp-table">
                <caption className="lp-sr">Manual certificate compared with automated SSL</caption>
                <thead><tr><th /><th>Certificate</th><th>Automated SSL</th></tr></thead>
                <tbody>
                  {COMPARE.map(([k, a, b]) => (
                    <tr key={k}><th scope="row">{k}</th><td>{a}</td><td>{b}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="lp-section lp-alt" id="why">
          <div className="lp-wrap">
            <p className="lp-kicker">Why CertDesk</p>
            <h2>Everything a certificate needs, in one place</h2>
            <div className="lp-grid3">
              {FEATURES.map(([icon, t, d]) => (
                <article key={t} className="lp-feature">
                  <span className="lp-feature-icon" aria-hidden="true">{icon}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section" id="faq">
          <div className="lp-wrap lp-faq">
            <p className="lp-kicker">FAQ</p>
            <h2>Questions, answered</h2>
            <div className="lp-faq-list">
              {FAQ.map(([qq, a]) => (
                <details key={qq}>
                  <summary>{qq}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-final">
          <div className="lp-wrap lp-final-in">
            <div>
              <h2>Take control of your certificates today</h2>
              <p>Sign in to order, validate and track every certificate, or ask for an account.</p>
            </div>
            <div className="lp-cta">
              <a {...consoleProps} className="lp-btn lp-btn-light lp-btn-lg">{signedIn ? 'Open console' : 'Sign in'}</a>
              {!signedIn ? <a href={contact} className="lp-btn lp-btn-outline-light lp-btn-lg">Request an account</a> : null}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter email={email} contact={contact} />
      {!signedIn ? <SignInDialog openOnLoad={sp.signin === '1'} contact={contact} /> : null}
    </div>
  );
}
