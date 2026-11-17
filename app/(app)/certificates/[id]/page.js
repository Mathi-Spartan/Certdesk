import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireWorkspace } from '@/lib/auth';
import { q } from '@/lib/db';
import { getOrderForWorkspace, syncOrder, displayStatus, primaryMethod, lifecycle } from '@/lib/orders';
import { lockRemaining, revalidatePath, resendPath } from '@/lib/gogetssl';
import { certFacts } from '@/lib/certs';
import { saveReminderSettings, requestCancel } from '@/app/actions/orders';
import TopBar from '@/components/TopBar';
import Icon from '@/components/Icon';
import DcvPanel from '@/components/DcvPanel';
import SubmitButton from '@/components/SubmitButton';
import { StatusBadge, fmtDate, fmtDateTime, FlashFromSearch, timeAgo } from '@/components/ui';

export const metadata = { title: 'Certificate · CertDesk' };

function basicEmails(domain) {
  const base = String(domain || '').replace(/^\*\./, '');
  return ['admin', 'administrator', 'hostmaster', 'postmaster', 'webmaster'].map((p) => `${p}@${base}`);
}

function Node({ kind }) {
  return (
    <span className={`node ${kind}`}>
      {kind === 'done' ? <Icon name="tick" size={12} stroke="#fff" width={3.5} /> : null}
    </span>
  );
}

