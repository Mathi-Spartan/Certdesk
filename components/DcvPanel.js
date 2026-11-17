import CopyButton from './CopyButton';
import Icon from './Icon';
import { checkNow, changeDcvMethod, resendEmail, revalidateDomain } from '@/app/actions/orders';
import { timeAgo } from './ui';
import SubmitButton from './SubmitButton';

function Record({ item }) {
  if (item.dns?.raw || item.dns?.value) {
    const d = item.dns;
    return (
      <div className="table-wrap" style={{ border: '1px solid var(--line)', borderRadius: 10 }}>
        <table className="t" style={{ minWidth: 560 }}>
          <thead><tr><th style={{ width: 80 }}>Type</th><th>Name</th><th>Value</th><th><span className="sr">Copy</span></th></tr></thead>
          <tbody>
            {d.name ? (
              <tr>
                <td className="mono">{d.type || 'CNAME'}</td>
                <td className="mono" style={{ overflowWrap: 'anywhere' }}>{d.name}</td>
                <td className="mono" style={{ overflowWrap: 'anywhere' }}>{d.value}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <CopyButton text={d.name} label="Copy name" /> <CopyButton text={d.value} label="Copy value" />
                </td>
              </tr>
            ) : (
              <tr><td colSpan={3} className="mono" style={{ overflowWrap: 'anywhere' }}>{d.raw}</td><td><CopyButton text={d.raw} /></td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }
  const h = item.http || item.https;
  if (h?.url || h?.content) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="code"><span className="k">File URL </span>{h.url}</div>
        <div className="code" style={{ whiteSpace: 'pre-wrap' }}><span className="k">File content{'\n'}</span>{h.content}</div>
        <div style={{ display: 'flex', gap: 8 }}><CopyButton text={h.url} label="Copy URL" /><CopyButton text={h.content} label="Copy content" /></div>
      </div>
    );
  }
  if (item.email) {
    return <div className="small">An approval link was sent to <strong>{item.email}</strong>. Open it and click approve.</div>;
  }
  return <div className="small muted">Validation details will appear here once GoGetSSL provides them. Use “Check now” in a minute.</div>;
}

export default function DcvPanel({ order, back, approverEmails, locks = {} }) {
  const items = Array.isArray(order.dcv) && order.dcv.length ? order.dcv : [{ domain: order.common_name, method: order.dcv_method }];
  const method = String(order.dcv_method || '').toLowerCase();
  const isEmail = method.includes('mail') || method.includes('@');
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
        </div>
      ))}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
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
        <span className="small muted" style={{ marginLeft: 'auto' }}>Last checked {timeAgo(order.last_synced_at)}</span>
      </div>
      <div className="small muted">
        <strong>Check status now</strong> asks GoGetSSL for the latest state and can be used any time.{' '}
        <strong>Ask the CA to re-check</strong> makes Sectigo look for your DNS record or file again. Use it once the record is live. GoGetSSL allows it once every 5 minutes per order.
      </div>

      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Change validation method</summary>
        <form action={changeDcvMethod} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginTop: 12 }}>
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
