import { one, q } from './db';
import * as gg from './gogetssl';

/** Balance plus alert threshold. Cached for 10 minutes so the partner pages stay fast. */
export async function balanceStatus({ fresh = false } = {}) {
  const settings = (await one(`select value from console.kv where key = 'billing_settings'`))?.value || {};
  let cached = await one(`select value, updated_at from console.kv where key = 'billing_balance' and updated_at > now() - interval '10 minutes'`);
  let balance = cached?.value || null;
  if (!balance || fresh) {
    try {
      const b = await gg.getBalance();
      balance = { amount: Number(b?.balance ?? b?.amount ?? NaN), currency: b?.currency || 'USD' };
      await q(
        `insert into console.kv (key, value, updated_at) values ('billing_balance', $1, now())
         on conflict (key) do update set value = excluded.value, updated_at = now()`,
        [JSON.stringify(balance)]
      );
    } catch (e) {
      return { error: e.message, threshold: settings.threshold ?? null };
    }
  }
  const threshold = settings.threshold ?? null;
  const low = threshold !== null && Number.isFinite(balance.amount) && balance.amount < threshold;
  return { ...balance, threshold, low };
}

/** GoGetSSL list responses vary in shape; find the first array of records in them. */
export function rowsOf(res) {
  if (Array.isArray(res)) return res;
  if (!res || typeof res !== 'object') return [];
  for (const k of ['invoices', 'orders', 'transactions', 'data', 'list', 'items']) if (Array.isArray(res[k])) return res[k];
  const arr = Object.values(res).find((v) => Array.isArray(v));
  if (arr) return arr;
  const objs = Object.values(res).filter((v) => v && typeof v === 'object' && !Array.isArray(v));
  return objs.length > 1 ? objs : [];
}

export async function settle(fn) {
  try { return { data: await fn() }; } catch (e) { return { error: e.message }; }
}
