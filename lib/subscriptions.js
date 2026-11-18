import { q, one } from './db';
import * as v2 from './gogetssl-v2';

export const KIND_LABEL = { caas: 'ACME CaaS', ais: 'Plan + Automate' };

export function kindForProduct(productId) {
  if (v2.CAAS_PRODUCT_IDS.includes(Number(productId))) return 'caas';
  if (v2.AIS_PRODUCT_IDS.includes(Number(productId))) return 'ais';
  return null;
}

/** Subscription products offered in CertDesk. Names come from the v2 catalogue when it has been read. */
export const SUBSCRIPTION_PRODUCTS = [
  { id: 300, kind: 'caas', name: 'Sectigo ACME Certificate-as-a-Service', blurb: 'Unlimited DV certificates for the listed domains, issued by your own ACME client (Certbot, acme.sh, Caddy, cert-manager) with EAB credentials.' },
  { id: 400, kind: 'ais', name: 'RapidSSL Plan', blurb: 'One domain. Certificates are issued and installed for you by the AutoInstall SSL agent, or by your ACME client.' },
  { id: 401, kind: 'ais', name: 'RapidSSL Wildcard Plan', blurb: 'One wildcard domain (*.example.com), installed by AutoInstall SSL or ACME.' },
  { id: 402, kind: 'ais', name: 'GeoTrust DV Plan + Automate', blurb: 'One domain on GeoTrust DV, installed by AutoInstall SSL or ACME.' },
  { id: 403, kind: 'ais', name: 'GeoTrust DV Wildcard Plan + Automate', blurb: 'One wildcard domain on GeoTrust DV, installed by AutoInstall SSL or ACME.' }
];

export async function addSubEvent(subId, kind, message, actorId, endpoint) {
  await q(
    `insert into console.subscription_events (subscription_id, kind, message, actor_user_id, endpoint) values ($1, $2, $3, $4, $5)`,
    [subId, kind, message, actorId || null, endpoint || null]
  );
}

export async function getSubForWorkspace(id, workspaceId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return null;
  return one('select * from console.subscriptions where id = $1 and workspace_id = $2', [id, workspaceId]);
}

const ts = (v) => (v ? new Date(v) : null);
const validDate = (v) => {
  const d = ts(v);
  return d && !isNaN(d) ? d.toISOString() : null;
};

function mapStatus(orderStatus, itemStatus) {
  const s = String(orderStatus || itemStatus || '').toLowerCase();
  if (!s) return 'pending';
  if (/cancel|revoked|refund/.test(s)) return 'cancelled';
  if (/expired|ended/.test(s)) return 'expired';
  if (/active|issued|complete/.test(s)) return 'active';
  if (/payment|unpaid/.test(s)) return 'payment_needed';
  return 'pending';
}

/** Read GET /certificates/{kind}/{id} into our row shape. */
export function parseDetails(kind, details) {
  const item = Array.isArray(details?.items) ? details.items[0] || {} : details || {};
  const sub = item.subscription || {};
  const account = item.account && typeof item.account === 'object' ? item.account : null;
  const autoinstall = item.autoinstall && typeof item.autoinstall === 'object' ? item.autoinstall : null;
  const domains = (Array.isArray(item.domains) ? item.domains : []).map((d) =>
    typeof d === 'string' ? { id: null, name: d } : { id: d.id ?? null, name: d.name || d.domain || '', status: d.status || null, raw: d }
  );
  const method = String(item.install_method || autoinstall?.installation_method || '').toLowerCase() || null;
  const autoRenew = sub.auto_renew !== undefined ? !!sub.auto_renew : sub.next_renewal ? true : sub.end ? false : null;
  return {
    status: mapStatus(details?.order?.status, item.status),
    gg_status: details?.order?.status || item.status || null,
    gg_order_id: details?.order?.id ?? null,
    domains,
    primary_domain: domains[0]?.name || null,
    install_method: kind === 'ais' ? method || 'autoinstall' : 'acme',
    auto_renew: autoRenew,
    begin_at: validDate(sub.begin),
    end_at: validDate(sub.end) || validDate(sub.next_renewal),
    next_renewal_at: validDate(sub.next_renewal),
    account: account
      ? { id: account.id ?? null, kid: account.eab_mac_id || null, hmac: account.eab_mac_key || null, server_url: account.server_url || null }
      : null,
    autoinstall: autoinstall
      ? { status: autoinstall.status || null, login: autoinstall.login_sso_link || null, manage: autoinstall.manage_sso_link || null, method: autoinstall.installation_method || null }
      : null
  };
}

export async function syncSubscription(sub) {
  if (!sub.item_id) return sub;
  const details = await v2.getDetails(sub.kind, sub.item_id);
  const p = parseDetails(sub.kind, details);
  const row = await one(
    `update console.subscriptions set
        status = case when cancel_requested_at is not null and $2 = 'active' then status else $2 end,
        gg_order_id = coalesce($3, gg_order_id), domains = $4, primary_domain = coalesce($5, primary_domain),
        install_method = $6, auto_renew = $7, begin_at = $8, end_at = $9, next_renewal_at = $10,
        account = $11, autoinstall = $12, raw = $13, last_synced_at = now(), updated_at = now()
      where id = $1 returning *`,
    [
      sub.id, p.status, p.gg_order_id, JSON.stringify(p.domains), p.primary_domain, p.install_method, p.auto_renew,
      p.begin_at, p.end_at, p.next_renewal_at, p.account ? JSON.stringify(p.account) : null,
      p.autoinstall ? JSON.stringify(p.autoinstall) : null, JSON.stringify(details)
    ]
  );
  if (sub.status !== row.status) await addSubEvent(sub.id, 'status', `Status changed to ${p.gg_status || row.status}`, null);
  return row;
}

export function subDisplay(sub) {
  const map = {
    active: { label: 'Active', tone: 'green' },
    pending: { label: 'Setting up', tone: 'amber' },
    payment_needed: { label: 'Payment needed', tone: 'amber' },
    cancelled: { label: 'Cancelled', tone: 'gray' },
    expired: { label: 'Ended', tone: 'red' }
  };
  const base = map[sub.status] || { label: sub.status, tone: 'gray' };
  if (sub.status === 'active' && sub.cancel_requested_at) return { label: 'Cancel requested', tone: 'amber' };
  return base;
}

export function daysTo(d) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

/** Refresh the oldest subscriptions of a workspace (a few per page load, to stay fast). */
export async function syncStaleSubs(workspaceId, limit = 5) {
  const rows = await q(
    `select * from console.subscriptions
      where workspace_id = $1 and item_id is not null and status <> 'cancelled'
        and (last_synced_at is null or last_synced_at < now() - interval '10 minutes')
      order by last_synced_at asc nulls first limit $2`,
    [workspaceId, limit]
  );
  for (const r of rows) {
    try {
      await syncSubscription(r);
    } catch {
      /* shown on the detail page */
    }
  }
}

/** True once the AutoInstall agent reports a finished install. "incomplete", "pending" and empty mean not yet. */
export function autoInstallDone(ai) {
  return /^(active|installed|complete|completed|issued|done|success)$/i.test(String(ai?.status || '').trim());
}
