import { q } from './db';
import { GoGetSSLError } from './gogetssl';

/**
 * GoGetSSL API v2 (JSON). Used for the subscription products:
 *   CaaS  (Sectigo ACME Certificate-as-a-Service)   /certificates/caas
 *   AIS   (Plan + Automate / AutoInstall SSL)        /certificates/ais
 * Auth header: "Authorization: GGS <partner code>:<API password>".
 */
const BASE = (process.env.GOGETSSL_API_V2_URL || 'https://my.gogetssl.com/api/v2').replace(/\/+$/, '');

export const CAAS_PRODUCT_IDS = [300];
export const AIS_PRODUCT_IDS = [400, 401, 402, 403];

/** Every v2 endpoint CertDesk uses for subscriptions, shown in the endpoint reference. */
export const ENDPOINTS = [
  { group: 'General', method: 'GET', path: '/authentication/validate', use: 'Check the partner code and API password (204 = valid)' },
  { group: 'General', method: 'GET', path: '/products', use: 'List v2 products with their categories and terms' },
  { group: 'General', method: 'GET', path: '/products/{id}', use: 'One product' },
  { group: 'CaaS', method: 'POST', path: '/certificates/caas', use: 'Order an ACME subscription: product + domains', body: '{ "product": { "id": 300 }, "domains": ["example.com", "*.example.com"] }' },
  { group: 'CaaS', method: 'GET', path: '/certificates/caas/{id}', use: 'Subscription details: ACME account (EAB key ID, HMAC key, server URL), domains, subscription dates' },
  { group: 'CaaS', method: 'POST', path: '/certificates/caas/{id}/domains', use: 'Add domains to the subscription', body: '["new.example.com"]' },
  { group: 'CaaS', method: 'DELETE', path: '/certificates/caas/{id}/domains/{domainId}', use: 'Remove one domain' },
  { group: 'CaaS', method: 'DELETE', path: '/certificates/caas/{id}/subscription', use: 'Turn auto-renewal off: the subscription ends at the end of its term' },
  { group: 'CaaS', method: 'POST', path: '/certificates/caas/{id}/cancel', use: 'Cancel the subscription (refund inside the refund window)', body: '{ "reason": "…", "refund": true }' },
  { group: 'Plan + Automate', method: 'POST', path: '/certificates/ais', use: 'Order a Plan + Automate subscription: product, domain, contacts', body: '{ "product": { "id": 402 }, "domains": ["example.com"], "contacts": { "primary": { "email": "…" }, "technical": { "email": "…" } } }' },
  { group: 'Plan + Automate', method: 'GET', path: '/certificates/ais/{id}', use: 'Details: AutoInstall status, SSO login and manage links, install method, ACME account, subscription dates' },
  { group: 'Plan + Automate', method: 'PATCH', path: '/certificates/ais/{id}', use: 'Switch install method. Not open at GoGetSSL yet (returns Not Found); hidden until GOGETSSL_AIS_METHOD_SWITCH=true', body: '{ "install_method": "autoinstall" | "acme" }' },
  { group: 'Plan + Automate', method: 'PATCH', path: '/certificates/ais/{id}/subscription', use: 'Turn auto-renewal on or off', body: '{ "auto_renew": false }' },
  { group: 'Plan + Automate', method: 'DELETE', path: '/certificates/ais/{id}/subscription', use: 'Turn auto-renewal off' },
  { group: 'Plan + Automate', method: 'POST', path: '/certificates/ais/{id}/cancel', use: 'Cancel the subscription (refund inside the refund window)', body: '{ "reason": "…", "refund": true }' }
];

function credentials() {
  const code = process.env.GOGETSSL_PARTNER_CODE;
  const pass = process.env.GOGETSSL_V2_PASS || process.env.GOGETSSL_PASS;
  if (!code || !pass) throw new GoGetSSLError('API v2 needs GOGETSSL_PARTNER_CODE and the API password in Vercel');
  return { code, pass };
}

export function v2Configured() {
  return !!(process.env.GOGETSSL_PARTNER_CODE && (process.env.GOGETSSL_V2_PASS || process.env.GOGETSSL_PASS));
}

async function logCall(method, path, ok, ms, error) {
  try {
    await q(`insert into console.api_log (path, ok, ms, error, api, method) values ($1, $2, $3, $4, 'v2', $5)`, [path, ok, ms, error || null, method]);
  } catch {
    /* logging never breaks a request */
  }
}

function v2Message(json, status) {
  if (json && typeof json === 'object') {
    if (json.message) {
      const errs = json.errors && typeof json.errors === 'object'
        ? Object.values(json.errors).flat().filter((x) => typeof x === 'string')
        : [];
      return errs.length ? `${json.message} (${errs.join('; ')})` : json.message;
    }
    if (json.description) return json.description;
    if (json.error && typeof json.error === 'string') return json.error;
  }
  return `HTTP ${status}`;
}

