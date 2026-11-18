import { lifecycle, displayStatus, daysLeft } from './orders';
import { subDisplay, autoInstallDone } from './subscriptions';

/**
 * One customer-facing view of everything a workspace owns: manual certificates and
 * automated subscriptions, each with a plain status, one date and one next step.
 *
 * group: 'action'   the customer has to do something
 *        'progress' waiting on GoGetSSL / the CA, nothing to do
 *        'ok'       all good
 *        'ended'    cancelled or finished
 */
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

function rawFromOrder(o) {
  const st = displayStatus(o);
  const l = lifecycle(o);
  const base = {
    id: o.id,
    type: 'cert',
    href: `/certificates/${o.id}`,
    domain: o.common_name || 'New order',
    extra: o.sans?.length ? `+${o.sans.length} more` : null,
    product: o.product_name || 'SSL certificate',
    ref: o.gg_order_id,
    tags: o.tags || [],
    created: o.created_at,
    status: { label: st.label, tone: st.tone }
  };
  if (['cancelled', 'cancel_requested'].includes(o.status) || st.key === 'order_ended') {
    return {
      ...base,
      group: st.key === 'order_ended' ? 'action' : 'ended',
      next: st.key === 'order_ended' ? { text: 'Order has ended. Buy a new one to stay covered.', cta: 'Renew', href: `/buy?renew=${o.id}`, primary: true } : { text: 'Closed' },
      date: null
    };
  }
  if (['validating', 'incomplete', 'reissuing'].includes(o.status)) {
    return {
      ...base,
      status: { label: o.status === 'reissuing' ? 'Reissuing' : 'Needs validation', tone: 'amber' },
      group: 'action',
      next: { text: 'Prove you own the domain to get the certificate issued.', cta: 'Validate', href: `/certificates/${o.id}`, primary: true },
      date: null
    };
  }
  if (o.status === 'payment_needed') {
    return { ...base, group: 'progress', next: { text: 'Waiting for payment. Your provider is handling it.' }, date: null };
  }
  if (o.status === 'issued') {
    const certDate = { label: 'Expires', at: o.valid_till, days: daysLeft(o.valid_till) };
    if (l.action === 'reissue' || l.action === 'reissue_overdue') {
      return { ...base, group: 'action', next: { text: 'Certificate expiring. Reissue it free, the order is still active.', cta: 'Reissue', href: `/certificates/${o.id}/reissue`, primary: true }, date: certDate };
    }
    if (l.action === 'renew') {
      return { ...base, group: 'action', next: { text: `Order ends ${fmt(o.order_expires_at || o.valid_till)}. Renew to keep the site covered.`, cta: 'Renew', href: `/buy?renew=${o.id}`, primary: true }, date: certDate };
    }
    return {
      ...base,
      group: 'ok',
      next: { text: l.reissueDueOn ? `Nothing to do. Reissue from ${fmt(l.reissueDueOn)}.` : 'Nothing to do.' },
      date: certDate
    };
  }
  return { ...base, group: 'ended', next: { text: st.label }, date: null };
}

function rawFromSub(s) {
  const st = subDisplay(s);
  const until = s.next_renewal_at || s.end_at;
  const base = {
    id: s.id,
    type: 'auto',
    href: `/subscriptions/${s.id}`,
    domain: s.primary_domain || 'New subscription',
    extra: s.domains?.length > 1 ? `+${s.domains.length - 1} more` : null,
    product: s.product_name || 'Automated SSL',
    ref: s.item_id,
    tags: s.tags || [],
    created: s.created_at,
    status: { label: st.label, tone: st.tone },
    date: until ? { label: s.next_renewal_at ? 'Renews' : 'Ends', at: until, days: daysLeft(until) } : null
  };
  if (['cancelled', 'expired'].includes(s.status)) return { ...base, group: 'ended', next: { text: 'Closed' }, date: null };
  if (s.status === 'pending') return { ...base, status: { label: 'Setting up', tone: 'amber' }, group: 'progress', next: { text: 'GoGetSSL is setting this up. Nothing to do yet.' } };
  if (s.status === 'payment_needed') return { ...base, group: 'progress', next: { text: 'Waiting for payment. Your provider is handling it.' } };
  if (s.cancel_requested_at) return { ...base, group: 'progress', next: { text: 'Cancellation in progress.' } };
  const usesAcme = s.kind === 'caas';
  if (s.kind === 'caas' && !s.account?.kid) return { ...base, group: 'progress', next: { text: 'ACME credentials are on their way.' } };
  if (s.auto_renew === false && base.date && base.date.days !== null && base.date.days <= 30) {
    return { ...base, group: 'action', next: { text: 'Auto-renewal is off and the term is ending.', cta: 'Review', href: base.href, primary: true } };
  }
  if (!usesAcme && !autoInstallDone(s.autoinstall)) {
    return { ...base, group: 'action', next: { text: 'Finish setup in AutoInstall SSL: the agent or your own ACME client.', cta: 'Set up', href: base.href, primary: true } };
  }
  return {
    ...base,
    status: { label: 'Active · automatic', tone: 'green' },
    group: 'ok',
    next: { text: usesAcme ? 'Nothing to do. Your ACME client renews certificates.' : 'Nothing to do. Certificates renew and install automatically.' }
  };
}

const RANK = { action: 0, progress: 1, ok: 2, ended: 3 };

/** Four words customers see everywhere. The sentence in `next` carries the detail. */
export const SIMPLE = {
  action: { label: 'Needs you', tone: 'red' },
  progress: { label: 'In progress', tone: 'amber' },
  ok: { label: 'Protected', tone: 'green' },
  ended: { label: 'Closed', tone: 'gray' }
};
const plain = (i) => ({ ...i, detail: i.status, status: SIMPLE[i.group] });
export const itemFromOrder = (o) => plain(rawFromOrder(o));
export const itemFromSub = (s) => plain(rawFromSub(s));

export function buildPortfolio(orders, subs) {
  const items = [...orders.filter((o) => o.status !== 'draft').map(itemFromOrder), ...subs.map(itemFromSub)];
  items.sort((a, b) => {
    if (RANK[a.group] !== RANK[b.group]) return RANK[a.group] - RANK[b.group];
    const ad = a.date?.at ? new Date(a.date.at).getTime() : Infinity;
    const bd = b.date?.at ? new Date(b.date.at).getTime() : Infinity;
    if (ad !== bd) return ad - bd;
    return new Date(b.created) - new Date(a.created);
  });
  const live = items.filter((i) => i.group !== 'ended');
  return {
    items,
    live,
    action: items.filter((i) => i.group === 'action'),
    progress: items.filter((i) => i.group === 'progress'),
    domains: new Set(live.flatMap((i) => [i.domain])).size,
    certs: live.filter((i) => i.type === 'cert').length,
    autos: live.filter((i) => i.type === 'auto').length,
    upcoming: live.filter((i) => i.date?.at && i.date.days >= 0).sort((a, b) => new Date(a.date.at) - new Date(b.date.at)).slice(0, 5)
  };
}

/** Refresh what is stale, then load the workspace's portfolio. */
export async function loadPortfolio(workspaceId) {
  const { q } = await import('./db');
  const { syncStale } = await import('./orders');
  const { syncStaleSubs } = await import('./subscriptions');
  await Promise.allSettled([syncStale(workspaceId, 10), syncStaleSubs(workspaceId, 4)]);
  const [orders, subs] = await Promise.all([
    q('select * from console.orders where workspace_id = $1', [workspaceId]),
    q('select * from console.subscriptions where workspace_id = $1', [workspaceId])
  ]);
  return buildPortfolio(orders, subs);
}
