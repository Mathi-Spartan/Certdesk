import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { q, one } from '@/lib/db';
import { openWorkspace, importOrder, setUserActive, unassignOrder } from '@/app/actions/admin';
import { importSubscription, unassignSubscription } from '@/app/actions/subscriptions';
import { subDisplay, KIND_LABEL } from '@/lib/subscriptions';
import TopBar from '@/components/TopBar';
import { StatusBadge, Empty, FlashFromSearch, fmtDate, timeAgo } from '@/components/ui';
import { CreateUserForm, ResetPasswordButton } from './UserForms';

export const metadata = { title: 'Workspace · CertDesk' };

export default async function WorkspaceAdmin({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ws = await one('select * from console.workspaces where id = $1', [id]);
  if (!ws) notFound();
  const users = await q(`select * from console.users where workspace_id = $1 order by created_at`, [id]);
  const orders = await q(`select * from console.orders where workspace_id = $1 order by created_at desc`, [id]);
  const subs = await q(`select * from console.subscriptions where workspace_id = $1 order by created_at desc`, [id]);
  const forSale = (await one('select count(*)::int as n from console.workspace_products where workspace_id = $1', [id]))?.n || 0;

  return (
    <>
      <TopBar crumbs={[{ label: 'Customer workspaces', href: '/partner' }, { label: ws.name }]}>
        <form action={openWorkspace}>
          <input type="hidden" name="workspace_id" value={ws.id} />
          <button className="btn primary" type="submit">Open as this customer</button>
        </form>
      </TopBar>
      <main className="page">
        <div>
          <h1 className="title">{ws.name}</h1>
          <p className="sub">{ws.contact_email || 'No contact email'} · created {fmtDate(ws.created_at)}</p>
        </div>
        <FlashFromSearch searchParams={sp} />
        <Link href={`/partner/workspaces/${ws.id}/products`} className="card pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, textDecoration: 'none', color: 'inherit' }}>
          <div>
            <h2 style={{ margin: 0 }}>Products this customer can order</h2>
            <p className="small muted" style={{ margin: '4px 0 0' }}>{forSale ? `${forSale} product${forSale === 1 ? '' : 's'} selected. Everything else shows as coming soon.` : 'None selected. The customer sees the catalogue as coming soon and cannot order.'}</p>
          </div>
          <span className="btn primary">Choose products</span>
        </Link>

        <div className="row top">
          <section className="card" style={{ flex: '2 1 560px', minWidth: 0 }}>
            <div className="card-head"><h2>Logins</h2><span className="small muted">Customers sign in with email and password. They cannot invite others.</span></div>
            {users.length === 0 ? <Empty title="No logins yet">Add the first one on the right.</Empty> : (
              <div className="table-wrap">
                <table className="t" style={{ minWidth: 560 }}>
                  <thead><tr><th>Name</th><th>Email</th><th>Last sign-in</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 600 }}>{u.name}</td>
                        <td>{u.email}</td>
                        <td>{timeAgo(u.last_login_at)}</td>
                        <td>{u.is_active ? <span className="badge tone-green">Active</span> : <span className="badge tone-gray">Disabled</span>}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <ResetPasswordButton userId={u.id} />{' '}
                          <form action={setUserActive} style={{ display: 'inline' }}>
                            <input type="hidden" name="user_id" value={u.id} />
                            <input type="hidden" name="active" value={u.is_active ? 'false' : 'true'} />
                            <button className="btn sm" type="submit">{u.is_active ? 'Disable' : 'Enable'}</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="card pad" style={{ flex: '1 1 300px' }}>
            <h2 style={{ marginBottom: 14 }}>Add a login</h2>
            <CreateUserForm workspaceId={ws.id} />
          </section>
        </div>

        <div className="row top">
          <section className="card" style={{ flex: '2 1 560px', minWidth: 0 }}>
            <div className="card-head"><h2>Certificates in this workspace</h2><span className="small muted">{orders.length}</span></div>
            {orders.length === 0 ? <Empty title="No orders yet">Assign an existing GoGetSSL order, or open the workspace and buy one.</Empty> : (
              <div className="table-wrap">
                <table className="t" style={{ minWidth: 640 }}>
                  <thead><tr><th>Domain</th><th>GoGetSSL order</th><th>Status</th><th>Expires</th><th /></tr></thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td className="mono">{o.common_name || '—'}<div className="small muted" style={{ fontFamily: 'var(--font-sans)' }}>{o.product_name}</div></td>
                        <td className="mono">{o.gg_order_id}</td>
                        <td><StatusBadge order={o} /></td>
                        <td>{fmtDate(o.valid_till)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <form action={unassignOrder}>
                            <input type="hidden" name="order_id" value={o.id} />
                            <input type="hidden" name="workspace_id" value={ws.id} />
                            <button className="btn sm ghost" type="submit">Remove</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="card pad" style={{ flex: '1 1 300px' }}>
            <h2 style={{ marginBottom: 6 }}>Assign an existing order</h2>
            <p className="small muted" style={{ margin: '0 0 14px' }}>Enter the order ID from your GoGetSSL account. CertDesk pulls its details and the customer sees it straight away.</p>
            <form action={importOrder} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="hidden" name="workspace_id" value={ws.id} />
              <div className="field"><label htmlFor="gid">GoGetSSL order ID</label><input className="input mono" id="gid" name="gg_order_id" inputMode="numeric" required placeholder="1234567" /></div>
              <button className="btn primary" type="submit">Assign to {ws.name}</button>
            </form>
          </section>
        </div>
        <div className="row top">
          <section className="card" style={{ flex: '2 1 560px', minWidth: 0 }}>
            <div className="card-head"><h2>Automated SSL subscriptions</h2><span className="small muted">{subs.length}</span></div>
            {subs.length === 0 ? <Empty title="No subscriptions yet">Assign an existing Plan + Automate or ACME CaaS item, or open the workspace and order one.</Empty> : (
              <div className="table-wrap">
                <table className="t" style={{ minWidth: 640 }}>
                  <thead><tr><th>Domain</th><th>Type</th><th>GoGetSSL item</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {subs.map((s) => {
                      const st = subDisplay(s);
                      return (
                        <tr key={s.id}>
                          <td className="mono">{s.primary_domain || '—'}<div className="small muted" style={{ fontFamily: 'var(--font-sans)' }}>{s.product_name}</div></td>
                          <td>{KIND_LABEL[s.kind]}</td>
                          <td className="mono">{s.item_id}</td>
                          <td><span className={`badge tone-${st.tone}`}>{st.label}</span></td>
                          <td style={{ textAlign: 'right' }}>
                            <form action={unassignSubscription}>
                              <input type="hidden" name="sub_id" value={s.id} />
                              <input type="hidden" name="workspace_id" value={ws.id} />
                              <button className="btn sm ghost" type="submit">Remove</button>
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
            <h2 style={{ marginBottom: 6 }}>Assign a subscription</h2>
            <p className="small muted" style={{ margin: '0 0 14px' }}>Enter the item ID of a Plan + Automate or ACME CaaS subscription. CertDesk reads it through API v2.</p>
            <form action={importSubscription} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="hidden" name="workspace_id" value={ws.id} />
              <div className="field">
                <label htmlFor="skind">Type</label>
                <select className="input" id="skind" name="kind" defaultValue="caas">
                  <option value="caas">ACME CaaS</option>
                  <option value="ais">Plan + Automate</option>
                </select>
              </div>
              <div className="field"><label htmlFor="sitem">GoGetSSL item ID</label><input className="input mono" id="sitem" name="item_id" inputMode="numeric" required placeholder="1234567" /></div>
              <button className="btn primary" type="submit">Assign to {ws.name}</button>
            </form>
          </section>
        </div>
        <p className="small muted"><Link href="/partner">← All workspaces</Link></p>
      </main>
    </>
  );
}
