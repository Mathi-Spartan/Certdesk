import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { q } from '@/lib/db';
import TopBar from '@/components/TopBar';
import { StatusBadge, Empty, fmtDate } from '@/components/ui';

export const metadata = { title: 'Orders · CertDesk' };

export default async function Orders() {
  const ctx = await requireWorkspace();
  const rows = await q(
    `select o.*, u.name as by_name from console.orders o left join console.users u on u.id = o.created_by
      where o.workspace_id = $1 order by o.created_at desc`,
    [ctx.workspaceId]
  );
  return (
    <>
      <TopBar crumbs={[{ label: ctx.workspace.name }, { label: 'Orders & billing' }]} />
      <main className="page">
        <div>
          <h1 className="title">Orders &amp; billing</h1>
          <p className="sub">Every order placed or assigned in this workspace. Billing is handled by your partner.</p>
        </div>
        <div className="card">
          {rows.length === 0 ? <Empty title="No orders yet" /> : (
            <div className="table-wrap">
              <table className="t" style={{ minWidth: 820 }}>
                <thead><tr><th>Date</th><th>GoGetSSL order</th><th>Certificate</th><th>Type</th><th>Status</th><th>Placed by</th>{ctx.isAdmin ? <th>Partner cost</th> : null}</tr></thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id}>
                      <td>{fmtDate(o.created_at)}</td>
                      <td className="mono">{o.gg_order_id || '—'}</td>
                      <td><Link className="cn" href={`/certificates/${o.id}`}>{o.common_name || 'Pending'}</Link><div className="small muted">{o.product_name}</div></td>
                      <td>{o.renewal_of ? 'Renewal' : 'New'}{o.period_months ? ` · ${o.period_months} mo` : ''}</td>
                      <td><StatusBadge order={o} /></td>
                      <td>{o.by_name || 'Assigned by partner'}</td>
                      {ctx.isAdmin ? <td className="mono">{o.order_amount != null ? `${o.order_amount} ${o.currency || ''}` : '—'}</td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
