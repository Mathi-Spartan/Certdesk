import { q, one } from '../db';
import * as gg from '../gogetssl';
import { syncOrder, addEvent, lifecycle, subscriptionOf, daysLeft, markRenewals } from '../orders';
import { itemFromOrder } from '../portfolio';
import { checkDcvRecord, dnsMessage } from '../dnscheck';
import { rank, extractDomains, extractOrderNumbers, serverOf, normalise, daysWindow } from './match';
import { ALL_ARTICLES } from './kb';
import { buildIndex, matchArticles } from './similar';
import { detectData, answerData, detailsCard } from './data';
import { COMPANY } from '../support';
import { cancelWindow, CANCEL_DAYS } from '../cancel';

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const ORDER_INTENTS = new Set(['change_method', 'why_pending', 'status', 'validate_how', 'dns_check', 'expiry', 'reissue', 'renew', 'download', 'autorenew']);
const QUICK = [
  { kind: 'reply', label: 'Why isn’t my certificate issued?', text: 'Why is my certificate not issued?' },
  { kind: 'reply', label: 'What needs my attention?', text: 'What needs my attention?' },
  { kind: 'reply', label: 'When does it expire?', text: 'When does my certificate expire?' },
  { kind: 'reply', label: 'Due in the next 30 days', text: 'List orders to reissue or renew in the next 30 days' },
  { kind: 'reply', label: 'Reissue or renew?', text: 'Do I need to reissue or renew?' },
  { kind: 'reply', label: 'Download my files', text: 'Download my certificate files' },
  { kind: 'reply', label: 'How do I install it?', text: 'How do I install my certificate?' }
];
const HANDOFF = { kind: 'handoff', label: 'Talk to support' };

// ───────────────────────── knowledge base

let seeded = false;
/** Insert any shipped article the database doesn't have yet. Edited articles are never overwritten. */
export async function ensureSeed() {
  if (seeded) return;
  await q(
    `insert into console.assist_articles (slug, title, category, keywords, body)
     select t.slug, t.title, t.category, string_to_array(t.kw, '|'), t.body
       from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[]) as t(slug, title, category, kw, body)
     on conflict (slug) do nothing`,
    [ALL_ARTICLES.map((a) => a.slug), ALL_ARTICLES.map((a) => a.title), ALL_ARTICLES.map((a) => a.category), ALL_ARTICLES.map((a) => a.keywords.join('|')), ALL_ARTICLES.map((a) => a.body)]
  );
  seeded = true;
}

let cache = { at: 0, index: null, list: [] };
/** Published articles (your edits included) plus the shipped example phrasings, indexed for matching. */
async function kbIndex() {
  if (cache.index && Date.now() - cache.at < 60000) return cache;
  let rows;
  try {
    await ensureSeed();
    rows = await q('select id, slug, title, category, keywords, body from console.assist_articles where published');
  } catch {
    rows = ALL_ARTICLES;
  }
  const shipped = Object.fromEntries(ALL_ARTICLES.map((a) => [a.slug, a.keywords]));
  const list = rows.map((r) => ({ ...r, keywords: [...new Set([...(r.keywords || []), ...(shipped[r.slug] || [])])] }));
  cache = { at: Date.now(), index: buildIndex(list), list };
  return cache;
}

export async function article(slug) {
  await ensureSeed();
  const a = await one('select id, slug, title, body from console.assist_articles where slug = $1 and published', [slug]);
  if (a) q('update console.assist_articles set views = views + 1 where id = $1', [a.id]).catch(() => {});
  return a || ALL_ARTICLES.find((x) => x.slug === slug) || null;
}

export async function searchKb(text, limit = 3) {
  await ensureSeed();
  const words = String(text || '').toLowerCase().replace(/[^a-z0-9@. ]+/g, ' ').trim();
  if (!words) return [];
  const rows = await q(
    `select id, slug, title, body, ts_rank(search, websearch_to_tsquery('english', $1)) + ts_rank(search, plainto_tsquery('english', $1)) as score
       from console.assist_articles
      where published and (search @@ websearch_to_tsquery('english', $1) or search @@ to_tsquery('english', $2))
      order by score desc limit $3`,
    [words, words.split(/\s+/).filter((w) => w.length > 2).map((w) => w.replace(/[^a-z0-9]/g, '')).filter(Boolean).join(' | ') || 'zzzz', limit]
  );
  return rows;
}

// ───────────────────────── orders

async function workspaceOrders(workspaceId) {
  return markRenewals(await q(`select * from console.orders where workspace_id = $1 and status <> 'draft' order by created_at desc`, [workspaceId]));
}

function bare(d) {
  return String(d || '').toLowerCase().replace(/^\*\./, '');
}

function findOrders(orders, text) {
  const nums = extractOrderNumbers(text);
  const byNum = orders.filter((o) => nums.includes(Number(o.gg_order_id)));
  if (byNum.length) return byNum;
  const doms = extractDomains(text).map(bare);
  if (!doms.length) return [];
  const exact = orders.filter((o) => doms.some((d) => bare(o.common_name) === d || (o.sans || []).some((s) => bare(s) === d)));
  if (exact.length) return exact;
  // "example.com" also finds www.example.com, shop.example.com…
  return orders.filter((o) => doms.some((d) => bare(o.common_name).endsWith('.' + d) || d.endsWith('.' + bare(o.common_name))));
}

