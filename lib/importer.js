import { q, one } from './db';
import * as gg from './gogetssl';
import { syncOrder } from './orders';

/** Every SSL order ID in the connected GoGetSSL account, newest first as GoGetSSL returns them. */
export async function listAccountOrders() {
  const out = [];
  const limit = 100;
  for (let offset = 0; offset < 50000; offset += limit) {
    const r = await gg.getAllSslOrders(limit, offset);
    const list = Array.isArray(r?.orders) ? r.orders : [];
    for (const o of list) if (Number(o.order_id)) out.push({ id: Number(o.order_id), status: o.status || null });
    if (list.length < limit) break;
  }
  return out;
}

function parseDate(v) {
  if (!v || String(v).startsWith('0000')) return null;
  const d = new Date(String(v).replace(' ', 'T') + (String(v).length <= 19 ? 'Z' : ''));
  return isNaN(d) ? null : d.toISOString();
}

/**
 * Import every order from the GoGetSSL account into a workspace.
 * Orders already in CertDesk (any workspace) are left where they are.
 * Stops pulling details at `deadline` (ms timestamp); the rest are filled in on first view.
 */
export async function importAccountOrders(workspaceId, userId, { deadline = 0, onProgress } = {}) {
  const all = await listAccountOrders();
  const ids = all.map((o) => o.id);
  const have = new Set(
    ids.length ? (await q('select gg_order_id from console.orders where gg_order_id = any($1::bigint[])', [ids])).map((r) => Number(r.gg_order_id)) : []
  );
  const res = { total: all.length, already: have.size, added: 0, detailed: 0, failed: [] };
  for (const o of all) {
    if (have.has(o.id)) continue;
    const row = await one(
      `insert into console.orders (workspace_id, gg_order_id, created_by, status, auto_renew) values ($1, $2, $3, 'validating', false) returning *`,
      [workspaceId, o.id, userId]
    );
    res.added += 1;
    if (deadline && Date.now() > deadline) continue;
    try {
      const s = await syncOrder(row);
      await q(
        `update console.orders set
           product_name = coalesce(product_name, (select name from console.products p where p.id = console.orders.product_id)),
           created_at = coalesce($2::timestamptz, created_at)
         where id = $1`,
        [s.id, parseDate(s.raw?.date || s.raw?.order_date || s.raw?.begin_date)]
      );
      res.detailed += 1;
    } catch (e) {
      res.failed.push({ id: o.id, error: String(e.message || e).slice(0, 160) });
    }
    onProgress?.(res);
  }
  return res;
}
