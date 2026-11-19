'use server';

import { redirect } from 'next/navigation';
import { q, one } from '@/lib/db';
import { requireWorkspace, requireAdmin } from '@/lib/auth';
import { canOrderProduct, CLOSED_MSG } from '@/lib/ordering';
import * as v2 from '@/lib/gogetssl-v2';
import { syncSubscription, addSubEvent, getSubForWorkspace, kindForProduct, SUBSCRIPTION_PRODUCTS, KIND_LABEL } from '@/lib/subscriptions';

const enc = encodeURIComponent;
const DOMAIN_RE = /^(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanDomain(d) {
  return String(d || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}
function domainList(text) {
  return [...new Set(String(text || '').split(/[\s,;]+/).map(cleanDomain).filter(Boolean))];
}

/** Runs a GoGetSSL call for a subscription, then sends the user back with a message. */
async function withSub(formData, fn) {
  const ctx = await requireWorkspace();
  const sub = await getSubForWorkspace(String(formData.get('sub_id')), ctx.workspaceId);
  if (!sub) redirect('/dashboard?err=' + enc('Subscription not found'));
  const back = `/subscriptions/${sub.id}`;
  if (!sub.item_id) redirect(back + '?err=' + enc('This subscription has no GoGetSSL item ID yet'));
  let msg;
  try {
    msg = await fn(sub, ctx);
  } catch (e) {
    await addSubEvent(sub.id, 'error', 'GoGetSSL refused: ' + e.message, ctx.user.id);
    redirect(back + '?err=' + enc('GoGetSSL: ' + e.message));
  }
  try {
    await syncSubscription(sub);
  } catch {
    /* the next page load retries */
  }
  redirect(back + '?ok=' + enc(msg));
}

export async function orderSubscription(prev, formData) {
  const ctx = await requireWorkspace();
  const productId = Number(formData.get('product_id'));
  if (!(await canOrderProduct(ctx, productId))) return { error: CLOSED_MSG };
  const kind = kindForProduct(productId);
  const product = SUBSCRIPTION_PRODUCTS.find((p) => p.id === productId);
  if (!kind || !product) return { error: 'Choose a subscription product' };
  const domains = domainList(formData.get('domains'));
  if (!domains.length) return { error: 'Add at least one domain' };
  const bad = domains.find((d) => !DOMAIN_RE.test(d));
  if (bad) return { error: `"${bad}" is not a valid domain name` };
  const wildcardProduct = /wildcard/i.test(product.name);
  if (kind === 'ais') {
    if (domains.length > 1) return { error: 'A Plan + Automate subscription covers one domain' };
    if (wildcardProduct && !domains[0].startsWith('*.')) domains[0] = '*.' + domains[0].replace(/^\*\./, '');
    if (!wildcardProduct && domains[0].startsWith('*.')) return { error: 'Choose a wildcard plan for a *. domain' };
  }
  const primaryEmail = String(formData.get('primary_email') || '').trim();
  const technicalEmail = String(formData.get('technical_email') || '').trim() || primaryEmail;
  if (kind === 'ais' && (!EMAIL_RE.test(primaryEmail) || !EMAIL_RE.test(technicalEmail))) return { error: 'Enter valid contact emails' };
  const installMethod = 'autoinstall';

  let created;
  try {
    created = kind === 'caas'
      ? await v2.createCaas({ productId, domains })
      : await v2.createAis({ productId, domain: domains[0], primaryEmail, technicalEmail, installMethod });
  } catch (e) {
    return { error: 'GoGetSSL: ' + e.message };
  }
  const ids = v2.createdIds(created);
  const row = await one(
    `insert into console.subscriptions (workspace_id, kind, product_id, product_name, gg_order_id, item_id, status, primary_domain, domains, contacts, raw, created_by, install_method)
     values ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, $10, $11, $12) returning *`,
    [
      ctx.workspaceId, kind, productId, product.name, ids.orderId, ids.itemId, domains[0],
      JSON.stringify(domains.map((name) => ({ id: null, name }))),
      kind === 'ais' ? JSON.stringify({ primary: primaryEmail, technical: technicalEmail }) : null,
      JSON.stringify(created), ctx.user.id, kind === 'ais' ? installMethod : 'acme'
    ]
  );
  await addSubEvent(row.id, 'ordered', `Ordered ${product.name} for ${domains.join(', ')}${ids.orderId ? ` · GoGetSSL order ${ids.orderId}` : ''}`, ctx.user.id, `POST /certificates/${kind}`);
  try {
    await syncSubscription(row);
  } catch {
    /* details may take a moment to appear */
  }
  redirect(`/subscriptions/${row.id}?ok=` + enc(`${KIND_LABEL[kind]} subscription ordered`));
}

export async function refreshSubscription(formData) {
  await withSub(formData, async () => 'Refreshed from GoGetSSL');
}

export async function addCaasDomains(formData) {
  await withSub(formData, async (sub, ctx) => {
    if (sub.kind !== 'caas') throw new Error('Only ACME CaaS subscriptions take extra domains');
    const existing = new Set((sub.domains || []).map((d) => d.name));
    const domains = domainList(formData.get('domains')).filter((d) => !existing.has(d));
    if (!domains.length) throw new Error('Enter at least one new domain');
    const bad = domains.find((d) => !DOMAIN_RE.test(d));
    if (bad) throw new Error(`"${bad}" is not a valid domain name`);
    await v2.addCaasDomains(sub.item_id, domains);
    await addSubEvent(sub.id, 'domains', `Added ${domains.join(', ')}`, ctx.user.id, `POST /certificates/caas/${sub.item_id}/domains`);
    return `Added ${domains.length} domain${domains.length > 1 ? 's' : ''}`;
  });
}

export async function removeCaasDomain(formData) {
  await withSub(formData, async (sub, ctx) => {
    if (sub.kind !== 'caas') throw new Error('Only ACME CaaS subscriptions have removable domains');
    const name = String(formData.get('domain') || '');
    // resolve the domain id from fresh details, as GoGetSSL needs it
    const details = await v2.getCaas(sub.item_id);
    const list = details?.items?.[0]?.domains || [];
    const hit = list.find((d) => (d.name || d.domain) === name);
    if (!hit?.id) throw new Error(`Could not find the GoGetSSL domain ID for ${name}`);
    if (list.length <= 1) throw new Error('A subscription needs at least one domain. Cancel it instead.');
    await v2.removeCaasDomain(sub.item_id, hit.id);
    await addSubEvent(sub.id, 'domains', `Removed ${name}`, ctx.user.id, `DELETE /certificates/caas/${sub.item_id}/domains/${hit.id}`);
    return `Removed ${name}`;
  });
}

export async function switchInstallMethod(formData) {
  await withSub(formData, async (sub, ctx) => {
    if (sub.kind !== 'ais') throw new Error('Install method applies to Plan + Automate');
    const method = formData.get('method') === 'acme' ? 'acme' : 'autoinstall';
    // GoGetSSL's API has no switch yet; the switch itself happens in AutoInstall SSL. Call it once it exists.
    if (process.env.GOGETSSL_AIS_METHOD_SWITCH === 'true') await v2.setAisInstallMethod(sub.item_id, method);
    await q('update console.subscriptions set install_method = $2, updated_at = now() where id = $1', [sub.id, method]);
    const label = method === 'acme' ? 'your own ACME client' : 'the AutoInstall agent';
    await addSubEvent(sub.id, 'method', `Set up for ${label}`, ctx.user.id);
    return method === 'acme'
      ? 'Showing the ACME steps. Choose ACME in AutoInstall SSL to make the switch.'
      : 'Showing the agent steps. Choose your server in AutoInstall SSL to make the switch.';
  });
}

export async function setAutoRenewal(formData) {
  await withSub(formData, async (sub, ctx) => {
    const on = formData.get('on') === 'true';
    let endpoint;
    if (on) {
      await v2.setAutoRenew(sub.kind, sub.item_id, true);
      endpoint = `PATCH /certificates/${sub.kind}/${sub.item_id}/subscription`;
    } else if (sub.kind === 'ais') {
      await v2.setAutoRenew('ais', sub.item_id, false);
      endpoint = `PATCH /certificates/ais/${sub.item_id}/subscription`;
    } else {
      await v2.stopSubscription('caas', sub.item_id);
      endpoint = `DELETE /certificates/caas/${sub.item_id}/subscription`;
    }
    await q('update console.subscriptions set auto_renew = $2, updated_at = now() where id = $1', [sub.id, on]);
    await addSubEvent(sub.id, 'renewal', on ? 'Auto-renewal turned on' : 'Auto-renewal turned off', ctx.user.id, endpoint);
    return on ? 'Auto-renewal is on' : 'Auto-renewal is off. The subscription ends at the end of its term.';
  });
}

export async function cancelSub(formData) {
  await withSub(formData, async (sub, ctx) => {
    if (String(formData.get('confirm') || '').trim().toLowerCase() !== 'cancel') throw new Error('Type CANCEL to confirm');
    const reason = String(formData.get('reason') || '').trim() || 'Cancelled from CertDesk';
    const refund = formData.get('refund') === 'on';
    await v2.cancelSubscription(sub.kind, sub.item_id, reason, refund);
    await q(`update console.subscriptions set cancel_requested_at = now(), updated_at = now() where id = $1`, [sub.id]);
    await addSubEvent(sub.id, 'cancel', `Cancellation sent${refund ? ' with refund request' : ''}: ${reason}`, ctx.user.id, `POST /certificates/${sub.kind}/${sub.item_id}/cancel`);
    return 'Cancellation sent to GoGetSSL';
  });
}

export async function saveSubTags(formData) {
  const ctx = await requireWorkspace();
  const sub = await getSubForWorkspace(String(formData.get('sub_id')), ctx.workspaceId);
  if (!sub) redirect('/dashboard');
  const tags = [...new Set(String(formData.get('tags') || '').split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 8);
  await q('update console.subscriptions set tags = $2, updated_at = now() where id = $1', [sub.id, tags]);
  redirect(`/subscriptions/${sub.id}?ok=` + enc('Tags saved'));
}

// ---- Partner only

/** Assign an existing GoGetSSL subscription item to a workspace. */
export async function importSubscription(formData) {
  const ctx = await requireAdmin();
  const workspaceId = String(formData.get('workspace_id'));
  const kind = formData.get('kind') === 'ais' ? 'ais' : 'caas';
  const itemId = Number(String(formData.get('item_id') || '').trim());
  const back = `/partner/workspaces/${workspaceId}`;
  if (!itemId) redirect(back + '?err=' + enc('Enter the GoGetSSL item ID of the subscription'));
  const existing = await one('select id, workspace_id from console.subscriptions where item_id = $1', [itemId]);
  if (existing) {
    await q('update console.subscriptions set workspace_id = $2, updated_at = now() where id = $1', [existing.id, workspaceId]);
    redirect(back + '?ok=' + enc(`Subscription ${itemId} moved to this workspace`));
  }
  let msg;
  try {
    const details = await v2.getDetails(kind, itemId);
    const item = details?.items?.[0] || {};
    const productId = Number(item.product?.id ?? details?.product?.id ?? (kind === 'caas' ? 300 : 0)) || null;
    const name = SUBSCRIPTION_PRODUCTS.find((p) => p.id === productId)?.name || item.product?.name || KIND_LABEL[kind];
    const row = await one(
      `insert into console.subscriptions (workspace_id, kind, product_id, product_name, item_id, created_by) values ($1, $2, $3, $4, $5, $6) returning *`,
      [workspaceId, kind, productId, name, itemId, ctx.user.id]
    );
    await addSubEvent(row.id, 'assigned', `Imported GoGetSSL ${KIND_LABEL[kind]} item ${itemId}`, ctx.user.id, `GET /certificates/${kind}/${itemId}`);
    const synced = await syncSubscription(row);
    msg = `${KIND_LABEL[kind]} ${itemId} (${synced.primary_domain || 'no domain'}) assigned`;
  } catch (e) {
    redirect(back + '?err=' + enc('GoGetSSL: ' + e.message));
  }
  redirect(back + '?ok=' + enc(msg));
}

export async function unassignSubscription(formData) {
  await requireAdmin();
  const id = String(formData.get('sub_id'));
  const workspaceId = String(formData.get('workspace_id'));
  await q('delete from console.subscriptions where id = $1 and workspace_id = $2', [id, workspaceId]);
  redirect(`/partner/workspaces/${workspaceId}?ok=` + enc('Subscription removed from this workspace (it still exists in GoGetSSL)'));
}

export async function testV2() {
  await requireAdmin();
  let msg;
  try {
    await v2.validateAuth();
    const products = v2.normaliseProducts(await v2.getProducts());
    await q(
      `insert into console.kv (key, value, updated_at) values ('v2_products', $1, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [JSON.stringify(products.map(({ raw, ...p }) => ({ ...p, raw })))]
    );
    const subs = products.filter((p) => kindForProduct(p.id));
    msg = `API v2 connected. ${products.length} products, ${subs.length} subscription products found.`;
  } catch (e) {
    redirect('/partner/api?err=' + enc('API v2: ' + e.message));
  }
  redirect('/partner/api?ok=' + enc(msg));
}