/** One v2 call. Returns parsed JSON, or null for an empty success (204). */
export async function callV2(path, method = 'GET', body) {
  const { code, pass } = credentials();
  const headers = { Authorization: `GGS ${code}:${pass}`, Accept: 'application/json', 'User-Agent': 'CertDesk/1.0' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const started = Date.now();
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, cache: 'no-store' });
  } catch (e) {
    await logCall(method, path, false, Date.now() - started, e.message);
    throw new GoGetSSLError('Could not reach GoGetSSL API v2: ' + e.message);
  }
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  if (res.status >= 400) {
    const msg = v2Message(json, res.status);
    await logCall(method, path, false, Date.now() - started, msg);
    throw new GoGetSSLError(msg, { status: res.status, body: json ?? text.slice(0, 500) });
  }
  if (text && json === null) {
    await logCall(method, path, false, Date.now() - started, `HTTP ${res.status}, not JSON`);
    throw new GoGetSSLError(`GoGetSSL API v2 answered HTTP ${res.status} with an unexpected response`);
  }
  await logCall(method, path, true, Date.now() - started, null);
  return json;
}

const id = (x) => Number(x);

// ---- General
export const validateAuth = () => callV2('/authentication/validate');
export const getProducts = () => callV2('/products');
export const getProduct = (productId) => callV2(`/products/${encodeURIComponent(productId)}`);

// ---- CaaS (ACME)
export const createCaas = ({ productId = 300, domains, term }) =>
  callV2('/certificates/caas', 'POST', { product: term ? { id: productId, term } : { id: productId }, domains });
export const getCaas = (itemId) => callV2(`/certificates/caas/${id(itemId)}`);
export const addCaasDomains = (itemId, domains) => callV2(`/certificates/caas/${id(itemId)}/domains`, 'POST', domains);
export const removeCaasDomain = (itemId, domainId) => callV2(`/certificates/caas/${id(itemId)}/domains/${encodeURIComponent(domainId)}`, 'DELETE');

// ---- AIS (Plan + Automate)
export const createAis = ({ productId, domain, primaryEmail, technicalEmail, installMethod, term }) => {
  const body = {
    product: term ? { id: productId, term } : { id: productId },
    domains: [domain],
    contacts: { primary: { email: primaryEmail }, technical: { email: technicalEmail || primaryEmail } }
  };
  if (installMethod === 'acme') body.install_method = 'acme';
  return callV2('/certificates/ais', 'POST', body);
};
export const getAis = (itemId) => callV2(`/certificates/ais/${id(itemId)}`);
export const setAisInstallMethod = (itemId, method) => callV2(`/certificates/ais/${id(itemId)}`, 'PATCH', { install_method: method });

// ---- Shared by both categories
export const getDetails = (kind, itemId) => (kind === 'caas' ? getCaas(itemId) : getAis(itemId));
export const setAutoRenew = (kind, itemId, on) => callV2(`/certificates/${kind}/${id(itemId)}/subscription`, 'PATCH', { auto_renew: !!on });
export const stopSubscription = (kind, itemId) => callV2(`/certificates/${kind}/${id(itemId)}/subscription`, 'DELETE');
export const cancelSubscription = (kind, itemId, reason, refund) => {
  const body = { reason: reason || 'Cancelled from CertDesk' };
  if (refund !== undefined && refund !== null) body.refund = !!refund;
  return callV2(`/certificates/${kind}/${id(itemId)}/cancel`, 'POST', body);
};

/** Pull the item id and order id out of a create response. */
export function createdIds(res) {
  const item = Array.isArray(res?.items) ? res.items[0] : null;
  return {
    orderId: res?.order?.id ?? res?.id ?? null,
    itemId: item?.id ?? res?.item_id ?? null,
    status: res?.order?.status || item?.status || null
  };
}

/** Normalise GET /products into a flat list. */
export function normaliseProducts(res) {
  const list = Array.isArray(res) ? res : Array.isArray(res?.products) ? res.products : Array.isArray(res?.data) ? res.data : [];
  return list.map((p) => ({
    id: Number(p.id),
    name: p.name || p.title || p.product || `Product ${p.id}`,
    category: p.category || p.type || null,
    brand: p.brand || p.vendor || null,
    terms: Array.isArray(p.terms) ? p.terms : Array.isArray(p.periods) ? p.periods : p.prices && typeof p.prices === 'object' ? Object.keys(p.prices).filter((k) => /^\d+$/.test(k)) : [],
    wildcard: p.wildcard ?? p.wildcard_enabled ?? /wildcard/i.test(p.name || ''),
    raw: p
  }));
}
