import Link from 'next/link';
import { getContext } from '@/lib/auth';
import { q } from '@/lib/db';
import { supportEmail } from '@/lib/support';
import SignInDialog from '@/components/SignInDialog';
import { SiteHeader, SiteFooter, UtilityBar, BRANDS, brandOf } from '@/components/site/SiteChrome';
import { NeedsGrid, LevelCards } from '@/components/site/Sections';
import BrandLogo from '@/components/site/BrandLogo';
import TlmCheck from '@/components/site/TlmCheck';
import HeroTitle from '@/components/site/HeroTitle';
import './landing.css';

export const metadata = {
  title: 'CertDesk · SSL certificates and automation in one console',
  description: 'Order, validate, install and renew SSL/TLS and code signing certificates from one console, or let Plan + Automate and ACME subscriptions do it for you.'
};

const STEPS = [
  ['Order', 'Pick a certificate or an automated subscription. Start with your domain and we suggest what fits.'],
  ['Create the key', 'Generate the key and CSR in your browser, or paste a CSR from your server.'],
  ['Validate', 'Add one DNS record or upload one file. We check it before you submit.'],
  ['Issued', 'The CA issues the certificate, often within minutes for DV.'],
  ['Install & reissue', 'Download for any server. Reissue free while the order runs.']
];

const FEATURES = [
  ['dashboard', 'One dashboard', 'Every certificate and subscription in one list, with what needs you at the top.'],
  ['key', 'Key stays with you', 'The private key is created on your machine and never sent to us.'],
  ['check', 'Guided validation', 'Exact DNS records and files to add, with DNS checks before you order.'],
  ['bell', 'Reissue reminders', 'See reissue and renewal dates long before anything expires.'],
  ['bolt', 'Automation ready', 'Plan + Automate and ACME subscriptions install and renew on their own.'],
  ['users', 'Managed accounts', 'Your provider sets you up and can assign existing orders to you.']
];

const ICONS = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m10.8 12.2 9.2-9.2M17 6l3 3M14 9l2 2" /></>,
  check: <><path d="M12 3 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6z" /><path d="m9 12 2 2 4-4" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" /></>
};

const TIMELINE = [
  { when: 'Until Mar 2026', days: 398, note: 'About one renewal a year' },
  { when: '15 Mar 2026', days: 200, note: 'In force now', now: true },
  { when: '15 Mar 2027', days: 100, note: 'About four a year' },
  { when: '15 Mar 2029', days: 47, note: 'About eight a year' }
];

const FAQ = [
  ['Who can use CertDesk?', 'CertDesk accounts are created by your SSL provider. Once you have one, sign in with your email and password to manage and order certificates.'],
  ['How fast is a DV certificate issued?', 'Usually within minutes of passing validation. Add the DNS record or file we show you and the certificate is issued as soon as the CA sees it.'],
  ['Do you see my private key?', 'No. When you create the key in the browser it is generated on your computer and downloaded straight to you. Only the CSR is sent to the CA.'],
  ['What is the difference between reissue and renew?', 'A certificate inside an active order can be reissued free as often as you need. When the order itself ends, you renew by placing a new order.'],
  ['What changes with 100-day certificates?', 'From 15 March 2027 public certificates last at most 100 days, so they need replacing about every three months. Automated subscriptions handle that for you.'],
  ['Plan + Automate or ACME CaaS?', 'Plan + Automate covers one domain and installs certificates for you with the AutoInstall agent. ACME CaaS covers many domains for your own ACME client.']
];

// 24-point rosette for the certificate seal
const SEAL = Array.from({ length: 48 }, (_, i) => {
  const r = i % 2 ? 41 : 48;
  const t = (i / 48) * Math.PI * 2;
  return `${(50 + r * Math.sin(t)).toFixed(1)},${(50 - r * Math.cos(t)).toFixed(1)}`;
}).join(' ');

function Icon({ name }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>
  );
}

const PK_ICONS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  building: <><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" /><path d="M16 9h2a2 2 0 0 1 2 2v10M2 21h20M8 7h4M8 11h4M8 15h4" /></>,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  shield: <><path d="M12 3 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6z" /><path d="m9 12 2 2 4-4" /></>
};
const PkIcon = ({ n }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PK_ICONS[n]}</svg>;