/** Latest live order per domain, so old cancelled duplicates don't get in the way. */
function preferLive(list) {
  const live = list.filter((o) => !['cancelled', 'cancel_requested'].includes(o.status));
  return live.length ? live : list;
}

function pickButtons(orders, intent) {
  const items = preferLive(orders).map((o) => ({ o, i: itemFromOrder(o) }));
  const rankG = { action: 0, progress: 1, ok: 2, ended: 3 };
  items.sort((a, b) => rankG[a.i.group] - rankG[b.i.group]);
  return items.slice(0, 8).map(({ o, i }) => ({ kind: 'pick', orderId: o.id, intent, label: `${o.common_name}${o.sans?.length ? ` +${o.sans.length}` : ''}`, note: i.detail?.label || '' }));
}

async function fresh(o) {
  const stale = !o.last_synced_at || Date.now() - new Date(o.last_synced_at).getTime() > 2 * 60000;
  if (stale && o.gg_order_id && !['cancelled'].includes(o.status)) {
    try { return await syncOrder(o); } catch { return o; }
  }
  return o;
}

// ───────────────────────── answers

function certButtons(o, extra = []) {
  return [...extra, { kind: 'link', label: 'Open certificate', href: `/certificates/${o.id}` }];
}

async function dcvBlocks(o) {
  const items = Array.isArray(o.dcv) && o.dcv.length ? o.dcv : [{ domain: o.common_name, method: o.dcv_method }];
  const pending = items.filter((it) => it.status !== 'validated');
  const blocks = [];
  const lines = [];
  let anyEmail = false;
  for (const it of pending.slice(0, 6)) {
    const m = String(it.method || o.dcv_method || '').toLowerCase();
    if (it.dns?.name && it.dns?.value) {
      const res = await checkDcvRecord(it.dns);
      blocks.push({ t: 'record', domain: it.domain, type: it.dns.type || 'CNAME', name: it.dns.name, value: it.dns.value, state: res?.state || 'unknown' });
      lines.push(res ? `**${it.domain}:** ${res.state === 'ok' ? 'the record is correct in public DNS ✓. Ask the CA to re-check if it isn’t issued in a few minutes.' : dnsMessage(it.dns, res)}` : `**${it.domain}:** add the ${it.dns.type || 'CNAME'} record below.`);
    } else if ((it.http || it.https)?.url) {
      const h = it.http || it.https;
      blocks.push({ t: 'file', domain: it.domain, url: h.url, content: h.content });
      lines.push(`**${it.domain}:** upload the file below so it opens at the exact URL, then ask the CA to re-check.`);
    } else if (it.email || m.includes('@') || m.includes('mail')) {
      anyEmail = true;
      lines.push(`**${it.domain}:** open the approval email sent to **${it.email || o.approver_email || 'the approver address'}** and click approve. Check spam too.`);
    } else {
      lines.push(`**${it.domain}:** validation details aren’t available yet. Tap **Refresh status** in a minute.`);
    }
  }
  if (pending.length > 6) lines.push(`…and ${pending.length - 6} more domain(s) on the certificate page.`);
  return { blocks, lines, anyEmail, pendingCount: pending.length, total: items.length };
}

async function answerStatus(o, focus) {
  o = await fresh(o);
  const item = itemFromOrder(o);
  const head = `**${o.common_name}**${o.sans?.length ? ` (+${o.sans.length})` : ''} · ${o.product_name || 'SSL'} · order #${o.gg_order_id || '—'}\nStatus: **${item.detail?.label || o.status}**`;
  if (['validating', 'incomplete', 'reissuing'].includes(o.status)) {
    const d = await dcvBlocks(o);
    const method = String(o.dcv_method || '').toUpperCase() || 'not set';
    const body = [head, `It’s waiting for domain validation (method: ${method}). ${d.pendingCount} of ${d.total} domain${d.total === 1 ? '' : 's'} still to validate.`, ...d.lines].join('\n\n');
    const buttons = [
      { kind: 'action', action: 'recheck', orderId: o.id, label: 'Ask the CA to re-check', primary: true },
      d.anyEmail ? { kind: 'action', action: 'resend', orderId: o.id, label: 'Resend approval email' } : null,
      { kind: 'action', action: 'refresh', orderId: o.id, label: 'Refresh status' },
      { kind: 'reply', label: 'Change validation method', text: 'How do I change the validation method?' }
    ].filter(Boolean);
    return { body, blocks: d.blocks, buttons: certButtons(o, buttons), orderId: o.id, matched: true };
  }
  if (o.status === 'issued') {
    const l = lifecycle(o);
    const body = [head, `The certificate is issued and valid until **${fmt(o.valid_till)}** (${l.certDays >= 0 ? `${plural(l.certDays, 'day')} left` : `expired ${-l.certDays} days ago`}).`, item.next?.text || ''].filter(Boolean).join('\n\n');
    const extra = [{ kind: 'link', label: 'Download all files (.zip)', href: `/api/orders/${o.id}/download?format=zip`, primary: true }];
    if (item.next?.cta && item.next.href) extra.push({ kind: 'link', label: item.next.cta, href: item.next.href });
    return { body, buttons: certButtons(o, extra), orderId: o.id, matched: true };
  }
  if (o.status === 'payment_needed') return { body: `${head}\n\nThe order is waiting for payment on the provider side. Nothing to do on your end. Support has been notified on their dashboard.`, buttons: certButtons(o, [HANDOFF]), orderId: o.id, matched: true };
  if (['cancelled', 'cancel_requested'].includes(o.status)) return { body: `${head}\n\n${o.status === 'cancel_requested' ? 'A cancellation was requested. Support confirms it, usually within 1–2 business days.' : 'This order is closed.'}`, buttons: certButtons(o, [{ kind: 'link', label: 'Order a new certificate', href: '/order' }]), orderId: o.id, matched: true };
  return { body: `${head}\n\n${item.next?.text || ''}`, buttons: certButtons(o), orderId: o.id, matched: true, focus };
}

