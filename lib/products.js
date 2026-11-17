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
  if (s.includes('digicert')) return 'DigiCert';
  if (s.includes('geotrust')) return 'GeoTrust';
  if (s.includes('rapidssl')) return 'RapidSSL';
  if (s.includes('thawte')) return 'Thawte';
  if (s.includes('gogetssl')) return 'GoGetSSL';
  if (s.includes('sectigo') || s.includes('comodo') || s.includes('positivessl') || s.includes('instantssl') || s.includes('essential')) return 'Sectigo';
  return brand || 'Other';
}

export function detectValidation(name, raw) {
  const s = String(name || '').toLowerCase();
  const t = String(raw?.product_type || raw?.validation || raw?.type || '').toLowerCase();
  if (s.includes('code sign') || s.includes('codesign') || t.includes('code')) return 'code';
  if (/\bev\b/.test(s) || t === 'ev') return 'ev';
  if (t === 'ov' || truthy(raw?.organization) || /\b(ov|business|organization|instantssl|secure site|premium)\b/.test(s)) return 'ov';
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
  const seen = new Map();
  for (const p of out) if (!seen.has(p.months)) seen.set(p.months, p);
  return [...seen.values()].sort((a, b) => a.months - b.months);
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
    const multidomain = truthy(p.is_multidomain) || truthy(p.multi_domains) || truthy(p.multidomain) || /multi|san|ucc/i.test(name);
    await q(
      `insert into console.products (id, name, brand, validation, wildcard, multidomain, san_included, san_max, prices, raw, synced_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
       on conflict (id) do update set name = excluded.name, brand = excluded.brand, validation = excluded.validation,
         wildcard = excluded.wildcard, multidomain = excluded.multidomain, san_included = excluded.san_included,
         san_max = excluded.san_max, prices = excluded.prices, raw = excluded.raw, synced_at = now()`,
      [
        id,
        name,
        detectBrand(name, p.brand),
        detectValidation(name, p),
        wildcard,
        multidomain,
        Number(p.multidomains_included || p.single_san_included || 0) || 0,
        Number(p.multidomains_maximum || p.max_san || 0) || 0,
        JSON.stringify(normPrices(p, pricesById.get(id))),
        JSON.stringify(p)
      ]
    );
    count++;
  }
  return count;
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
