import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { q } from '@/lib/db';
import { syncStaleSubs, subDisplay, daysTo, KIND_LABEL } from '@/lib/subscriptions';
import TopBar from '@/components/TopBar';
import Icon from '@/components/Icon';
import { Kpi, Empty, fmtDate, FlashFromSearch, timeAgo } from '@/components/ui';

export const metadata = { title: 'Automated SSL · CertDesk' };

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'caas', label: 'ACME CaaS' },
  { key: 'ais', label: 'Plan + Automate' },
  { key: 'closed', label: 'Cancelled & ended' }
];

export default async function Subscriptions({ searchParams }) {
  const sp = await searchParams;
  const ctx = await requireWorkspace();
  await syncStaleSubs(ctx.workspaceId, 6);
  const all = await q(`select * from console.subscriptions where workspace_id = $1 order by created_at desc`, [ctx.workspaceId]);
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab : 'all';
  const closed = (s) => ['cancelled', 'expired'].includes(s.status);
  const counts = {
    all: all.filter((s) => !closed(s)).length,
    caas: all.filter((s) => s.kind === 'caas' && !closed(s)).length,
    ais: all.filter((s) => s.kind === 'ais' && !closed(s)).length,
    closed: all.filter(closed).length
  };
  const rows = all.filter((s) => (tab === 'closed' ? closed(s) : !closed(s) && (tab === 'all' || s.kind === tab)));
  const live = all.filter((s) => !closed(s));
  const active = live.filter((s) => s.status === 'active').length;
  const settingUp = live.filter((s) => ['pending', 'payment_needed'].includes(s.status)).length;
  const renewOff = live.filter((s) => s.auto_renew === false).length;
  const domains = live.reduce((n, s) => n + (s.domains?.length || 0), 0);

  return (
    <>
      <TopBar crumbs={[{ label: ctx.workspace.name }, { label: 'Automated SSL' }]}>
        <Link className="btn" href="/subscriptions/endpoints"><Icon name="code" />API v2 endpoints</Link>
        <Link className="btn primary" href="/subscriptions/new"><Icon name="plus" stroke="#fff" width={2.4} />New subscription</Link>
      </TopBar>
      <main className="page" style={{ gap: 16 }}>
        <div>
          <h1 className="title">Automated SSL subscriptions</h1>
          <p className="sub">Plan + Automate and ACME Certificate-as-a-Service. These renew and reissue on their own; the manual certificates stay under Certificates.</p>
        </div>
        <FlashFromSearch searchParams={sp} />
        <div className="kpis">
          <Kpi label="Active subscriptions" value={active} icon="loop" />
          <Kpi label="Setting up" value={settingUp} icon="clock" tone={settingUp ? 'amber' : undefined} />
          <Kpi label="Domains covered" value={domains} icon="globe" />
          <Kpi label="Auto-renewal off" value={renewOff} icon="alert" tone={renewOff ? 'red' : undefined} foot={<span className="small muted">These end at the end of their term</span>} />
        </div>
        <nav className="tabs" aria-label="Type">
          {TABS.map((t) => (
            <Link key={t.key} href={t.key === 'all' ? '/subscriptions' : `/subscriptions?tab=${t.key}`} className={tab === t.key ? 'on' : ''}>
              {t.label} <span style={{ color: 'var(--muted)' }}>{counts[t.key]}</span>
            </Link>
          ))}
        </nav>
        <div className="card">
          {rows.length === 0 ? (
            <Empty title={all.length ? 'Nothing in this view' : 'No subscriptions yet'}>
              <span>Order ACME CaaS for unlimited certificates through your own ACME client, or Plan + Automate to have certificates installed for you.</span>
              <Link className="btn primary" href="/subscriptions/new">New subscription</Link>
            </Empty>
          ) : (
            <div className="table-wrap">
              <table className="t" style={{ minWidth: 980 }}>
                <thead>
                  <tr><th>Domain</th><th>Type</th><th>Status</th><th>Install method</th><th>Auto-renewal</th><th>Term ends / renews</th><th>GoGetSSL</th><th>Synced</th></tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const st = subDisplay(s);
                    const until = s.next_renewal_at || s.end_at;
                    const d = daysTo(until);
                    return (
                      <tr key={s.id}>
                        <td>
                          <Link className="cn" href={`/subscriptions/${s.id}`}>{s.primary_domain || 'Pending'}</Link>
                          {s.domains?.length > 1 ? <span className="small muted"> +{s.domains.length - 1} more</span> : null}
                        </td>
                        <td>
                          <div>{KIND_LABEL[s.kind]}</div>
                          <div className="small muted">{s.product_name}</div>
                        </td>
                        <td><span className={`badge tone-${st.tone}`}>{st.label}</span></td>
                        <td>{s.kind === 'caas' ? 'Your ACME client' : s.install_method === 'acme' ? 'Your ACME client' : 'AutoInstall SSL'}</td>
                        <td>{s.auto_renew === null ? <span className="muted">—</span> : s.auto_renew ? <span className="badge tone-green">On</span> : <span className="badge tone-red">Off</span>}</td>
                        <td>
                          {until ? (
                            <>
                              <div style={{ fontWeight: 600, color: d !== null && d <= 30 && !s.auto_renew ? 'var(--red-strong)' : undefined }}>{d < 0 ? `${-d} days ago` : `${d} days`}</div>
                              <div className="small muted">{s.next_renewal_at ? 'Renews ' : 'Ends '}{fmtDate(until)}</div>
                            </>
                          ) : <span className="muted">—</span>}
                        </td>
                        <td className="mono small">
                          <div>Order {s.gg_order_id || '—'}</div>
                          <div className="muted">Item {s.item_id || '—'}</div>
                        </td>
                        <td className="small muted">{timeAgo(s.last_synced_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
