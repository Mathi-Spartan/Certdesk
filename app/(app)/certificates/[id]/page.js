import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireWorkspace } from '@/lib/auth';
import { getOrderForWorkspace, syncOrder, primaryMethod, lifecycle } from '@/lib/orders';
import { lockRemaining, revalidatePath, resendPath } from '@/lib/gogetssl';
import { certFacts } from '@/lib/certs';
import { saveReminderSettings, requestCancel } from '@/app/actions/orders';
import TopBar from '@/components/TopBar';
import Icon from '@/components/Icon';
import DcvPanel from '@/components/DcvPanel';
import SubmitButton from '@/components/SubmitButton';
import { fmtDate, FlashFromSearch, timeAgo } from '@/components/ui';
import { itemFromOrder } from '@/lib/portfolio';
import { supportEmail, helpHref } from '@/lib/support';

export const metadata = { title: 'Certificate · CertDesk' };

function basicEmails(domain) {
  const base = String(domain || '').replace(/^\*\./, '');
  return ['admin', 'administrator', 'hostmaster', 'postmaster', 'webmaster'].map((p) => `${p}@${base}`);
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

  const item = itemFromOrder(order);
  const help = helpHref(await supportEmail(), {
    subject: `Help with ${order.common_name || 'my certificate'} (order ${order.gg_order_id || order.id})`,
    body: `Domain: ${order.common_name || ''}\nProduct: ${order.product_name || ''}\nOrder: ${order.gg_order_id || ''}\nStatus: ${item.detail?.label || ''}\n\nMy question:\n`
  });
  const hero = {
    action: { icon: 'alert', bg: '#FEF2F2', fg: 'var(--red-strong)', border: '#FECACA' },
    progress: { icon: 'clock', bg: '#FFFBEB', fg: '#B45309', border: '#FDE68A' },
    ok: { icon: 'tick', bg: '#F0FDF4', fg: '#15803D', border: '#BBF7D0' },
    ended: { icon: 'info', bg: '#F4F4F5', fg: 'var(--ink-2)', border: 'var(--line)' }
  }[item.group];
  const heroTitle = validating
    ? `Prove you own ${order.common_name}`
    : item.group === 'ok'
      ? 'Your certificate is active'
      : item.group === 'ended'
        ? 'This order is closed'
        : life.action === 'reissue' || life.action === 'reissue_overdue'
          ? life.certDays < 0 ? `Certificate expired ${-life.certDays} days ago` : `Certificate expires in ${life.certDays} days`
          : life.action === 'renew' || life.action === 'order_ended'
            ? 'Time to renew this order'
            : item.detail?.label || 'Waiting';

  return (
    <>
      <TopBar crumbs={[{ label: 'My SSL', href: '/dashboard' }, { label: order.common_name || 'Pending order' }]}>
        <span className="small muted">Order <span className="mono">{order.gg_order_id || '—'}</span></span>
      </TopBar>
      <main className="page" style={{ maxWidth: 1100 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span className="ws-badge" style={{ width: 48, height: 48, borderRadius: 12 }}><Icon name="lock" size={22} stroke="#fff" /></span>
          <div style={{ minWidth: 0 }}>
            <h1 className="mono" style={{ margin: 0, fontSize: 24, fontWeight: 500, overflowWrap: 'anywhere' }}>{order.common_name || 'Pending order'}</h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6, alignItems: 'center', fontSize: 13 }} className="muted">
              <span className={`badge tone-${item.status.tone}`}>{item.status.label}</span>
              <span>{order.product_name}</span>
              {order.sans?.length ? <span>· +{order.sans.length} more domain{order.sans.length > 1 ? 's' : ''}</span> : null}
              {(order.tags || []).map((t) => <span key={t} className="tag">{t}</span>)}
            </div>
          </div>
        </div>

        <FlashFromSearch searchParams={sp} />
        {syncError ? <div className="alert amber"><Icon name="info" />Could not refresh just now. Showing the last known state.</div> : null}

        <section className="next-card" style={{ background: hero.bg, borderColor: hero.border }} aria-label="Next step">
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <span className="next-icon" style={{ color: hero.fg, borderColor: hero.border }}><Icon name={hero.icon} size={20} stroke={hero.fg} width={2.4} /></span>
            <div style={{ flex: '1 1 320px', minWidth: 0 }}>
              <h2 style={{ fontSize: 18, margin: 0 }}>{heroTitle}</h2>
              <p style={{ margin: '4px 0 0', color: 'var(--ink-2)' }}>
                {validating
                  ? 'Follow the steps below. The certificate is issued as soon as the check passes, usually within minutes.'
                  : item.group === 'ok'
                    ? <>Download it and install it on your server. {life.reissueDueOn ? `We'll remind you to reissue from ${fmtDate(life.reissueDueOn)}.` : ''}</>
                    : item.next?.text}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {item.group === 'ok' ? <a className="btn primary" href={`/api/orders/${order.id}/download?format=fullchain`}><Icon name="download" stroke="#fff" />Download certificate</a> : null}
              {!validating && item.next?.cta ? <Link className="btn primary" href={item.next.href}>{item.next.cta}</Link> : null}
            </div>
          </div>
          {validating ? (
            <div className="next-body">
              <DcvPanel order={{ id: order.id, common_name: order.common_name, dcv: order.dcv, dcv_method: order.dcv_method, approver_email: order.approver_email, last_synced_at: order.last_synced_at }} back={back} approverEmails={basicEmails(order.common_name)} locks={locks} />
            </div>
          ) : null}
        </section>

        <div className="facts">
          <div><span className="small muted">Certificate expires</span><strong style={{ color: life.certDays !== null && life.certDays <= 30 ? 'var(--red-strong)' : undefined }}>{issued ? fmtDate(order.valid_till) : 'Not issued yet'}</strong>{issued && life.certDays !== null ? <span className="small muted">{life.certDays < 0 ? `${-life.certDays} days ago` : `in ${life.certDays} days`}</span> : null}</div>
          <div><span className="small muted">Order active until</span><strong>{fmtDate(order.order_expires_at) || '—'}</strong><span className="small muted">Free reissues until then</span></div>
          <div><span className="small muted">Covers</span><strong className="mono" style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{(facts?.san?.length ? facts.san : [order.common_name, ...(order.sans || [])]).filter(Boolean).slice(0, 3).join(', ')}</strong>{(order.sans?.length || 0) > 2 ? <span className="small muted">and more</span> : null}</div>
          <div><span className="small muted">Validation</span><strong>{primaryMethod(order)}</strong></div>
        </div>

        {issued ? (
          <details className="card fold" open={item.group === 'ok'}>
            <summary><Icon name="download" />Install on your server</summary>
            <div className="fold-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
                <a className="btn sm" href={`/api/orders/${order.id}/download?format=fullchain`}>Nginx / full chain (.pem)</a>
                <a className="btn sm" href={`/api/orders/${order.id}/download?format=crt`}>Certificate only (.crt)</a>
                <a className="btn sm" href={`/api/orders/${order.id}/download?format=ca`}>CA bundle</a>
                <a className="btn sm" href={`/api/orders/${order.id}/download?format=csr`}>CSR</a>
              </div>
              <div className="small muted">Use the private key you saved when the key was created. It was never sent to us.</div>
              {life.canReissue && item.group === 'ok' ? <Link className="small" href={`/certificates/${order.id}/reissue`}>Lost the key or changing servers? Reissue for free</Link> : null}
            </div>
          </details>
        ) : null}

        <details className="card fold">
          <summary><Icon name="info" />Certificate details</summary>
          <div className="fold-body">
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px 24px', fontSize: 13 }}>
              <div><dt className="muted">Product</dt><dd style={{ margin: 0 }}>{order.product_name || '—'}</dd></div>
              <div><dt className="muted">Issuer</dt><dd style={{ margin: 0 }}>{facts?.issuer || '—'}</dd></div>
              <div><dt className="muted">Valid from</dt><dd style={{ margin: 0 }}>{issued ? fmtDate(order.valid_from) : '—'}</dd></div>
              <div><dt className="muted">Valid until</dt><dd style={{ margin: 0 }}>{issued ? fmtDate(order.valid_till) : '—'}</dd></div>
              <div><dt className="muted">Order term</dt><dd style={{ margin: 0 }}>{order.period_months ? `${order.period_months} months` : '—'}</dd></div>
              <div><dt className="muted">Key</dt><dd style={{ margin: 0 }} className="mono">{facts?.key || '—'}</dd></div>
              <div><dt className="muted">Serial number</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }} className="mono">{facts?.serial || '—'}</dd></div>
              <div><dt className="muted">SHA-256 fingerprint</dt><dd style={{ margin: 0, overflowWrap: 'anywhere', fontSize: 11 }} className="mono">{facts?.fingerprint256 || '—'}</dd></div>
              <div><dt className="muted">All domains</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }} className="mono">{(facts?.san?.length ? facts.san : [order.common_name, ...(order.sans || [])]).filter(Boolean).join(', ')}</dd></div>
              <div><dt className="muted">Last updated</dt><dd style={{ margin: 0 }}>{timeAgo(order.last_synced_at)}</dd></div>
            </dl>
          </div>
        </details>

        <details className="card fold">
          <summary><Icon name="key" />Settings</summary>
          <div className="fold-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <form action={saveReminderSettings} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, alignItems: 'end' }}>
              <input type="hidden" name="order_id" value={order.id} />
              <div className="field">
                <label htmlFor="rem">Remind me to reissue</label>
                <select className="input" id="rem" name="reminder_days" defaultValue={String(order.reminder_days || 30)}>
                  {[45, 30, 21, 14, 7].map((n) => <option key={n} value={n}>{n} days before it expires</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="tags">Tags</label>
                <input className="input" id="tags" name="tags" defaultValue={(order.tags || []).join(', ')} placeholder="prod, payments" />
              </div>
              <div><SubmitButton className="btn" pendingText="Saving…">Save</SubmitButton></div>
            </form>
            {order.status !== 'cancelled' && order.status !== 'cancel_requested' ? (
              <form action={requestCancel} style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--line-soft)', paddingTop: 16 }}>
                <input type="hidden" name="order_id" value={order.id} />
                <div style={{ fontWeight: 600, color: 'var(--red-strong)' }}>Cancel this order</div>
                <div className="field" style={{ maxWidth: 420 }}><label htmlFor="reason">Reason</label><input className="input" id="reason" name="reason" placeholder="No longer needed" /></div>
                <div><SubmitButton className="btn sm danger" pendingText="Sending…">Request cancellation</SubmitButton></div>
                <span className="small muted">Refunds depend on the certificate authority&apos;s refund window.</span>
              </form>
            ) : null}
          </div>
        </details>
        {help ? <a className="help-link" href={help} style={{ alignSelf: 'flex-start' }}><Icon name="info" />Stuck? Ask us about this certificate</a> : null}
      </main>
    </>
  );
}
