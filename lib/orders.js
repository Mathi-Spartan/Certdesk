import { q, one } from './db';
import * as gg from './gogetssl';

const DAY = 86400000;

/** Map a GoGetSSL status string to our lifecycle status. */
export function mapStatus(ggStatus) {
  const s = String(ggStatus || '').toLowerCase().trim();
  if (s === 'active') return 'issued';
  if (s === 'processing' || s === 'pending' || s === 'new_order') return 'validating';
  if (s === 'reissue') return 'reissuing';
  if (s === 'incomplete') return 'incomplete';
  if (s === 'payment needed' || s === 'payment_needed' || s === 'unpaid') return 'payment_needed';
  if (s === 'canceled' || s === 'cancelled' || s === 'refunded' || s === 'rejected') return 'cancelled';
  if (s === 'expired') return 'expired';
  return s ? 'validating' : 'draft';
}

export function daysLeft(validTill) {
  if (!validTill) return null;
  const end = new Date(validTill).getTime();
  return Math.ceil((end - Date.now()) / DAY);
}

/** Status shown in the UI, including derived "expiring" and "expired". */
export function displayStatus(o) {
  if (o.status === 'issued') {
    const d = daysLeft(o.valid_till);
    if (d !== null && d < 0) return { key: 'expired', label: 'Expired', tone: 'red' };
    if (d !== null && d <= 30) return { key: 'expiring', label: 'Expiring', tone: 'red' };
    return { key: 'active', label: 'Active', tone: 'green' };
  }
  const map = {
    validating: { label: 'In validation', tone: 'amber' },
    reissuing: { label: 'Reissuing', tone: 'violet' },
    incomplete: { label: 'Incomplete', tone: 'amber' },
    payment_needed: { label: 'Payment needed', tone: 'amber' },
    cancel_requested: { label: 'Cancellation requested', tone: 'gray' },
    cancelled: { label: 'Cancelled', tone: 'gray' },
    expired: { label: 'Expired', tone: 'red' },
    draft: { label: 'Draft', tone: 'gray' }
  };
  return { key: o.status, ...(map[o.status] || { label: o.status, tone: 'gray' }) };
}

function parseDnsRecord(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const parts = raw.trim().split(/\s+/);
  if (parts.length >= 3) {
    const typeIdx = parts.findIndex((p) => /^(CNAME|TXT)$/i.test(p));
    if (typeIdx > 0) {
      return {
        name: parts[0].replace(/\.$/, ''),
        type: parts[typeIdx].toUpperCase(),
        value: parts.slice(typeIdx + 1).join(' ').replace(/\.$/, ''),
        raw
      };
    }
  }
  return { name: null, type: null, value: null, raw };
}

function pickValidation(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  const dns = obj.dns || obj.DNS;
  if (dns) out.dns = parseDnsRecord(typeof dns === 'string' ? dns : dns.record || dns.value || null);
  const http = obj.http || obj.HTTP;
  if (http && typeof http === 'object') out.http = { url: http.link || http.url || null, content: http.content || null, filename: http.filename || null };
  const https = obj.https || obj.HTTPS;
  if (https && typeof https === 'object') out.https = { url: https.link || https.url || null, content: https.content || null, filename: https.filename || null };
  return out;
}

/**
 * Turn whatever GoGetSSL returns about domain validation into one list:
 * [{ domain, method, status, dns, http, https, email }]
 */
export function extractDcv(status) {
  if (!status || typeof status !== 'object') return [];
  const items = [];
  const main = {
    domain: status.domain || null,
    method: status.dcv_method || null,
    status: status.status === 'active' ? 'validated' : 'pending',
    email: status.approver_email || null,
    ...pickValidation(status.approver_method || status.validation || {})
  };
  if (typeof status.approver_method === 'string' && status.approver_method.includes('@')) main.email = status.approver_method;
  items.push(main);
  const sans = Array.isArray(status.san) ? status.san : [];
  for (const s of sans) {
    items.push({
      domain: s.san_name || s.domain || null,
      method: s.validation_method || null,
      status: /valid|active|approved/i.test(String(s.status_description || s.status || '')) ? 'validated' : 'pending',
      statusText: s.status_description || null,
      ...pickValidation(s.validation || {})
    });
  }
  return items.filter((i) => i.domain);
}

function toDate(v) {
  if (!v || v === '0000-00-00') return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export async function addEvent(orderId, kind, message, actorId = null, data = null) {
  await q(
    'insert into console.order_events (order_id, kind, message, actor_user_id, data) values ($1, $2, $3, $4, $5)',
    [orderId, kind, message, actorId, data ? JSON.stringify(data) : null]
  );
}

/** Pull the latest status for one order from GoGetSSL and store it. */
export async function syncOrder(orderRow) {
  if (!orderRow.gg_order_id) return orderRow;
  const st = await gg.getOrderStatus(orderRow.gg_order_id);
  const newStatus = orderRow.status === 'cancel_requested' && mapStatus(st.status) !== 'cancelled'
    ? 'cancel_requested'
    : mapStatus(st.status);
  const sans = Array.isArray(st.san) ? st.san.map((s) => s.san_name).filter(Boolean) : orderRow.sans || [];
  const updated = await one(
    `update console.orders set
        gg_status = $2, gg_status_description = $3, status = $4,
        common_name = coalesce($5, common_name), sans = $6,
        valid_from = $7, valid_till = $8,
        crt_code = coalesce($9, crt_code), ca_code = coalesce($10, ca_code),
        csr = coalesce(csr, $11), dcv_method = coalesce($12, dcv_method),
        product_id = coalesce(product_id, $13), period_months = coalesce(period_months, $14),
        dcv = $15, raw = $16, last_synced_at = now(), updated_at = now()
      where id = $1 returning *`,
    [
      orderRow.id,
      st.status || null,
      st.status_description || null,
      newStatus,
      st.domain || null,
      sans,
      toDate(st.valid_from),
      toDate(st.valid_till),
      st.crt_code || null,
      st.ca_code || null,
      st.csr_code || null,
      st.dcv_method || null,
      st.product_id ? Number(st.product_id) : null,
      st.ssl_period ? Number(st.ssl_period) : null,
      JSON.stringify(extractDcv(st)),
      JSON.stringify(st)
    ]
  );
  if (orderRow.status !== newStatus) {
    const label = displayStatus(updated).label;
    await addEvent(orderRow.id, 'status', `Status changed to ${label}`, null, { from: orderRow.status, to: newStatus });
  }
  return updated;
}

/** Sync orders in a workspace that are still moving, at most every few minutes. */
export async function syncStale(workspaceId, minutes = 5) {
  const rows = await q(
    `select * from console.orders
      where workspace_id = $1 and gg_order_id is not null
        and status in ('validating','reissuing','incomplete','payment_needed','cancel_requested','draft')
        and (last_synced_at is null or last_synced_at < now() - ($2 || ' minutes')::interval)
      order by last_synced_at nulls first limit 8`,
    [workspaceId, String(minutes)]
  );
  for (const r of rows) {
    try {
      await syncOrder(r);
    } catch {
      /* shown on the order page when opened */
    }
  }
}

export async function getOrderForWorkspace(id, workspaceId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return null;
  return one('select * from console.orders where id = $1 and workspace_id = $2', [id, workspaceId]);
}

export function primaryMethod(o) {
  const m = String(o.dcv_method || '').toLowerCase();
  if (m.includes('dns')) return 'DNS';
  if (m.includes('http')) return 'HTTP';
  if (m.includes('mail') || m.includes('@')) return 'Email';
  return o.dcv_method ? o.dcv_method : '—';
}
