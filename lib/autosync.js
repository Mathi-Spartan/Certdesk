import { q, one } from './db';
import { syncOrder } from './orders';
import { importAccountOrders } from './importer';

/**
 * Look for orders placed directly in GoGetSSL and add them to the partner pool (unassigned).
 * Runs at most once every `minutes` across all requests: the kv row doubles as a lock.
 */
export async function maybeImportNew({ minutes = 10, budgetMs = 20000 } = {}) {
  const lock = await one(
    `insert into console.kv (key, value, updated_at) values ('auto_import', '{}'::jsonb, now())
     on conflict (key) do update set updated_at = now()
       where console.kv.updated_at < now() - make_interval(mins => $1::int)
     returning updated_at`,
    [minutes]
  );
  if (!lock) return null;
  const deadline = Date.now() + budgetMs;
  let r = { total: 0, added: 0, detailed: 0, already: 0, failed: [] };
  let error = null;
  try {
    r = await importAccountOrders(null, null, { deadline });
    // Orders added earlier whose details never loaded
    const stubs = await q(`select * from console.orders where gg_order_id is not null and last_synced_at is null order by created_at desc limit 25`);
    for (const s of stubs) {
      if (Date.now() > deadline) break;
      try { await syncOrder(s); r.detailed += 1; } catch { /* next run */ }
    }
  } catch (e) {
    error = String(e?.message || e).slice(0, 200);
  }
  await q(`update console.kv set value = $1 where key = 'auto_import'`, [JSON.stringify({ at: new Date().toISOString(), total: r.total, added: r.added, detailed: r.detailed, error })]);
  return { ...r, error };
}

export async function lastAutoImport() {
  const row = await one(`select value, updated_at from console.kv where key = 'auto_import'`).catch(() => null);
  return row ? { ...(row.value || {}), checkedAt: row.updated_at } : null;
}
