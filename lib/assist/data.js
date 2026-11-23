/**
 * Questions answered from the customer's own certificates: counts, "is this domain covered",
 * order details and filtered lists. Pure functions over order rows, so they are easy to test.
 */
import { extractDomains, extractOrderNumbers } from './match';

const DAY = 86400000;
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const daysTo = (d) => (d ? Math.ceil((new Date(d).getTime() - Date.now()) / DAY) : null);
const bare = (d) => String(d || '').toLowerCase().replace(/^\*\./, '');
const LIVE = (o) => !['cancelled', 'cancel_requested'].includes(o.status) && !o.renewedBy;
const LISTY = /\b(which|list|show|all|any|what are|do i have)\b|\bmy [\w-]+ (certificates|certs|orders|ssls)\b/;

const BRANDS = [
  ['digicert', /digicert/i], ['sectigo', /sectigo|comodo|positivessl|essentialssl|instantssl/i], ['geotrust', /geotrust/i],
  ['rapidssl', /rapidssl/i], ['thawte', /thawte/i], ['gogetssl', /gogetssl/i]
];
const BRAND_LABEL = { digicert: 'DigiCert', sectigo: 'Sectigo', geotrust: 'GeoTrust', rapidssl: 'RapidSSL', thawte: 'Thawte', gogetssl: 'GoGetSSL' };
const brandOf = (name) => (BRANDS.find(([, re]) => re.test(name || '')) || [null])[0];
const METHOD_WORD = { dns: /\bdns\b|\bcname\b/, http: /\bhttps?\b|\bfile\b/, email: /\be-?mail\b|\bapprov/ };

