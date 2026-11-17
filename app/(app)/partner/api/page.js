import { requireAdmin } from '@/lib/auth';
import { q, one } from '@/lib/db';
import { testApi } from '@/app/actions/admin';
import { testV2 } from '@/app/actions/subscriptions';
import { v2Configured } from '@/lib/gogetssl-v2';
import { kindForProduct } from '@/lib/subscriptions';
import TopBar from '@/components/TopBar';
import { FlashFromSearch, fmtDateTime, timeAgo } from '@/components/ui';

export const metadata = { title: 'Provider API · CertDesk' };

export default async function ProviderApi({ searchParams }) {
  const sp = await searchParams;
  await requireAdmin();
  const configured = !!(process.env.GOGETSSL_USER && process.env.GOGETSSL_PASS);
  const stats = await one(
    `select count(*)::int as calls, count(*) filter (where not ok)::int as failed, round(avg(ms))::int as avg_ms
       from console.api_log where created_at > now() - interval '24 hours'`
  );
  const recent = await q('select * from console.api_log order by created_at desc limit 25');
  const v2ok = v2Configured();
  const v2products = await one(`select value, updated_at from console.kv where key = 'v2_products'`);
  const v2subs = Array.isArray(v2products?.value) ? v2products.value.filter((p) => kindForProduct(p.id)) : [];
  const cron = await one(`select value, updated_at from console.kv where key = 'cron_last_run'`);
  return (
    <>
      <TopBar crumbs={[{ label: 'Partner account' }, { label: 'Provider API' }]}>
        <form action={testApi}><button className="btn" type="submit">Test API v1</button></form>
        <form action={testV2}><button className="btn primary" type="submit" disabled={!v2ok}>Test API v2</button></form>
      </TopBar>
      <main className="page">
        <div>
          <h1 className="title">GoGetSSL connection</h1>
          <p className="sub">All calls go from the CertDesk server to GoGetSSL. Customers never see your API credentials.</p>
        </div>
        <FlashFromSearch searchParams={sp} />
        <div className="row top">
          <section className="card pad" style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="between"><h2>Credentials</h2>{configured ? <span className="badge tone-green">Configured</span> : <span className="badge tone-red">Missing</span>}</div>
            <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <div className="between"><dt className="muted">API URL</dt><dd style={{ margin: 0 }} className="mono">{process.env.GOGETSSL_API_URL || 'https://my.gogetssl.com/api'}</dd></div>
              <div className="between"><dt className="muted">Username</dt><dd style={{ margin: 0 }} className="mono">{process.env.GOGETSSL_USER || '—'}</dd></div>
              <div className="between"><dt className="muted">Password</dt><dd style={{ margin: 0 }}>{configured ? 'Stored as a server secret' : '—'}</dd></div>
            </dl>
            <div className="small muted">Credentials are set as environment variables in Vercel (GOGETSSL_USER, GOGETSSL_PASS).</div>
            <div className="between" style={{ marginTop: 6 }}><h2>API v2 (subscriptions)</h2>{v2ok ? <span className="badge tone-green">Configured</span> : <span className="badge tone-red">Missing</span>}</div>
            <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <div className="between"><dt className="muted">API URL</dt><dd style={{ margin: 0 }} className="mono">{process.env.GOGETSSL_API_V2_URL || 'https://my.gogetssl.com/api/v2'}</dd></div>
              <div className="between"><dt className="muted">Partner code</dt><dd style={{ margin: 0 }} className="mono">{process.env.GOGETSSL_PARTNER_CODE || '—'}</dd></div>
              <div className="between"><dt className="muted">Auth</dt><dd style={{ margin: 0 }} className="mono">GGS code:password</dd></div>
            </dl>
            {v2products ? (
              <div className="small muted">Catalogue read {timeAgo(v2products.updated_at)}: {v2subs.length ? v2subs.map((p) => `${p.id} ${p.name}`).join(' · ') : 'no subscription products returned'}</div>
            ) : <div className="small muted">Run “Test API v2” to read the v2 product catalogue.</div>}
          </section>
          <section className="dark" style={{ flex: '2 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="between"><h2 style={{ margin: 0, fontSize: 16, color: '#fff' }}>Last 24 hours</h2><span className="eyebrow">SERVER-SIDE ONLY</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12 }}>
              <div><div style={{ fontSize: 28, fontWeight: 600 }}>{stats.calls}</div><div className="small" style={{ color: '#A1A1AA' }}>API calls</div></div>
              <div><div style={{ fontSize: 28, fontWeight: 600, color: stats.failed ? '#FCA5A5' : '#86EFAC' }}>{stats.failed}</div><div className="small" style={{ color: '#A1A1AA' }}>Failed</div></div>
              <div><div style={{ fontSize: 28, fontWeight: 600 }}>{stats.avg_ms ?? '—'}<span style={{ fontSize: 14 }}> ms</span></div><div className="small" style={{ color: '#A1A1AA' }}>Average time</div></div>
            </div>
            <div className="small" style={{ color: '#A1A1AA' }}>Daily background sync: {cron ? `${timeAgo(cron.updated_at)} · ${cron.value.synced ?? 0} orders checked` : 'not run yet'}</div>
          </section>
        </div>
        <section className="card">
          <div className="card-head"><h2>Recent calls</h2></div>
          <div className="table-wrap">
            <table className="t" style={{ minWidth: 640 }}>
              <thead><tr><th>Time</th><th>Endpoint</th><th>Result</th><th>Duration</th></tr></thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDateTime(r.created_at)}</td>
                    <td className="mono">{r.api === 'v2' ? <span className="badge tone-violet" style={{ marginRight: 6 }}>v2</span> : null}{r.method ? r.method + ' ' : ''}{r.path}</td>
                    <td>{r.ok ? <span className="badge tone-green">OK</span> : <span className="badge tone-red" title={r.error || ''}>{(r.error || 'Error').slice(0, 60)}</span>}</td>
                    <td>{r.ms} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
