'use client';

import { useMemo, useState } from 'react';
import BrandLogo from './BrandLogo';
import { recommend, LEVEL_INFO } from '@/lib/finder';

const BRAND_LIST = [
  ['digicert', 'DigiCert'], ['sectigo', 'Sectigo'], ['geotrust', 'GeoTrust'], ['thawte', 'Thawte'],
  ['rapidssl', 'RapidSSL'], ['comodo', 'Comodo'], ['gogetssl', 'GoGetSSL']
];
const BRAND_NAME = Object.fromEntries(BRAND_LIST);

const I = {
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3.6 9h16.8M3.6 15h16.8M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" /></>,
  star: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />,
  layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
  code: <path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 4l-4 16" />,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  building: <><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" /><path d="M16 9h2a2 2 0 0 1 2 2v10M2 21h20M8 7h4M8 11h4M8 15h4" /></>,
  shield: <><path d="M12 3 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6z" /><path d="m9 12 2 2 4-4" /></>,
  hand: <path d="M7 11V6a2 2 0 1 1 4 0v5M11 10V4a2 2 0 1 1 4 0v6M15 10V6a2 2 0 1 1 4 0v8a7 7 0 0 1-7 7h-1a6 6 0 0 1-5.2-3L3 13.5a1.8 1.8 0 0 1 3-1.9L7 13" />,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  term: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3M13 15h4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  leaf: <path d="M5 21c0-9 6-15 16-16-1 10-7 16-16 16zM5 21l7-7" />,
  scale: <path d="M12 3v18M5 7h14M5 7l-3 7a4 4 0 0 0 6 0zM19 7l-3 7a4 4 0 0 0 6 0zM8 21h8" />,
  crown: <path d="m3 7 4 4 5-7 5 7 4-4-2 12H5z" />,
  badge: <><circle cx="12" cy="9" r="6" /><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7" /></>
};
const Svg = ({ k, s = 20 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[k]}</svg>;

const START = { secure: 'one', trust: 'basic', domains: 5, wildMulti: false, manage: 'manual', brand: 'any', priority: 'balanced', speed: 'any', codeLevel: 'standard' };

function Opt({ on, onClick, icon, title, hint }) {
  return (
    <button type="button" className={`sf-opt ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on}>
      {icon ? <span className="sf-opt-ico"><Svg k={icon} /></span> : null}
      <span className="sf-opt-txt"><strong>{title}</strong>{hint ? <small>{hint}</small> : null}</span>
      <span className="sf-opt-dot" aria-hidden="true" />
    </button>
  );
}

function Q({ n, title, hint, children }) {
  return (
    <section className="sf-q">
      <div className="sf-q-head"><span className="sf-n">{n}</span><div><h3>{title}</h3>{hint ? <p>{hint}</p> : null}</div></div>
      {children}
    </section>
  );
}

function tagsOf(p) {
  const t = [];
  if (p.automation) t.push('Automated');
  t.push(p.validation === 'code' ? (/\bEV\b/.test(p.name) ? 'EV code signing' : 'Code signing') : p.validation.toUpperCase());
  if (p.wildcard) t.push('Wildcard');
  if (p.multi && p.san_max) t.push(`Up to ${p.san_max} domains`);
  else if (p.multi) t.push('Multi-domain');
  return t;
}

/** Interactive certificate recommendation. No prices. */
export default function SslFinder({ products, orderHref, signedIn, contact }) {
  const [a, setA] = useState(START);
  const set = (k, v) => setA((x) => ({ ...x, [k]: v }));
  const r = useMemo(() => recommend(products, a), [products, a]);
  const code = a.secure === 'code';
  const top = r.top;
  const info = LEVEL_INFO[r.level];
  const brandsAvail = BRAND_LIST.filter(([slug]) => products.some((p) => new RegExp(slug === 'comodo' ? 'positivessl|essential|instantssl|comodo' : slug, 'i').test(p.name)));
  let n = 1;

  const cta = (p) => {
    if (!p) return null;
    if (signedIn) return <a className="sf-btn primary" href={orderHref(p)}>Order this certificate</a>;
    return <a className="sf-btn primary" href="#signin" data-signin="">Sign in to order</a>;
  };

  return (
    <div className="sf">
      <header className="sf-banner">
        <div>
          <span className="sf-kicker"><Svg k="star" s={14} />Interactive SSL Finder</span>
          <h1>Find the right certificate in 30 seconds</h1>
          <p>Answer a few questions about what you need to protect. We match it against {products.length} certificates from {brandsAvail.length} trusted brands and explain the pick.</p>
        </div>
        <div className="sf-banner-side">
          <b>{products.length}</b><span>certificates compared</span>
          <button type="button" className="sf-reset" onClick={() => setA(START)}>Start over</button>
        </div>
      </header>

      <div className="sf-body">
        <div className="sf-qs">
          <Q n={n++} title="What do you want to secure?">
            <div className="sf-opts four">
              <Opt on={a.secure === 'one'} onClick={() => set('secure', 'one')} icon="globe" title="One website" hint="example.com and www" />
              <Opt on={a.secure === 'subs'} onClick={() => set('secure', 'subs')} icon="star" title="A site and all subdomains" hint="*.example.com" />
              <Opt on={a.secure === 'many'} onClick={() => set('secure', 'many')} icon="layers" title="Several different domains" hint="example.com, shop.net …" />
              <Opt on={code} onClick={() => set('secure', 'code')} icon="code" title="Software or code" hint="Apps, drivers, scripts" />
            </div>
          </Q>

          {a.secure === 'many' ? (
            <Q n={n++} title="How many domain names?" hint="Count every distinct name you need on the certificate.">
              <div className="sf-range">
                <input type="range" min="2" max="250" value={a.domains} onChange={(e) => set('domains', Number(e.target.value))} aria-label="Number of domains" />
                <output>{a.domains}</output>
              </div>
              <label className="sf-switch">
                <input type="checkbox" checked={a.wildMulti} onChange={(e) => set('wildMulti', e.target.checked)} />
                <span aria-hidden="true" />Some of them are wildcards (*.example.com)
              </label>
            </Q>
          ) : null}

          {code ? (
            <Q n={n++} title="Which kind of code signing?">
              <div className="sf-opts">
                <Opt on={a.codeLevel === 'standard'} onClick={() => set('codeLevel', 'standard')} icon="badge" title="Standard" hint="Apps, installers, scripts, macros" />
                <Opt on={a.codeLevel === 'ev'} onClick={() => set('codeLevel', 'ev')} icon="shield" title="Extended Validation" hint="Instant SmartScreen trust, drivers" />
              </div>
            </Q>
          ) : (
            <Q n={n++} title="How much identity should visitors see?" hint="Every level gives the same 256-bit encryption.">
              <div className="sf-opts three">
                <Opt on={a.trust === 'basic'} onClick={() => set('trust', 'basic')} icon="lock" title="Encryption" hint="Blogs, tools, internal sites" />
                <Opt on={a.trust === 'business'} onClick={() => set('trust', 'business')} icon="building" title="Verified business" hint="Company sites, portals" />
                <Opt on={a.trust === 'high'} onClick={() => set('trust', 'high')} icon="shield" title="Highest assurance" hint="Payments, banking, finance" />
              </div>
            </Q>
          )}

          {!code ? (
            <Q n={n++} title="How should renewals happen?" hint="Certificates now last 200 days, dropping to 100 in March 2027.">
              <div className="sf-opts three">
                <Opt on={a.manage === 'manual'} onClick={() => set('manage', 'manual')} icon="hand" title="I install it myself" hint="Download and install" />
                <Opt on={a.manage === 'agent'} onClick={() => set('manage', 'agent')} icon="bolt" title="Automate on my server" hint="Agent for Apache, NGINX, IIS" />
                <Opt on={a.manage === 'acme'} onClick={() => set('manage', 'acme')} icon="term" title="My ACME client" hint="Certbot, acme.sh, cert-manager" />
              </div>
            </Q>
          ) : null}

          {!code ? (
            <Q n={n++} title="When do you need it?">
              <div className="sf-opts three">
                <Opt on={a.speed === 'today'} onClick={() => set('speed', 'today')} icon="clock" title="Today" />
                <Opt on={a.speed === 'week'} onClick={() => set('speed', 'week')} icon="cal" title="This week" />
                <Opt on={a.speed === 'any'} onClick={() => set('speed', 'any')} icon="leaf" title="No rush" />
              </div>
            </Q>
          ) : null}

          <Q n={n++} title="What matters most?">
            <div className="sf-opts three">
              <Opt on={a.priority === 'value'} onClick={() => set('priority', 'value')} icon="leaf" title="Best value" hint="Trusted and economical" />
              <Opt on={a.priority === 'balanced'} onClick={() => set('priority', 'balanced')} icon="scale" title="Balanced" hint="Brand and value" />
              <Opt on={a.priority === 'premium'} onClick={() => set('priority', 'premium')} icon="crown" title="Premium brand" hint="Top recognition and support" />
            </div>
          </Q>

          <Q n={n++} title="Any preferred brand?" hint="Optional.">
            <div className="sf-brands">
              <button type="button" className={`sf-brand any ${a.brand === 'any' ? 'on' : ''}`} onClick={() => set('brand', 'any')} aria-pressed={a.brand === 'any'}>No preference</button>
              {brandsAvail.map(([slug, name]) => (
                <button key={slug} type="button" className={`sf-brand ${a.brand === slug ? 'on' : ''}`} onClick={() => set('brand', slug)} aria-pressed={a.brand === slug} title={name}>
                  <BrandLogo slug={slug} name={name} height={18} />
                </button>
              ))}
            </div>
          </Q>
        </div>

        <aside className="sf-result" aria-live="polite">
          {top ? (
            <div className="sf-card" key={top.id}>
              <div className="sf-card-head">
                <span className="sf-rec">Recommended for you</span>
                <span className="sf-card-logo"><BrandLogo slug={top.slug} name={BRAND_NAME[top.slug]} height={22} /></span>
              </div>
              <h2>{top.name}</h2>
              <div className="sf-tags">{tagsOf(top).map((t) => <span key={t}>{t}</span>)}</div>

              <ul className="sf-why">{r.why.slice(0, 4).map((w) => <li key={w}>{w}</li>)}</ul>

              <dl className="sf-facts">
                <div><dt>Validation</dt><dd>{info.label}</dd></div>
                <div><dt>What is checked</dt><dd>{info.checks}</dd></div>
                <div><dt>Issued in</dt><dd>{r.automated ? 'Minutes, then renews itself' : info.time}</dd></div>
                <div><dt>Visitors see</dt><dd>{info.shows}</dd></div>
              </dl>

              {r.notes.length ? <div className="sf-notes">{r.notes.map((t) => <p key={t}>{t}</p>)}</div> : null}

              <div className="sf-ctas">
                {cta(top)}
                <a className="sf-btn" href={contact}>Ask an expert</a>
              </div>

              {r.alts.length ? (
                <div className="sf-alts">
                  <span className="sf-alts-k">Also a good fit</span>
                  {r.alts.map((p) => (
                    <div key={p.id} className="sf-alt">
                      <span className="sf-alt-logo"><BrandLogo slug={p.slug} name={BRAND_NAME[p.slug]} height={14} /></span>
                      <div><strong>{p.name}</strong><small>{tagsOf(p).join(' · ')}</small></div>
                      {signedIn ? <a href={orderHref(p)} aria-label={`Order ${p.name}`}>→</a> : null}
                    </div>
                  ))}
                </div>
              ) : null}
              <p className="sf-count">Matched from {r.count} certificate{r.count === 1 ? '' : 's'} that fit your answers.</p>
            </div>
          ) : (
            <div className="sf-card"><h2>No exact match</h2><p>Try a different combination, or <a href={contact}>ask an expert</a>.</p></div>
          )}
        </aside>
      </div>
    </div>
  );
}
