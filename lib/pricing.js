import { q } from './db';

/**
 * Prices you set for customers (never the GoGetSSL cost). A workspace price wins over the default
 * price for all customers. Returns { [productId]: { [months]: { price, currency } } }.
 */
export async function customerPrices(workspaceId) {
  const rows = await q(
    `select distinct on (product_id, months) product_id, months, price, currency
       from console.customer_prices
      where workspace_id = $1 or workspace_id is null
      order by product_id, months, (workspace_id is null)`,
    [workspaceId || null]
  ).catch(() => []);
  const out = {};
  for (const r of rows) {
    out[r.product_id] = out[r.product_id] || {};
    out[r.product_id][r.months] = { price: Number(r.price), currency: r.currency };
  }
  return out;
}

export function fmtMoney(v, currency = 'USD') {
  if (v == null || isNaN(Number(v))) return null;
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(v));
  } catch {
    return `${Number(v).toFixed(2)} ${currency}`;
  }
}
