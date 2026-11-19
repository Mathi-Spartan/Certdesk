'use server';

import { redirect } from 'next/navigation';
import { q } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

/** Save customer prices for one workspace (or all customers). Empty fields clear a price. */
export async function savePrices(formData) {
  await requireAdmin();
  const ws = String(formData.get('workspace_id') || '');
  const workspaceId = /^[0-9a-f-]{36}$/i.test(ws) ? ws : null;
  const currency = /^[A-Z]{3}$/.test(String(formData.get('currency') || '')) ? String(formData.get('currency')) : 'USD';
  let saved = 0;
  for (const [key, raw] of formData.entries()) {
    const m = /^p_(\d+)_(\d+)$/.exec(key);
    if (!m) continue;
    const productId = Number(m[1]);
    const months = Number(m[2]);
    const v = String(raw).trim();
    await q(
      `delete from console.customer_prices where product_id = $1 and months = $2 and coalesce(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce($3::uuid, '00000000-0000-0000-0000-000000000000'::uuid)`,
      [productId, months, workspaceId]
    );
    if (v !== '' && !isNaN(Number(v)) && Number(v) >= 0) {
      await q(`insert into console.customer_prices (workspace_id, product_id, months, price, currency) values ($1, $2, $3, $4, $5)`, [workspaceId, productId, months, Number(v), currency]);
      saved++;
    }
  }
  redirect(`/partner/pricing?ws=${workspaceId || ''}&ok=${encodeURIComponent(`${saved} price${saved === 1 ? '' : 's'} saved`)}`);
}
