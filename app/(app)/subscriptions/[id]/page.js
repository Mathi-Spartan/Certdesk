import { notFound } from 'next/navigation';
import { requireWorkspace } from '@/lib/auth';
import { getSubForWorkspace, syncSubscription, daysTo, KIND_LABEL, autoInstallDone } from '@/lib/subscriptions';
import {
  refreshSubscription, addCaasDomains, removeCaasDomain, switchInstallMethod, setAutoRenewal, cancelSub, saveSubTags
} from '@/app/actions/subscriptions';
import TopBar from '@/components/TopBar';
import Icon from '@/components/Icon';
import CopyButton from '@/components/CopyButton';
import SecretValue from '@/components/SecretValue';
import SubmitButton from '@/components/SubmitButton';
import { fmtDate, FlashFromSearch } from '@/components/ui';
import { itemFromSub } from '@/lib/portfolio';
import { supportEmail, helpHref } from '@/lib/support';

export const metadata = { title: 'Subscription · CertDesk' };


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
  const isCaas = sub.kind === 'caas';
  const method = isCaas ? 'acme' : String(sub.install_method || '').includes('acme') ? 'acme' : 'autoinstall';
  const closed = ['cancelled', 'expired'].includes(sub.status);
  const active = sub.status === 'active';
  const until = sub.next_renewal_at || sub.end_at;
  const left = daysTo(until);
  const ai = sub.autoinstall || {};
  const hidden = <input type="hidden" name="sub_id" value={sub.id} />;
  const item = itemFromSub(sub);
  const hero = {
    action: { icon: 'alert', bg: '#FEF2F2', fg: 'var(--red-strong)', border: '#FECACA' },
    progress: { icon: 'clock', bg: '#FFFBEB', fg: '#B45309', border: '#FDE68A' },
    ok: { icon: 'tick', bg: '#F0FDF4', fg: '#15803D', border: '#BBF7D0' },
    ended: { icon: 'info', bg: '#F4F4F5', fg: 'var(--ink-2)', border: 'var(--line)' }
  }[item.group];
  const needsAgent = !isCaas && !autoInstallDone(ai) && active;
  const needsAcmeSetup = (isCaas || method === 'acme') && sub.account?.kid && active;
  const aisAcmeSetup = !isCaas && method === 'acme' && !autoInstallDone(ai) && active;
  const heroTitle = item.group === 'ended'
    ? 'This subscription is closed'
    : item.group === 'progress'
      ? sub.cancel_requested_at ? 'Cancellation in progress' : 'Setting up your subscription'
      : sub.auto_renew === false && left !== null && left <= 30
        ? `Auto-renewal is off · ends in ${Math.max(0, left)} days`
        : needsAgent
          ? aisAcmeSetup ? 'One step left: connect your ACME client' : 'One step left: install the agent'
          : 'Your sites are covered automatically';
  const heroText = item.group === 'progress'
    ? item.next.text
    : sub.auto_renew === false && left !== null && left <= 30
      ? 'Turn auto-renewal back on to keep certificates coming after the term ends.'
      : needsAgent
        ? aisAcmeSetup
          ? 'Get your ACME keys in AutoInstall SSL and register your ACME client. Steps are below.'
          : 'Open AutoInstall SSL and run the install command on your server. Steps are below.'
        : needsAcmeSetup
          ? 'Point your ACME client at the credentials below. It requests and renews certificates on its own.'
          : item.next?.text;
  const heroCta = needsAgent && ai.login
    ? <a className="btn primary" href={ai.login} target="_blank" rel="noreferrer">Open AutoInstall SSL<Icon name="ext" stroke="#fff" /></a>
    : sub.auto_renew === false && active
      ? <form action={setAutoRenewal}>{hidden}<input type="hidden" name="on" value="true" /><SubmitButton className="btn primary" pendingText="Saving…">Turn auto-renewal on</SubmitButton></form>
      : null;
  const help = helpHref(await supportEmail(), {
    subject: `Help with ${sub.primary_domain || 'my subscription'} (${KIND_LABEL[sub.kind]})`,
    body: `Domain: ${sub.primary_domain || ''}\nProduct: ${sub.product_name || ''}\nReference: ${sub.item_id || ''}\n\nMy question:\n`
  });



  return (
    <>
      <TopBar crumbs={[{ label: 'My SSL', href: '/' }, { label: sub.primary_domain || 'Pending' }]}>
        <form action={refreshSubscription}>{hidden}<SubmitButton className="btn sm" pendingText="Refreshing…">Refresh</SubmitButton></form>
      </TopBar>
      <main className="page" style={{ maxWidth: 1100 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span className="ws-badge violet" style={{ width: 48, height: 48, borderRadius: 12 }}><Icon name={isCaas ? 'loop' : 'bolt'} size={22} stroke="#fff" /></span>
          <div>
            <h1 className="mono" style={{ margin: 0, fontSize: 24, fontWeight: 500 }}>{sub.primary_domain || 'Pending'}</h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6, alignItems: 'center', fontSize: 13 }} className="muted">
              <span className={`badge tone-${item.status.tone}`}>{item.status.label}</span>
              <span className="type-chip auto"><Icon name="loop" size={12} />Automated · {KIND_LABEL[sub.kind]}</span>
              <span>{sub.product_name}</span>
              {(sub.tags || []).map((t) => <span key={t} className="tag">{t}</span>)}
            </div>
          </div>
        </div>

        <FlashFromSearch searchParams={sp} />
        {syncError ? <div className="alert amber"><Icon name="info" />Could not refresh just now. Showing the last known state.</div> : null}

        <section className="next-card" style={{ background: hero.bg, borderColor: hero.border }} aria-label="Next step">
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <span className="next-icon" style={{ borderColor: hero.border }}><Icon name={hero.icon} size={20} stroke={hero.fg} width={2.4} /></span>
            <div style={{ flex: '1 1 320px', minWidth: 0 }}>
              <h2 style={{ fontSize: 18, margin: 0 }}>{heroTitle}</h2>
              <p style={{ margin: '4px 0 0', color: 'var(--ink-2)' }}>{heroText}</p>
            </div>
            {heroCta}
          </div>
        </section>

        <div className="facts">
          <div><span className="small muted">{sub.next_renewal_at ? 'Renews automatically' : 'Term ends'}</span><strong style={{ color: sub.auto_renew === false && left !== null && left <= 30 ? 'var(--red-strong)' : undefined }}>{fmtDate(until)}</strong>{left !== null ? <span className="small muted">{left < 0 ? `${-left} days ago` : `in ${left} days`}</span> : null}</div>
          <div><span className="small muted">Auto-renewal</span><strong>{sub.auto_renew === null ? '—' : sub.auto_renew ? 'On' : 'Off'}</strong></div>
          <div><span className="small muted">Domains</span><strong>{(sub.domains || []).length}</strong><span className="small muted mono" style={{ overflowWrap: 'anywhere' }}>{(sub.domains || []).slice(0, 2).map((d) => d.name).join(', ')}</span></div>
          <div><span className="small muted">Certificates issued by</span><strong>{method === 'acme' ? 'Your ACME client' : 'AutoInstall SSL'}</strong></div>
        </div>

        {!isCaas ? (
          <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="between" style={{ flexWrap: 'wrap', gap: 10 }}>
              <h2>Installation</h2>
              <span className={`badge tone-${autoInstallDone(ai) ? 'green' : 'amber'}`}>{autoInstallDone(ai) ? 'Installed' : ai.status ? 'Not finished' : sub.status === 'pending' ? 'Waiting for GoGetSSL' : 'Not started'}</span>
            </div>

            <div className="small muted" style={{ marginBottom: -8 }}>How do you want to install?</div>
            <div className="method-switch" role="group" aria-label="How certificates reach your server">
              {[
                ['autoinstall', 'AutoInstall agent', 'Installs and renews for you'],
                ['acme', 'My ACME client', 'Certbot, acme.sh, Caddy…']
              ].map(([m, t, d]) => (
                <form key={m} action={switchInstallMethod}>
                  {hidden}<input type="hidden" name="method" value={m} />
                  <button type="submit" className={method === m ? 'on' : ''} aria-pressed={method === m} disabled={method === m || closed}>
                    <span className="t">{t}</span>
                    <span className="d">{method === m ? 'Selected' : d}</span>
                  </button>
                </form>
              ))}
            </div>

            {autoInstallDone(ai) ? (
              <div className="between" style={{ gap: 12, flexWrap: 'wrap', fontSize: 13 }}>
                <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="ok-circle" style={{ width: 24, height: 24 }}><Icon name="tick" size={12} stroke="#fff" width={3} /></span>Installed and renewing automatically.</span>
                {ai.manage || ai.login ? <a className="btn sm" href={ai.manage || ai.login} target="_blank" rel="noreferrer">Manage in AutoInstall SSL<Icon name="ext" /></a> : null}
              </div>
            ) : method === 'autoinstall' ? (
              <ol className="setup-steps">
                <li><strong>Open AutoInstall SSL</strong> with the button below. You&apos;re signed in automatically.</li>
                <li><strong>Choose your server</strong> (Apache, NGINX or IIS) and copy the install command it shows.</li>
                <li><strong>Run the command</strong> on your server with root or admin access. The agent installs the certificate and renews it from then on.</li>
                <li><strong>Come back here.</strong> The status changes to Installed once the first certificate is in place.</li>
              </ol>
            ) : (
              <ol className="setup-steps">
                <li><strong>Open AutoInstall SSL</strong> with the button below. You&apos;re signed in automatically.</li>
                <li><strong>Choose ACME</strong> as your environment. If it isn&apos;t listed, choose your server and click <em>Agent Options</em> to reveal ACME.</li>
                <li><strong>Get your EAB key ID, HMAC key and server URL.</strong> They appear here as soon as GoGetSSL issues them. Keep the HMAC key secret.</li>
                <li><strong>Register your ACME client</strong> with those keys, for example: <code className="inline-code">certbot --server &lt;server URL&gt; --eab-kid &lt;key ID&gt; --eab-hmac-key &lt;HMAC key&gt; -d {sub.primary_domain}</code>. It requests and renews certificates on its own.</li>
              </ol>
            )}

            {!autoInstallDone(ai) ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {ai.login ? <a className="btn primary" href={ai.login} target="_blank" rel="noreferrer">Open AutoInstall SSL<Icon name="ext" stroke="#fff" /></a> : <button className="btn" disabled>{sub.status === 'pending' ? 'Available once GoGetSSL finishes setting up' : 'Sign-in link not ready yet'}</button>}
                {ai.manage ? <a className="btn" href={ai.manage} target="_blank" rel="noreferrer">Manage enrollment<Icon name="ext" /></a> : null}
              </div>
            ) : null}
            <span className="small muted">The switch itself happens in AutoInstall SSL, and you can change it any time there. Sign-in links come fresh each time this page loads; if one has expired, reload the page.</span>
          </section>
        ) : null}

        {isCaas || sub.account?.kid ? <AcmeCard sub={sub} /> : null}

        <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="between"><h2>Domains</h2><span className="small muted">{(sub.domains || []).length} covered</span></div>
          <ul className="domain-list">
            {(sub.domains || []).map((d) => (
              <li key={d.name}>
                <span className="mono">{d.name}</span>
                {isCaas && !closed && (sub.domains || []).length > 1 ? (
                  <form action={removeCaasDomain}>{hidden}<input type="hidden" name="domain" value={d.name} /><SubmitButton className="btn sm ghost" pendingText="Removing…">Remove</SubmitButton></form>
                ) : null}
              </li>
            ))}
          </ul>
          {isCaas && !closed ? (
            <form action={addCaasDomains} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {hidden}
              <label className="sr" htmlFor="add-domains">Domains to add</label>
              <input id="add-domains" name="domains" className="input mono" placeholder="Add domains, e.g. api.example.com, *.dev.example.com" style={{ flex: '1 1 300px' }} required />
              <SubmitButton className="btn" pendingText="Adding…">Add</SubmitButton>
            </form>
          ) : (
            <span className="small muted">This plan covers one domain. Order another subscription for more.</span>
          )}
        </section>

        <details className="card fold">
          <summary><Icon name="key" />Settings</summary>
          <div className="fold-body" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div className="between" style={{ gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 300px' }}>
                <div style={{ fontWeight: 600 }}>Auto-renewal <span className={`badge tone-${sub.auto_renew === false ? 'red' : 'green'}`} style={{ marginLeft: 6 }}>{sub.auto_renew === false ? 'Off' : 'On'}</span></div>
                <div className="small muted">
                  {sub.auto_renew === false
                    ? `Ends ${fmtDate(until)}. Certificates stop after that.`
                    : `Renews ${sub.next_renewal_at ? `on ${fmtDate(sub.next_renewal_at)}` : 'at the end of each term'} so certificates keep coming.`}
                </div>
              </div>
              {!closed ? (
                <form action={setAutoRenewal}>
                  {hidden}<input type="hidden" name="on" value={sub.auto_renew === false ? 'true' : 'false'} />
                  <SubmitButton className={`btn sm ${sub.auto_renew === false ? 'primary' : ''}`} pendingText="Saving…">{sub.auto_renew === false ? 'Turn on' : 'Turn off'}</SubmitButton>
                </form>
              ) : null}
            </div>
            <form action={saveSubTags} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', borderTop: '1px solid var(--line-soft)', paddingTop: 18 }}>
              {hidden}
              <div className="field" style={{ flex: '1 1 260px' }}>
                <label htmlFor="tags">Tags</label>
                <input id="tags" name="tags" className="input" defaultValue={(sub.tags || []).join(', ')} placeholder="production, eu" />
              </div>
              <SubmitButton className="btn" pendingText="Saving…">Save</SubmitButton>
            </form>
            {!closed && !sub.cancel_requested_at ? (
              <form action={cancelSub} style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--line-soft)', paddingTop: 18 }}>
                {hidden}
                <div style={{ fontWeight: 600, color: 'var(--red-strong)' }}>Cancel subscription</div>
                <div className="grid-form">
                  <div className="field"><label htmlFor="reason">Reason</label><input id="reason" name="reason" className="input" placeholder="No longer needed" /></div>
                  <div className="field"><label htmlFor="confirm">Type CANCEL to confirm</label><input id="confirm" name="confirm" className="input" autoComplete="off" required /></div>
                </div>
                <label className="check"><input type="checkbox" name="refund" defaultChecked /> Ask for a refund if it&apos;s inside the refund window</label>
                <div><SubmitButton className="btn sm danger" pendingText="Cancelling…">Cancel subscription</SubmitButton></div>
              </form>
            ) : null}
          </div>
        </details>

        {help ? <a className="help-link" href={help} style={{ alignSelf: 'flex-start' }}><Icon name="info" />Stuck? Ask us about this subscription</a> : null}
      </main>
    </>
  );
}
