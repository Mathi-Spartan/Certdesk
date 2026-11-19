import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireWorkspace } from '@/lib/auth';
import { getOrderForWorkspace, syncOrder, primaryMethod, lifecycle } from '@/lib/orders';
import { lockRemaining, revalidatePath, resendPath } from '@/lib/gogetssl';
import { certFacts } from '@/lib/certs';
import { saveReminderSettings, requestCancel } from '@/app/actions/orders';
import TopBar from '@/components/TopBar';
import DcvPanel from '@/components/DcvPanel';
import SubmitButton from '@/components/SubmitButton';
import { fmtDate, FlashFromSearch, timeAgo } from '@/components/ui';
import { itemFromOrder } from '@/lib/portfolio';
import { supportEmail, helpHref } from '@/lib/support';

export const metadata = { title: 'Certificate · CertDesk' };

const DAY = 86400000;
const svg = (d, s = 15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;

function basicEmails(domain) {
  const base = String(domain || '').replace(/^\*\./, '');
  return ['admin', 'administrator', 'hostmaster', 'postmaster', 'webmaster'].map((p) => `${p}@${base}`);
}

/** The maximum public certificate lifetime that applies to a certificate issued today (CA/B Forum SC-081v3). */
function nextCap(now = Date.now()) {
  if (now >= Date.parse('2029-03-15')) return 47;
  if (now >= Date.parse('2027-03-15')) return 100;
  return 200;
}

export default async function CertificateDetail({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireWorkspace();
  let order = await getOrderForWorkspace(id, ctx.workspaceId);
  if (!order) notFound();
  let syncError = null;
  const stale = !order.last_synced_at || Date.now() - new Date(order.last_synced_at).getTime() > 5 * 60000;
  if (stale && order.gg_order_id && order.status !== 'cancelled') {
    try {
      order = await syncOrder(order);
    } catch (e) {
      syncError = e.message;
    }
  }
  const locks = order.gg_order_id
    ? { revalidate: await lockRemaining(revalidatePath(order.gg_order_id)), resend: await lockRemaining(resendPath(order.gg_order_id)) }
    : {};
  const facts = certFacts(order);
  const life = lifecycle(order);
  const issued = order.status === 'issued';
  const back = `/certificates/${order.id}`;
  const validating = ['validating', 'incomplete', 'reissuing'].includes(order.status);
  const ended = ['cancelled', 'cancel_requested'].includes(order.status);
  const item = itemFromOrder(order);
  const help = helpHref(await supportEmail(), {
    subject: `Help with ${order.common_name || 'my certificate'} (order ${order.gg_order_id || order.id})`,
    body: `Domain: ${order.common_name || ''}\nProduct: ${order.product_name || ''}\nOrder: ${order.gg_order_id || ''}\nStatus: ${item.detail?.label || ''}\n\nMy question:\n`
  });

  const names = (facts?.san?.length ? facts.san : [order.common_name, ...(order.sans || [])]).filter(Boolean);
  const days = issued ? life.certDays : null;
  const lifetime = issued && order.valid_from && order.valid_till ? Math.round((new Date(order.valid_till) - new Date(order.valid_from)) / DAY) : null;
  const ringPct = lifetime && days !== null ? Math.max(0, Math.min(1, days / lifetime)) : 0;
  const ringTone = days === null ? '#A1A1AA' : days <= 14 ? '#DC2626' : days <= 30 ? '#F59E0B' : 'var(--cx-accent)';
  const pillTone = item.group === 'action' ? (days !== null && days <= 14 ? 'red' : 'action') : item.group;
  const pillText = issued && days !== null ? (days < 0 ? `Expired ${-days} days ago` : `Expires in ${days} days`) : item.detail?.label || item.status.label;

  // lifecycle stepper from real dates
  const steps = [
    { label: 'Ordered', sub: fmtDate(order.created_at), state: 'done' },
    { label: 'Validated', sub: issued ? primaryMethod(order) : validating ? 'Waiting for you' : '—', state: issued ? 'done' : validating ? 'now' : 'todo' },
    { label: 'Issued', sub: issued ? fmtDate(order.valid_from) : 'After validation', state: issued ? 'done' : 'todo' },
    life.reissueDueOn ? { label: 'Reissue due', sub: fmtDate(life.reissueDueOn), state: life.action === 'reissue' || life.action === 'reissue_overdue' ? 'now' : 'todo' } : null,
    { label: order.order_expires_at && order.order_expires_at !== order.valid_till ? 'Order ends' : 'Expires', sub: fmtDate(order.order_expires_at || order.valid_till) || '—', state: life.action === 'renew' || life.action === 'order_ended' ? 'now' : 'todo' }
  ].filter(Boolean);
  if (ended) steps.push({ label: 'Closed', sub: order.status === 'cancel_requested' ? 'Cancellation requested' : 'Cancelled', state: 'done' });

  const alert = item.group === 'action' && !validating ? item.next : null;

  return (
    <>
      {ctx.isAdmin ? <TopBar crumbs={[{ label: 'Certificates', href: '/orders' }, { label: order.common_name || 'Pending order' }]} /> : null}
      <main className="cx3-page">
        <div className="cx3-head">
          <div className="cx3-title">
            <span className="cx3-title-ico">{svg(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>, 22)}</span>
            <div>
              <h1 className="mono cx3-cn-title">{order.common_name || 'Pending order'}</h1>
              <div className="cx3-meta">
                <span className={`cx3-pill ${pillTone}`}>{pillText}</span>
                <span>{order.product_name}</span>
                {order.sans?.length ? <><i aria-hidden="true">·</i><span>+{order.sans.length} more name{order.sans.length > 1 ? 's' : ''}</span></> : null}
                <i aria-hidden="true">·</i><span>Order <span className="mono">{order.gg_order_id || '—'}</span></span>
                {(order.tags || []).map((t) => <span key={t} className="cx3-tag">{t}</span>)}
              </div>
            </div>
          </div>
          <div className="cx3-row">
            {issued ? <a className="cx3-btn" href={`/api/orders/${order.id}/download?format=fullchain`}>{svg(<path d="M12 3v12M7 10l5 5 5-5M5 21h14" />)}Download</a> : null}
            {issued && life.canReissue ? <Link className="cx3-btn" href={`/certificates/${order.id}/reissue`}>Reissue</Link> : null}
            {item.next?.cta && !validating ? <Link className="cx3-btn primary" href={item.next.href}>{item.next.cta}</Link> : null}
            {!ended && !(item.next?.cta && !validating) ? <Link className="cx3-btn primary" href={`/buy?renew=${order.id}`}>Renew</Link> : null}
          </div>
        </div>

        <FlashFromSearch searchParams={sp} />
        {syncError ? <div className="cx3-alert amber">{svg(<><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></>, 18)}<div>Could not refresh from the certificate authority just now. Showing the last known state.</div></div> : null}
        {alert ? (
          <div role="alert" className="cx3-alert red">
            {svg(<><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></>, 18)}
            <div><strong>{alert.text}</strong>{!order.auto_renew ? ' Auto-renew is off for this certificate.' : ''}</div>
            {alert.cta ? <Link className="cx3-btn sm danger" href={alert.href}>{alert.cta}</Link> : null}
          </div>
        ) : null}

        <section className="cx3-card cx3-steps" aria-label="Lifecycle">
          <ol>
            {steps.map((s, i) => (
              <li key={s.label} className={s.state}>
                <div className="cx3-step-line"><span className="cx3-step-dot">{s.state === 'done' ? svg(<path d="m5 12 5 5 9-10" />, 12) : null}</span>{i < steps.length - 1 ? <i /> : null}</div>
                <strong>{s.label}</strong>
                <small>{s.sub}</small>
              </li>
            ))}
          </ol>
        </section>

        <div className="cx3-split">
          <div className="cx3-col">
            {validating ? (
              <section className="cx3-card cx3-pad" id="dcv">
                <div className="cx3-card-head"><div><h2>Prove you control {order.common_name}</h2><p>The certificate is issued as soon as the check passes, usually within minutes.</p></div></div>
                <DcvPanel order={{ id: order.id, common_name: order.common_name, dcv: order.dcv, dcv_method: order.dcv_method, approver_email: order.approver_email, last_synced_at: order.last_synced_at }} back={back} approverEmails={basicEmails(order.common_name)} locks={locks} />
              </section>
            ) : null}

            <section className="cx3-card cx3-pad">
              <h2>Certificate</h2>
              <dl className="cx3-facts">
                <div><dt>Covers</dt><dd className="mono">{names.join(', ') || '—'}</dd></div>
                <div><dt>Issuer</dt><dd>{facts?.issuer || (issued ? '—' : 'Not issued yet')}</dd></div>
                <div><dt>Serial number</dt><dd className="mono wrap">{facts?.serial || '—'}</dd></div>
                <div><dt>Valid from</dt><dd>{issued ? fmtDate(order.valid_from) : '—'}</dd></div>
                <div><dt>Valid until</dt><dd className={days !== null && days <= 30 ? 't-red strong' : ''}>{issued ? fmtDate(order.valid_till) : '—'}</dd></div>
                <div><dt>Key</dt><dd className="mono">{facts?.key || '—'}</dd></div>
                <div className="wide"><dt>SHA-256 fingerprint</dt><dd className="mono wrap small">{facts?.fingerprint256 || '—'}</dd></div>
                <div><dt>Plan</dt><dd>{order.period_months ? `${order.period_months % 12 === 0 ? `${order.period_months / 12} year${order.period_months > 12 ? 's' : ''}` : `${order.period_months} months`}` : '—'}{order.order_expires_at ? ` · ends ${fmtDate(order.order_expires_at)}` : ''}</dd></div>
                <div><dt>Reissues</dt><dd>{life.canReissue ? 'Free while the order is active' : '—'}</dd></div>
                <div><dt>Validation</dt><dd>{primaryMethod(order)}</dd></div>
                <div><dt>Last updated</dt><dd>{timeAgo(order.last_synced_at)}</dd></div>
              </dl>
            </section>

            {issued ? (
              <section className="cx3-card cx3-pad">
                <div className="cx3-card-head"><div><h2>Check the live site</h2><p>See whether {order.common_name} is serving this certificate with a complete, trusted chain.</p></div>
                  <Link className="cx3-btn" href={`/tools/ssl-checker?host=${encodeURIComponent(String(order.common_name || '').replace(/^\*\./, ''))}`}>Run SSL check</Link></div>
              </section>
            ) : null}
          </div>

          <aside className="cx3-col side">
            <section className="cx3-card cx3-pad cx3-life-card">
              <div className="cx3-ring sm">
                <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={days === null ? 'Not issued' : `${days} days left`}>
                  <circle cx="44" cy="44" r="37" fill="none" stroke="#F4F4F5" strokeWidth="9" />
                  <circle cx="44" cy="44" r="37" fill="none" stroke={ringTone} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${ringPct * 232.5} 232.5`} transform="rotate(-90 44 44)" />
                </svg>
                <div><b style={{ color: days !== null && days <= 14 ? '#B91C1C' : undefined }}>{days === null ? '—' : Math.max(0, days)}</b><small>{days === null ? 'not issued' : 'days left'}</small></div>
              </div>
              <p>{lifetime ? <>Lifetime <strong>{lifetime} days</strong>. </> : null}A certificate issued now is capped at <strong>{nextCap()} days</strong> under current CA/B Forum rules.</p>
            </section>

            {!ended ? (
              <section className="cx3-card cx3-pad">
                <h2>Reminders</h2>
                <form action={saveReminderSettings} className="cx3-form">
                  <input type="hidden" name="order_id" value={order.id} />
                  <label className="cx3-field">
                    <span>Remind me to reissue</span>
                    <select name="reminder_days" defaultValue={String(order.reminder_days || 30)}>
                      {[45, 30, 21, 14, 7].map((n) => <option key={n} value={n}>{n} days before it expires</option>)}
                    </select>
                  </label>
                  <label className="cx3-field">
                    <span>Tags</span>
                    <input name="tags" defaultValue={(order.tags || []).join(', ')} placeholder="prod, payments" />
                  </label>
                  <SubmitButton className="cx3-btn" pendingText="Saving…">Save</SubmitButton>
                </form>
              </section>
            ) : null}

            {issued ? (
              <section className="cx3-card cx3-pad">
                <h2>Download for your server</h2>
                <div className="cx3-dlgrid">
                  <a className="cx3-btn" href={`/api/orders/${order.id}/download?format=fullchain`}>Nginx / full chain</a>
                  <a className="cx3-btn" href={`/api/orders/${order.id}/download?format=crt`}>Certificate (.crt)</a>
                  <a className="cx3-btn" href={`/api/orders/${order.id}/download?format=ca`}>CA bundle</a>
                  <a className="cx3-btn" href={`/api/orders/${order.id}/download?format=csr`}>CSR</a>
                </div>
                <p className="cx3-muted">Use the private key you saved when the key was created. Need PFX or JKS? Use the <Link href="/tools/converter">format converter</Link>.</p>
              </section>
            ) : null}

            {help ? <a className="cx3-help" href={help}>{svg(<><circle cx="12" cy="12" r="9" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4M12 17h.01" /></>, 16)}Questions about this certificate? Ask us</a> : null}

            {!ended ? (
              <details className="cx3-card cx3-danger">
                <summary>Cancel this order</summary>
                <form action={requestCancel} className="cx3-form">
                  <input type="hidden" name="order_id" value={order.id} />
                  <label className="cx3-field"><span>Reason</span><input name="reason" placeholder="No longer needed" /></label>
                  <SubmitButton className="cx3-btn sm danger" pendingText="Sending…">Request cancellation</SubmitButton>
                  <span className="cx3-muted">Refunds depend on the certificate authority&apos;s refund window.</span>
                </form>
              </details>
            ) : null}
          </aside>
        </div>
      </main>
    </>
  );
}