export default async function Landing({ searchParams }) {
  const sp = (await searchParams) || {};
  const [ctx, email, allProducts] = await Promise.all([
    getContext().catch(() => null),
    supportEmail().catch(() => null),
    q(`select name, brand from console.products where not automation`).catch(() => [])
  ]);
  const byBrand = {};
  for (const p of allProducts) { const b = brandOf(p).slug; byBrand[b] = (byBrand[b] || 0) + 1; }
  const total = allProducts.length;
  const signedIn = !!ctx;
  const consoleHref = ctx ? (ctx.isAdmin && !ctx.workspaceId ? '/partner' : '/orders') : '#signin';
  const consoleProps = signedIn ? { href: consoleHref } : { href: '#signin', 'data-signin': '' };
  const pkiContact = email ? `mailto:${email}?subject=${encodeURIComponent('PKI consultation')}` : '#faq';
  const contact = email ? `mailto:${email}?subject=${encodeURIComponent('CertDesk account request')}` : '#faq';
  const daysTo100 = Math.max(0, Math.ceil((new Date('2027-03-15T00:00:00Z') - Date.now()) / 86400000));

  return (
    <div className="lp">
      <a className="lp-skip" href="#main">Skip to content</a>
      <UtilityBar email={email} />
      <SiteHeader signedIn={signedIn} consoleHref={consoleHref} />

      <main id="main">
        <section className="hx">
          <div className="hx-bg" aria-hidden="true" />
          <div className="hx-spot" aria-hidden="true" />
          <div className="lp-wrap hx-in">
            <div className="hx-text">
              <span className="hx-pill"><span className="lp-new">New</span> Plan + Automate and ACME subscriptions are here</span>
              <HeroTitle />
              <p className="hx-lead">
                Order DV, OV, EV, wildcard, multi-domain and code signing certificates, follow guided validation, and see every reissue
                and renewal coming. Or let an automated subscription handle it all.
              </p>
              <div className="lp-cta">
                <a {...consoleProps} className="lp-btn lp-btn-primary lp-btn-lg">{signedIn ? 'Open your console' : 'Sign in to your console'}<span aria-hidden="true">→</span></a>
                <Link href="/finder" className="lp-btn lp-btn-glass lp-btn-lg">Find my certificate</Link>
              </div>
              <ul className="hx-trust">
                <li><Icon name="check" />256-bit encryption</li>
                <li><Icon name="bolt" />DV in minutes</li>
                <li><Icon name="key" />Key stays on your machine</li>
              </ul>
            </div>

            <div className="hz" aria-hidden="true">
              <div className="hz-glow" />
              <div className="hz-orbit hz-o1">
                {['digicert', 'sectigo', 'geotrust'].map((slug, i) => (
                  <div key={slug} className="hz-sat" style={{ '--a': `${i * 120 + 20}deg` }}>
                    <span className="hz-chip"><BrandLogo slug={slug} name={slug} height={18} /></span>
                  </div>
                ))}
              </div>
              <div className="hz-orbit hz-o2">
                {['thawte', 'rapidssl', 'comodo'].map((slug, i) => (
                  <div key={slug} className="hz-sat" style={{ '--a': `${i * 120 + 80}deg` }}>
                    <span className="hz-chip"><BrandLogo slug={slug} name={slug} height={16} /></span>
                  </div>
                ))}
              </div>

              <div className="hz-cert">
                <div className="hz-url">
                  <svg className="hz-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                  <span className="hz-https">https://</span><span className="hz-type">shop.example.com</span><span className="hz-caret" />
                </div>
                <div className="hz-body">
                  <svg className="hz-seal" viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="hzs" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F97316" /><stop offset="1" stopColor="#C2410C" /></linearGradient>
                    </defs>
                    <polygon fill="url(#hzs)" points={SEAL} />
                    <circle cx="50" cy="50" r="31" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.5" strokeDasharray="2 3" />
                    <path d="m37 51 9 9 18-19" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <dl className="hz-fields">
                    <div><dt>Issued to</dt><dd className="mono">shop.example.com</dd></div>
                    <div><dt>Validation</dt><dd>Organization (OV)</dd></div>
                    <div><dt>Valid for</dt><dd>200 days <span className="hz-ok">Trusted</span></dd></div>
                  </dl>
                </div>
                <div className="hz-life"><span /></div>
                <div className="hz-chain">
                  <span className="hz-node"><i />Root CA</span>
                  <span className="hz-link" />
                  <span className="hz-node"><i />Intermediate</span>
                  <span className="hz-link" />
                  <span className="hz-node on"><i />Your site</span>
                </div>
              </div>

              <div className="hx-float hz-f1"><span className="hx-dot ok" />Certificate issued <b>in 4 min</b></div>
              <div className="hx-float hz-f2"><span className="hx-dot auto" />Auto-renewal <b>on</b></div>
              <div className="hx-float hz-f3"><span className="hz-tick">✓</span>DNS validated</div>
            </div>
          </div>

          <div className="lp-wrap">
            <div className="lp-marquee hx-marquee" aria-label="Certificate authorities">
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
          </div>
        </section>

        <section className="lp-wrap hx-stats">
          <div><strong>{total > 20 ? `${total}+` : '70+'}</strong><span>SSL & code signing products</span></div>
          <div><strong>{BRANDS.length}</strong><span>Trusted brands</span></div>
          <div><strong>DV · OV · EV</strong><span>Every validation level</span></div>
          <div><strong>Agent + ACME</strong><span>Automation built in</span></div>
        </section>

        <section className="lp-section hx-sec" id="certificates">
          <div className="lp-wrap">
            <div className="hx-sec-head">
              <div>
                <p className="lp-kicker hx-left">Find your certificate</p>
                <h2 className="hx-left">What do you need to secure?</h2>
              </div>
              <Link href="/ssl" className="lp-btn lp-btn-ghost">See all certificates →</Link>
            </div>
            <NeedsGrid />
          </div>
        </section>

        <section className="lp-section lp-alt hx-sec">
          <div className="lp-wrap">
            <p className="lp-kicker">Choose by validation level</p>
            <h2>The right certificate for every trust requirement</h2>
            <p className="lp-sub" style={{ marginBottom: 34 }}>Every level gives the same 256-bit encryption. The difference is how much the CA checks about you.</p>
            <LevelCards />
          </div>
        </section>

        <section className="lp-section hx-sec" id="how">
          <div className="lp-wrap">
            <p className="lp-kicker">How it works</p>
            <h2>From order to installed in five guided steps</h2>
            <ol className="hx-steps">
              {STEPS.map(([t, d], i) => (
                <li key={t}>
                  <span className="hx-step-n">{String(i + 1).padStart(2, '0')}</span>
                  <strong>{t}</strong>
                  <span>{d}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="ax" id="automation">
          <div className="ax-bg" aria-hidden="true" />
          <div className="lp-wrap ax-in">
            <div className="ax-copy">
              <p className="ax-kicker"><span className="ax-pulse" />Automated SSL</p>
              <h2>Certificate lifetimes are shrinking. <span className="ax-grad">Let automation keep up.</span></h2>
              <p className="ax-text">
                Public certificates are limited to 200 days now, 100 days from 15 March 2027 and 47 days from 15 March 2029.
                Automated subscriptions replace them before they expire, so nothing lapses.
              </p>

              <div className="ax-count">
                <b>{daysTo100}</b>
                <div><strong>days until 100-day certificates</strong><span>CA/Browser Forum ballot SC-081v3 · 15 March 2027</span></div>
              </div>

              <div className="ax-plans">
                <article>
                  <span className="ax-ico">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></svg>
                  </span>
                  <h3>Plan + Automate</h3>
                  <p>One domain. The AutoInstall agent installs and renews it for you, or use your own ACME client.</p>
                  <ul><li>Apache</li><li>NGINX</li><li>IIS</li><li>ACME</li></ul>
                </article>
                <article>
                  <span className="ax-ico alt">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3M13 15h4" /></svg>
                  </span>
                  <h3>ACME Certificate-as-a-Service</h3>
                  <p>Many domains and unlimited certificates. Plug the keys into the ACME client you already run.</p>
                  <ul><li>Certbot</li><li>acme.sh</li><li>Caddy</li><li>cert-manager</li></ul>
                </article>
              </div>
              <div className="lp-cta" style={{ marginTop: 26 }}>
                <Link href="/ssl?type=auto" className="lp-btn lp-btn-light lp-btn-lg">Explore automated SSL <span aria-hidden="true">→</span></Link>
              </div>
            </div>

            <div className="ax-viz">
              <div className="ax-card">
                <div className="ax-card-head">
                  <span>Maximum certificate lifetime</span>
                  <em>SC-081v3</em>
                </div>
                <div className="ax-chart" role="list" aria-label="Maximum certificate lifetime by date">
                  {TIMELINE.map((t, i) => (
                    <div key={t.when} role="listitem" className={`ax-col ${t.now ? 'now' : ''} ${i === 0 ? 'past' : ''}`}>
                      <span className="ax-val"><b>{t.days}</b> days</span>
                      <span className="ax-bar" style={{ height: `${Math.max(10, (t.days / 398) * 100)}%` }}>{t.now ? <i>Now</i> : null}</span>
                      <span className="ax-when">{t.when.replace('Until ', 'Until ')}</span>
                    </div>
                  ))}
                </div>
                <div className="ax-reps">
                  <span className="ax-reps-k">Replacements per year</span>
                  <div className="ax-reps-row">
                    {[1, 2, 4, 8].map((n, i) => (
                      <div key={n} className={TIMELINE[i].now ? 'now' : ''}>
                        <span className="ax-dots" aria-hidden="true">{Array.from({ length: n }, (_, k) => <i key={k} style={{ animationDelay: `${k * 0.12}s` }} />)}</span>
                        <small>{n}×</small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="ax-term" aria-hidden="true">
                <div className="ax-term-bar"><i /><i /><i /><span>certdesk-agent · renew</span></div>
                <ul>
                  <li><span className="ax-t-time">02:00</span>checking 14 domains</li>
                  <li><span className="ax-t-time">02:00</span>shop.example.com <b>expires in 29 days</b></li>
                  <li><span className="ax-t-time">02:01</span>DNS validated · certificate issued</li>
                  <li><span className="ax-t-time">02:01</span>installed on nginx · reloaded <span className="ax-ok">✓</span></li>
                  <li className="ax-cursor"><span className="ax-t-time">02:01</span>next run in 24h</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section wx" id="why">
          <div className="lp-wrap wx-in">
            <div className="wx-copy">
              <p className="lp-kicker hx-left">Why CertDesk</p>
              <h2 className="wx-title">Everything a certificate needs, <span>in one place.</span></h2>
              <p className="wx-sub">Built for how certificates actually live: ordered once, validated, reissued, renewed and audited, without spreadsheets or missed emails.</p>
              <ul className="wx-list">
                {FEATURES.map(([icon, t, d], n) => (
                  <li key={t} style={{ '--i': n }}>
                    <span className="wx-ico"><Icon name={icon} /></span>
                    <div><strong>{t}</strong><span>{d}</span></div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="wx-stage" aria-hidden="true">
              <div className="wx-glow" />
              <div className="wx-win">
                <div className="wx-win-bar"><i /><i /><i /><span className="wx-url"><b>🔒</b> certdesk · Overview</span></div>
                <div className="wx-win-body">
                  <aside className="wx-side">
                    <span className="wx-side-ws"><em>P</em>Paransh</span>
                    <span className="on">Overview</span><span>Certificates <small>26</small></span><span>Order new</span><span>Tools</span>
                  </aside>
                  <div className="wx-main">
                    <div className="wx-hero">
                      <div className="wx-ring"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" /><circle cx="20" cy="20" r="16" className="v" /></svg><b>5/6</b></div>
                      <div><small>Certificate posture</small><strong>3 items need you</strong></div>
                    </div>
                    <div className="wx-stats">
                      <span><b>9</b>Active</span><span className="r"><b>2</b>Renew</span><span className="a"><b>1</b>Reissue</span><span className="v"><b>1</b>Validate</span>
                    </div>
                    <div className="wx-tabs"><span className="on">Renew <i>2</i></span><span>Reissue <i>1</i></span><span>Validate <i>1</i></span></div>
                    {[
                      ['shop.example.com', 'Subscription ends 2 Dec', 'Renew', 'r'],
                      ['*.example.org', 'Certificate 9 Dec · subscription to Jun 2027', 'Reissue', 'a'],
                      ['api.example.net', 'TXT record found in DNS', 'Validate', 'v']
                    ].map(([d, t, b, k]) => (
                      <div key={d} className={`wx-row ${k}`}><span className="wx-bar" /><div><b>{d}</b><small>{t}</small></div><em>{b}</em></div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="wx-float wx-f1"><span className="wx-f-ico b"><Icon name="key" /></span><div><b>private.key</b><small>generated in your browser</small></div></div>
              <div className="wx-float wx-f2"><span className="wx-f-ico g">✓</span><div><b>DNS validated</b><small>_dnsauth TXT · example.com</small></div></div>
              <div className="wx-float wx-f3"><span className="wx-f-ico a"><Icon name="bell" /></span><div><b>Reissue in 7 days</b><small>*.example.org · free</small></div></div>
              <div className="wx-float wx-f4"><div><b>Auto-renew</b><small>Plan + Automate</small></div><span className="wx-switch" /></div>
              <div className="wx-float wx-f5"><span className="wx-avs"><i>PS</i><i>AK</i><i>RM</i></span><small>Orders assigned by your provider</small></div>
            </div>
          </div>
        </section>

        <section className="lp-section pk" id="pki">
          <div className="lp-wrap">
            <div className="pk-top">
              <div>
                <p className="lp-kicker hx-left">PKI consulting</p>
                <h2 className="pk-title">Enterprise PKI, <span>planned and run with you.</span></h2>
                <p className="pk-sub">From a first certificate inventory to a full private PKI, our consultants help you design, migrate and automate, and get ready for 47-day certificates and post-quantum cryptography.</p>
              </div>
              <a className="lp-btn lp-btn-primary lp-btn-lg" href={`${pkiContact}`}>Book a free consultation</a>
            </div>

            <div className="pk-grid">
              {[
                ['search', 'Certificate inventory & risk review', 'Find every certificate across servers, cloud and devices, then rank what could cause an outage.'],
                ['building', 'Private PKI design', 'Plan internal CAs, Microsoft CA migration and certificate profiles for users, devices and Wi-Fi.'],
                ['bolt', 'Automation rollout', 'ACME, SCEP and EST rollouts so renewals happen without tickets as lifetimes shrink.'],
                ['shield', 'Crypto-agility & PQC readiness', 'Map algorithms and keys in use and plan the move to post-quantum cryptography.']
              ].map(([i, t, d]) => (
                <article key={t} className="pk-card">
                  <span className="pk-ico"><PkIcon n={i} /></span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </article>
              ))}
            </div>

            <div className="pk-tlm">
              <div className="pk-tlm-copy">
                <span className="pk-badge"><BrandLogo slug="digicert" name="DigiCert" height={16} /> Trust Lifecycle Manager</span>
                <h3>We help you deploy DigiCert Trust Lifecycle Manager</h3>
                <p>Trust Lifecycle Manager is DigiCert’s platform for CA-agnostic certificate management and PKI services, part of DigiCert ONE. It gives one place to discover, manage and automate public and private certificates.</p>
                <ul className="pk-list">
                  <li><b>Discovery:</b> scan networks and cloud, and import certificates from any CA into one inventory.</li>
                  <li><b>Automation:</b> ACME, SCEP and EST plus agents and connectors for issuance, renewal and installation.</li>
                  <li><b>Public and private PKI:</b> manage DigiCert public certificates and your own private CAs together.</li>
                  <li><b>Integrations:</b> Microsoft CA, HSMs, ITSM, MDM and DevOps tools.</li>
                </ul>
                <div className="pk-steps">
                  <span className="pk-steps-k">How we help</span>
                  <ol>
                    <li><b>Scope</b>Requirements and licensing</li>
                    <li><b>Proof of concept</b>Your systems, real data</li>
                    <li><b>Deploy</b>Connectors, discovery, policies</li>
                    <li><b>Hand over</b>Runbooks and training</li>
                  </ol>
                </div>
              </div>
              <TlmCheck contact={email ? `mailto:${email}?subject=${encodeURIComponent('DigiCert Trust Lifecycle Manager consultation')}` : '#faq'} />
            </div>
          </div>
        </section>

        <section className="lp-section lp-alt hx-sec" id="faq">
          <div className="lp-wrap hx-faq">
            <div>
              <p className="lp-kicker hx-left">FAQ</p>
              <h2 className="hx-left">Questions, answered</h2>
              <p className="hx-faq-side">Something else? {email ? <a href={`mailto:${email}`}>Email us</a> : 'Ask your provider'} and we&apos;ll help.</p>
            </div>
            <div className="lp-faq-list hx-faq-list">
              {FAQ.map(([qq, a]) => (
                <details key={qq}>
                  <summary>{qq}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-wrap hx-final-wrap">
          <div className="hx-final">
            <div>
              <h2>Take control of your certificates today</h2>
              <p>Sign in to order, validate and track every certificate, or ask for an account.</p>
            </div>
            <div className="lp-cta">
              <a {...consoleProps} className="lp-btn lp-btn-light lp-btn-lg">{signedIn ? 'Open console' : 'Sign in'}</a>
              {!signedIn ? <a href={contact} className="lp-btn lp-btn-outline-light lp-btn-lg">Request an account</a> : <Link href="/ssl" className="lp-btn lp-btn-outline-light lp-btn-lg">Browse certificates</Link>}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter email={email} contact={contact} />
      {!signedIn ? <SignInDialog openOnLoad={sp.signin === '1'} contact={contact} /> : null}
    </div>
  );
}
