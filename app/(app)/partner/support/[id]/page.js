import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { q, one } from '@/lib/db';
import { itemFromOrder } from '@/lib/portfolio';
import { claimChat, returnToBot, resolveChat, markSeen } from '@/app/actions/assist';
import TopBar from '@/components/TopBar';
import { fmtDate, timeAgo } from '@/components/ui';
import Thread from './Thread';

export const metadata = { title: 'Conversation · CertDesk' };
export const dynamic = 'force-dynamic';

const LABEL = { bot: 'With the assistant', waiting: 'Waiting for you', human: 'In conversation', resolved: 'Resolved' };

export default async function Conversation({ params }) {
  const { id } = await params;
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const c = await one(
    `select c.*, w.name as workspace_name, w.id as ws_id, u.name as user_name, u.email as user_email
       from console.assist_conversations c join console.workspaces w on w.id = c.workspace_id left join console.users u on u.id = c.user_id
      where c.id = $1`,
    [id]
  );
  if (!c) notFound();
  await markSeen(id);
  const messages = await q('select id, role, body, data, intent, matched, helpful, created_at from console.assist_messages where conversation_id = $1 order by id asc', [id]);
  const orderIds = [...new Set([c.context?.orderId, ...messages.map((m) => m.data?.orderId)].filter((x) => /^[0-9a-f-]{36}$/i.test(String(x || ''))))].slice(-5);
  const orders = orderIds.length ? await q('select * from console.orders where id = any($1::uuid[]) and workspace_id = $2', [orderIds, c.workspace_id]) : [];
  const attention = await q(
    `select * from console.orders where workspace_id = $1 and status in ('validating','incomplete','reissuing','payment_needed') order by updated_at desc limit 5`,
    [c.workspace_id]
  );
  const shown = [...orders, ...attention.filter((a) => !orders.some((o) => o.id === a.id))].slice(0, 6);

  return (
    <>
      <TopBar crumbs={[{ label: 'Support inbox', href: '/partner/support' }, { label: c.workspace_name }]} />
      <main className="page sp-thread-page">
        <div className="sp-thread-head">
          <div>
            <h1 className="title" style={{ marginBottom: 4 }}>{c.subject || 'Conversation'}</h1>
            <p className="sub" style={{ margin: 0 }}>{c.workspace_name} · {c.user_name || ''} {c.user_email ? `<${c.user_email}>` : ''} · started {timeAgo(c.created_at)} · <strong>{LABEL[c.status] || c.status}</strong></p>
          </div>
          <div className="sp-thread-actions">
            {c.status !== 'human' && c.status !== 'resolved' ? <form action={claimChat}><input type="hidden" name="id" value={c.id} /><button className="cx3-btn primary" type="submit">Take over chat</button></form> : null}
            {c.status === 'human' || c.status === 'waiting' ? <form action={returnToBot}><input type="hidden" name="id" value={c.id} /><button className="cx3-btn" type="submit">Return to assistant</button></form> : null}
            {c.status !== 'resolved' ? <form action={resolveChat}><input type="hidden" name="id" value={c.id} /><button className="cx3-btn" type="submit">Mark resolved</button></form> : null}
          </div>
        </div>

        <div className="sp-thread-grid">
          <Thread id={c.id} initial={JSON.parse(JSON.stringify(messages))} status={c.status} />
          <aside className="sp-side">
            <section className="cx3-card cx3-pad">
              <h2>Customer’s certificates</h2>
              {!shown.length ? <p className="cx3-muted">No orders mentioned yet.</p> : (
                <ul className="sp-orders">
                  {shown.map((o) => {
                    const it = itemFromOrder(o);
                    return (
                      <li key={o.id}>
                        <b>{o.common_name}{o.sans?.length ? ` +${o.sans.length}` : ''}</b>
                        <small>{o.product_name} · #{o.gg_order_id || '—'}</small>
                        <span className="sp-st">{it.detail?.label}</span>
                        <small>{o.valid_till ? `Cert until ${fmtDate(o.valid_till)}` : 'Not issued'}{o.order_expires_at ? ` · Sub until ${fmtDate(o.order_expires_at)}` : ''}{o.dcv_method ? ` · ${String(o.dcv_method).toUpperCase()}` : ''}</small>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="cx3-muted" style={{ margin: '10px 0 0' }}>To act on an order (re-check, reissue), open the customer’s workspace from <Link href="/partner">Customer workspaces</Link>.</p>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
