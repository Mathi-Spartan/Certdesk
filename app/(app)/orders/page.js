import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { q } from '@/lib/db';
import TopBar from '@/components/TopBar';
import TypeChip from '@/components/TypeChip';
import { itemFromOrder, itemFromSub } from '@/lib/portfolio';
import { Empty, fmtDate } from '@/components/ui';

export const metadata = { title: 'Order history · CertDesk' };

export default async function Orders() {
  const ctx = await requireWorkspace();
  const [orders, subs] = await Promise.all([
    q(
      `select o.*, u.name as by_name from console.orders o left join console.users u on u.id = o.created_by
        where o.workspace_id = $1 and o.status <> 'draft'`,
      [ctx.workspaceId]
    ),
    q(
      `select s.*, u.name as by_name from console.subscriptions s left join console.users u on u.id = s.created_by
        where s.workspace_id = $1`,
      [ctx.workspaceId]
    )
  ]);
  const rows = [
    ...orders.map((o) => ({ ...itemFromOrder(o), at: o.created_at, by: o.by_name, kindLabel: o.renewal_of ? 'Renewal' : 'New order', term: o.period_months ? `${o.period_months} months` : null, cost: o.order_amount != null ? `${o.order_amount} ${o.currency || ''}` : null })),
    ...subs.map((s) => ({ ...itemFromSub(s), at: s.created_at, by: s.by_name, kindLabel: 'Subscription', term: null, cost: null }))
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  return (
    <>
      <TopBar crumbs={[{ label: ctx.workspace.name }, { label: 'Order history' }]} />
      <main className="page">
        <div>
          <h1 className="title">Order history</h1>
          <p className="sub">Every order placed or assigned to you, newest first. Billing is handled by your provider.</p>
        </div>
        <div className="card">
          {rows.length === 0 ? <Empty title="No orders yet"><Link className="btn primary" href="/order">Order SSL</Link></Empty> : (
            <div className="table-wrap">
              <table className="t list" style={{ minWidth: 820 }}>
                <thead><tr><th>Date</th><th>Domain</th><th>Type</th><th>Order</th><th>Status</th><th>Placed by</th>{ctx.isAdmin ? <th>Reference</th> : null}{ctx.isAdmin ? <th>Partner cost</th> : null}</tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.type + r.id}>
                      <td>{fmtDate(r.at)}</td>
                      <td><Link className="cn" href={r.href}>{r.domain}</Link><div className="small muted">{r.product}</div></td>
                      <td><TypeChip type={r.type} /></td>
                      <td>{r.kindLabel}{r.term ? <div className="small muted">{r.term}</div> : null}</td>
                      <td><span className={`badge tone-${r.status.tone}`}>{r.status.label}</span></td>
                      <td>{r.by || 'Your provider'}</td>
                      {ctx.isAdmin ? <td className="mono small">{r.ref || '—'}</td> : null}
                      {ctx.isAdmin ? <td className="mono small">{r.cost || '—'}</td> : null}
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
