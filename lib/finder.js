/**
 * SSL Finder: turns a few plain answers into one recommended certificate plus alternatives.
 * Pure function, no prices; runs in the browser.
 */

export const BRAND_TIER = { digicert: 5, geotrust: 4, thawte: 4, sectigo: 3, rapidssl: 3, comodo: 2, gogetssl: 1 };

function brandSlug(name) {
  const s = name.toLowerCase();
  for (const b of ['gogetssl', 'digicert', 'geotrust', 'thawte', 'rapidssl']) if (s.includes(b)) return b;
  if (/positivessl|essential|instantssl|comodo/.test(s)) return 'comodo';
  return 'sectigo';
}

const isMulti = (p) => p.multidomain || /\b(SAN|UCC|MDC|Multi-Domain)\b/i.test(p.name);
const EXCLUDE = /trial|vpro|public ip/i;

export const LEVEL_INFO = {
  dv: { label: 'Domain Validation (DV)', checks: 'Domain ownership only', time: 'Minutes', shows: 'Padlock in the browser' },
  ov: { label: 'Organisation Validation (OV)', checks: 'Domain and registered company', time: '1–3 working days', shows: 'Padlock, company name in the certificate' },
  ev: { label: 'Extended Validation (EV)', checks: 'Full legal, physical and operational checks', time: '3–5 working days', shows: 'Padlock, verified legal entity in the certificate' },
  code: { label: 'Code Signing', checks: 'Publisher identity (company or individual)', time: '1–5 working days', shows: 'Your name as publisher when software is installed' }
};

/**
 * answers: { secure: 'one'|'subs'|'many'|'code', trust: 'basic'|'business'|'high', domains: n,
 *            wildMulti: bool, manage: 'manual'|'agent'|'acme', brand: 'any'|slug, priority: 'value'|'balanced'|'premium',
 *            speed: 'today'|'week'|'any', codeLevel: 'standard'|'ev' }
 */