async function answerExpiry(o) {
  o = await fresh(o);
  const l = lifecycle(o);
  const sub = subscriptionOf(o);
  const item = itemFromOrder(o);
  const rows = [];
  rows.push(o.valid_till ? `**Certificate:** valid until **${fmt(o.valid_till)}**${l.certDays !== null ? ` (${l.certDays >= 0 ? `${plural(l.certDays, 'day')} left` : `expired ${-l.certDays} days ago`})` : ''}` : '**Certificate:** not issued yet');
  rows.push(sub ? `**Subscription:** ${sub.months ? `${sub.months} months, ` : ''}until **${fmt(sub.end)}**${sub.days !== null ? ` (${sub.days >= 0 ? `${plural(sub.days, 'day')} left` : 'ended'})` : ''}` : '**Subscription:** end date not known yet');
  if (l.reissueDueOn) rows.push(`Next free reissue from **${fmt(l.reissueDueOn)}**.`);
  const extra = item.next?.cta && item.next.href ? [{ kind: 'link', label: item.next.cta, href: item.next.href, primary: true }] : [];
  return { body: [`**${o.common_name}**`, ...rows, item.next?.text || ''].filter(Boolean).join('\n\n'), buttons: certButtons(o, extra), orderId: o.id, matched: true };
}

async function answerLifecycle(o) {
  o = await fresh(o);
  const l = lifecycle(o);
  const sub = subscriptionOf(o);
  let verdict;
  if (!['issued', 'expired'].includes(o.status)) verdict = 'This order isn’t issued yet, so there’s nothing to reissue or renew. Finish validation first.';
  else if (l.action === 'order_ended' || (sub && sub.ended)) verdict = `**Renew.** The subscription ended on ${fmt(sub?.end)}, so a new order is needed.`;
  else if (l.action === 'renew') verdict = `**Renew.** The subscription ends ${fmt(sub?.end || o.valid_till)} and there’s no time left for another reissue.`;
  else if (l.action === 'reissue' || l.action === 'reissue_overdue') verdict = `**Reissue (free).** The certificate ${l.certDays < 0 ? 'has expired' : `expires ${fmt(o.valid_till)}`} but your subscription runs until ${fmt(sub?.end)}.`;
  else verdict = `**Nothing yet.** The certificate is valid until ${fmt(o.valid_till)}${l.reissueDueOn ? `; reissue from ${fmt(l.reissueDueOn)}` : ''}${sub ? `. Subscription until ${fmt(sub.end)}` : ''}.`;
  const item = itemFromOrder(o);
  const extra = item.next?.cta && item.next.href ? [{ kind: 'link', label: item.next.cta, href: item.next.href, primary: true }] : [];
  return { body: `**${o.common_name}**\n\n${verdict}\n\nReissue = fresh certificate on the same paid subscription, free. Renew = new subscription when the paid period ends.`, buttons: certButtons(o, extra), orderId: o.id, matched: true };
}

async function answerDownload(o) {
  if (o.status !== 'issued') return { body: `**${o.common_name}** isn’t issued yet (${itemFromOrder(o).detail?.label || o.status}), so there’s nothing to download. Let’s get it validated.`, buttons: certButtons(o, [{ kind: 'reply', label: 'Why isn’t it issued?', text: `Why is ${o.common_name} not issued?` }]), orderId: o.id, matched: true };
  return {
    body: `**${o.common_name}** is ready. The ZIP has the certificate, the CA bundle, the full chain and the CSR. Your private key isn’t included; it stays with you from when the CSR was created.`,
    buttons: certButtons(o, [
      { kind: 'link', label: 'Download all files (.zip)', href: `/api/orders/${o.id}/download?format=zip`, primary: true },
      { kind: 'link', label: 'Full chain only (.pem)', href: `/api/orders/${o.id}/download?format=fullchain` },
      { kind: 'reply', label: 'How do I install it?', text: 'How do I install my certificate?' }
    ]),
    orderId: o.id,
    matched: true
  };
}

function answerAutoRenew(o) {
  return {
    body: `Auto-renew for **${o.common_name}** is **${o.auto_renew ? 'on' : 'off'}**. ${o.auto_renew ? 'A new subscription is ordered automatically when this one ends.' : 'When it’s on, a new subscription is ordered automatically when this one ends.'}`,
    buttons: certButtons(o, [{ kind: 'action', action: o.auto_renew ? 'autorenew_off' : 'autorenew_on', orderId: o.id, label: o.auto_renew ? 'Turn auto-renew off' : 'Turn auto-renew on', primary: !o.auto_renew }]),
    orderId: o.id,
    matched: true
  };
}

