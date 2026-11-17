import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireWorkspace } from '@/lib/auth';
import { q } from '@/lib/db';
import { getSubForWorkspace, syncSubscription, subDisplay, daysTo, KIND_LABEL } from '@/lib/subscriptions';
import {
  refreshSubscription, addCaasDomains, removeCaasDomain, switchInstallMethod, setAutoRenewal, cancelSub, saveSubTags
} from '@/app/actions/subscriptions';
import TopBar from '@/components/TopBar';
import Icon from '@/components/Icon';
import CopyButton from '@/components/CopyButton';
import SecretValue from '@/components/SecretValue';
import SubmitButton from '@/components/SubmitButton';
import EndpointPanel from '@/components/EndpointPanel';
import { fmtDate, fmtDateTime, FlashFromSearch, timeAgo } from '@/components/ui';

export const metadata = { title: 'Subscription · CertDesk' };

function Node({ kind }) {
  return <span className={`node ${kind}`}>{kind === 'done' ? <Icon name="tick" size={12} stroke="#fff" width={3.5} /> : null}</span>;
}

function AcmeCard({ sub }) {
  const a = sub.account || {};
  const server = a.server_url || 'https://acme.sectigo.com/v2/DV';
  const first = (sub.domains || []).map((d) => d.name).filter(Boolean);
  const dArgs = (first.length ? first : ['example.com']).map((d) => `-d '${d}'`).join(' ');
  const certbot = `certbot certonly --standalone --non-interactive --agree-tos \\\n  --email you@example.com --server ${server} \\\n  --eab-kid ${a.kid || '<EAB_KID>'} --eab-hmac-key ${a.hmac || '<EAB_HMAC_KEY>'} \\\n  ${dArgs}`;
  const acmesh = `acme.sh --register-account --server ${server} \\\n  --eab-kid ${a.kid || '<EAB_KID>'} --eab-hmac-key ${a.hmac || '<EAB_HMAC_KEY>'}\nacme.sh --issue --server ${server} ${dArgs.replace(/-d /g, '-d ')} --webroot /var/www/html`;
  const row = { display: 'grid', gridTemplateColumns: '130px 1fr', gap: 12, alignItems: 'center', fontSize: 13 };
  return (
    <section className="dark" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="between">
        <div>
          <div className="eyebrow">ACME ACCOUNT · EXTERNAL ACCOUNT BINDING</div>
          <h2 style={{ margin: '6px 0 0', color: '#fff' }}>Credentials for your ACME client</h2>
        </div>
        {a.kid ? <span className="badge tone-green">Ready</span> : <span className="badge tone-amber">Waiting for GoGetSSL</span>}
      </div>
      <div style={row}><span style={{ color: '#A1A1AA' }}>Directory URL</span><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="mono" style={{ flex: 1, overflowWrap: 'anywhere' }}>{a.server_url || '—'}</span>{a.server_url ? <CopyButton text={a.server_url} dark /> : null}</span></div>
      <div style={row}><span style={{ color: '#A1A1AA' }}>EAB key ID</span><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="mono" style={{ flex: 1, overflowWrap: 'anywhere' }}>{a.kid || '—'}</span>{a.kid ? <CopyButton text={a.kid} dark /> : null}</span></div>
      <div style={row}><span style={{ color: '#A1A1AA' }}>EAB HMAC key</span><SecretValue value={a.hmac} label="EAB HMAC key" /></div>
      {a.id ? <div style={row}><span style={{ color: '#A1A1AA' }}>Account ID</span><span className="mono">{a.id}</span></div> : null}
      {a.kid ? (
        <details>
          <summary style={{ cursor: 'pointer', color: '#C4B8FF', fontSize: 13 }}>Set up Certbot or acme.sh</summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <div className="between"><span className="small" style={{ color: '#A1A1AA' }}>Certbot</span><CopyButton text={certbot.replace(/\\\n\s*/g, '')} dark /></div>
            <pre className="code" style={{ margin: 0, background: '#18181B', whiteSpace: 'pre-wrap' }}>{certbot}</pre>
            <div className="between"><span className="small" style={{ color: '#A1A1AA' }}>acme.sh</span><CopyButton text={acmesh} dark /></div>
            <pre className="code" style={{ margin: 0, background: '#18181B', whiteSpace: 'pre-wrap' }}>{acmesh}</pre>
            <span className="small" style={{ color: '#A1A1AA' }}>The HMAC key is a secret. Anyone holding it can issue certificates for the domains in this subscription.</span>
          </div>
        </details>
      ) : null}
    </section>
  );
}

