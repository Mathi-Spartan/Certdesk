import { requireAdmin } from '@/lib/auth';
import { q } from '@/lib/db';
import { ENDPOINTS, v2Configured } from '@/lib/gogetssl-v2';
import TopBar from '@/components/TopBar';
import Icon from '@/components/Icon';
import { fmtDateTime } from '@/components/ui';

export const metadata = { title: 'API v2 endpoints · CertDesk' };

const METHOD_TONE = { GET: 'green', POST: 'violet', PATCH: 'amber', DELETE: 'red' };
const GROUP_NOTE = {
  General: 'Authentication and the product catalogue.',
  CaaS: 'Sectigo ACME Certificate-as-a-Service, product 300. One subscription, many domains, certificates issued by the customer’s ACME client.',
  'Plan + Automate': 'AutoInstall SSL plans, products 400 to 403. One domain each, installed by the AutoInstall agent or by ACME.'
};

export default async function Endpoints() {
  const ctx = await requireAdmin();
  const groups = [...new Set(ENDPOINTS.map((e) => e.group))];
  const calls = ctx.isAdmin
    ? await q(`select method, path, ok, ms, error, created_at from console.api_log where api = 'v2' order by created_at desc limit 25`)
    : [];
  return (
    <>
      <TopBar crumbs={[{ label: 'Partner account' }, { label: 'API v2 reference' }]} />
      <main className="page" style={{ gap: 18 }}>
        <div>
          <h1 className="title">GoGetSSL API v2 · subscription endpoints</h1>
          <p className="sub">Every call CertDesk makes for Plan + Automate and ACME CaaS. Base URL <span className="mono">https://my.gogetssl.com/api/v2</span>, JSON in and out.</p>
        </div>
        <section className="dark" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="eyebrow">AUTHENTICATION</div>
          <pre className="code" style={{ margin: 0, background: '#18181B', whiteSpace: 'pre-wrap' }}>
            <span className="k">Authorization:</span> GGS {'<partner code>'}:{'<API password>'}{'\n'}<span className="k">Accept:</span> application/json{'\n'}<span className="k">Content-Type:</span> application/json
          </pre>
          <span className="small" style={{ color: '#A1A1AA' }}>
            HTTP 400 and above is an error with a <span className="mono">message</span> field. 204 is a success with no body.
            {ctx.isAdmin ? (v2Configured() ? ' Credentials are set in Vercel.' : ' Add GOGETSSL_PARTNER_CODE in Vercel to enable API v2.') : ''}
          </span>
        </section>

        {groups.map((g) => (
          <section key={g} className="card" aria-labelledby={`g-${g}`}>
            <div className="pad" style={{ paddingBottom: 0 }}>
              <h2 id={`g-${g}`}>{g}</h2>
              <p className="small muted" style={{ margin: '4px 0 12px' }}>{GROUP_NOTE[g]}</p>
            </div>
            <div className="table-wrap">
              <table className="t" style={{ minWidth: 860 }}>
                <thead><tr><th style={{ width: 80 }}>Method</th><th>Path</th><th>What it does</th><th>Body</th></tr></thead>
                <tbody>
                  {ENDPOINTS.filter((e) => e.group === g).map((e) => (
                    <tr key={e.method + e.path}>
                      <td><span className={`badge tone-${METHOD_TONE[e.method]}`} style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 11 }}>{e.method}</span></td>
                      <td className="mono">{e.path}</td>
                      <td>{e.use}</td>
                      <td className="mono small" style={{ maxWidth: 340, overflowWrap: 'anywhere' }}>{e.body || <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        {ctx.isAdmin ? (
          <section className="card">
            <div className="pad" style={{ paddingBottom: 12 }}><h2>Recent API v2 calls</h2></div>
            {calls.length === 0 ? <p className="pad muted" style={{ paddingTop: 0 }}>No API v2 calls yet. Test the connection under Partner · API connection.</p> : (
              <div className="table-wrap">
                <table className="t">
                  <thead><tr><th>When</th><th>Call</th><th>Result</th><th>Time</th></tr></thead>
                  <tbody>
                    {calls.map((c, i) => (
                      <tr key={i}>
                        <td className="small">{fmtDateTime(c.created_at)}</td>
                        <td className="mono small">{c.method} {c.path}</td>
                        <td>{c.ok ? <span className="badge tone-green">OK</span> : <span style={{ color: 'var(--red-strong)' }}><Icon name="alert" size={12} stroke="var(--red-strong)" /> {c.error}</span>}</td>
                        <td className="small muted">{c.ms} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}
      </main>
    </>
  );
}