async function answerOverview(workspaceId, orders) {
  const items = preferLive(orders).map((o) => ({ o, i: itemFromOrder(o) }));
  const need = items.filter((x) => x.i.group === 'action');
  const prog = items.filter((x) => x.i.group === 'progress');
  const ok = items.filter((x) => x.i.group === 'ok');
  const subs = await q(`select count(*)::int as n from console.subscriptions where workspace_id = $1 and status not in ('cancelled','expired')`, [workspaceId]).catch(() => [{ n: 0 }]);
  if (!need.length) {
    return { body: `All good. **${ok.length}** certificate${ok.length === 1 ? ' is' : 's are'} valid${prog.length ? `, ${prog.length} in progress on the provider side` : ''}${subs[0]?.n ? ` and ${plural(subs[0].n, 'automated subscription')} running` : ''}. Nothing needs you right now.`, buttons: [{ kind: 'link', label: 'Open My certificates', href: '/orders' }], matched: true };
  }
  const lines = need.slice(0, 8).map(({ o, i }) => `- **${o.common_name}**: ${i.detail?.label}. ${i.next?.text || ''}`);
  return {
    body: `**${need.length}** certificate${need.length === 1 ? ' needs' : 's need'} you:\n\n${lines.join('\n')}${need.length > 8 ? `\n- …and ${need.length - 8} more` : ''}`,
    buttons: need.slice(0, 5).map(({ o }) => ({ kind: 'pick', orderId: o.id, intent: 'status', label: o.common_name })),
    matched: true
  };
}

/** Everything with a certificate expiry or subscription end inside the window, split by what to do. */
function answerDue(orders, days, text) {
  const DAY = 86400000;
  const now = Date.now();
  const want = /reissue/.test(normalise(text)) && !/renew/.test(normalise(text)) ? 'reissue' : /renew/.test(normalise(text)) && !/reissue/.test(normalise(text)) ? 'renew' : 'both';
  const reissue = [];
  const renew = [];
  for (const o of preferLive(orders)) {
    if (!['issued', 'expired'].includes(o.status) || o.renewedBy) continue;
    const l = lifecycle(o);
    const sub = subscriptionOf(o);
    const certIn = o.valid_till ? Math.ceil((new Date(o.valid_till).getTime() - now) / DAY) : null;
    const subIn = sub ? sub.days : null;
    if (subIn !== null && subIn <= days && subIn >= -30) renew.push({ o, at: sub.end, d: subIn, why: subIn < 0 ? 'subscription ended' : 'subscription ends' });
    else if (certIn !== null && certIn <= days && certIn >= -30) (l.canReissue ? reissue : renew).push({ o, at: o.valid_till, d: certIn, why: certIn < 0 ? 'certificate expired' : 'certificate expires' });
  }
  const byDate = (a, b) => a.d - b.d;
  reissue.sort(byDate);
  renew.sort(byDate);
  const line = (x) => `- **${x.o.common_name}**: ${x.why} ${fmt(x.at)} (${x.d < 0 ? `${-x.d} days ago` : x.d === 0 ? 'today' : `in ${plural(x.d, 'day')}`})`;
  const parts = [];
  if (want !== 'renew') parts.push(reissue.length ? `**Reissue (free)**: ${reissue.length}\n\n${reissue.slice(0, 12).map(line).join('\n')}` : '**Reissue (free):** none');
  if (want !== 'reissue') parts.push(renew.length ? `**Renew**: ${renew.length}\n\n${renew.slice(0, 12).map(line).join('\n')}` : '**Renew:** none');
  const shown = [...(want !== 'renew' ? reissue : []), ...(want !== 'reissue' ? renew : [])];
  const head = shown.length ? `In the next **${days} days**${want === 'both' ? '' : ` (${want})`}:` : `Nothing ${want === 'both' ? 'to reissue or renew' : `to ${want}`} in the next **${days} days**.`;
  return {
    body: [head, ...parts].join('\n\n'),
    buttons: [
      ...shown.slice(0, 5).map((x) => ({ kind: 'link', label: `${reissue.includes(x) ? 'Reissue' : 'Renew'} ${x.o.common_name}`, href: reissue.includes(x) ? `/certificates/${x.o.id}/reissue` : `/buy?renew=${x.o.id}` })),
      ...(days < 90 ? [{ kind: 'reply', label: 'Next 90 days', text: `List orders to reissue or renew in the next 90 days` }] : [])
    ],
    matched: true
  };
}

function cancelAnswer(o) {
  const w = cancelWindow(o);
  if (w.reason === 'already') return { body: `A cancellation for **${o.common_name}** has already been requested. The support team confirms it, usually within 1–2 business days.`, buttons: [{ kind: 'link', label: 'Open certificate', href: `/certificates/${o.id}` }], matched: true };
  if (!w.allowed) {
    return {
      body: `**${o.common_name}** can’t be cancelled any more. Orders can only be cancelled within **${CANCEL_DAYS} days of purchase**: this one was purchased on ${fmt(w.purchased)} and the window closed on **${fmt(w.deadline)}**.\n\nIf you no longer need it, you can simply turn auto-renew off so it isn’t renewed.`,
      buttons: [{ kind: 'link', label: 'Open certificate', href: `/certificates/${o.id}` }, { kind: 'action', action: 'autorenew_off', orderId: o.id, label: 'Turn auto-renew off' }, HANDOFF],
      matched: true
    };
  }
  return {
    body: `**${o.common_name}** can still be cancelled: you have **${plural(w.daysLeft, 'day')}** left (until ${fmt(w.deadline)}, ${CANCEL_DAYS} days after purchase on ${fmt(w.purchased)}).\n\nOpen the certificate and use **Cancel this order** at the bottom. Cancelling stops the whole order and the certificate. Any refund depends on the certificate authority’s rules.`,
    buttons: [{ kind: 'link', label: 'Go to Cancel this order', href: `/certificates/${o.id}#cancel`, primary: true }],
    matched: true
  };
}

