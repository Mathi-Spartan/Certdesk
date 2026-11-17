import { daysLeft, displayStatus, primaryMethod } from './orders';

/** Everything the Overview needs, computed from a workspace's orders. */
export function computeInsights(orders) {
  const live = orders.filter((o) => !['cancelled', 'draft'].includes(o.status));
  const issued = live.filter((o) => o.status === 'issued' && (daysLeft(o.valid_till) ?? 1) >= 0);
  const expiring = issued.filter((o) => daysLeft(o.valid_till) <= 30);
  const validating = live.filter((o) => ['validating', 'incomplete', 'reissuing'].includes(o.status));
  const autoOn = live.filter((o) => o.auto_renew).length;
  const methods = { DNS: 0, Email: 0, HTTP: 0, Other: 0 };
  for (const o of live) {
    const m = primaryMethod(o);
    methods[m in methods ? m : 'Other']++;
  }

  // 12-week horizon starting this week
  const weeks = [];
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < 12; i++) {
    const from = new Date(start.getTime() + i * 7 * 86400000);
    const to = new Date(from.getTime() + 7 * 86400000);
    const n = issued.filter((o) => {
      const t = new Date(o.valid_till).getTime();
      return t >= from.getTime() && t < to.getTime();
    }).length;
    weeks.push({ from, n, tone: i < 2 ? 'red' : i < 4 ? 'amber' : 'violet' });
  }

  const total = live.length || 1;
  const pctAuto = live.length ? autoOn / live.length : 1;
  const pctDns = live.length ? methods.DNS / live.length : 1;
  const pctNotExpiring = live.length ? 1 - expiring.length / total : 1;
  const pctNoStuck = live.length ? 1 - validating.filter((o) => Date.now() - new Date(o.created_at).getTime() > 3 * 86400000).length / total : 1;
  const health = Math.round(100 * (0.35 * pctAuto + 0.25 * pctDns + 0.25 * pctNotExpiring + 0.15 * pctNoStuck));

  const attention = [];
  for (const o of expiring.sort((a, b) => new Date(a.valid_till) - new Date(b.valid_till))) {
    const d = daysLeft(o.valid_till);
    attention.push({
      tone: 'red',
      title: `${o.common_name} expires in ${d} day${d === 1 ? '' : 's'}`,
      sub: o.auto_renew ? 'Auto-renew is on' : 'Auto-renew is off',
      href: `/certificates/${o.id}`,
      cta: 'Renew now',
      primary: true
    });
  }
  for (const o of validating) {
    attention.push({
      tone: 'amber',
      title: `${o.common_name || 'New order'} is waiting for validation`,
      sub: `${primaryMethod(o)} · ${o.gg_status_description || displayStatus(o).label}`,
      href: '/validation',
      cta: 'View steps'
    });
  }
  for (const o of live.filter((x) => x.status === 'payment_needed')) {
    attention.push({ tone: 'amber', title: `${o.common_name} needs payment at GoGetSSL`, sub: 'Contact your partner', href: `/certificates/${o.id}`, cta: 'Details' });
  }
  if (methods.Email > 0) {
    attention.push({
      tone: 'violet',
      title: `${methods.Email} certificate${methods.Email === 1 ? '' : 's'} still use email validation`,
      sub: 'Each renewal will need someone to click an approval email',
      href: '/certificates',
      cta: 'Review'
    });
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
    validating,
    autoOn,
    pctAuto,
    methods,
    weeks,
    health,
    attention: attention.slice(0, 6),
    byValidation,
    byBrand,
    autoOffExpiring: expiring.filter((o) => !o.auto_renew).length
  };
}