/** Which data question is this, if any. */
export function detectData(text) {
  const t = ` ${String(text || '').toLowerCase()} `;
  const doms = extractDomains(text);
  const nums = extractOrderNumbers(text);
  if (/\bhow many\b/.test(t) && /(cert|ssl|order|domain|subscription)/.test(t)) return 'count';
  if (doms.length && /\b(cover(ed|s|ing)?|secured?|protected|included|have (a|an|any) (cert|ssl)\w*|is there (a|an|any) (cert|ssl)\w*|which (cert|ssl|order)\w* (is )?for|(cert|ssl)\w* for)\b/.test(t)) return 'covers';
  if ((doms.length || nums.length) && /\b(order (number|no|id)|order #|details?|info(rmation)?|which product|what product|brand|when (did|was)|ordered|purchased|bought|paid|pay|price|cost|serial|issuer|issued (on|by))\b/.test(t)) return 'details';
  if (/\bexpired\b/.test(t) && LISTY.test(t) && !doms.length) return 'expired_list';
  if (/auto[- ]?renew/.test(t) && /\b(which|list|show|all|enabled|turned on|are on|have)\b/.test(t) && !doms.length) return 'autorenew_list';
  if (LISTY.test(t) && /\b(dns|cname|http|file|e-?mail|approval)\b/.test(t) && /\b(validat|method|using|use)\w*/.test(t) && !/\b(how|why|check|fix|add|not|record)\b/.test(t)) return 'by_method';
  if (LISTY.test(t) && /\b(wildcards?|multi[- ]?domains?|san|ov|ev|dv)\b/.test(t) && !/\b(what is|what's|difference|vs|or)\b/.test(t)) return 'by_type';
  if (LISTY.test(t) && BRANDS.some(([, re]) => re.test(t)) && !/\b(what is|difference|vs)\b/.test(t)) return 'by_brand';
  if (/\b(list|show)( me)?( all)?( my)? (cert|ssl|domain|order)/.test(t) || /\ball (of )?my (cert|ssl|domain|order)/.test(t)) {
    if (!/\b(expir|renew|reissue|due|next \d|within|this (week|month))/.test(t)) return 'list_all';
  }
  if (/\b(support|contact|helpdesk|customer care|your team)\b/.test(t) && /\b(email|mail id|phone|number|hours|timing|address|reach|whatsapp|call)\b/.test(t)) return 'contact';
  if (/\b(help )?topics?\b|\bcategories\b|\bbrowse help\b|\bfaq\b|\bwhat can you (do|answer)\b|\bwhat (questions|can i ask)\b/.test(t)) return 'topics';
  return null;
}

function names(o) {
  return [o.common_name, ...(o.sans || [])].filter(Boolean).map((n) => String(n).toLowerCase());
}

/** Does a certificate name cover this host? Wildcards cover exactly one level. */
export function covers(name, host) {
  name = String(name).toLowerCase();
  host = String(host).toLowerCase();
  if (name === host) return true;
  if (name.startsWith('*.')) {
    const base = name.slice(2);
    if (!host.endsWith('.' + base)) return false;
    return !host.slice(0, -(base.length + 1)).includes('.');
  }
  return false;
}

function line(o) {
  const d = daysTo(o.valid_till);
  const when = o.status === 'issued' && o.valid_till ? (d < 0 ? `expired ${fmt(o.valid_till)}` : `valid until ${fmt(o.valid_till)}`) : o.status.replace(/_/g, ' ');
  return `- **${o.common_name}**${o.sans?.length ? ` (+${o.sans.length})` : ''}: ${o.product_name || 'SSL'}, ${when}`;
}

function listAnswer(title, list, empty, extraButtons = []) {
  if (!list.length) return { body: empty, buttons: extraButtons, matched: true };
  return {
    body: `${title}: **${list.length}**\n\n${list.slice(0, 15).map(line).join('\n')}${list.length > 15 ? `\n- …and ${list.length - 15} more on My certificates` : ''}`,
    buttons: [...list.slice(0, 4).map((o) => ({ kind: 'link', label: o.common_name, href: `/certificates/${o.id}` })), ...extraButtons],
    matched: true
  };
}

/**
 * Build the answer. `products` is a map id → { validation, wildcard, multidomain }; `subs` are automated subscriptions.
 * `contact` is { name, email, company }.
 */
export function answerData(kind, text, orders, { products = {}, subs = [], contact = {} } = {}) {
  const live = orders.filter(LIVE);
  const t = String(text || '').toLowerCase();

  if (kind === 'count') {
    const issued = live.filter((o) => o.status === 'issued');
    const valid = issued.filter((o) => daysTo(o.valid_till) >= 0);
    const expired = issued.filter((o) => daysTo(o.valid_till) < 0);
    const pending = live.filter((o) => ['validating', 'incomplete', 'reissuing', 'payment_needed'].includes(o.status));
    const domains = new Set(live.flatMap(names).map(bare));
    const autoSubs = subs.filter((s) => !['cancelled', 'expired'].includes(s.status));
    return {
      body: `You have **${plural(live.length, 'certificate order')}** covering **${plural(domains.size, 'domain')}**:\n\n- ${valid.length} valid\n- ${pending.length} waiting for validation or in progress\n- ${expired.length} with an expired certificate\n${autoSubs.length ? `- ${plural(autoSubs.length, 'automated subscription')}\n` : ''}${orders.length - live.length ? `- ${orders.length - live.length} closed (cancelled)` : ''}`.trim(),
      buttons: [{ kind: 'reply', label: 'What needs my attention?', text: 'What needs my attention?' }, { kind: 'link', label: 'Open My certificates', href: '/orders' }],
      matched: true
    };
  }

  if (kind === 'covers') {
    const hosts = extractDomains(text);
    const parts = [];
    const buttons = [];
    for (const h of hosts.slice(0, 3)) {
      const host = h.replace(/^\*\./, '');
      const hits = live.filter((o) => names(o).some((n) => covers(n, h) || covers(n, host) || (h.startsWith('*.') && n === h)));
      if (hits.length) {
        const best = hits.sort((a, b) => (b.status === 'issued') - (a.status === 'issued') || new Date(b.valid_till || 0) - new Date(a.valid_till || 0))[0];
        const d = daysTo(best.valid_till);
        const state = best.status === 'issued' ? (d >= 0 ? `valid until **${fmt(best.valid_till)}** (${plural(d, 'day')} left)` : `but that certificate **expired ${fmt(best.valid_till)}**`) : `but it isn’t issued yet (${best.status.replace(/_/g, ' ')})`;
        const via = names(best).find((n) => covers(n, h) || covers(n, host)) || best.common_name;
        parts.push(`**${h}** is covered by **${best.common_name}**${via !== best.common_name ? ` (through ${via})` : ''}, ${state}.${hits.length > 1 ? ` ${hits.length - 1} other order${hits.length > 2 ? 's' : ''} also cover it.` : ''}`);
        buttons.push({ kind: 'link', label: `Open ${best.common_name}`, href: `/certificates/${best.id}` });
      } else {
        const near = live.find((o) => names(o).some((n) => n.startsWith('*.') && host.endsWith('.' + n.slice(2))));
        parts.push(`**${h}** isn’t covered by any of your certificates.${near ? ` Your wildcard **${near.common_name}** only covers one level of subdomains, so it doesn’t include ${h}.` : ''}`);
        buttons.push({ kind: 'link', label: 'Order a certificate', href: '/order' });
      }
    }
    return { body: parts.join('\n\n'), buttons: [...new Map(buttons.map((b) => [b.label, b])).values()].slice(0, 4), matched: true };
  }

  if (kind === 'details') {
    const nums = extractOrderNumbers(text);
    const doms = extractDomains(text).map(bare);
    let hit = live.filter((o) => nums.includes(Number(o.gg_order_id)));
    if (!hit.length) hit = live.filter((o) => doms.some((d) => bare(o.common_name) === d || (o.sans || []).some((s) => bare(s) === d)));
    if (!hit.length) return { body: 'I couldn’t find an order for that in your account. Check the spelling, or tap one of your certificates.', buttons: live.slice(0, 5).map((o) => ({ kind: 'pick', orderId: o.id, intent: 'details', label: o.common_name })), matched: true, pendingIntent: 'details' };
    const o = hit.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    return detailsCard(o, products);
  }

  if (kind === 'expired_list') {
    const list = live.filter((o) => o.status === 'issued' && daysTo(o.valid_till) < 0).sort((a, b) => new Date(a.valid_till) - new Date(b.valid_till));
    return listAnswer('Certificates that have expired', list, 'None of your certificates has expired. 🎉', [{ kind: 'reply', label: 'Reissue or renew?', text: 'Do I need to reissue or renew?' }]);
  }

  if (kind === 'autorenew_list') {
    const on = live.filter((o) => o.auto_renew);
    return listAnswer('Certificates with auto-renew on', on, 'Auto-renew is **off** for all your certificates. You can turn it on per certificate under **Reminders & auto-renew**.', [{ kind: 'reply', label: 'What is auto-renew?', text: 'How does auto renew work?' }]);
  }

  if (kind === 'by_method') {
    const m = Object.entries(METHOD_WORD).find(([, re]) => re.test(t))?.[0];
    const list = live.filter((o) => {
      const v = String(o.dcv_method || '').toLowerCase();
      return m === 'email' ? v.includes('@') || v.includes('mail') : m === 'http' ? v.startsWith('http') : v === m;
    });
    return listAnswer(`Certificates using ${m === 'http' ? 'HTTP file' : m === 'email' ? 'email' : 'DNS'} validation`, list, `None of your certificates uses ${m === 'http' ? 'HTTP file' : m === 'email' ? 'email' : 'DNS'} validation.`);
  }

  if (kind === 'by_type') {
    const want = /wildcard/.test(t) ? 'wildcard' : /multi[- ]?domain|\bsan\b/.test(t) ? 'multidomain' : /\bev\b/.test(t) ? 'ev' : /\bov\b/.test(t) ? 'ov' : 'dv';
    const list = live.filter((o) => {
      const p = products[o.product_id] || {};
      if (want === 'wildcard') return p.wildcard || String(o.common_name).startsWith('*.');
      if (want === 'multidomain') return p.multidomain || (o.sans || []).length > 1;
      return String(p.validation || '').toLowerCase() === want;
    });
    const label = { wildcard: 'Wildcard certificates', multidomain: 'Multi-domain certificates', ev: 'EV certificates', ov: 'OV certificates', dv: 'DV certificates' }[want];
    return listAnswer(label, list, `You don’t have any ${label.toLowerCase()}.`, [{ kind: 'link', label: 'Order one', href: '/order' }]);
  }

  if (kind === 'by_brand') {
    const b = BRANDS.find(([, re]) => re.test(t))?.[0];
    const list = live.filter((o) => brandOf(o.product_name) === b);
    return listAnswer(`${BRAND_LABEL[b]} certificates`, list, `You don’t have any ${BRAND_LABEL[b]} certificates.`);
  }

  if (kind === 'list_all') {
    const order = { validating: 0, incomplete: 0, reissuing: 0, payment_needed: 1, issued: 2, expired: 3 };
    const list = [...live].sort((a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4) || String(a.common_name).localeCompare(String(b.common_name)));
    return listAnswer('Your certificates', list, 'You don’t have any certificates yet.', [{ kind: 'link', label: 'Open My certificates', href: '/orders' }]);
  }

  if (kind === 'contact') {
    return {
      body: `You can reach the support team right here: tap **Talk to support** and they’ll reply in this chat.\n\n- Email: **${contact.email || 'support@sslorbit.com'}**\n- Contact: ${contact.name || 'Support team'}\n- Company: ${contact.company || ''}`.trim(),
      buttons: [{ kind: 'handoff', label: 'Talk to support', primary: true }],
      matched: true
    };
  }

  return null;
}

export function detailsCard(o, products = {}) {
  const p = products[o.product_id] || {};
  const d = daysTo(o.valid_till);
  const sd = daysTo(o.order_expires_at);
  const rows = [
    `- Order number: **#${o.gg_order_id || '—'}**`,
    `- Product: **${o.product_name || '—'}**${p.validation ? ` (${String(p.validation).toUpperCase()}${p.wildcard ? ', wildcard' : ''}${p.multidomain ? ', multi-domain' : ''})` : ''}`,
    `- Names: ${[o.common_name, ...(o.sans || [])].slice(0, 6).join(', ')}${(o.sans || []).length > 5 ? '…' : ''}`,
    `- Status: **${String(o.status).replace(/_/g, ' ')}**${o.dcv_method ? `, ${String(o.dcv_method).includes('@') ? 'email' : String(o.dcv_method).toUpperCase()} validation` : ''}`,
    `- Ordered: ${fmt(o.created_at)}${o.period_months ? ` · ${o.period_months} months` : ''}`,
    o.valid_till ? `- Certificate: ${fmt(o.valid_from)} to **${fmt(o.valid_till)}**${d !== null ? ` (${d >= 0 ? `${plural(d, 'day')} left` : `expired ${-d} days ago`})` : ''}` : '- Certificate: not issued yet',
    o.order_expires_at ? `- Subscription until **${fmt(o.order_expires_at)}**${sd !== null ? ` (${sd >= 0 ? `${plural(sd, 'day')} left` : 'ended'})` : ''}` : null,
    `- Auto-renew: ${o.auto_renew ? 'on' : 'off'}`,
    o.customer_price != null ? `- Price: ${o.customer_price} ${o.customer_currency || ''}`.trim() : null
  ].filter(Boolean);
  return {
    body: `**${o.common_name}**\n\n${rows.join('\n')}`,
    buttons: [
      { kind: 'link', label: 'Open certificate', href: `/certificates/${o.id}`, primary: true },
      o.status === 'issued' ? { kind: 'link', label: 'Download ZIP', href: `/api/orders/${o.id}/download?format=zip` } : null
    ].filter(Boolean),
    orderId: o.id,
    matched: true
  };
}