async function kbAnswer(slug, intro, extra = []) {
  const a = await article(slug);
  if (!a) return null;
  return { body: intro ? `${intro}\n\n${a.body}` : a.body, title: a.title, articleSlug: a.slug, buttons: extra, matched: true };
}

// ───────────────────────── main entry

/**
 * Work out the answer for one customer message.
 * conv.context: { orderId, pendingIntent, at }
 */
export async function answer(ctx, conv, text, { forcedIntent = null, forcedOrderId = null } = {}) {
  // "Topics: Validation" (from the topic browser)
  const topicPick = /^topics?:\s*(.+)$/i.exec(String(text || '').trim());
  if (topicPick && !forcedIntent) return topicArticles(topicPick[1]);

  // Questions about the customer's own certificates
  if (forcedIntent === 'details' && forcedOrderId) {
    const o = await one('select * from console.orders where id = $1 and workspace_id = $2', [forcedOrderId, ctx.workspaceId]);
    if (o) return { ...detailsCard(o, await productMap()), intent: 'details' };
  }
  const dataKind = forcedIntent ? null : detectData(text);
  if (dataKind === 'topics') return topicList();
  if (dataKind) {
    const [orders, products, subs] = await Promise.all([
      workspaceOrders(ctx.workspaceId),
      productMap(),
      q(`select status from console.subscriptions where workspace_id = $1`, [ctx.workspaceId]).catch(() => [])
    ]);
    const res = answerData(dataKind, text, orders, { products, subs, contact: { name: COMPANY.contact, email: COMPANY.email, company: COMPANY.name } });
    if (res) return { ...res, intent: dataKind };
  }

  const ranked = forcedIntent ? [{ intent: forcedIntent, score: 9 }] : rank(text);
  const top = ranked[0];
  const second = ranked[1];
  const intent = top && (forcedIntent || top.score >= 1.5) ? top.intent : null;
  const orders = await workspaceOrders(ctx.workspaceId);
  const context = conv.context || {};

  // which order is meant
  let mentioned = forcedOrderId ? orders.filter((o) => o.id === forcedOrderId) : findOrders(orders, text);
  mentioned = preferLive(mentioned);
  const recent = context.orderId && Date.now() - (context.at || 0) < 30 * 60000 ? orders.find((o) => o.id === context.orderId) : null;

  // A message that is only a domain or order number: show its status.
  const onlyRef = !intent && mentioned.length && normalise(text).split(' ').length <= 4;
  const effective = onlyRef ? 'status' : intent;

  // A general question ("cname or txt?", "is reissue free?") beats an order intent when it clearly
  // matches an article and doesn't point at an order (no domain, no "my/it/this").
  if (!forcedIntent && effective && ORDER_INTENTS.has(effective) && !mentioned.length && !/\b(my|our|it|its|this|these|mine)\b/i.test(text)) {
    const kb = await bestArticles(text);
    if (kb[0] && kb[0].score >= 0.6 && (!kb[1] || kb[0].score - kb[1].score >= 0.05)) return articleReply(kb[0].a, kb.slice(1).filter((x) => x.score >= 0.35));
  }

  // Knowledge base first for "how / what / why" questions that aren't about a specific order.
  const STRONG = new Set([...ORDER_INTENTS, 'greet', 'thanks', 'helpme', 'human', 'overview', 'list_due', 'cancel']);
  if (!forcedIntent && !(effective && STRONG.has(effective))) {
    const kb = await bestArticles(text);
    const [a1, a2] = kb;
    const confident = a1 && a1.score >= 0.42 && (a1.score >= 0.6 || !a2 || a1.score - a2.score >= 0.06);
    const installAsk = effective === 'install' && !serverOf(text) && !(a1 && a1.score >= 0.6);
    if (confident && !installAsk && (!effective || a1.score >= 0.6 || (top?.score || 0) < 3.5)) return articleReply(a1.a, kb.slice(1).filter((x) => x.score >= 0.35));
    if (!effective) return didYouMean(text, kb);
  }
  if (!effective) return fallback(text);

  // Two different topics scored the same: ask which.
  if (!forcedIntent && second && Math.abs(top.score - second.score) < 0.01 && !['reissue', 'renew'].includes(top.intent)) {
    const kb = await bestArticles(text);
    if (kb[0] && kb[0].score >= 0.75) return articleReply(kb[0].a, kb.slice(1).filter((x) => x.score >= 0.35));
    return { body: 'Which one do you mean?', buttons: [label(top.intent), label(second.intent), HANDOFF].filter(Boolean), matched: true, intent: 'clarify' };
  }

  if (ORDER_INTENTS.has(effective)) {
    let o = mentioned.length === 1 ? mentioned[0] : null;
    if (!o && mentioned.length > 1) return { body: 'I found more than one order for that. Which one?', buttons: pickButtons(mentioned, effective), matched: true, intent: effective, pendingIntent: effective };
    if (!o && recent) o = recent;
    if (effective === 'change_method' && !o) { const w = preferLive(orders).filter((x) => ['validating', 'incomplete', 'reissuing'].includes(x.status)); if (w.length === 1) o = w[0]; }
    if (!o) {
      const live = preferLive(orders);
      if (!orders.length) return { body: 'You don’t have any certificates yet. Want to order one?', buttons: [{ kind: 'link', label: 'Order a certificate', href: '/order', primary: true }, { kind: 'link', label: 'Help me choose', href: '/tools/finder' }], matched: true, intent: effective };
      if (live.length === 1) o = live[0];
      else if (effective === 'why_pending' || effective === 'status' || effective === 'validate_how' || effective === 'dns_check') {
        const waiting = live.filter((x) => ['validating', 'incomplete', 'reissuing'].includes(x.status));
        if (waiting.length === 1) o = waiting[0];
        else if (waiting.length > 1) return { body: `${plural(waiting.length, 'certificate')} ${waiting.length === 1 ? 'is' : 'are'} waiting for validation. Which one?`, buttons: pickButtons(waiting, effective), matched: true, intent: effective, pendingIntent: effective };
        else if (effective === 'why_pending') { const ov = await answerOverview(ctx.workspaceId, orders); return { ...ov, body: 'None of your certificates is waiting for validation right now.\n\n' + ov.body, intent: effective }; }
      }
      if (!o) return { body: 'Which certificate do you mean? Tap one, or type its domain name.', buttons: pickButtons(live, effective), matched: true, intent: effective, pendingIntent: effective };
    }
    let res;
    if (effective === 'why_pending' || effective === 'status' || effective === 'validate_how' || effective === 'dns_check') res = await answerStatus(o, effective);
    else if (effective === 'expiry') res = await answerExpiry(o);
    else if (effective === 'reissue' || effective === 'renew') res = await answerLifecycle(o);
    else if (effective === 'download') res = await answerDownload(o);
    else if (effective === 'autorenew') res = answerAutoRenew(o);
    else if (effective === 'change_method') {
      const multi = (o.sans || []).length > 0;
      res = {
        body: `**${o.common_name}** uses **${String(o.dcv_method || 'not set').toUpperCase()}** validation.\n\nTo switch, open the certificate and use **Change validation method** under Validation: DNS (CNAME), HTTP file, HTTPS file or an approver email.${multi ? ' On multi-domain certificates you can also change each domain on its own.' : ''} Wildcard domains can only use DNS or email.\n\nNew validation details appear on the page straight away.`,
        buttons: [{ kind: 'link', label: 'Open certificate', href: `/certificates/${o.id}`, primary: true }],
        orderId: o.id,
        matched: true
      };
    }
    if (effective === 'validate_how' && res && o.status !== 'issued') {
      const a = await article(/approvalemail/.test(normalise(text)) ? 'approval-email' : 'validation-methods');
      if (a) res.body += `\n\n---\n\n**${a.title}**\n\n${a.body}`;
    }
    return { ...res, intent: effective };
  }

  const ref = mentioned[0] || recent || null;
  switch (effective) {
    case 'greet':
    case 'helpme':
      return { buttons: [...QUICK, { kind: 'reply', label: 'Browse all help topics', text: 'Help topics' }], body: `Hi${ctx.user?.name ? ` ${String(ctx.user.name).split(' ')[0]}` : ''}! I’m **Nunmathi** (நுண்மதி), your CertDesk assistant. I can check your certificates live, explain validation, and get you the right files. Ask me anything, or tap a question:`, matched: true, intent: effective };
    case 'thanks':
      return { body: 'Happy to help! Anything else?', buttons: QUICK.slice(0, 3), matched: true, intent: effective };
    case 'human':
      return { body: 'Sure, I’ll pass this to the support team. Add anything they should know (optional), then tap **Send to support**.', buttons: [{ kind: 'handoff', label: 'Send to support', primary: true }], matched: true, intent: effective };
    case 'list_due':
      return { ...answerDue(orders, daysWindow(text), text), intent: effective };
    case 'overview':
      return { ...(await answerOverview(ctx.workspaceId, orders)), intent: effective };
    case 'install': {
      const srv = serverOf(text);
      if (!srv) return { body: 'Which server or hosting panel is it?', buttons: ['Nginx', 'Apache', 'IIS', 'cPanel', 'Plesk', 'Tomcat'].map((s) => ({ kind: 'reply', label: s, text: `Install on ${s}` })), matched: true, intent: effective };
      const extra = ref?.status === 'issued' ? [{ kind: 'link', label: 'Download all files (.zip)', href: `/api/orders/${ref.id}/download?format=zip`, primary: true }] : [];
      if (srv === 'iis' || srv === 'tomcat') extra.push({ kind: 'link', label: 'Format converter', href: '/tools/converter' });
      return { ...(await kbAnswer(`install-${srv}`, null, extra)), intent: effective, orderId: ref?.id };
    }
    case 'convert':
      return { ...(await kbAnswer('convert-formats', null, [{ kind: 'link', label: 'Open format converter', href: '/tools/converter', primary: true }])), intent: effective };
    case 'privatekey':
      return { ...(await kbAnswer('lost-private-key', null, ref ? [{ kind: 'link', label: `Reissue ${ref.common_name}`, href: `/certificates/${ref.id}/reissue`, primary: true }] : [])), intent: effective, orderId: ref?.id };
    case 'cancel': {
      if (!ref) {
        return { body: `Orders can be cancelled within **${CANCEL_DAYS} days of purchase**. After that, cancellation isn’t available.\n\nWhich certificate do you want to cancel? Tap one and I’ll tell you if it’s still inside the window.`, buttons: pickButtons(orders.filter((o) => !['cancelled', 'cancel_requested'].includes(o.status)), 'cancel'), matched: true, intent: effective, pendingIntent: 'cancel' };
      }
      return { ...cancelAnswer(ref), intent: effective, orderId: ref.id };
    }
    case 'adddomain':
      return { ...(await kbAnswer('add-domains', null, [{ kind: 'handoff', label: 'Ask support to add domains', primary: true }])), intent: effective, orderId: ref?.id };
    case 'buy':
      return { body: 'You can order from **Order new certificate**. Not sure which one fits? The SSL Finder asks a few questions and suggests the right certificate.', buttons: [{ kind: 'link', label: 'Order a certificate', href: '/order', primary: true }, { kind: 'link', label: 'SSL Finder', href: '/tools/finder' }], matched: true, intent: effective };
    case 'browsererror':
      return { ...(await kbAnswer('browser-errors', null, [{ kind: 'link', label: 'Run SSL checker', href: '/tools/ssl-checker', primary: true }])), intent: effective };
    case 'lifetime':
      return { ...(await kbAnswer('certificate-lifetimes')), intent: effective };
    case 'csr':
      return { ...(await kbAnswer('what-is-csr', null, [{ kind: 'link', label: 'CSR decoder', href: '/tools/csr-decoder' }])), intent: effective };
    case 'caa':
      return { ...(await kbAnswer('caa-records')), intent: effective };
    default:
      return fallback(text);
  }
}