export function recommend(products, a) {
  const notes = [];
  const why = [];
  const list = products.filter((p) => !EXCLUDE.test(p.name)).map((p) => ({ ...p, slug: brandSlug(p.name), multi: isMulti(p) }));

  // 1. Validation level
  let level;
  if (a.secure === 'code') level = 'code';
  else if (a.trust === 'high') level = 'ev';
  else if (a.trust === 'business') level = 'ov';
  else level = 'dv';

  if (level !== 'code' && level !== 'dv' && a.speed === 'today') {
    notes.push(`${level.toUpperCase()} needs company checks that take ${LEVEL_INFO[level].time.toLowerCase()}. If the site must be secure today, start with a DV certificate now and switch when ${level.toUpperCase()} is issued.`);
  }
  // EV cannot cover wildcards
  if (level === 'ev' && (a.secure === 'subs' || (a.secure === 'many' && a.wildMulti))) {
    notes.push('EV certificates cannot include wildcard names (an industry rule). We suggest EV multi-domain listing each subdomain, or OV wildcard if every subdomain must be covered.');
  }

  // 2. Automation
  let automated = false;
  if (level === 'dv' && a.manage !== 'manual' && a.secure !== 'code') automated = true;
  if (level !== 'dv' && level !== 'code' && a.manage !== 'manual') {
    notes.push('Automated plans are Domain Validation only. Your certificate will be managed here with reissue reminders; automation can be added for DV sites.');
  }

  // 3. Candidate products
  let cands;
  if (level === 'code') {
    cands = list.filter((p) => p.validation === 'code' && (a.codeLevel === 'ev' ? /\bEV\b/.test(p.name) : !/\bEV\b/.test(p.name)));
    why.push(a.codeLevel === 'ev' ? 'EV code signing builds Windows SmartScreen reputation immediately and is required for kernel-mode drivers.' : 'Standard code signing shows your verified name as the publisher when people install your software.');
    notes.push('Code signing keys must be kept on a hardware token or HSM (industry rule since June 2023). The CA can ship a token or you can use your own HSM.');
  } else if (automated) {
    if (a.manage === 'acme' && (a.secure === 'many' || a.domains > 3)) {
      cands = list.filter((p) => p.automation && /acme/i.test(p.name));
      why.push('ACME Certificate-as-a-Service covers many domains with unlimited certificates from your own ACME client.');
    } else {
      cands = list.filter((p) => p.automation && !/acme/i.test(p.name) && (a.secure === 'subs' ? p.wildcard : !p.wildcard));
      if (a.secure === 'many') notes.push('Plan + Automate covers one domain per plan. For many domains, choose one plan per site or ACME CaaS with your own ACME client.');
      why.push(a.manage === 'agent' ? 'The AutoInstall agent installs and renews the certificate on Apache, NGINX or IIS for you.' : 'Your ACME client (Certbot, acme.sh, Caddy, cert-manager) can request and renew it.');
    }
    why.push('Renewals happen on their own, which matters as lifetimes drop to 100 days in March 2027 and 47 days in 2029.');
  }
  if (!cands || !cands.length) {
    automated = false;
    const lv = list.filter((p) => !p.automation && p.validation === level);
    if (a.secure === 'one') cands = lv.filter((p) => !p.wildcard && !p.multi);
    else if (a.secure === 'subs') cands = level === 'ev' ? lv.filter((p) => p.multi && !p.wildcard) : lv.filter((p) => p.wildcard && !p.multi);
    else {
      const wantWild = a.wildMulti && level !== 'ev';
      cands = lv.filter((p) => p.multi && (wantWild ? p.wildcard : !p.wildcard) && (!p.san_max || p.san_max >= a.domains));
      if (!cands.length) cands = lv.filter((p) => p.multi);
    }
  }

  // 4. Rank: brand preference first, then priority (value ↔ premium), then product tier words
  const prio = a.priority || 'balanced';
  const score = (p) => {
    let s = 0;
    if (a.brand && a.brand !== 'any') s += p.slug === a.brand ? 100 : 0;
    const t = BRAND_TIER[p.slug] || 2;
    if (prio === 'premium') s += t * 10;
    else if (prio === 'value') s += (6 - t) * 10;
    else s += 30 - Math.abs(t - 3) * 8;
    const pro = /\bPRO\b|Premium|Enterprise/i.test(p.name);
    if (prio === 'premium' && pro) s += 4;
    if (prio === 'value' && pro) s -= 4;
    if (/Basic|Standard|PositiveSSL|Essential|Domain SSL|SSL 123|QuickSSL/i.test(p.name) && prio !== 'premium') s += 2;
    return s;
  };
  const ranked = [...cands].sort((x, y) => score(y) - score(x) || x.name.localeCompare(y.name));
  const top = ranked[0] || null;
  // alternatives: prefer different brands
  const alts = [];
  for (const p of ranked.slice(1)) {
    if (alts.length >= 2) break;
    if (p.slug !== top?.slug && !alts.some((x) => x.slug === p.slug)) alts.push(p);
  }
  for (const p of ranked.slice(1)) { if (alts.length >= 2) break; if (!alts.includes(p)) alts.push(p); }

  // 5. Why it fits
  if (a.secure === 'one') why.unshift('Covers one website; the www and non-www versions are both included.');
  if (a.secure === 'subs') why.unshift(level === 'ev' ? 'Lists each subdomain by name on one EV certificate.' : 'One wildcard certificate covers every first-level subdomain (*.yourdomain.com).');
  if (a.secure === 'many') why.unshift(`One certificate for ${a.domains} different domain names${a.wildMulti && level !== 'ev' ? ', including wildcard names' : ''}.`);
  if (level === 'dv') why.push('Issued in minutes after a single DNS record or file check.');
  if (level === 'ov') why.push('Your verified company name is written into the certificate, which customers and auditors can check.');
  if (level === 'ev') why.push('The strictest verification available, expected by banks, payment pages and regulated industries.');
  if (top && a.brand && a.brand !== 'any' && top.slug !== a.brand) notes.push('No certificate from your preferred brand fits these answers, so we picked the closest match.');
  if (top && prio === 'premium') why.push('A top-tier brand with strong recognition, warranty and support.');
  if (top && prio === 'value') why.push('A trusted, cost-effective brand: the same 256-bit encryption at a lower price point.');

  return { level, automated, top, alts, why, notes, count: cands.length };
}
