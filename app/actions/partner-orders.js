'use server';

import { redirect } from 'next/navigation';
import { q, one } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { addEvent } from '@/lib/orders';
import { importAccountOrders } from '@/lib/importer';

const enc = encodeURIComponent;
const back = (qs) => '/partner/orders' + (qs ? '?' + qs : '');

function idsFrom(formData) {
  return [...new Set(formData.getAll('ids').map(String).filter((x) => /^[0-9a-f-]{36}$/i.test(x)))];
}

/** Pull every order from the connected GoGetSSL account into the partner pool (unassigned). */
export async function importFromAccount() {
  const ctx = await requireAdmin();
  let r;
  try {
    r = await importAccountOrders(null, ctx.user.id, { deadline: Date.now() + 240000 });
  } catch (e) {
    redirect(back('err=' + enc('GoGetSSL: ' + e.message)));
  }
  const parts = [`${r.total} orders in the GoGetSSL account`, `${r.added} new imported`];
  if (r.already) parts.push(`${r.already} were already here`);
  if (r.added > r.detailed) parts.push(`${r.added - r.detailed} still loading details — run import again to finish`);
  redirect(back('ok=' + enc(parts.join(' · '))));
}

/** Assign the selected orders to a customer workspace. */
export async function assignOrders(formData) {
  const ctx = await requireAdmin();
  const ids = idsFrom(formData);
  const workspaceId = String(formData.get('workspace_id') || '');
  const keep = String(formData.get('keep') || '');
  if (!ids.length) redirect(back(keep + '&err=' + enc('Select at least one order')));
  const ws = /^[0-9a-f-]{36}$/i.test(workspaceId) ? await one('select id, name from console.workspaces where id = $1', [workspaceId]) : null;
  if (!ws) redirect(back(keep + '&err=' + enc('Choose a workspace to assign to')));
  const moved = await q(
    'update console.orders set workspace_id = $2, updated_at = now() where id = any($1::uuid[]) returning id',
    [ids, ws.id]
  );
  for (const m of moved) await addEvent(m.id, 'assigned', `Assigned to ${ws.name} by the partner`, ctx.user.id);
  redirect(back(keep + '&ok=' + enc(`${moved.length} order${moved.length === 1 ? '' : 's'} assigned to ${ws.name}`)));
}

/** Return the selected orders to the partner pool, hiding them from customers. */
export async function unassignOrders(formData) {
  const ctx = await requireAdmin();
  const ids = idsFrom(formData);
  const keep = String(formData.get('keep') || '');
  if (!ids.length) redirect(back(keep + '&err=' + enc('Select at least one order')));
  const moved = await q(
    'update console.orders set workspace_id = null, updated_at = now() where id = any($1::uuid[]) and workspace_id is not null returning id',
    [ids]
  );
  for (const m of moved) await addEvent(m.id, 'unassigned', 'Returned to the partner account', ctx.user.id);
  redirect(back(keep + '&ok=' + enc(`${moved.length} order${moved.length === 1 ? '' : 's'} moved back to your partner account`)));
}