async function productMap() {
  const rows = await q('select id, validation, wildcard, multidomain from console.products').catch(() => []);
  return Object.fromEntries(rows.map((p) => [p.id, p]));
}

async function bestArticles(text) {
  const { index } = await kbIndex();
  return matchArticles(index, text, 4);
}

function articleReply(a, related = []) {
  if (a.id) q('update console.assist_articles set views = views + 1 where id = $1', [a.id]).catch(() => {});
  return {
    body: `**${a.title}**\n\n${a.body}`,
    articleSlug: a.slug,
    buttons: [...related.slice(0, 2).map((r) => ({ kind: 'article', slug: r.a.slug, label: r.a.title })), HANDOFF],
    matched: true,
    intent: 'kb'
  };
}

function didYouMean(text, kb) {
  const close = kb.filter((x) => x.score >= 0.25).slice(0, 3);
  if (close.length) {
    return {
      body: 'I’m not completely sure what you mean. Is it one of these?',
      buttons: [...close.map((x) => ({ kind: 'article', slug: x.a.slug, label: x.a.title })), { kind: 'reply', label: 'Browse all help topics', text: 'Help topics' }, HANDOFF],
      matched: false,
      intent: 'none'
    };
  }
  return fallback(text);
}

const TOPIC_ORDER = ['Validation', 'OV & EV', 'Ordering', 'Lifecycle', 'Install', 'Troubleshooting', 'CSR & keys', 'Automation', 'Billing', 'Account', 'General'];
async function topicList() {
  const { list } = await kbIndex();
  const cats = [...new Set(list.map((a) => a.category))].sort((a, b) => (TOPIC_ORDER.indexOf(a) + 99) % 99 - (TOPIC_ORDER.indexOf(b) + 99) % 99);
  const n = (c) => list.filter((a) => a.category === c).length;
  return {
    body: `I can answer **${list.length}+ help topics**, plus live questions about your own certificates: what needs attention, why one isn’t issued, expiry dates, whether a domain is covered, order details and lists (expired, wildcard, by brand or validation method).

Pick a topic to see its questions:`,
    buttons: cats.map((c) => ({ kind: 'reply', label: `${c} (${n(c)})`, text: `Topics: ${c}` })),
    matched: true,
    intent: 'topics'
  };
}
async function topicArticles(cat) {
  const { list } = await kbIndex();
  const want = String(cat).replace(/\s*\(\d+\)\s*$/, '').trim().toLowerCase();
  const items = list.filter((a) => a.category.toLowerCase() === want);
  if (!items.length) return topicList();
  return {
    body: `**${items[0].category}**: tap a question.`,
    buttons: [...items.slice(0, 14).map((a) => ({ kind: 'article', slug: a.slug, label: a.title })), { kind: 'reply', label: '← All topics', text: 'Help topics' }],
    matched: true,
    intent: 'topics'
  };
}

