import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { q } from '@/lib/db';
import * as gg from '@/lib/gogetssl';
import { computeInsights } from '@/lib/insights';
import { openWorkspace, createWorkspace } from '@/app/actions/admin';
import TopBar from '@/components/TopBar';
import { Kpi, Empty, FlashFromSearch } from '@/components/ui';

export const metadata = { title: 'Customer workspaces · CertDesk' };

export default async function Partner({ searchParams }) {
  const sp = await searchParams;
  await requireAdmin();
  const workspaces = await q(
    `select w.*, (select count(*)::int from console.users u where u.workspace_id = w.id) as members,
            (select count(*)::int from console.workspace_products wp where wp.workspace_id = w.id) as products_for_sale
       from console.workspaces w order by w.created_at desc`
  );
  const orders = await q(`select * from console.orders where status <> 'draft'`);
  let balance = null;
  let balanceErr = null;
  try {
    balance = await gg.getBalance();
  } catch (e) {
    balanceErr = e.message;
  }
  const byWs = {};
  for (const o of orders) (byWs[o.workspace_id] ||= []).push(o);
  const all = computeInsights(orders);

  return (
    <>
      <TopBar crumbs={[{ label: 'Partner account' }, { label: 'Customer workspaces' }]} />
      <main className="page">
        <div>
          <h1 className="title">Customer workspaces</h1>
          <p className="sub">Create a workspace for each customer, add their logins, assign existing orders, or open a workspace to order for them.</p>
        </div>
        <FlashFromSearch searchParams={sp} />
        <div className="kpis">
          <Kpi label="Workspaces" value={workspaces.length} icon="building" />
          <Kpi label="Certificates managed" value={all.live.length} icon="lock" />
          <Kpi label="Expiring in 30 days" value={all.expiring.length} icon="clock" tone={all.expiring.length ? 'red' : undefined} />
          <Kpi label="GoGetSSL balance" value={balance ? `${balance.balance ?? '?'}` : '—'} icon="card"
            foot={<span className="small muted">{balance ? balance.currency || '' : balanceErr ? <Link href="/partner/api">Connection problem</Link> : ''}</span>} />
        </div>

        <div className="row top">
          <section className="card" style={{ flex: '2 1 600px', minWidth: 0 }}>
            {workspaces.length === 0 ? <Empty title="No customer workspaces yet">Create the first one on the right.</Empty> : (
              <div className="table-wrap">
                <table className="t" style={{ minWidth: 760 }}>
                  <thead><tr><th>Workspace</th><th>Certificates</th><th>Health</th><th>Expiring ≤30d</th><th>Logins</th><th>For sale</th><th /></tr></thead>
                  <tbody>
                    {workspaces.map((w) => {
                      const s = computeInsights(byWs[w.id] || []);
                      return (
                        <tr key={w.id}>
                          <td><Link href={`/partner/workspaces/${w.id}`} style={{ fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>{w.name}</Link><div className="small muted">{w.contact_email || '—'}</div></td>
                          <td>{s.live.length}</td>
                          <td>
                            {s.live.length ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div className="bar" style={{ width: 80, background: s.health < 60 ? 'var(--red-bg)' : undefined }}><span style={{ width: `${s.health}%`, background: s.health < 60 ? 'var(--red-dot)' : undefined }} /></div>
                                <strong style={{ color: s.health < 60 ? 'var(--red-strong)' : undefined }}>{s.health}</strong>
                              </div>
                            ) : <span className="muted">—</span>}
                          </td>
                          <td style={{ color: s.expiring.length ? 'var(--red-strong)' : undefined, fontWeight: s.expiring.length ? 600 : 400 }}>{s.expiring.length}</td>
                          <td>{w.members}</td>
                          <td><Link href={`/partner/workspaces/${w.id}/products`} className="small" style={{ fontWeight: 600 }}>{w.products_for_sale ? `${w.products_for_sale} product${w.products_for_sale === 1 ? '' : 's'}` : 'None · choose'}</Link></td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <Link className="btn sm" href={`/partner/workspaces/${w.id}/products`}>Products</Link>{' '}<Link className="btn sm" href={`/partner/workspaces/${w.id}`}>Manage</Link>{' '}
                            <form action={openWorkspace} style={{ display: 'inline' }}>
                              <input type="hidden" name="workspace_id" value={w.id} />
                              <button className="btn sm primary" type="submit">Open</button>
                            </form>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card pad" style={{ flex: '1 1 300px' }}>
            <h2 style={{ marginBottom: 14 }}>New workspace</h2>
            <form action={createWorkspace} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="field"><label htmlFor="wn">Customer name</label><input className="input" id="wn" name="name" required placeholder="Example Ltd." /></div>
              <div className="field"><label htmlFor="we">Contact email</label><input className="input" id="we" name="contact_email" type="email" placeholder="it@example.com" /></div>
              <button className="btn primary" type="submit">Create workspace</button>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}
