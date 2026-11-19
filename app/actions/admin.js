'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { q, one } from '@/lib/db';
import { requireAdmin, setActingWorkspace, hashPassword, generatePassword } from '@/lib/auth';
import { syncCatalogue } from '@/lib/products';
import { syncOrder, addEvent } from '@/lib/orders';
import * as gg from '@/lib/gogetssl';

const enc = encodeURIComponent;

export async function openWorkspace(formData) {
  const ctx = await requireAdmin();
  const id = String(formData.get('workspace_id'));
  const ws = await one('select id from console.workspaces where id = $1', [id]);
  if (!ws) redirect('/partner?err=' + enc('Workspace not found'));
  await setActingWorkspace(ctx.tokenHash, ws.id);
  redirect('/dashboard');
}

export async function exitWorkspace() {
  const ctx = await requireAdmin();
  await setActingWorkspace(ctx.tokenHash, null);
  redirect('/partner');
}

export async function createWorkspace(formData) {
  await requireAdmin();
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('contact_email') || '').trim() || null;
  if (!name) redirect('/partner?err=' + enc('Give the workspace a name'));
  const ws = await one('insert into console.workspaces (name, contact_email) values ($1, $2) returning id', [name, email]);
  redirect(`/partner/workspaces/${ws.id}?ok=` + enc('Workspace created. Add a login for the customer below.'));
}

export async function createCustomerUser(prev, formData) {
  await requireAdmin();
  const workspaceId = String(formData.get('workspace_id'));
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  if (!name || !email) return { error: 'Name and email are required.' };
  const exists = await one('select id from console.users where email = $1', [email]);
  if (exists) return { error: 'An account with that email already exists.' };
  const password = String(formData.get('password') || '').trim() || generatePassword();
  if (password.length < 10) return { error: 'Use at least 10 characters, or leave the password blank to generate one.' };
  await q(
    `insert into console.users (email, name, password_hash, role, workspace_id) values ($1, $2, $3, 'customer', $4)`,
    [email, name, hashPassword(password), workspaceId]
  );
  revalidatePath(`/partner/workspaces/${workspaceId}`);
  return { ok: true, email, password };
}

export async function resetUserPassword(prev, formData) {
  await requireAdmin();
  const userId = String(formData.get('user_id'));
  const user = await one(`select id, email, workspace_id from console.users where id = $1 and role = 'customer'`, [userId]);
  if (!user) return { error: 'User not found.' };
  const password = generatePassword();
  await q('update console.users set password_hash = $2 where id = $1', [user.id, hashPassword(password)]);
  await q('delete from console.sessions where user_id = $1', [user.id]);
  return { ok: true, email: user.email, password };
}

export async function setUserActive(formData) {
  await requireAdmin();
  const userId = String(formData.get('user_id'));
  const active = formData.get('active') === 'true';
  const u = await one(
    `update console.users set is_active = $2 where id = $1 and role = 'customer' returning workspace_id`,
    [userId, active]
  );
  if (!active) await q('delete from console.sessions where user_id = $1', [userId]);
  redirect(`/partner/workspaces/${u?.workspace_id}?ok=` + enc(active ? 'Login enabled' : 'Login disabled and signed out'));
}

/** Assign an existing GoGetSSL order to a workspace. */
export async function importOrder(formData) {
  const ctx = await requireAdmin();
  const workspaceId = String(formData.get('workspace_id'));
  const ggId = Number(String(formData.get('gg_order_id') || '').trim());
  const back = `/partner/workspaces/${workspaceId}`;
  if (!ggId) redirect(back + '?err=' + enc('Enter a GoGetSSL order ID'));
  const existing = await one('select id, workspace_id from console.orders where gg_order_id = $1', [ggId]);
  if (existing) {
    if (existing.workspace_id === workspaceId) redirect(back + '?err=' + enc('That order is already in this workspace'));
    await q('update console.orders set workspace_id = $2, updated_at = now() where id = $1', [existing.id, workspaceId]);
    await addEvent(existing.id, 'assigned', 'Moved to this workspace by the partner', ctx.user.id);
    redirect(back + '?ok=' + enc(`Order ${ggId} moved to this workspace`));
  }
  let msg;
  try {
    const st = await gg.getOrderStatus(ggId);
    const row = await one(
      `insert into console.orders (workspace_id, gg_order_id, product_id, common_name, created_by, status)
       values ($1, $2, $3, $4, $5, 'validating') returning *`,
      [workspaceId, ggId, st.product_id ? Number(st.product_id) : null, st.domain || null, ctx.user.id]
    );
    const p = row.product_id ? await one('select name from console.products where id = $1', [row.product_id]) : null;
    if (p) await q('update console.orders set product_name = $2 where id = $1', [row.id, p.name]);
    await addEvent(row.id, 'assigned', `Imported from GoGetSSL order ${ggId}`, ctx.user.id);
    await syncOrder(row);
    msg = `Order ${ggId} (${st.domain || 'no domain yet'}) assigned`;
  } catch (e) {
    redirect(back + '?err=' + enc('GoGetSSL: ' + e.message));
  }
  redirect(back + '?ok=' + enc(msg));
}

export async function unassignOrder(formData) {
  await requireAdmin();
  const orderId = String(formData.get('order_id'));
  const workspaceId = String(formData.get('workspace_id'));
  await q('delete from console.orders where id = $1 and workspace_id = $2', [orderId, workspaceId]);
  redirect(`/partner/workspaces/${workspaceId}?ok=` + enc('Order removed from this workspace (it still exists in GoGetSSL)'));
}

export async function syncCatalogueAction() {
  await requireAdmin();
  let n;
  try {
    n = await syncCatalogue();
  } catch (e) {
    redirect('/partner/catalogue?err=' + enc('GoGetSSL: ' + e.message));
  }
  redirect('/partner/catalogue?ok=' + enc(`${n} products synced from GoGetSSL`));
}

export async function setProductEnabled(formData) {
  await requireAdmin();
  const id = Number(formData.get('product_id'));
  const enabled = formData.get('enabled') === 'true';
  await q('update console.products set enabled = $2 where id = $1 and (not automation or $2 = false)', [id, enabled]);
  revalidatePath('/partner/catalogue');
}

export async function testApi() {
  await requireAdmin();
  let msg;
  try {
    const b = await gg.testConnection();
    msg = `Connected. Balance ${b.balance ?? '?'} ${b.currency || ''}`.trim();
  } catch (e) {
    redirect('/partner/api?err=' + enc(e.message));
  }
  redirect('/partner/api?ok=' + enc(msg));
}

/** Master account: choose which products a customer workspace can order. Everything else shows as coming soon. */
export async function saveWorkspaceProducts(formData) {
  await requireAdmin();
  const ws = String(formData.get('workspace_id') || '');
  if (!/^[0-9a-f-]{36}$/i.test(ws)) redirect('/partner');
  const ids = [...new Set(formData.getAll('product_id').map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  const known = ids.length ? (await q('select id from console.products where id = any($1::int[])', [ids])).map((r) => Number(r.id)) : [];
  await q('delete from console.workspace_products where workspace_id = $1 and not (product_id = any($2::int[]))', [ws, known]);
  if (known.length) {
    await q(
      `insert into console.workspace_products (workspace_id, product_id) select $1, unnest($2::int[]) on conflict do nothing`,
      [ws, known]
    );
  }
  revalidatePath(`/partner/workspaces/${ws}/products`);
  redirect(`/partner/workspaces/${ws}/products?ok=${encodeURIComponent(`${known.length} product${known.length === 1 ? '' : 's'} available to order for this customer`)}`);
}
