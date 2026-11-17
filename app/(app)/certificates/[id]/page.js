import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireWorkspace } from '@/lib/auth';
import { q } from '@/lib/db';
import { getOrderForWorkspace, syncOrder, daysLeft, displayStatus, primaryMethod } from '@/lib/orders';
import { certFacts } from '@/lib/certs';
import { saveRenewalSettings, requestCancel } from '@/app/actions/orders';
import TopBar from '@/components/TopBar';
import Icon from '@/components/Icon';
import DcvPanel from '@/components/DcvPanel';
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
  const facts = certFacts(order);
  const st = displayStatus(order);
  const d = daysLeft(order.valid_till);
  const issued = order.status === 'issued';
  const lifetime = order.valid_from && order.valid_till ? Math.round((new Date(order.valid_till) - new Date(order.valid_from)) / 86400000) : null;
  const back = `/certificates/${order.id}`;
  const firstEvent = events[events.length - 1];

  const steps = [
    { label: 'Ordered', sub: fmtDate(order.created_at), kind: 'done' },
    { label: 'Validated', sub: issued || order.status === 'reissuing' ? primaryMethod(order) : 'Waiting', kind: issued ? 'done' : order.status === 'validating' || order.status === 'incomplete' ? 'now' : 'todo' },
    { label: 'Issued', sub: order.valid_from ? fmtDate(order.valid_from) : '—', kind: issued ? 'done' : 'todo' },
    { label: 'Renewal', sub: issued ? (d <= order.renew_lead_days ? 'Due now' : `in ${Math.max(0, d - order.renew_lead_days)} days`) : '—', kind: issued && d <= order.renew_lead_days ? 'warn' : 'todo' },
    { label: 'Expires', sub: fmtDate(order.valid_till), kind: st.key === 'expired' ? 'warn' : 'todo' }
  ];
  const circ = 2 * Math.PI * 37;
  const ringPct = lifetime && d !== null ? Math.max(0, Math.min(1, d / lifetime)) : 0;

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
                {issued && d !== null && d >= 0 ? <span>{d} days left</span> : null}
                <span>{order.product_name}</span>
                {(order.tags || []).map((t) => <span key={t} className="tag">{t}</span>)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {issued ? <a className="btn" href={`/api/orders/${order.id}/download?format=fullchain`}><Icon name="download" />Download</a> : null}
            {issued ? <Link className="btn" href={`/certificates/${order.id}/reissue`}>Reissue</Link> : null}
            {issued || st.key === 'expired' ? <Link className="btn primary" href={`/buy?renew=${order.id}`}>Renew now</Link> : null}
          </div>
        </div>

        <FlashFromSearch searchParams={sp} />
        {syncError ? <div className="alert amber"><Icon name="info" />Could not refresh from GoGetSSL just now: {syncError}</div> : null}
        {issued && d !== null && d <= 30 && !order.auto_renew ? (
          <div role="alert" className="alert red">
            <Icon name="alert" stroke="var(--red-strong)" />
            <div style={{ flex: '1 1 360px' }}><strong>This certificate expires in {d} days and auto-renew is off.</strong> Renew now with DNS validation so the next renewal needs no action.</div>
            <Link className="btn sm danger" href={`/buy?renew=${order.id}`}>Renew now</Link>
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
            {!issued && order.status !== 'cancelled' ? (
              <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="between"><h2>Domain validation</h2><span className="small muted">{order.gg_status_description || ''}</span></div>
                <DcvPanel order={order} back={back} approverEmails={basicEmails(order.common_name)} />
              </section>
            ) : null}

            <section className="card pad">
              <h2 style={{ marginBottom: 16 }}>Certificate</h2>
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px 24px', fontSize: 13 }}>
                <div><dt className="muted">Covers</dt><dd style={{ margin: 0 }} className="mono">{(facts?.san?.length ? facts.san : [order.common_name, ...(order.sans || [])]).filter(Boolean).join(', ')}</dd></div>
                <div><dt className="muted">Product</dt><dd style={{ margin: 0 }}>{order.product_name || '—'}</dd></div>
                <div><dt className="muted">Issuer</dt><dd style={{ margin: 0 }}>{facts?.issuer || '—'}</dd></div>
                <div><dt className="muted">Valid from</dt><dd style={{ margin: 0 }}>{fmtDate(order.valid_from)}</dd></div>
                <div><dt className="muted">Valid until</dt><dd style={{ margin: 0, fontWeight: 600, color: d !== null && d <= 30 ? 'var(--red-strong)' : undefined }}>{fmtDate(order.valid_till)}</dd></div>
                <div><dt className="muted">Key</dt><dd style={{ margin: 0 }} className="mono">{facts?.key || '—'}</dd></div>
                <div><dt className="muted">Serial number</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }} className="mono">{facts?.serial || '—'}</dd></div>
                <div><dt className="muted">SHA-256 fingerprint</dt><dd style={{ margin: 0, overflowWrap: 'anywhere', fontSize: 11 }} className="mono">{facts?.fingerprint256 || '—'}</dd></div>
                <div><dt className="muted">Plan</dt><dd style={{ margin: 0 }}>{order.period_months ? `${order.period_months} months` : '—'}</dd></div>
                <div><dt className="muted">Validation</dt><dd style={{ margin: 0 }}>{primaryMethod(order)}</dd></div>
                <div><dt className="muted">GoGetSSL status</dt><dd style={{ margin: 0 }}>{order.gg_status || '—'}</dd></div>
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
              {firstEvent ? null : null}
            </section>
          </div>

          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {issued ? (
              <section className="card pad" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ position: 'relative', width: 88, height: 88, flex: 'none' }}>
                  <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={`${d} days of ${lifetime} remaining`}>
                    <circle cx="44" cy="44" r="37" fill="none" stroke="#F4F4F5" strokeWidth="9" />
                    <circle cx="44" cy="44" r="37" fill="none" stroke={d <= 30 ? 'var(--red-dot)' : 'var(--accent)'} strokeWidth="9" strokeLinecap="round"
                      strokeDasharray={`${ringPct * circ} ${circ}`} transform="rotate(-90 44 44)" />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: d <= 30 ? 'var(--red-strong)' : undefined }}>{d}</span>
                    <span className="small muted">days left</span>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                  Lifetime <strong>{lifetime} days</strong>. New public certificates are capped at <strong>200 days</strong>, dropping to 100 days on 15 Mar 2027.
                </div>
              </section>
            ) : null}

            <section className="card pad">
              <h2 style={{ marginBottom: 14 }}>Renewal</h2>
              <form action={saveRenewalSettings} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <input type="hidden" name="order_id" value={order.id} />
                <label className="check"><input type="checkbox" name="auto_renew" defaultChecked={order.auto_renew} /><span><strong>Auto-renew</strong><br /><span className="small muted">Order and validate before expiry</span></span></label>
                <div className="field">
                  <label htmlFor="lead">Start renewal</label>
                  <select className="input" id="lead" name="renew_lead_days" defaultValue={String(order.renew_lead_days)}>
                    {[45, 30, 14, 7].map((n) => <option key={n} value={n}>{n} days before expiry</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="tags">Tags</label>
                  <input className="input" id="tags" name="tags" defaultValue={(order.tags || []).join(', ')} placeholder="prod, payments" />
                </div>
                <button className="btn sm" type="submit">Save</button>
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
                  <button className="btn sm danger" type="submit">Request cancellation</button>
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
