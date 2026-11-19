import { q } from './db';
import * as gg from './gogetssl';

function firstArray(obj) {
  if (Array.isArray(obj)) return obj;
  if (!obj || typeof obj !== 'object') return [];
  for (const v of Object.values(obj)) if (Array.isArray(v)) return v;
  for (const v of Object.values(obj)) if (v && typeof v === 'object' && !Array.isArray(v)) {
    const vals = Object.values(v);
    if (vals.length && vals.every((x) => x && typeof x === 'object')) return vals;
  }
  return [];
}

const truthy = (v) => v === true || v === 1 || v === '1' || v === 'yes' || v === 'true';

export function detectBrand(name, brand) {
  const s = `${brand || ''} ${name || ''}`.toLowerCase();
  if (s.includes('comodo') && !s.includes('sectigo')) return 'Sectigo';
  if (s.includes('digicert')) return 'DigiCert';
  if (s.includes('geotrust')) return 'GeoTrust';
  if (s.includes('rapidssl')) return 'RapidSSL';
  if (s.includes('thawte')) return 'Thawte';
  if (s.includes('gogetssl')) return 'GoGetSSL';
  if (s.includes('sectigo') || s.includes('comodo') || s.includes('positivessl') || s.includes('instantssl') || s.includes('essential')) return 'Sectigo';
  return brand ? String(brand).charAt(0).toUpperCase() + String(brand).slice(1) : 'Other';
}

export function detectValidation(name, raw) {
  const s = String(name || '').toLowerCase();
  const t = String(raw?.product_type || raw?.validation || raw?.type || '').toLowerCase();
  if (s.includes('code sign') || s.includes('codesign') || t.includes('code')) return 'code';
  if (t.startsWith('extended') || t === 'ev') return 'ev';
  if (t.startsWith('business') || t.startsWith('organization') || t === 'ov') return 'ov';
  if (t.startsWith('domain') || t === 'dv') return 'dv';
  if (/\bev\b/.test(s)) return 'ev';
  if (truthy(raw?.organization) || truthy(raw?.org_required) || /\b(ov|business|organization|instantssl|secure site|premium)\b/.test(s)) return 'ov';
  return 'dv';
}

/** Prices normalised to [{ months, price }] sorted by months. */
function normPrices(raw, priceRows) {
  const out = [];
  const add = (months, price) => {
    const m = Number(months);
    const p = Number(price);
    if (m > 0 && !isNaN(p)) out.push({ months: m, price: p });
  };
  const src = raw?.prices || raw?.price;
  if (Array.isArray(src)) src.forEach((p) => add(p.period || p.months, p.price));
  else if (src && typeof src === 'object') Object.entries(src).forEach(([k, v]) => add(k, typeof v === 'object' ? v.price : v));
  for (const r of priceRows || []) add(r.period || r.months, r.price);
  const maxMonths = Number(raw?.max_period) || 0;
  const seen = new Map();
  for (const p of out) if (!seen.has(p.months) && (!maxMonths || p.months <= maxMonths)) seen.set(p.months, p);
  return [...seen.values()].sort((a, b) => a.months - b.months);
}

/** Plan + Automate, ACME and CaaS products: kept out of the manual console for now. */
export function isAutomationProduct(name) {
  return /automate|acme|certificate-as-a-service|\bcaas\b/i.test(String(name || ''));
}

/** Refresh the catalogue from GoGetSSL. Keeps each product's enabled flag. */
export async function syncCatalogue() {
  let list = [];
  try {
    list = firstArray(await gg.getSslProducts());
  } catch {
    list = [];
  }
  if (!list.length) list = firstArray(await gg.getAllProducts());
  let priceRows = [];
  try {
    priceRows = firstArray(await gg.getAllPrices());
  } catch {
    priceRows = [];
  }
  const pricesById = new Map();
  for (const r of priceRows) {
    const id = Number(r.id || r.product_id);
    if (!pricesById.has(id)) pricesById.set(id, []);
    pricesById.get(id).push(r);
  }
  let count = 0;
  for (const p of list) {
    const id = Number(p.id || p.product_id);
    if (!id) continue;
    const name = p.product || p.name || p.product_name || `Product ${id}`;
    const wildcard = truthy(p.wildcard) || truthy(p.wildcard_enabled) || /wildcard/i.test(name);
    const multidomain = truthy(p.is_multidomain) || truthy(p.multi_domains) || truthy(p.multidomain) || /multi|\bsan\b|ucc|flex/i.test(name);
    await q(
      `insert into console.products (id, name, brand, validation, wildcard, multidomain, san_included, san_max, prices, raw, automation, synced_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
       on conflict (id) do update set name = excluded.name, brand = excluded.brand, validation = excluded.validation,
         wildcard = excluded.wildcard, multidomain = excluded.multidomain, san_included = excluded.san_included,
         san_max = excluded.san_max, prices = excluded.prices, raw = excluded.raw, automation = excluded.automation,
         enabled = console.products.enabled and not excluded.automation, synced_at = now()`,
      [
        id,
        name,
        detectBrand(name, p.brand),
        detectValidation(name, p),
        wildcard,
        multidomain,
        Number(p.multidomains_included || p.single_san_included || 0) || 0,
        Number(p.multidomains_maximum || p.max_san || p.san_max || 0) || 0,
        JSON.stringify(normPrices(p, pricesById.get(id))),
        JSON.stringify(p),
        isAutomationProduct(name)
      ]
    );
    count++;
  }
  count += await syncV2CodeSigning();
  return count;
}

/**
 * Code signing products that only API v2 lists (category "cs"), e.g. Sectigo and GoGetSSL code signing.
 * DigiCert code signing is already in the API v1 list. A failing v2 call leaves the catalogue as it is.
 */
async function syncV2CodeSigning() {
  const v2 = await import('./gogetssl-v2');
  if (!v2.v2Configured()) return 0;
  let list = [];
  try {
    const res = await v2.getProducts();
    list = Array.isArray(res) ? res : Array.isArray(res?.products) ? res.products : Array.isArray(res?.data) ? res.data : [];
  } catch {
    return 0;
  }
  let n = 0;
  for (const p of list) {
    if (!p || String(p.category || '').toLowerCase() !== 'cs') continue;
    const id = Number(p.id);
    if (!id) continue;
    const name = p.label || p.name || p.title || `Code signing ${id}`;
    const prices = (Array.isArray(p.prices) ? p.prices : [])
      .map((x) => ({ months: Number(x.term || x.months), price: Number(x.selling ?? x.price) }))
      .filter((x) => x.months > 0 && !isNaN(x.price));
    await q(
      `insert into console.products (id, name, brand, validation, wildcard, multidomain, san_included, san_max, prices, raw, automation, synced_at)
       values ($1, $2, $3, 'code', false, false, 0, 0, $4, $5, false, now())
       on conflict (id) do update set name = excluded.name, brand = excluded.brand, validation = 'code',
         prices = case when jsonb_array_length(excluded.prices) > 0 then excluded.prices else console.products.prices end,
         raw = console.products.raw || jsonb_build_object('v2', excluded.raw), synced_at = now()`,
      [id, name, detectBrand(name, p.brand || p.vendor), JSON.stringify(prices), JSON.stringify(p)]
    );
    n++;
  }
  return n;
}

export const TYPE_LABELS = {
  dv: 'Domain validated (DV)',
  ov: 'Organisation validated (OV)',
  ev: 'Extended validation (EV)',
  code: 'Code signing'
};

export function productKind(p) {
  if (p.validation === 'code') return 'code';
  if (p.wildcard) return 'wildcard';
  if (p.multidomain) return 'multi';
  return p.validation;
}
