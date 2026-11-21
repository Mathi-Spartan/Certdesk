import CopyButton from './CopyButton';
import Icon from './Icon';
import { checkNow, changeDcvMethod, resendEmail, revalidateDomain, changeDomainDcv } from '@/app/actions/orders';
import { timeAgo } from './ui';
import SubmitButton from './SubmitButton';

function Field({ label, value, copy = true }) {
  return (
    <div className="dcv-f">
      <span className="dcv-k">{label}</span>
      <code className="dcv-v">{value}</code>
      {copy && value ? <CopyButton text={value} label="Copy" /> : null}
    </div>
  );
}

function Record({ item }) {
  if (item.dns?.raw || item.dns?.value) {
    const d = item.dns;
    return (
      <div className="dcv-card">
        {d.name ? (
          <>
            <Field label="Type" value={d.type || 'CNAME'} copy={false} />
            <Field label="Name / Host" value={d.name} />
            <Field label="Value / Points to" value={d.value} />
            <p className="dcv-tip">If your DNS panel adds the domain automatically, enter only the part before your domain as the name.</p>
          </>
        ) : <Field label="Record" value={d.raw} />}
      </div>
    );
  }
  const h = item.http || item.https;
  if (h?.url || h?.content) {
    return (
      <div className="dcv-card">
        <Field label="File URL" value={h.url} />
        <Field label="File content" value={h.content} />
        <p className="dcv-tip">The file must open at exactly this URL, with no redirect.</p>
      </div>
    );
  }
  if (item.email) {
    return <div className="small">An approval link was sent to <strong>{item.email}</strong>. Open it and click approve.</div>;
  }
  return <div className="small muted">Validation details will appear here once GoGetSSL provides them. Use “Check status now” in a minute.</div>;
}

function emailsFor(domain) {
  const base = String(domain || '').replace(/^\*\./, '').replace(/^www\./, '');
  return ['admin', 'administrator', 'hostmaster', 'postmaster', 'webmaster'].map((p) => `${p}@${base}`);
}

export default function DcvPanel({ order, back, approverEmails, locks = {} }) {
  const items = Array.isArray(order.dcv) && order.dcv.length ? order.dcv : [{ domain: order.common_name, method: order.dcv_method }];
  const method = String(order.dcv_method || '').toLowerCase();
  const isEmail = method.includes('mail') || method.includes('@');
  const multi = items.length > 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {it.status === 'validated' ? <Icon name="tick" stroke="var(--green)" width={2.6} /> : <span className="dot" style={{ background: 'var(--amber-dot)' }} />}
            <span className="mono" style={{ fontWeight: 500 }}>{it.domain}</span>
            <span className="small muted">{(it.method || order.dcv_method || '').toString().toUpperCase()}{it.statusText ? ` · ${it.statusText}` : ''}</span>
          </div>
          {it.status === 'validated' ? null : <Record item={{ ...it, email: it.email || (isEmail ? order.approver_email : null) }} />}
          {multi && it.status !== 'validated' && it.domain ? (
            <div className="dcv-dom">
              <form action={revalidateDomain}>
                <input type="hidden" name="order_id" value={order.id} /><input type="hidden" name="back" value={back} />
                <input type="hidden" name="domain" value={it.domain} />
                <SubmitButton className="btn sm" pendingText="Asking…" lockedSeconds={locks.revalidate || 0} lockLabel="Re-check in">Re-check this domain</SubmitButton>
              </form>
              <details>
                <summary>Change method for this domain</summary>
                <form action={changeDomainDcv} className="dcv-dom-form">
                  <input type="hidden" name="order_id" value={order.id} /><input type="hidden" name="back" value={back} />
                  <input type="hidden" name="domain" value={it.domain} />
                  <select className="input" name="method" defaultValue={String(it.method || '').toLowerCase().includes('http') ? 'http' : 'dns'} aria-label={`Method for ${it.domain}`}>
                    <option value="dns">DNS CNAME</option>
                    {String(it.domain).startsWith('*.') ? null : <option value="http">HTTP file</option>}
                    {String(it.domain).startsWith('*.') ? null : <option value="https">HTTPS file</option>}
                    <option value="email">Approver email</option>
                  </select>
                  <select className="input" name="approver_email" defaultValue="" aria-label={`Approver email for ${it.domain}`}>
                    <option value="">Approver email (email only)</option>
                    {emailsFor(it.domain).map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <SubmitButton className="btn sm dark-btn" pendingText="Changing…">Change</SubmitButton>
                </form>
              </details>
            </div>
          ) : null}
        </div>
      ))}

      <div className="dcv-actions">
        <form action={checkNow}>
          <input type="hidden" name="order_id" value={order.id} /><input type="hidden" name="back" value={back} />
          <SubmitButton className="btn sm primary" pendingText="Checking…">Check status now</SubmitButton>
        </form>
        <form action={revalidateDomain}>
          <input type="hidden" name="order_id" value={order.id} /><input type="hidden" name="back" value={back} />
          <input type="hidden" name="domain" value={order.common_name || ''} />
          <SubmitButton pendingText="Asking the CA…" lockedSeconds={locks.revalidate || 0} lockLabel="Re-check available in">Ask the CA to re-check</SubmitButton>
        </form>
        {isEmail ? (
          <form action={resendEmail}>
            <input type="hidden" name="order_id" value={order.id} /><input type="hidden" name="back" value={back} />
            <SubmitButton pendingText="Sending…" lockedSeconds={locks.resend || 0} lockLabel="Resend available in">Resend approval email</SubmitButton>
          </form>
        ) : null}
        <span className="small muted dcv-last">Last checked {timeAgo(order.last_synced_at)}</span>
      </div>
      <div className="small muted">
        <strong>Check status now</strong> asks GoGetSSL for the latest state and can be used any time.{' '}
        <strong>Ask the CA to re-check</strong> makes Sectigo look for your DNS record or file again. Use it once the record is live. GoGetSSL allows it once every 5 minutes per order.
      </div>

      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>{multi ? 'Change validation method for all domains' : 'Change validation method'}</summary>
        <form action={changeDcvMethod} className="dcv-change">
          <input type="hidden" name="order_id" value={order.id} /><input type="hidden" name="back" value={back} />
          <div className="field" style={{ flex: '1 1 160px' }}>
            <label htmlFor={`m-${order.id}`}>Method</label>
            <select className="input" id={`m-${order.id}`} name="method" defaultValue={isEmail ? 'email' : method.includes('http') ? 'http' : 'dns'}>
              <option value="dns">DNS CNAME</option>
              <option value="http">HTTP file</option>
              <option value="https">HTTPS file</option>
              <option value="email">Approver email</option>
            </select>
          </div>
          <div className="field" style={{ flex: '2 1 240px' }}>
            <label htmlFor={`e-${order.id}`}>Approver email (email method only)</label>
            <select className="input" id={`e-${order.id}`} name="approver_email" defaultValue={order.approver_email || ''}>
              <option value="">—</option>
              {(approverEmails || []).map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <SubmitButton className="btn sm dark-btn" pendingText="Changing…">Change</SubmitButton>
        </form>
      </details>
    </div>
  );
}