const LABELS = {
  why_pending: ['Why isn’t it issued?', 'Why is my certificate not issued?'],
  validate_how: ['How to validate', 'How do I validate my domain?'],
  change_method: ['Change validation method', 'How do I change the validation method?'],
  dns_check: ['Check my DNS record', 'Check my DNS record'],
  expiry: ['Expiry dates', 'When does my certificate expire?'],
  reissue: ['Reissue or renew?', 'Do I need to reissue?'],
  renew: ['Reissue or renew?', 'Do I need to renew?'],
  download: ['Download files', 'Download my certificate files'],
  install: ['Install help', 'How do I install my certificate?'],
  convert: ['PFX / JKS formats', 'Convert to PFX'],
  privatekey: ['Private key', 'I lost my private key'],
  autorenew: ['Auto-renew', 'Auto renew settings'],
  cancel: ['Cancel / refund', 'How do I cancel?'],
  adddomain: ['Add domains', 'Add more domains'],
  buy: ['Order a certificate', 'I want to buy a certificate'],
  browsererror: ['Browser error', 'Browser shows not secure'],
  lifetime: ['Shorter lifetimes', 'What is the 47 day change?'],
  csr: ['What is a CSR?', 'What is a CSR?'],
  overview: ['What needs attention', 'What needs my attention?'],
  list_due: ['Due in 30 days', 'List orders to reissue or renew in the next 30 days'],
  status: ['Order status', 'Order status'],
  caa: ['CAA records', 'CAA record error']
};
function label(intent) {
  const l = LABELS[intent];
  return l ? { kind: 'reply', label: l[0], text: l[1] } : null;
}