export default async function SubscriptionDetail({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireWorkspace();
  let sub = await getSubForWorkspace(id, ctx.workspaceId);
  if (!sub) notFound();
  let syncError = null;
  const stale = !sub.last_synced_at || Date.now() - new Date(sub.last_synced_at).getTime() > 2 * 60000;
  if (stale && sub.item_id && sub.status !== 'cancelled') {
    try {
      sub = await syncSubscription(sub);
    } catch (e) {
      syncError = e.message;
    }
  }
  const events = await q(
    `select e.*, u.name as actor from console.subscription_events e left join console.users u on u.id = e.actor_user_id
      where e.subscription_id = $1 order by e.created_at desc limit 30`,
    [sub.id]
  );
  const st = subDisplay(sub);
  const isCaas = sub.kind === 'caas';
  const method = isCaas ? 'acme' : sub.install_method || 'autoinstall';
  const closed = ['cancelled', 'expired'].includes(sub.status);
  const active = sub.status === 'active';
  const until = sub.next_renewal_at || sub.end_at;
  const left = daysTo(until);
  const ai = sub.autoinstall || {};
  const hidden = <input type="hidden" name="sub_id" value={sub.id} />;

  const steps = [
    { label: 'Ordered', sub: fmtDate(sub.created_at), kind: 'done' },
    { label: 'Active', sub: sub.begin_at ? fmtDate(sub.begin_at) : active ? 'Yes' : 'Setting up', kind: active || sub.begin_at ? 'done' : 'now' },
    { label: isCaas ? 'Certificates via ACME' : method === 'acme' ? 'Certificates via ACME' : 'AutoInstall SSL', sub: isCaas || method === 'acme' ? (sub.account?.kid ? 'EAB ready' : 'Waiting') : ai.status || 'Waiting', kind: (isCaas || method === 'acme') ? (sub.account?.kid ? 'done' : 'todo') : ai.status ? 'done' : 'todo' },
    { label: sub.auto_renew === false ? 'Term ends' : 'Next renewal', sub: fmtDate(until), kind: sub.auto_renew === false && left !== null && left <= 30 ? 'warn' : 'todo' }
  ];

  return (
    <>
      <TopBar crumbs={[{ label: 'Automated SSL', href: '/subscriptions' }, { label: sub.primary_domain || 'Pending' }]}>
        <span className="small muted">Item <span className="mono">{sub.item_id || '—'}</span> · Order <span className="mono">{sub.gg_order_id || '—'}</span></span>
        <form action={refreshSubscription}>{hidden}<SubmitButton className="btn sm" pendingText="Refreshing…">Refresh</SubmitButton></form>
      </TopBar>
      <main className="page">
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span className="ws-badge violet" style={{ width: 48, height: 48, borderRadius: 12 }}><Icon name={isCaas ? 'loop' : 'bolt'} size={22} stroke="#fff" /></span>
          <div>
            <h1 className="mono" style={{ margin: 0, fontSize: 24, fontWeight: 500 }}>{sub.primary_domain || 'Pending'}</h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6, alignItems: 'center', fontSize: 13 }} className="muted">
              <span className={`badge tone-${st.tone}`}>{st.label}</span>
              <span className="badge tone-violet">{KIND_LABEL[sub.kind]}</span>
              <span>{sub.product_name}</span>
              {sub.gg_status ? <span className="mono small">GoGetSSL: {sub.gg_status}</span> : null}
              {(sub.tags || []).map((t) => <span key={t} className="tag">{t}</span>)}
            </div>
          </div>
        </div>

        <FlashFromSearch searchParams={sp} />
        {syncError ? <div className="alert amber"><Icon name="info" />Could not refresh from GoGetSSL just now: {syncError}</div> : null}
        {sub.status === 'pending' ? <div className="alert violet"><Icon name="clock" />GoGetSSL is setting this subscription up. {isCaas ? 'The ACME credentials appear here when it is ready.' : 'The AutoInstall SSL links appear here when it is ready.'}</div> : null}
        {sub.status === 'payment_needed' ? <div className="alert amber"><Icon name="info" />GoGetSSL is waiting for payment on this order.</div> : null}
        {sub.cancel_requested_at && !closed ? <div className="alert amber"><Icon name="info" />Cancellation sent {fmtDateTime(sub.cancel_requested_at)}. GoGetSSL confirms it shortly.</div> : null}
        {active && sub.auto_renew === false && left !== null ? (
          <div className="alert red"><Icon name="alert" stroke="var(--red-strong)" /><span><strong>Auto-renewal is off.</strong> This subscription ends {left < 0 ? `${-left} days ago` : `in ${left} days`} ({fmtDate(until)}) and its certificates stop renewing.</span></div>
        ) : null}

        <section aria-label="Subscription lifecycle" className="card pad">
          <ol className="stepper" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
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
            {!isCaas ? (
              <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="between">
                  <h2>Installation</h2>
                  <span className="small muted">PATCH /certificates/ais/{sub.item_id}</span>
                </div>
                <div className="choices">
                  <form action={switchInstallMethod} style={{ display: 'contents' }}>
                    {hidden}<input type="hidden" name="method" value="autoinstall" />
                    <button className={`choice ${method === 'autoinstall' ? 'on' : ''}`} type="submit" disabled={method === 'autoinstall' || closed} aria-pressed={method === 'autoinstall'}>
                      <span className="t">AutoInstall SSL</span>
                      <span className="d">An agent on your server issues, installs and renews each certificate.</span>
                    </button>
                  </form>
                  <form action={switchInstallMethod} style={{ display: 'contents' }}>
                    {hidden}<input type="hidden" name="method" value="acme" />
                    <button className={`choice ${method === 'acme' ? 'on' : ''}`} type="submit" disabled={method === 'acme' || closed} aria-pressed={method === 'acme'}>
                      <span className="t">Your ACME client</span>
                      <span className="d">Use Certbot, acme.sh or similar with EAB credentials.</span>
                    </button>
                  </form>
                </div>
                {method === 'autoinstall' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                    <div className="between"><span className="muted">AutoInstall status</span><span className="badge tone-gray">{ai.status || 'Not reported yet'}</span></div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {ai.login ? <a className="btn primary" href={ai.login} target="_blank" rel="noreferrer">Open AutoInstall SSL<Icon name="ext" stroke="#fff" /></a> : <button className="btn" disabled>Sign-in link not ready</button>}
                      {ai.manage ? <a className="btn" href={ai.manage} target="_blank" rel="noreferrer">Manage installation<Icon name="ext" /></a> : null}
                    </div>
                    <span className="small muted">These are single sign-on links from GoGetSSL. They expire, so CertDesk fetches fresh ones each time this page refreshes.</span>
                  </div>
                ) : null}
              </section>
            ) : null}

            {isCaas || method === 'acme' ? <AcmeCard sub={sub} /> : null}

            <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="between"><h2>Domains</h2><span className="small muted">{(sub.domains || []).length} covered</span></div>
              <div className="table-wrap" style={{ border: '1px solid var(--line)', borderRadius: 10 }}>
                <table className="t">
                  <thead><tr><th>Domain</th><th>GoGetSSL domain ID</th><th>Status</th>{isCaas && !closed ? <th /> : null}</tr></thead>
                  <tbody>
                    {(sub.domains || []).map((d) => (
                      <tr key={d.name}>
                        <td className="mono">{d.name}</td>
                        <td className="mono small muted">{d.id ?? '—'}</td>
                        <td>{d.status ? <span className="badge tone-gray">{d.status}</span> : <span className="muted">—</span>}</td>
                        {isCaas && !closed ? (
                          <td style={{ textAlign: 'right' }}>
                            {(sub.domains || []).length > 1 ? (
                              <form action={removeCaasDomain}>{hidden}<input type="hidden" name="domain" value={d.name} /><SubmitButton className="btn sm ghost" pendingText="Removing…">Remove</SubmitButton></form>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {isCaas && !closed ? (
                <form action={addCaasDomains} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {hidden}
                  <label className="sr" htmlFor="add-domains">Domains to add</label>
                  <textarea id="add-domains" name="domains" className="input mono" rows={2} placeholder="api.example.com, *.dev.example.com" style={{ flex: '1 1 300px' }} required />
                  <SubmitButton className="btn" pendingText="Adding…">Add domains</SubmitButton>
                </form>
              ) : null}
              {!isCaas ? <span className="small muted">A Plan + Automate subscription covers one domain. Order another subscription for more domains.</span> : null}
            </section>

            <section className="card pad">
              <h2 style={{ marginBottom: 16 }}>Subscription</h2>
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px 24px', fontSize: 13 }}>
                <div><dt className="muted">Product</dt><dd style={{ margin: 0 }}>{sub.product_name} <span className="mono small muted">#{sub.product_id}</span></dd></div>
                <div><dt className="muted">Type</dt><dd style={{ margin: 0 }}>{KIND_LABEL[sub.kind]}</dd></div>
                <div><dt className="muted">Started</dt><dd style={{ margin: 0 }}>{fmtDate(sub.begin_at)}</dd></div>
                <div><dt className="muted">Next renewal</dt><dd style={{ margin: 0, fontWeight: 600 }}>{fmtDate(sub.next_renewal_at)}</dd></div>
                <div><dt className="muted">Term ends</dt><dd style={{ margin: 0 }}>{fmtDate(sub.end_at)}</dd></div>
                <div><dt className="muted">Install method</dt><dd style={{ margin: 0 }}>{method === 'acme' ? 'ACME client' : 'AutoInstall SSL'}</dd></div>
                <div><dt className="muted">GoGetSSL order</dt><dd style={{ margin: 0 }} className="mono">{sub.gg_order_id || '—'}</dd></div>
                <div><dt className="muted">GoGetSSL item</dt><dd style={{ margin: 0 }} className="mono">{sub.item_id || '—'}</dd></div>
                {sub.contacts ? <div><dt className="muted">Contacts</dt><dd style={{ margin: 0 }}>{sub.contacts.primary}{sub.contacts.technical && sub.contacts.technical !== sub.contacts.primary ? `, ${sub.contacts.technical}` : ''}</dd></div> : null}
                <div><dt className="muted">Last synced</dt><dd style={{ margin: 0 }}>{timeAgo(sub.last_synced_at)}</dd></div>
              </dl>
            </section>

            <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h2>History</h2>
              {events.length === 0 ? <span className="muted">No events yet.</span> : (
                <ol className="feed">
                  {events.map((e) => (
                    <li key={e.id}>
                      <span className="when">{fmtDateTime(e.created_at)}</span>
                      <span>
                        {e.message}{e.actor ? <span className="muted"> · {e.actor}</span> : null}
                        {e.endpoint ? <span className="mono small muted" style={{ display: 'block' }}>{e.endpoint}</span> : null}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {ctx.isAdmin && sub.raw ? (
              <details className="card pad">
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Last GoGetSSL response (partner only)</summary>
                <pre className="code" style={{ marginTop: 12, maxHeight: 420, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(sub.raw, (k, v) => (k === 'eab_mac_key' ? '••• hidden •••' : v), 2)}
                </pre>
              </details>
            ) : null}
          </div>

          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="between">
                <h2>Auto-renewal</h2>
                {sub.auto_renew === null ? <span className="badge tone-gray">Unknown</span> : sub.auto_renew ? <span className="badge tone-green">On</span> : <span className="badge tone-red">Off</span>}
              </div>
              <p className="small muted" style={{ margin: 0 }}>
                {sub.auto_renew === false
                  ? `The subscription ends ${fmtDate(until)}. Certificates are not issued after that.`
                  : `GoGetSSL renews the subscription ${sub.next_renewal_at ? `on ${fmtDate(sub.next_renewal_at)}` : 'at the end of each term'} and keeps issuing certificates.`}
              </p>
              {!closed ? (
                <form action={setAutoRenewal}>
                  {hidden}<input type="hidden" name="on" value={sub.auto_renew === false ? 'true' : 'false'} />
                  <SubmitButton className={`btn sm ${sub.auto_renew === false ? 'primary' : ''}`} pendingText="Saving…">
                    {sub.auto_renew === false ? 'Turn auto-renewal on' : 'Turn auto-renewal off'}
                  </SubmitButton>
                </form>
              ) : null}
              <span className="small muted mono">{sub.auto_renew === false || !isCaas ? `PATCH /certificates/${sub.kind}/${sub.item_id}/subscription` : `DELETE /certificates/caas/${sub.item_id}/subscription`}</span>
            </section>

            <EndpointPanel kind={sub.kind} itemId={sub.item_id} />

            <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h2>Tags</h2>
              <form action={saveSubTags} style={{ display: 'flex', gap: 8 }}>
                {hidden}
                <label className="sr" htmlFor="tags">Tags</label>
                <input id="tags" name="tags" className="input" defaultValue={(sub.tags || []).join(', ')} placeholder="production, eu" style={{ flex: 1 }} />
                <SubmitButton className="btn sm" pendingText="Saving…">Save</SubmitButton>
              </form>
            </section>

            {!closed && !sub.cancel_requested_at ? (
              <details className="card pad">
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--red-strong)' }}>Cancel subscription</summary>
                <form action={cancelSub} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                  {hidden}
                  <div className="field"><label htmlFor="reason">Reason</label><input id="reason" name="reason" className="input" placeholder="Test order" /></div>
                  <label className="check"><input type="checkbox" name="refund" defaultChecked /> Ask for a refund (inside the refund window)</label>
                  <div className="field"><label htmlFor="confirm">Type CANCEL to confirm</label><input id="confirm" name="confirm" className="input" autoComplete="off" required /></div>
                  <SubmitButton className="btn sm danger" pendingText="Cancelling…">Cancel subscription</SubmitButton>
                  <span className="small muted mono">POST /certificates/{sub.kind}/{sub.item_id}/cancel</span>
                </form>
              </details>
            ) : null}
            <Link className="small" href="/subscriptions">Back to all subscriptions</Link>
          </div>
        </div>
      </main>
    </>
  );
}