function Clock({ title, sub, days, total, tone, children }) {
  const circ = 2 * Math.PI * 37;
  const pct = total && days !== null ? Math.max(0, Math.min(1, days / total)) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', width: 88, height: 88, flex: 'none' }}>
        <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={`${title}: ${days ?? 'unknown'} days left`}>
          <circle cx="44" cy="44" r="37" fill="none" stroke="#F4F4F5" strokeWidth="9" />
          <circle cx="44" cy="44" r="37" fill="none" stroke={tone} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${pct * circ} ${circ}`} transform="rotate(-90 44 44)" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 22, fontWeight: 700 }}>{days ?? '—'}</span>
          <span className="small muted">days left</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div className="small muted">{sub}</div>
        {children}
      </div>
    </div>
  );
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
  const events = await q(
    `select e.*, u.name as actor from console.order_events e left join console.users u on u.id = e.actor_user_id
      where e.order_id = $1 order by e.created_at desc limit 20`,
    [order.id]
  );
  const locks = order.gg_order_id
    ? { revalidate: await lockRemaining(revalidatePath(order.gg_order_id)), resend: await lockRemaining(resendPath(order.gg_order_id)) }
    : {};
  const facts = certFacts(order);
  const st = displayStatus(order);
  const life = lifecycle(order);
  const issued = order.status === 'issued';
  const certLifetime = issued && order.valid_from && order.valid_till ? Math.round((new Date(order.valid_till) - new Date(order.valid_from)) / 86400000) : null;
  const orderLifetime = order.order_starts_at && order.order_expires_at ? Math.round((new Date(order.order_expires_at) - new Date(order.order_starts_at)) / 86400000) : null;
  const back = `/certificates/${order.id}`;
  const validating = ['validating', 'incomplete', 'reissuing'].includes(order.status);

  const steps = [
    { label: 'Ordered', sub: fmtDate(order.order_starts_at || order.created_at), kind: 'done' },
    { label: 'Validated', sub: issued ? primaryMethod(order) : validating ? 'Waiting' : '—', kind: issued ? 'done' : validating ? 'now' : 'todo' },
    { label: 'Issued', sub: issued ? fmtDate(order.valid_from) : 'Not yet', kind: issued ? 'done' : 'todo' },
    {
      label: life.canReissue || !issued ? 'Reissue' : 'No reissue left',
      sub: issued ? (life.canReissue ? `Due ${fmtDate(life.reissueDueOn)}` : 'Certificate runs to order end') : 'After issue',
      kind: life.action === 'reissue' || life.action === 'reissue_overdue' ? 'warn' : 'todo'
    },
    { label: 'Certificate expires', sub: issued ? fmtDate(order.valid_till) : '—', kind: life.certDays !== null && life.certDays < 0 ? 'warn' : 'todo' },
    { label: 'Order ends · renew', sub: fmtDate(order.order_expires_at), kind: life.action === 'renew' || life.action === 'order_ended' ? 'warn' : 'todo' }
  ];

  return (
    <>
      <TopBar crumbs={[{ label: 'Certificates', href: '/certificates' }, { label: order.common_name || 'Pending order' }]}>
        <span className="small muted">GoGetSSL order <span className="mono">{order.gg_order_id || '—'}</span></span>
      </TopBar>
      <main className="page">
        <div className="between" style={{ alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span className="ws-badge" style={{ width: 48, height: 48, borderRadius: 12 }}><Icon name="lock" size={22} stroke="#fff" /></span>
            <div>
              <h1 className="mono" style={{ margin: 0, fontSize: 24, fontWeight: 500 }}>{order.common_name || 'Pending order'}</h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6, alignItems: 'center', fontSize: 13 }} className="muted">
                <StatusBadge order={order} />
                <span>{order.product_name}</span>
                {(order.tags || []).map((t) => <span key={t} className="tag">{t}</span>)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {issued ? <a className="btn" href={`/api/orders/${order.id}/download?format=fullchain`}><Icon name="download" />Download</a> : null}
            {issued && life.canReissue ? <Link className={`btn ${life.action === 'reissue' || life.action === 'reissue_overdue' ? 'primary' : ''}`} href={`/certificates/${order.id}/reissue`}>Reissue</Link> : null}
            {issued && (life.action === 'renew' || life.action === 'order_ended') ? <Link className="btn primary" href={`/buy?renew=${order.id}`}>Renew order</Link> : null}
          </div>
        </div>

        <FlashFromSearch searchParams={sp} />
        {syncError ? <div className="alert amber"><Icon name="info" />Could not refresh from GoGetSSL just now: {syncError}</div> : null}
        {life.action === 'reissue' || life.action === 'reissue_overdue' ? (
          <div role="alert" className="alert red">
            <Icon name="alert" stroke="var(--red-strong)" />
            <div style={{ flex: '1 1 360px' }}>
              <strong>{life.certDays < 0 ? `This certificate expired ${-life.certDays} days ago.` : `This certificate expires in ${life.certDays} days.`}</strong>{' '}
              Your order is active until {fmtDate(order.order_expires_at)}, so reissuing is free. Install the new certificate before the old one expires.
            </div>
            <Link className="btn sm danger" href={`/certificates/${order.id}/reissue`}>Reissue now</Link>
          </div>
        ) : null}
        {life.action === 'renew' || life.action === 'order_ended' ? (
          <div role="alert" className="alert red">
            <Icon name="alert" stroke="var(--red-strong)" />
            <div style={{ flex: '1 1 360px' }}>
              <strong>{life.orderDays !== null && life.orderDays < 0 ? 'This order has ended.' : `This order ends ${life.orderDays !== null ? `in ${life.orderDays} days` : 'soon'}.`}</strong>{' '}
              No reissues are left on it. Renew to buy a new order for {order.common_name}.
            </div>
            <Link className="btn sm danger" href={`/buy?renew=${order.id}`}>Renew order</Link>
          </div>
        ) : null}
        {order.status === 'payment_needed' ? <div className="alert amber"><Icon name="info" />GoGetSSL is waiting for payment on this order. Your partner has been notified.</div> : null}
        {order.status === 'cancel_requested' ? <div className="alert amber"><Icon name="info" />Cancellation requested. GoGetSSL usually answers within 24–48 hours.</div> : null}

        <section aria-label="Lifecycle" className="card pad">
          <ol className="stepper">
            {steps.map((s, i) => (
              <li key={s.label}>
                <div className="ln"><Node kind={s.kind} />{i < steps.length - 1 ? <span className={`line ${s.kind === 'done' ? 'done' : ''}`} /> : null}</div>
                <div style={{ fontWeight: 600, fontSize: 13, color: s.kind === 'warn' ? 'var(--red-strong)' : s.kind === 'todo' ? 'var(--muted)' : undefined }}>{s.label}</div>
                <div className="small muted">{s.sub}</div>
              </li>
            ))}
          </ol>
        </section>

        <div className="row top">
          <div style={{ flex: '2 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {validating ? (
              <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="between"><h2>Domain validation</h2><span className="small muted">{order.gg_status_description || ''}</span></div>
                <DcvPanel order={order} back={back} approverEmails={basicEmails(order.common_name)} locks={locks} />
              </section>
            ) : null}

            <section className="card pad">
              <h2 style={{ marginBottom: 16 }}>Certificate</h2>
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px 24px', fontSize: 13 }}>
                <div><dt className="muted">Covers</dt><dd style={{ margin: 0 }} className="mono">{(facts?.san?.length ? facts.san : [order.common_name, ...(order.sans || [])]).filter(Boolean).join(', ')}</dd></div>
                <div><dt className="muted">Product</dt><dd style={{ margin: 0 }}>{order.product_name || '—'}</dd></div>
                <div><dt className="muted">Issuer</dt><dd style={{ margin: 0 }}>{facts?.issuer || '—'}</dd></div>
                <div><dt className="muted">Certificate valid from</dt><dd style={{ margin: 0 }}>{issued ? fmtDate(order.valid_from) : '—'}</dd></div>
                <div><dt className="muted">Certificate valid until</dt><dd style={{ margin: 0, fontWeight: 600, color: life.certDays !== null && life.certDays <= 30 ? 'var(--red-strong)' : undefined }}>{issued ? fmtDate(order.valid_till) : '—'}</dd></div>
                <div><dt className="muted">Key</dt><dd style={{ margin: 0 }} className="mono">{facts?.key || '—'}</dd></div>
                <div><dt className="muted">Order term</dt><dd style={{ margin: 0 }}>{order.period_months ? `${order.period_months} months` : '—'}</dd></div>
                <div><dt className="muted">Order active until</dt><dd style={{ margin: 0, fontWeight: 600 }}>{fmtDate(order.order_expires_at)}</dd></div>
                <div><dt className="muted">Serial number</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }} className="mono">{facts?.serial || '—'}</dd></div>
                <div><dt className="muted">SHA-256 fingerprint</dt><dd style={{ margin: 0, overflowWrap: 'anywhere', fontSize: 11 }} className="mono">{facts?.fingerprint256 || '—'}</dd></div>
                <div><dt className="muted">Validation</dt><dd style={{ margin: 0 }}>{primaryMethod(order)}</dd></div>
                <div><dt className="muted">Last synced</dt><dd style={{ margin: 0 }}>{timeAgo(order.last_synced_at)}</dd></div>
              </dl>
            </section>

            <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h2>History</h2>
              {events.length === 0 ? <span className="muted">No events yet.</span> : (
                <ol className="feed">
                  {events.map((e) => (
                    <li key={e.id}><span className="when">{fmtDateTime(e.created_at)}</span><span>{e.message}{e.actor ? <span className="muted"> · {e.actor}</span> : null}</span></li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Clock title="Certificate" sub={issued ? `Expires ${fmtDate(order.valid_till)} · reissue before then` : 'Starts when issued'}
                days={issued ? life.certDays : null} total={certLifetime} tone={life.certDays !== null && life.certDays <= 30 ? 'var(--red-dot)' : 'var(--accent)'} />
              <Clock title="Order" sub={order.order_expires_at ? `Active until ${fmtDate(order.order_expires_at)} · renew after` : 'Dates appear once GoGetSSL sets them'}
                days={life.orderDays} total={orderLifetime} tone={life.orderDays !== null && life.orderDays <= 30 ? 'var(--red-dot)' : '#F59E0B'} />
              <div className="small muted">Certificates last at most 200 days (100 days from 15 Mar 2027). Reissues are free until the order ends.</div>
            </section>

            <section className="card pad">
              <h2 style={{ marginBottom: 14 }}>Reminder &amp; tags</h2>
              <form action={saveReminderSettings} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <input type="hidden" name="order_id" value={order.id} />
                <div className="field">
                  <label htmlFor="rem">Mark reissue as due</label>
                  <select className="input" id="rem" name="reminder_days" defaultValue={String(order.reminder_days || 30)}>
                    {[45, 30, 21, 14, 7].map((n) => <option key={n} value={n}>{n} days before the certificate expires</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="tags">Tags</label>
                  <input className="input" id="tags" name="tags" defaultValue={(order.tags || []).join(', ')} placeholder="prod, payments" />
                </div>
                <SubmitButton pendingText="Saving…">Save</SubmitButton>
              </form>
            </section>

            {issued ? (
              <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h2>Download for your server</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
                  <a className="btn sm" href={`/api/orders/${order.id}/download?format=fullchain`}>Nginx (full chain)</a>
                  <a className="btn sm" href={`/api/orders/${order.id}/download?format=crt`}>Certificate .crt</a>
                  <a className="btn sm" href={`/api/orders/${order.id}/download?format=ca`}>CA bundle</a>
                  <a className="btn sm" href={`/api/orders/${order.id}/download?format=csr`}>CSR</a>
                </div>
                <div className="small muted">Your private key was never sent to CertDesk. Use the key you saved when the CSR was created.</div>
              </section>
            ) : null}

            {order.status !== 'cancelled' && order.status !== 'cancel_requested' ? (
              <details className="card pad">
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Cancel this order</summary>
                <form action={requestCancel} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                  <input type="hidden" name="order_id" value={order.id} />
                  <div className="field"><label htmlFor="reason">Reason</label><input className="input" id="reason" name="reason" placeholder="Test order" /></div>
                  <SubmitButton className="btn sm danger" pendingText="Sending…">Request cancellation</SubmitButton>
                  <span className="small muted">Sent to GoGetSSL. Refunds depend on the CA's refund window.</span>
                </form>
              </details>
            ) : null}
          </div>
        </div>
      </main>
    </>
  );
}
