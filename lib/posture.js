import { certFacts } from './certs';
import { daysLeft, subscriptionOf, lifecycle } from './orders';

const DAY = 86400000;
/** Maximum public TLS lifetime (CA/B Forum SC-081) for a certificate issued on a date. */
export function maxLifetime(issued) {
  const t = new Date(issued).getTime();
  if (t >= Date.parse('2029-03-15')) return 47;
  if (t >= Date.parse('2027-03-15')) return 100;
  if (t >= Date.parse('2026-03-15')) return 200;
  return 398;
}

/**
 * Inventory and policy checks across a workspace, the way enterprise PKI consoles
 * report them, reduced to what a customer can act on.
 */
export function posture(orders, products) {
  const prod = Object.fromEntries((products || []).map((p) => [p.id, p]));
  const live = orders.filter((o) => ['issued', 'validating', 'reissuing', 'incomplete'].includes(o.status) || (o.status === 'expired' && lifecycle(o).canReissue));
  const issued = live.filter((o) => o.status === 'issued' && o.crt_code);
  const rows = issued.map((o) => ({ o, f: certFacts(o) })).filter((r) => r.f);

  const count = (arr, keyFn) => arr.reduce((m, x) => { const k = keyFn(x); if (k) m[k] = (m[k] || 0) + 1; return m; }, {});
  const level = count(live, (o) => String(prod[o.product_id]?.validation || '').toUpperCase() || (/\bEV\b/i.test(o.product_name || '') ? 'EV' : /\bOV\b|Organization|Premium/i.test(o.product_name || '') ? 'OV' : 'DV'));
  const keys = count(rows, (r) => r.f.key);
  const issuers = count(rows, (r) => r.f.issuer.replace(/\s+(TLS|RSA|ECC|DV|OV|EV).*$/i, '').trim() || r.f.issuer);
  const shape = count(live, (o) => (String(o.common_name || '').startsWith('*.') ? 'Wildcard' : (o.sans || []).length ? 'Multi-domain' : 'Single domain'));

  const weak = rows.filter((r) => /^RSA (\d+)/.test(r.f.key) && Number(r.f.key.split(' ')[1]) < 2048);
  const overLife = issued.filter((o) => o.valid_from && o.valid_till && (new Date(o.valid_till) - new Date(o.valid_from)) / DAY > maxLifetime(o.valid_from) + 1);
  const urgent = issued.filter((o) => { const d = daysLeft(o.valid_till); return d !== null && d <= 7; });
  const expired = live.filter((o) => o.valid_till && daysLeft(o.valid_till) < 0 && o.status !== 'reissuing');
  const nonDns = live.filter((o) => o.dcv_method && !String(o.dcv_method).toLowerCase().includes('dns'));
  const subEnding = live.filter((o) => { const s = subscriptionOf(o); return s && !s.ended && s.days <= 30; });

  const checks = [
    { id: 'expired', label: 'No expired certificates in use', bad: expired.length, href: '/orders?f=action', fix: 'Reissue or renew' },
    { id: 'urgent', label: 'Nothing expires within 7 days', bad: urgent.length, href: '/renewals', fix: 'Reissue now' },
    { id: 'subs', label: 'Subscriptions cover the next 30 days', bad: subEnding.length, href: '/renewals', fix: 'Renew' },
    { id: 'keys', label: 'Strong keys (RSA 2048+ or ECDSA)', bad: weak.length, href: '/orders', fix: 'Reissue with a new key' },
    { id: 'life', label: 'Lifetimes within CA/B Forum limits', bad: overLife.length, href: '/orders', fix: 'Reissue' },
    { id: 'dcv', label: 'DNS validation, ready for shorter lifetimes', bad: nonDns.length, href: '/validation', fix: 'Switch to DNS', soft: true }
  ];
  const passed = checks.filter((c) => !c.bad).length;
  return { total: live.length, issuedCount: issued.length, level, keys, issuers, shape, checks, passed };
}
