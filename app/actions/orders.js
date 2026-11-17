'use server';

import dns from 'node:dns/promises';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { q, one } from '@/lib/db';
import { requireWorkspace } from '@/lib/auth';
import * as gg from '@/lib/gogetssl';
import { syncOrder, addEvent, getOrderForWorkspace } from '@/lib/orders';

const enc = encodeURIComponent;
const DOMAIN_RE = /^(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}$/i;

function cleanDomain(d) {
  return String(d || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

async function webserverType() {
  const cached = await one(`select value from console.kv where key = 'gg_webserver_other'`);
  if (cached?.value?.id) return cached.value.id;
  let id = 18;
  try {
    const res = await gg.getWebServers(1);
    const list = Array.isArray(res.webservers) ? res.webservers : Object.values(res).find(Array.isArray) || [];
    const other = list.find((w) => /other/i.test(w.software || w.name || ''));
    id = Number((other || list[0] || {}).id) || id;
  } catch {
    /* fall back to the common "Other" id */
  }
  await q(
    `insert into console.kv (key, value) values ('gg_webserver_other', $1)
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [JSON.stringify({ id })]
  );
  return id;
}

/** DNS checks shown in the wizard before paying. */
export async function preflight(domainInput) {
  await requireWorkspace();
  const domain = cleanDomain(domainInput);
  if (!DOMAIN_RE.test(domain)) return { error: 'Enter a valid domain name, for example shop.example.com' };
  const host = domain.replace(/^\*\./, '');
  const checks = [];
  try {
    const a = await dns.resolve(host, 'A');
    checks.push({ ok: true, text: `Domain resolves · A record ${a[0]}` });
  } catch {
    checks.push({ ok: null, text: 'No A record found. That is fine for DNS or email validation, but HTTP validation will fail.' });
  }
  let caa = [];
  const parts = host.split('.');
  for (let i = 0; i < parts.length - 1 && !caa.length; i++) {
    try {
      caa = await dns.resolveCaa(parts.slice(i).join('.'));
    } catch {
      caa = [];
    }
  }
  if (!caa.length) checks.push({ ok: true, text: 'No CAA record, so any certificate authority may issue' });
  else {
    const issuers = caa.map((r) => r.issue || r.issuewild).filter(Boolean);
    checks.push({ ok: null, text: `CAA record allows: ${issuers.join(', ') || 'see DNS'}. Make sure it includes your chosen CA.` });
  }
  return { domain, checks };
}

export async function approverEmails(domainInput) {
  await requireWorkspace();
  const domain = cleanDomain(domainInput).replace(/^\*\./, '');
  try {
    const res = await gg.getDomainEmails(domain);
    const list = res.ComodoApprovalEmails || res.GeotrustApprovalEmails || Object.values(res).find(Array.isArray) || [];
    return { emails: list };
  } catch (e) {
    return { error: e.message, emails: ['admin', 'administrator', 'hostmaster', 'postmaster', 'webmaster'].map((p) => `${p}@${domain}`) };
  }
}

export async function decodeCsr(csr) {
  await requireWorkspace();
  try {
    const res = await gg.decodeCsr(csr);
    const r = res.csrResult || res;
    return { ok: true, cn: r.CN || r.cn || null, o: r.O || null, keySize: r.keysize || r['Key Size'] || null };
  } catch (e) {
    return { error: e.message };
  }
}

/** Place a new order (or a renewal) from the wizard. */
export async function placeOrder(input) {
  const ctx = await requireWorkspace();
  const product = await one('select * from console.products where id = $1 and enabled', [Number(input.productId)]);
  if (!product) return { error: 'That certificate is not available. Pick another one.' };
  const cn = cleanDomain(input.commonName);
  if (!DOMAIN_RE.test(cn)) return { error: 'The domain name is not valid.' };
  const sans = (input.sans || []).map(cleanDomain).filter((d) => d && d !== cn);
  if (sans.some((d) => !DOMAIN_RE.test(d))) return { error: 'One of the additional domains is not valid.' };
  const method = ['dns', 'http', 'https', 'email'].includes(input.dcvMethod) ? input.dcvMethod : 'dns';
  if (method === 'email' && !input.approverEmail) return { error: 'Choose an approver email.' };
  if (method === 'email' && sans.length) return { error: 'Use DNS or HTTP validation when the certificate covers more than one domain.' };
  if (cn.startsWith('*.') && method.startsWith('http')) return { error: 'Wildcard certificates cannot use HTTP validation. Choose DNS or email.' };
  if (!String(input.csr || '').includes('BEGIN CERTIFICATE REQUEST')) return { error: 'A CSR is required.' };
  const period = Number(input.period) || 12;
  const c = input.contact || {};
  for (const k of ['firstname', 'lastname', 'email', 'phone']) {
    if (!String(c[k] || '').trim()) return { error: 'Fill in the administrative contact (name, email and phone).' };
  }
  const needsOrg = product.validation === 'ov' || product.validation === 'ev';
  const o = input.org || {};
  if (needsOrg) {
    for (const k of ['name', 'addressline1', 'city', 'country', 'phone', 'postalcode']) {
      if (!String(o[k] || '').trim()) return { error: 'OV and EV certificates need the organisation details filled in.' };
    }
  }

  let renewalOf = null;
  if (input.renewalOf) {
    renewalOf = await getOrderForWorkspace(input.renewalOf, ctx.workspaceId);
    if (!renewalOf) return { error: 'The certificate being renewed was not found.' };
  }

  const contact = {
    firstname: c.firstname.trim(),
    lastname: c.lastname.trim(),
    email: c.email.trim(),
    phone: c.phone.trim(),
    title: String(c.title || 'IT Manager').trim()
  };
  const form = {
    product_id: product.id,
    period,
    csr: input.csr,
    server_count: -1,
    webserver_type: await webserverType(),
    dcv_method: method,
    approver_email: method === 'email' ? input.approverEmail : undefined,
    dns_names: sans.length ? sans.join(',') : undefined,
    approver_emails: sans.length ? sans.map(() => method).join(',') : undefined,
    signature_hash: 'SHA2'
  };
  for (const who of ['admin', 'tech']) {
    form[`${who}_firstname`] = contact.firstname;
    form[`${who}_lastname`] = contact.lastname;
    form[`${who}_email`] = contact.email;
    form[`${who}_phone`] = contact.phone;
    form[`${who}_title`] = contact.title;
    if (needsOrg) {
      form[`${who}_organization`] = o.name;
      form[`${who}_addressline1`] = o.addressline1;
      form[`${who}_city`] = o.city;
      form[`${who}_country`] = o.country;
      form[`${who}_postalcode`] = o.postalcode;
      form[`${who}_region`] = o.region;
    }
  }
  if (needsOrg) {
    Object.assign(form, {
      org_name: o.name,
      org_division: o.division || 'IT',
      org_addressline1: o.addressline1,
      org_city: o.city,
      org_country: o.country,
      org_phone: o.phone,
      org_postalcode: o.postalcode,
      org_region: o.region
    });
  }

  let res;
  try {
    res = renewalOf ? await gg.addSslRenewOrder(form) : await gg.addSslOrder(form);
  } catch (e) {
    return { error: 'GoGetSSL did not accept the order: ' + e.message };
  }
  if (!res.order_id) return { error: 'GoGetSSL did not return an order ID.' };

  const row = await one(
    `insert into console.orders (workspace_id, gg_order_id, product_id, product_name, common_name, sans, status,
        dcv_method, approver_email, period_months, webserver_type, csr, contact, renewal_of, invoice_id,
        order_amount, currency, tags, created_by, auto_renew)
     values ($1,$2,$3,$4,$5,$6,'validating',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) returning *`,
    [
      ctx.workspaceId,
      Number(res.order_id),
      product.id,
      product.name,
      cn,
      sans,
      method,
      method === 'email' ? input.approverEmail : null,
      period,
      form.webserver_type,
      input.csr,
      JSON.stringify({ ...contact, org: needsOrg ? o : null }),
      renewalOf ? renewalOf.id : null,
      res.invoice_id ? String(res.invoice_id) : null,
      res.order_amount != null ? Number(res.order_amount) : null,
      res.currency || null,
      renewalOf ? renewalOf.tags : (input.tags || []).filter(Boolean),
      ctx.user.id,
      input.autoRenew !== false
    ]
  );
  await addEvent(row.id, 'ordered', `${renewalOf ? 'Renewal' : 'Order'} placed with GoGetSSL (order ${res.order_id})`, ctx.user.id);
  if (renewalOf) await addEvent(renewalOf.id, 'renewal', `Renewal ordered (GoGetSSL order ${res.order_id})`, ctx.user.id);
  await q('update console.workspaces set contact = $2 where id = $1', [ctx.workspaceId, JSON.stringify({ ...contact, org: needsOrg ? o : null })]);
  try {
    await syncOrder(row);
  } catch {
    /* details appear on the next sync */
  }
  return { id: row.id };
}

async function loadOrder(formData) {
  const ctx = await requireWorkspace();
  const order = await getOrderForWorkspace(String(formData.get('order_id')), ctx.workspaceId);
  if (!order) redirect('/certificates?err=' + enc('Certificate not found'));
  return { ctx, order, back: String(formData.get('back') || `/certificates/${order.id}`) };
}

function withMsg(back, key, msg) {
  return back + (back.includes('?') ? '&' : '?') + key + '=' + enc(msg);
}

export async function checkNow(formData) {
  const { order, back } = await loadOrder(formData);
  let msg;
  try {
    const o = await syncOrder(order);
    msg = `Checked with GoGetSSL: ${o.gg_status_description || o.gg_status || 'no change'}`;
  } catch (e) {
    redirect(withMsg(back, 'err', 'GoGetSSL: ' + e.message));
  }
  redirect(withMsg(back, 'ok', msg));
}

export async function toggleAutoRenew(formData) {
  const { ctx, order } = await loadOrder(formData);
  const on = !order.auto_renew;
  await q('update console.orders set auto_renew = $2, updated_at = now() where id = $1', [order.id, on]);
  await addEvent(order.id, 'settings', `Auto-renew turned ${on ? 'on' : 'off'}`, ctx.user.id);
  revalidatePath('/', 'layout');
}

export async function saveRenewalSettings(formData) {
  const { ctx, order, back } = await loadOrder(formData);
  const lead = Math.min(90, Math.max(1, Number(formData.get('renew_lead_days')) || 30));
  const auto = formData.get('auto_renew') === 'on';
  const tags = String(formData.get('tags') || '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
  await q('update console.orders set renew_lead_days = $2, auto_renew = $3, tags = $4, updated_at = now() where id = $1', [order.id, lead, auto, tags]);
  await addEvent(order.id, 'settings', `Renewal settings saved (auto-renew ${auto ? 'on' : 'off'}, ${lead} days before expiry)`, ctx.user.id);
  redirect(withMsg(back, 'ok', 'Renewal settings saved'));
}

export async function changeDcvMethod(formData) {
  const { ctx, order, back } = await loadOrder(formData);
  const method = String(formData.get('method'));
  const value = method === 'email' ? String(formData.get('approver_email') || '') : method;
  if (!value) redirect(withMsg(back, 'err', 'Choose an approver email'));
  try {
    await gg.changeValidation(order.gg_order_id, value);
    await q('update console.orders set dcv_method = $2, approver_email = $3, updated_at = now() where id = $1', [
      order.id,
      method,
      method === 'email' ? value : null
    ]);
    await addEvent(order.id, 'validation', `Validation method changed to ${method === 'email' ? value : method.toUpperCase()}`, ctx.user.id);
    await syncOrder({ ...order, dcv_method: method });
  } catch (e) {
    redirect(withMsg(back, 'err', 'GoGetSSL: ' + e.message));
  }
  redirect(withMsg(back, 'ok', 'Validation method changed'));
}

export async function resendEmail(formData) {
  const { ctx, order, back } = await loadOrder(formData);
  try {
    await gg.resendValidationEmail(order.gg_order_id);
    await addEvent(order.id, 'validation', 'Validation email sent again', ctx.user.id);
  } catch (e) {
    redirect(withMsg(back, 'err', 'GoGetSSL: ' + e.message));
  }
  redirect(withMsg(back, 'ok', 'Validation email sent again'));
}

export async function revalidateDomain(formData) {
  const { ctx, order, back } = await loadOrder(formData);
  const domain = String(formData.get('domain') || order.common_name);
  try {
    await gg.revalidate(order.gg_order_id, domain);
    await addEvent(order.id, 'validation', `Asked the CA to check ${domain} again`, ctx.user.id);
    await syncOrder(order);
  } catch (e) {
    redirect(withMsg(back, 'err', 'GoGetSSL: ' + e.message));
  }
  redirect(withMsg(back, 'ok', `The CA will check ${domain} again`));
}

export async function requestCancel(formData) {
  const { ctx, order, back } = await loadOrder(formData);
  const reason = String(formData.get('reason') || '').trim() || 'Cancelled by customer from CertDesk';
  try {
    await gg.cancelOrder(order.gg_order_id, reason);
    await q(`update console.orders set status = 'cancel_requested', updated_at = now() where id = $1`, [order.id]);
    await addEvent(order.id, 'cancel', `Cancellation requested: ${reason}`, ctx.user.id);
  } catch (e) {
    redirect(withMsg(back, 'err', 'GoGetSSL: ' + e.message));
  }
  redirect(withMsg(back, 'ok', 'Cancellation requested. GoGetSSL usually answers within 24–48 hours.'));
}

export async function reissue(input) {
  const ctx = await requireWorkspace();
  const order = await getOrderForWorkspace(input.orderId, ctx.workspaceId);
  if (!order) return { error: 'Certificate not found.' };
  if (!String(input.csr || '').includes('BEGIN CERTIFICATE REQUEST')) return { error: 'A new CSR is required.' };
  const method = ['dns', 'http', 'https', 'email'].includes(input.dcvMethod) ? input.dcvMethod : 'dns';
  const sans = order.sans || [];
  try {
    await gg.reissueOrder(order.gg_order_id, {
      csr: input.csr,
      webserver_type: order.webserver_type || (await webserverType()),
      dcv_method: method,
      approver_email: method === 'email' ? input.approverEmail : undefined,
      dns_names: sans.length ? sans.join(',') : undefined,
      approver_emails: sans.length ? sans.map(() => method).join(',') : undefined,
      signature_hash: 'SHA2'
    });
  } catch (e) {
    return { error: 'GoGetSSL: ' + e.message };
  }
  await q(`update console.orders set status = 'reissuing', csr = $2, dcv_method = $3, updated_at = now() where id = $1`, [order.id, input.csr, method]);
  await addEvent(order.id, 'reissue', 'Reissue requested with a new key', ctx.user.id);
  try {
    await syncOrder(order);
  } catch {
    /* next sync */
  }
  return { id: order.id };
}
