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

const LABEL = {
  secure: { one: 'One website', subs: 'Site + subdomains', many: 'Several domains', code: 'Software signing' },
  trust: { basic: 'Encryption', business: 'Verified business', high: 'Highest assurance' },
  manage: { manual: 'Manual install', agent: 'Automated agent', acme: 'ACME client' },
  speed: { today: 'Needed today', week: 'This week', any: 'No rush' },
  priority: { value: 'Best value', balanced: 'Balanced', premium: 'Premium brand' },
  codeLevel: { standard: 'Standard code signing', ev: 'EV code signing' }
};

function Opt({ on, onClick, icon, title, hint, preview }) {
  return (
    <button type="button" className={`sf-opt ${on ? 'on' : ''} ${preview ? 'has-prev' : ''}`} onClick={onClick} aria-pressed={on}>
      {preview ? <span className="sf-prev" aria-hidden="true">{preview}</span> : null}
      <span className="sf-opt-row">
        {icon ? <span className="sf-opt-ico"><Svg k={icon} /></span> : null}
        <span className="sf-opt-txt"><strong>{title}</strong>{hint ? <small>{hint}</small> : null}</span>
      </span>
      <span className="sf-opt-dot" aria-hidden="true" />
    </button>
  );
}

function Q({ n, title, hint, children }) {
  return (
    <section className="sf-q" style={{ '--d': `${n * 60}ms` }}>
      <div className="sf-q-head"><span className="sf-n">{String(n).padStart(2, '0')}</span><div><h3>{title}</h3>{hint ? <p>{hint}</p> : null}</div></div>
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

/* little live previews inside the answer cards */
const Url = ({ host, sub }) => <span className="pv-url"><i className="pv-lock" />{sub ? <em>{sub}</em> : null}{host}</span>;
const PREV = {
  one: <><Url host="example.com" /><Url host="example.com" sub="www." /></>,
  subs: <><Url host=".example.com" sub="shop" /><Url host=".example.com" sub="api" /><Url host=".example.com" sub="mail" /></>,
  many: <span className="pv-chips"><b>example.com</b><b>shop.net</b><b>brand.io</b><b>+2</b></span>,
  code: <span className="pv-file"><i>setup.exe</i><b>✓ Signed by Your Company</b></span>,
  basic: <span className="pv-cert"><span>Issued to</span><b>example.com</b></span>,
  business: <span className="pv-cert"><span>Organisation</span><b>Your Company Ltd</b><span className="ok">Verified</span></span>,
  high: <span className="pv-cert"><span>Legal entity</span><b>Your Bank Ltd · IN</b><span className="ok">EV verified</span></span>
};

/** Interactive certificate recommendation. No prices. */
export default function SslFinder({ products, orderHref, signedIn, contact }) {
  const [a, setA] = useState(START);
  const set = (k, v) => setA((x) => ({ ...x, [k]: v }));
  const r = useMemo(() => recommend(products, a), [products, a]);
  const code = a.secure === 'code';
  const top = r.top;
  const info = LEVEL_INFO[r.level];
  const brandsAvail = BRAND_LIST.filter(([slug]) => products.some((p) => new RegExp(slug === 'comodo' ? 'positivessl|essential|instantssl|comodo' : slug, 'i').test(p.name)));
  const match = Math.max(72, 99 - r.notes.length * 6 - (a.brand !== 'any' && top && top.slug !== a.brand ? 12 : 0));
  const ring = 2 * Math.PI * 26;
  const needs = [
    LABEL.secure[a.secure],
    a.secure === 'many' ? `${a.domains} domains${a.wildMulti ? ' + wildcards' : ''}` : null,
    code ? LABEL.codeLevel[a.codeLevel] : LABEL.trust[a.trust],
    code ? null : LABEL.manage[a.manage],
    code ? null : LABEL.speed[a.speed],
    LABEL.priority[a.priority],
    a.brand !== 'any' ? BRAND_NAME[a.brand] : null
  ].filter(Boolean);
  let n = 1;

  return (
    <div className="sf">
      <header className="sf-banner">
        <span className="sf-blob b1" aria-hidden="true" /><span className="sf-blob b2" aria-hidden="true" />
        <div className="sf-banner-copy">
          <span className="sf-kicker"><span className="sf-live" />Interactive SSL Finder</span>
          <h1>Find the right certificate <span>in 30 seconds.</span></h1>
          <p>Tell us what you need to protect. We compare {products.length} certificates from {brandsAvail.length} trusted authorities and explain the best fit, no jargon.</p>
          <div className="sf-banner-stats">
            <span><b>{products.length}</b>certificates</span>
            <span><b>{brandsAvail.length}</b>authorities</span>
            <span><b>DV · OV · EV</b>+ code signing</span>
          </div>
        </div>
        <div className="sf-banner-art" aria-hidden="true">
          <div className="sf-mini">
            <div className="sf-mini-bar"><i /><i /><i /><span><b>🔒</b> https://example.com</span></div>
            <div className="sf-mini-body">
              <svg viewBox="0 0 100 100" className="sf-mini-seal"><defs><linearGradient id="sfs" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FED7AA" /><stop offset="1" stopColor="#C2410C" /></linearGradient></defs><circle cx="50" cy="50" r="44" fill="url(#sfs)" /><circle cx="50" cy="50" r="34" fill="none" stroke="rgba(255,255,255,.55)" strokeDasharray="2 3" /><path d="m36 51 9 9 19-20" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <div><b>Certificate valid</b><small>Matched to your answers</small></div>
            </div>
          </div>
        </div>
      </header>

      <div className="sf-body">
        <div className="sf-qs">
          <Q n={n++} title="What do you want to secure?">
            <div className="sf-opts four">
              <Opt on={a.secure === 'one'} onClick={() => set('secure', 'one')} icon="globe" title="One website" hint="Domain with and without www" preview={PREV.one} />
              <Opt on={a.secure === 'subs'} onClick={() => set('secure', 'subs')} icon="star" title="Site + all subdomains" hint="One wildcard, *.example.com" preview={PREV.subs} />
              <Opt on={a.secure === 'many'} onClick={() => set('secure', 'many')} icon="layers" title="Several domains" hint="Different names, one certificate" preview={PREV.many} />
              <Opt on={code} onClick={() => set('secure', 'code')} icon="code" title="Software or code" hint="Apps, drivers, scripts" preview={PREV.code} />
            </div>
          </Q>

          {a.secure === 'many' ? (
            <Q n={n++} title="How many domain names?" hint="Count every distinct name on the certificate.">
              <div className="sf-range">
                <input type="range" min="2" max="250" value={a.domains} onChange={(e) => set('domains', Number(e.target.value))} aria-label="Number of domains" style={{ '--p': `${((a.domains - 2) / 248) * 100}%` }} />
                <output><b>{a.domains}</b><small>domains</small></output>
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
                <Opt on={a.trust === 'basic'} onClick={() => set('trust', 'basic')} icon="lock" title="Encryption" hint="Blogs, tools, internal sites" preview={PREV.basic} />
                <Opt on={a.trust === 'business'} onClick={() => set('trust', 'business')} icon="building" title="Verified business" hint="Company sites, portals" preview={PREV.business} />
                <Opt on={a.trust === 'high'} onClick={() => set('trust', 'high')} icon="shield" title="Highest assurance" hint="Payments, banking, finance" preview={PREV.high} />
              </div>
            </Q>
          )}

          {!code ? (
            <Q n={n++} title="How should renewals happen?" hint="Certificates last 200 days now, 100 from March 2027.">
              <div className="sf-opts three">
                <Opt on={a.manage === 'manual'} onClick={() => set('manage', 'manual')} icon="hand" title="I install it myself" hint="Download and install" />
                <Opt on={a.manage === 'agent'} onClick={() => set('manage', 'agent')} icon="bolt" title="Automate my server" hint="Apache, NGINX, IIS agent" />
                <Opt on={a.manage === 'acme'} onClick={() => set('manage', 'acme')} icon="term" title="My ACME client" hint="Certbot, acme.sh, cert-manager" />
              </div>
            </Q>
          ) : null}

          {!code ? (
            <Q n={n++} title="When do you need it?">
              <div className="sf-seg">
                {[['today', 'clock', 'Today'], ['week', 'cal', 'This week'], ['any', 'leaf', 'No rush']].map(([k, ic, t]) => (
                  <button key={k} type="button" className={a.speed === k ? 'on' : ''} onClick={() => set('speed', k)} aria-pressed={a.speed === k}><Svg k={ic} s={16} />{t}</button>
                ))}
              </div>
            </Q>
          ) : null}

          <Q n={n++} title="What matters most?">
            <div className="sf-seg">
              {[['value', 'leaf', 'Best value'], ['balanced', 'scale', 'Balanced'], ['premium', 'crown', 'Premium brand']].map(([k, ic, t]) => (
                <button key={k} type="button" className={a.priority === k ? 'on' : ''} onClick={() => set('priority', k)} aria-pressed={a.priority === k}><Svg k={ic} s={16} />{t}</button>
              ))}
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
          <div className="sf-needs">
            <span>Your needs</span>
            <div>{needs.map((t) => <i key={t}>{t}</i>)}</div>
            <button type="button" onClick={() => setA(START)}>Reset</button>
          </div>

          {top ? (
            <div className="sf-card" key={top.id}>
              <div className="sf-hero">
                <span className="sf-shine" aria-hidden="true" />
                <div className="sf-hero-top">
                  <span className="sf-rec">★ Best match</span>
                  <div className="sf-score" title={`${match}% match`}>
                    <svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="26" /><circle cx="30" cy="30" r="26" className="v" style={{ strokeDasharray: `${(match / 100) * ring} ${ring}` }} /></svg>
                    <b>{match}<small>%</small></b>
                  </div>
                </div>
                <span className="sf-hero-logo"><BrandLogo slug={top.slug} name={BRAND_NAME[top.slug]} height={22} /></span>
                <h2>{top.name}</h2>
                <div className="sf-tags">{tagsOf(top).map((t) => <span key={t}>{t}</span>)}</div>
                <div className="sf-hero-foot">
                  <span><small>Issued in</small><b>{r.automated ? 'Minutes · auto-renews' : info.time}</b></span>
                  <span><small>Checks</small><b>{info.checks}</b></span>
                </div>
              </div>

              <div className="sf-card-body">
                <h4>Why this fits</h4>
                <ul className="sf-why">{r.why.slice(0, 4).map((w, i) => <li key={w} style={{ '--i': i }}>{w}</li>)}</ul>

                <div className="sf-tiles">
                  <div><Svg k="shield" s={16} /><small>Validation</small><b>{info.label.replace(/ \(.*\)/, '')}</b></div>
                  <div><Svg k="globe" s={16} /><small>Visitors see</small><b>{info.shows}</b></div>
                </div>

                {r.notes.length ? <div className="sf-notes">{r.notes.map((t) => <p key={t}>{t}</p>)}</div> : null}

                <div className="sf-ctas">
                  {signedIn
                    ? <a className="sf-btn primary" href={orderHref(top)}>Order this certificate <span aria-hidden="true">→</span></a>
                    : <a className="sf-btn primary" href="#signin" data-signin="">Sign in to order <span aria-hidden="true">→</span></a>}
                  <a className="sf-btn" href={contact}>Ask an expert</a>
                </div>

                {r.alts.length ? (
                  <div className="sf-alts">
                    <span className="sf-alts-k">Also a good fit</span>
                    {r.alts.map((p, i) => (
                      <a key={p.id} className="sf-alt" href={signedIn ? orderHref(p) : '#signin'} {...(signedIn ? {} : { 'data-signin': '' })}>
                        <span className="sf-alt-logo"><BrandLogo slug={p.slug} name={BRAND_NAME[p.slug]} height={14} /></span>
                        <span className="sf-alt-txt"><strong>{p.name}</strong><small>{tagsOf(p).join(' · ')}</small></span>
                        <span className="sf-alt-pct">{Math.max(60, match - 5 - i * 4)}%</span>
                      </a>
                    ))}
                  </div>
                ) : null}
                <p className="sf-count">Compared {products.length} certificates · {r.count} fit your answers</p>
              </div>
            </div>
          ) : (
            <div className="sf-card"><div className="sf-card-body"><h2>No exact match</h2><p>Try a different combination, or <a href={contact}>ask an expert</a>.</p></div></div>
          )}
        </aside>
      </div>
    </div>
  );
}
