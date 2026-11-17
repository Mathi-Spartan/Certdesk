import { q } from '@/lib/db';
import { syncOrder } from '@/lib/orders';
import { syncSubscription } from '@/lib/subscriptions';
import { v2Configured } from '@/lib/gogetssl-v2';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Daily: refresh every order that is still moving or close to expiry. */
export async function GET(req) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const rows = await q(
    `select * from console.orders
      where gg_order_id is not null
        and (status in ('validating','reissuing','incomplete','payment_needed','cancel_requested')
             or (status = 'issued' and valid_till <= current_date + 45))
      order by last_synced_at nulls first limit 60`
  );
  let synced = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      await syncOrder(r);
      synced++;
    } catch {
      failed++;
    }
  }
  let subs = 0;
  if (v2Configured()) {
    const srows = await q(
      `select * from console.subscriptions where item_id is not null and status <> 'cancelled'
        order by last_synced_at nulls first limit 40`
    );
    for (const r of srows) {
      try {
        await syncSubscription(r);
        subs++;
      } catch {
        failed++;
      }
    }
  }
  await q(
    `insert into console.kv (key, value, updated_at) values ('cron_last_run', $1, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [JSON.stringify({ synced, failed, subscriptions: subs })]
  );
  return Response.json({ synced, failed, subscriptions: subs });
}
