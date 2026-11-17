import { q, one } from './db';

const BASE = (process.env.GOGETSSL_API_URL || 'https://my.gogetssl.com/api').replace(/\/+$/, '');

export class GoGetSSLError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'GoGetSSLError';
    this.details = details;
  }
}

async function logCall(path, ok, ms, error) {
  try {
    await q('insert into console.api_log (path, ok, ms, error) values ($1, $2, $3, $4)', [path, ok, ms, error || null]);
  } catch {
    /* logging must never break a request */
  }
}

function toForm(data) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(data || {})) {
    if (v === undefined || v === null || v === '') continue;
    body.append(k, String(v));
  }
  return body;
}

function errorMessage(json) {
  if (!json || typeof json !== 'object') return null;
  if (json.error === true || json.error === 'true' || json.success === false) {
    return json.description || json.message || 'GoGetSSL returned an error';
  }
  return null;
}

async function fetchJson(path, { method = 'GET', query, form } = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, v);
  const started = Date.now();
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
      body: form ? toForm(form) : undefined,
      cache: 'no-store'
    });
  } catch (e) {
    await logCall(path, false, Date.now() - started, e.message);
    throw new GoGetSSLError('Could not reach GoGetSSL: ' + e.message);
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    await logCall(path, false, Date.now() - started, `HTTP ${res.status}, not JSON`);
    throw new GoGetSSLError(`GoGetSSL answered HTTP ${res.status} with an unexpected response`);
  }
  const err = errorMessage(json);
  await logCall(path, !err, Date.now() - started, err);
  return { json, err };
}

async function authKey(force = false) {
  if (!force) {
    const row = await one(
      `select value from console.kv where key = 'gg_auth' and updated_at > now() - interval '6 hours'`
    );
    if (row?.value?.key) return row.value.key;
  }
  if (!process.env.GOGETSSL_USER || !process.env.GOGETSSL_PASS) {
    throw new GoGetSSLError('GoGetSSL credentials are not configured');
  }
  const { json, err } = await fetchJson('/auth/', {
    method: 'POST',
    form: { user: process.env.GOGETSSL_USER, pass: process.env.GOGETSSL_PASS }
  });
  if (err || !json.key) throw new GoGetSSLError('GoGetSSL login failed: ' + (err || 'no key returned'));
  await q(
    `insert into console.kv (key, value, updated_at) values ('gg_auth', $1, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [JSON.stringify({ key: json.key })]
  );
  return json.key;
}

/** Authenticated call. Logs in again once if the key was rejected. */
export async function call(path, { method = 'GET', form, query } = {}, retried = false) {
  const key = await authKey(retried);
  const { json, err } = await fetchJson(path, { method, form, query: { ...(query || {}), auth_key: key } });
  if (err) {
    if (!retried && /auth|key|login|session/i.test(err)) return call(path, { method, form, query }, true);
    throw new GoGetSSLError(err, json);
  }
  return json;
}

// ---- Account
export const testConnection = async () => {
  await authKey(true);
  return getBalance();
};
export const getBalance = () => call('/account/balance/');
export const getAccount = () => call('/account/');

// ---- Products
export const getSslProducts = () => call('/products/ssl/');
export const getAllProducts = () => call('/products/');
export const getAllPrices = () => call('/products/all_prices/');
export const getProductDetails = (id) => call(`/products/details/${Number(id)}`);

// ---- Tools
export const decodeCsr = (csr) => call('/tools/csr/decode/', { method: 'POST', form: { csr } });
export const getDomainEmails = (domain) => call('/tools/domain/emails/', { method: 'POST', form: { domain } });
export const getDomainAlternative = (csr) => call('/tools/domain/alternative/', { method: 'POST', form: { csr } });
export const getWebServers = (supplier = 1) => call(`/tools/webservers/${Number(supplier)}`);

// ---- Orders
export const addSslOrder = (form) => call('/orders/add_ssl_order/', { method: 'POST', form });
export const addSslRenewOrder = (form) => call('/orders/add_ssl_renew_order/', { method: 'POST', form });
export const getOrderStatus = (orderId) => call(`/orders/status/${Number(orderId)}`);
export const reissueOrder = (orderId, form) =>
  call(`/orders/ssl/reissue/${Number(orderId)}`, { method: 'POST', form });
export const changeValidation = (orderId, approverEmailOrMethod) =>
  call(`/orders/ssl/change_validation_email/${Number(orderId)}`, {
    method: 'POST',
    form: { approver_email: approverEmailOrMethod }
  });
export const resendValidationEmail = (orderId) => call(`/orders/ssl/resend_validation_email/${Number(orderId)}`);
export const revalidate = (orderId, domain) =>
  call(`/orders/ssl/revalidate/${Number(orderId)}`, { method: 'POST', form: { domain } });
export const cancelOrder = (orderId, reason) =>
  call('/orders/cancel_ssl_order/', { method: 'POST', form: { order_id: orderId, reason } });
