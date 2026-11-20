import { getContext } from '@/lib/auth';
import { q } from '@/lib/db';
import { certFacts } from '@/lib/certs';
import { subscriptionOf, displayStatus } from '@/lib/orders';

export const dynamic = 'force-dynamic';

const d = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
const csv = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Certificate inventory as CSV (ISO 8601 dates, UTC). */
export async function GET(req) {
  const ctx = await getContext();
  if (!ctx?.workspaceId) return new Response('Not signed in', { status: 401 });
  const ids = (new URL(req.url).searchParams.get('ids') || '').split(',').filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  const orders = ids.length
    ? await q(`select * from console.orders where workspace_id = $1 and id = any($2::uuid[]) order by valid_till nulls last`, [ctx.workspaceId, ids])
    : await q(`select * from console.orders where workspace_id = $1 and status <> 'draft' order by valid_till nulls last`, [ctx.workspaceId]);
  const head = ['Common name', 'Other names', 'Product', 'Order', 'Status', 'Certificate valid from', 'Certificate expires', 'Subscription start', 'Subscription end', 'Subscription months', 'Issuer', 'Key', 'Serial', 'SHA-256 fingerprint', 'Validation method', 'Auto-renew'];
  const lines = [head.join(',')];
  for (const o of orders) {
    const f = certFacts(o) || {};
    const s = subscriptionOf(o) || {};
    lines.push([
      o.common_name, (o.sans || []).join(' '), o.product_name, o.gg_order_id, displayStatus(o).label,
      d(o.valid_from), d(o.valid_till), d(s.start), d(s.end), s.months || '',
      f.issuer, f.key, f.serial, f.fingerprint256, o.dcv_method, o.auto_renew ? 'On' : 'Off'
    ].map(csv).join(','));
  }
  const name = `certificates-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response('﻿' + lines.join('\r\n') + '\r\n', {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' }
  });
}
