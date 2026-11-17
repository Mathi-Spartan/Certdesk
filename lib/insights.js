import { daysLeft, displayStatus, primaryMethod, lifecycle } from './orders';

const DAY = 86400000;

/** Everything the Overview needs, computed from a workspace's orders. Manual management only. */
export function computeInsights(orders) {
  const live = orders.filter((o) => !['cancelled', 'draft'].includes(o.status));
  const withLife = live.map((o) => ({ o, l: lifecycle(o) }));
  const issued = live.filter((o) => o.status === 'issued' && (daysLeft(o.valid_till) ?? 1) >= 0);
  const reissueDue = withLife.filter(({ l }) => l.action === 'reissue' || l.action === 'reissue_overdue').map(({ o }) => o);
  const renewDue = withLife.filter(({ l }) => l.action === 'renew' || l.action === 'order_ended').map(({ o }) => o);
  const expiring = issued.filter((o) => daysLeft(o.valid_till) <= 30);
  const expired = live.filter((o) => o.status === 'issued' && daysLeft(o.valid_till) < 0);
  const validating = live.filter((o) => ['validating', 'incomplete', 'reissuing'].includes(o.status));
  const stuck = validating.filter((o) => Date.now() - new Date(o.created_at).getTime() > 3 * DAY);
  const methods = { DNS: 0, Email: 0, HTTP: 0, Other: 0 };
  for (const o of live) {
    const m = primaryMethod(o);
    methods[m in methods ? m : 'Other']++;
  }

  // 12-week horizon: certificate expiries (reissues) and order ends (renewals)
  const weeks = [];
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < 12; i++) {
    const from = new Date(start.getTime() + i * 7 * DAY);
    const to = new Date(from.getTime() + 7 * DAY);
    const inWeek = (d) => d && new Date(d).getTime() >= from.getTime() && new Date(d).getTime() < to.getTime();
    const reissues = issued.filter((o) => inWeek(o.valid_till) && lifecycle(o).canReissue).length;
    const renewals = live.filter((o) => inWeek(o.order_expires_at) || (inWeek(o.valid_till) && o.status === 'issued' && !lifecycle(o).canReissue)).length;
    weeks.push({ from, reissues, renewals, n: reissues + renewals });
  }

  const total = live.length || 1;
  const pctNotExpired = live.length ? 1 - expired.length / total : 1;
  const pctOnTime = live.length ? 1 - (reissueDue.length + renewDue.length) / total : 1;
  const pctNotStuck = live.length ? 1 - stuck.length / total : 1;
  const pctDns = live.length ? methods.DNS / total : 1;
  const health = Math.round(100 * (0.4 * pctNotExpired + 0.25 * Math.max(0, pctOnTime) + 0.2 * pctNotStuck + 0.15 * pctDns));

  const attention = [];
  for (const o of reissueDue.sort((a, b) => new Date(a.valid_till) - new Date(b.valid_till))) {
    const d = daysLeft(o.valid_till);
    attention.push({
      tone: 'red',
      title: d < 0 ? `${o.common_name} certificate expired ${-d} day${d === -1 ? '' : 's'} ago` : `${o.common_name} certificate expires in ${d} day${d === 1 ? '' : 's'}`,
      sub: `Reissue it now. It's free while the order runs until ${new Date(o.order_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      href: `/certificates/${o.id}/reissue`,
      cta: 'Reissue',
      primary: true
    });
  }
  for (const o of renewDue) {
    const d = daysLeft(o.order_expires_at) ?? daysLeft(o.valid_till);
    attention.push({
      tone: 'red',
      title: d < 0 ? `${o.common_name} order has ended` : `${o.common_name} order ends in ${d} day${d === 1 ? '' : 's'}`,
      sub: 'Renew to buy a new order and keep the site covered',
      href: `/buy?renew=${o.id}`,
      cta: 'Renew order',
      primary: true
    });
  }
  for (const o of validating) {
    attention.push({
      tone: 'amber',
      title: `${o.common_name || 'New order'} is waiting for validation`,
      sub: `${primaryMethod(o)} · ${o.gg_status_description || displayStatus(o).label}`,
      href: `/certificates/${o.id}`,
      cta: 'View steps'
    });
  }
  for (const o of live.filter((x) => x.status === 'payment_needed')) {
    attention.push({ tone: 'amber', title: `${o.common_name} needs payment at GoGetSSL`, sub: 'Contact your partner', href: `/certificates/${o.id}`, cta: 'Details' });
  }

  const byValidation = { dv: 0, ov: 0, ev: 0 };
  const byBrand = {};
  for (const o of live) {
    const v = /\bev\b/i.test(o.product_name || '') ? 'ev' : /\b(ov|business|organization|instantssl|secure site)\b/i.test(o.product_name || '') ? 'ov' : 'dv';
    byValidation[v]++;
    const b = (o.product_name || 'Other').split(' ')[0];
    byBrand[b] = (byBrand[b] || 0) + 1;
  }

  return {
    live,
    issued,
    expiring,
    expired,
    reissueDue,
    renewDue,
    validating,
    methods,
    weeks,
    health,
    attention: attention.slice(0, 8),
    byValidation,
    byBrand
  };
}
