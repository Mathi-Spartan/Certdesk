import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { q } from '@/lib/db';
import CopyButton from '@/components/CopyButton';
import { fmtDate } from '@/components/ui';

export const metadata = { title: 'Validation · CertDesk' };

const DAY = 86400000;
const LABEL = { dns: 'DNS', email: 'Email', http: 'HTTP', https: 'HTTPS' };
const ago = (d) => {
  const n = Math.floor((Date.now() - new Date(d)) / DAY);
  return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
};

function Steps({ entry, method }) {
  if (method === 'dns' && entry?.dns?.name) {
    return (
      <div className="cx3-records">
        <table>
          <thead><tr><th>Type</th><th>Name</th><th>Value</th><th><span className="sr">Copy</span></th></tr></thead>
          <tbody>
            <tr>
              <td className="mono">{entry.dns.type}</td>
              <td className="mono wrap">{entry.dns.name}</td>
              <td className="mono wrap">{entry.dns.value}</td>
              <td className="right"><CopyButton text={`${entry.dns.name} ${entry.dns.type} ${entry.dns.value}`} label="Copy record" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
  const h = entry?.http || entry?.https;
  if ((method === 'http' || method === 'https') && h?.url) {
    return (
      <div className="cx3-filestep">
        <div className="cx3-code mono">{h.url}</div>
        <p>Create this file on the web server with the exact contents below. The CA fetches it over {method.toUpperCase()}, so make sure the path is not redirected.</p>
        {h.content ? <div className="cx3-code mono soft">{h.content}<CopyButton text={h.content} label="Copy contents" /></div> : null}
      </div>
    );
  }
  if (method === 'email') {
    return <p className="cx3-note">An approval email has been sent{entry?.email ? <> to <strong>{entry.email}</strong></> : null}. Open it and click the approval link to issue the certificate.</p>;
  }
  return <p className="cx3-note">Open the order to see the validation steps.</p>;
}

export default async function Validation() {
  const ctx = await requireWorkspace();
  const orders = await q(
    `select * from console.orders where workspace_id = $1 and status in ('validating','incomplete','reissuing') order by created_at`,
    [ctx.workspaceId]
  );
  const items = orders.flatMap((o) => {
    const list = Array.isArray(o.dcv) && o.dcv.length ? o.dcv : [{ domain: o.common_name, method: o.dcv_method }];
    return list.filter((e) => e.status !== 'validated').map((e, k) => ({ o, e, k, method: e.method || o.dcv_method }));
  });

  return (
    <main className="cx3-page">
      <div className="cx3-head">
        <div>
          <h1>Validation</h1>
          <p>{items.length ? `${items.length} domain${items.length === 1 ? '' : 's'} waiting for proof of control across ${orders.length} order${orders.length === 1 ? '' : 's'}` : 'Nothing is waiting for validation'}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <section className="cx3-card cx3-empty">
          <span className="cx3-empty-ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></svg></span>
          <h2>All domains are validated</h2>
          <p>When a new order needs a DNS record, a file or an email approval, the exact steps appear here.</p>
          <div className="cx3-row"><Link className="cx3-btn" href="/orders">View certificates</Link></div>
        </section>
      ) : items.map(({ o, e, k, method }) => (
        <section key={o.id + ':' + k} className="cx3-card">
          <div className="cx3-vhead">
            <div className="cx3-vtitle">
              <span className="cx3-pill action">{LABEL[method] || 'Validation'} · waiting</span>
              <h2 className="mono">{e.domain || o.common_name}</h2>
              <span className="cx3-muted">{o.product_name} · ordered {ago(o.created_at)}</span>
            </div>
            <span className="cx3-muted small">{o.last_synced_at ? `Last checked ${fmtDate(o.last_synced_at)}` : 'Not checked yet'}</span>
          </div>
          <div className="cx3-vbody">
            <Steps entry={e} method={method} />
            <div className="cx3-row">
              <Link className="cx3-btn primary" href={`/certificates/${o.id}`}>Open order to check</Link>
              {method === 'dns' ? <span className="cx3-muted small push">Add the record at your DNS host (Cloudflare, GoDaddy, Route 53, cPanel…)</span> : null}
            </div>
          </div>
        </section>
      ))}

      <section className="cx3-banner">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
        <div><strong>Validation can be reused for shorter windows each year, down to 10 days by March 2029.</strong> Leaving DNS records in place, or moving to automation, means renewals never wait on a person.</div>
        <Link href="/renewals">Set up automation →</Link>
      </section>
    </main>
  );
}