async function fallback(text) {
  let kb = [];
  try { kb = await bestArticles(text); } catch { kb = []; }
  const close = kb.filter((x) => x.score >= 0.25).slice(0, 3);
  return {
    body: 'I’m not sure I understood that. Try one of these, type a domain name to see its status, or I can pass your question to the support team.',
    buttons: [...(close.length ? close.map((x) => ({ kind: 'article', slug: x.a.slug, label: x.a.title })) : QUICK.slice(0, 3)), { kind: 'reply', label: 'Browse all help topics', text: 'Help topics' }, HANDOFF],
    matched: false,
    intent: 'none'
  };
}

export async function articleAnswer(slug) {
  const a = await article(slug);
  if (!a) return { body: 'That article is no longer available.', buttons: [HANDOFF], matched: false, intent: 'kb' };
  return { body: `**${a.title}**\n\n${a.body}`, articleSlug: a.slug, buttons: [HANDOFF], matched: true, intent: 'kb' };
}

// ───────────────────────── actions from chat buttons

export async function runAction(ctx, action, orderId) {
  const o = await one('select * from console.orders where id = $1 and workspace_id = $2', [orderId, ctx.workspaceId]);
  if (!o) return { body: 'I couldn’t find that certificate in your account.', matched: false, intent: 'action' };
  try {
    if (action === 'refresh') {
      const n = await syncOrder(o);
      const st = await answerStatus(n);
      return { ...st, intent: 'action', body: 'Refreshed from the provider just now.\n\n' + st.body };
    }
    if (action === 'recheck') {
      const left = await gg.lockRemaining(gg.revalidatePath(o.gg_order_id));
      if (left > 0) return { body: `The CA allows a re-check once every 5 minutes per order. Try again in about ${Math.ceil(left / 60)} min.`, buttons: [{ kind: 'action', action: 'refresh', orderId: o.id, label: 'Refresh status' }], matched: true, intent: 'action', orderId: o.id };
      const d = await dcvBlocks(o);
      const bad = d.blocks.find((b) => b.t === 'record' && b.state !== 'ok' && b.state !== 'unknown');
      if (bad) return { body: `Before asking the CA: the record for **${bad.domain}** isn’t right in public DNS yet (${bad.state === 'malformed' ? 'extra spaces or quotes' : 'not found'}). Fix it first, otherwise the re-check will fail.`, blocks: [bad], buttons: [{ kind: 'action', action: 'recheck_force', orderId: o.id, label: 'Re-check anyway' }], matched: true, intent: 'action', orderId: o.id };
      action = 'recheck_force';
    }
    if (action === 'recheck_force') {
      await gg.revalidate(o.gg_order_id, o.common_name);
      await addEvent(o.id, 'validation', 'Asked the CA to re-check (from the support chat)', ctx.user.id);
      return { body: `Done. The CA will check **${o.common_name}** again. DV certificates are usually issued within a few minutes once validation passes.`, buttons: [{ kind: 'action', action: 'refresh', orderId: o.id, label: 'Refresh status in a minute' }, { kind: 'link', label: 'Open certificate', href: `/certificates/${o.id}` }], matched: true, intent: 'action', orderId: o.id };
    }
    if (action === 'resend') {
      await gg.resendValidationEmail(o.gg_order_id);
      await addEvent(o.id, 'validation', 'Approval email sent again (from the support chat)', ctx.user.id);
      return { body: `Sent. Check the inbox (and spam) of **${o.approver_email || 'the approver address'}**.`, buttons: [{ kind: 'reply', label: 'Didn’t get it', text: 'I did not get the approval email' }], matched: true, intent: 'action', orderId: o.id };
    }
    if (action === 'autorenew_on' || action === 'autorenew_off') {
      const on = action === 'autorenew_on';
      await q('update console.orders set auto_renew = $2, updated_at = now() where id = $1', [o.id, on]);
      await addEvent(o.id, 'settings', `Auto-renew turned ${on ? 'on' : 'off'} (from the support chat)`, ctx.user.id);
      return { body: `Auto-renew for **${o.common_name}** is now **${on ? 'on' : 'off'}**.`, matched: true, intent: 'action', orderId: o.id };
    }
  } catch (e) {
    return { body: `The provider said: ${e.message}`, buttons: [HANDOFF], matched: false, intent: 'action', orderId: o.id };
  }
  return { body: 'That action isn’t available.', matched: false, intent: 'action' };
}

export { daysLeft };
