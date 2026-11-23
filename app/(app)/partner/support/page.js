import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { q, one } from '@/lib/db';
import TopBar from '@/components/TopBar';
import { FlashFromSearch, timeAgo } from '@/components/ui';

export const metadata = { title: 'Support inbox · CertDesk' };
export const dynamic = 'force-dynamic';

const TABS = [
  ['open', 'Needs you'],
  ['human', 'In conversation'],
  ['bot', 'With Nunmathi'],
  ['resolved', 'Resolved'],
  ['all', 'All']
];
const WHERE = {
  open: `c.status = 'waiting' or (c.status = 'human' and c.unread_admin > 0)`,
  human: `c.status = 'human'`,
  bot: `c.status = 'bot'`,
  resolved: `c.status = 'resolved'`,
  all: 'true'
};
const STATUS = { bot: ['Nunmathi', ''], waiting: ['Waiting for you', 'red'], human: ['In conversation', 'blue'], resolved: ['Resolved', 'gray'] };
const TOPIC = {
  why_pending: 'Not issued / pending', status: 'Order status', validate_how: 'How to validate', dns_check: 'DNS check', expiry: 'Expiry dates',
  reissue: 'Reissue / renew', renew: 'Reissue / renew', download: 'Download files', install: 'Install', convert: 'Formats (PFX/JKS)',
  privatekey: 'Private key', autorenew: 'Auto-renew', cancel: 'Cancel / refund', adddomain: 'Add domains', buy: 'Buying', browsererror: 'Browser errors',
  lifetime: 'Lifetimes', csr: 'CSR', overview: 'What needs attention', caa: 'CAA', kb: 'Help articles', count: 'How many certificates', covers: 'Is a domain covered', details: 'Order details', expired_list: 'Expired list', autorenew_list: 'Auto-renew list', by_method: 'List by validation method', by_type: 'List by type', by_brand: 'List by brand', list_all: 'List all certificates', contact: 'Support contact', topics: 'Browsed topics', change_method: 'Change validation method', list_due: 'Due in N days', action: 'Buttons (re-check, resend…)', human: 'Asked for a person', none: 'Not understood'
};

export default async function SupportInbox({ searchParams }) {
  const sp = await searchParams;
  await requireAdmin();
  const tab = WHERE[sp.tab] ? sp.tab : 'open';
  let ready = true;
  let list = [];
  let stats = {};
  let topics = [];
  let unanswered = [];
  let counts = {};
  try {
    list = await q(
      `select c.*, w.name as workspace_name, u.name as user_name, u.email as user_email,
              (select body from console.assist_messages m where m.conversation_id = c.id and m.role in ('user','agent') order by id desc limit 1) as preview
         from console.assist_conversations c
         join console.workspaces w on w.id = c.workspace_id
         left join console.users u on u.id = c.user_id
        where ${WHERE[tab]}
        order by c.last_message_at desc limit 100`
    );
    const cnt = await q(`select status, count(*)::int n, count(*) filter (where unread_admin > 0)::int unread from console.assist_conversations group by status`);
    for (const r of cnt) counts[r.status] = r;
    counts.open = (counts.waiting?.n || 0) + (counts.human?.unread || 0);
    stats = await one(
      `select
         (select count(*)::int from console.assist_conversations where created_at > now() - interval '30 days') as chats,
         (select count(distinct conversation_id)::int from console.assist_messages where role = 'system' and body like 'Your chat has been passed%' and created_at > now() - interval '30 days') as handoffs,
         (select count(*)::int from console.assist_messages where role = 'bot' and created_at > now() - interval '30 days') as answers,
         (select count(*)::int from console.assist_messages where role = 'bot' and matched = false and created_at > now() - interval '30 days') as missed,
         (select count(*)::int from console.assist_messages where helpful is true and created_at > now() - interval '30 days') as up,
         (select count(*)::int from console.assist_messages where helpful is false and created_at > now() - interval '30 days') as down`
    );
    topics = await q(
      `select intent, count(*)::int n from console.assist_messages where role = 'bot' and intent is not null and intent not in ('greet','helpme','thanks','clarify')
         and created_at > now() - interval '30 days' group by intent order by n desc limit 8`
    );
    unanswered = await q(
      `select m.id, m.created_at, m.conversation_id, w.name as workspace_name,
              (select body from console.assist_messages u where u.conversation_id = m.conversation_id and u.role = 'user' and u.id < m.id order by u.id desc limit 1) as question
         from console.assist_messages m
         join console.assist_conversations c on c.id = m.conversation_id
         join console.workspaces w on w.id = c.workspace_id
        where m.role = 'bot' and (m.matched = false or m.helpful is false) and m.created_at > now() - interval '30 days'
        order by m.id desc limit 15`
    );
  } catch (e) {
    ready = !/assist_/.test(String(e.message));
    if (ready) throw e;
  }
  const solved = stats.chats ? Math.max(0, Math.round(((stats.chats - (stats.handoffs || 0)) / stats.chats) * 100)) : null;
  const understood = stats.answers ? Math.round(((stats.answers - stats.missed) / stats.answers) * 100) : null;
  const helpful = stats.up + stats.down ? Math.round((stats.up / (stats.up + stats.down)) * 100) : null;
  const maxTopic = Math.max(1, ...topics.map((t) => t.n));

  return (
    <>
      <TopBar crumbs={[{ label: 'Partner account' }, { label: 'Support inbox' }]}>
        <Link href="/partner/support/kb" className="btn">Knowledge base</Link>
      </TopBar>
      <main className="page">
        <div>
          <h1 className="title">Support inbox</h1>
          <p className="sub">Nunmathi (நுண்மதி), the CertDesk assistant, answers customers from their live orders. Chats it can’t solve, or where a customer asks for a person, land here.</p>
        </div>
        <FlashFromSearch searchParams={sp} />
        {!ready ? (
          <div className="cx3-alert amber" style={{ margin: '16px 0' }}><div><strong>Support chat isn’t set up yet.</strong> The database tables in <code>db/assist.sql</code> need to be created once.</div></div>
        ) : (
          <>
            <div className="sp-kpis">
              <div className="cx3-card cx3-pad"><span className="bl-k">Chats · 30 days</span><b className="bl-big">{stats.chats || 0}</b></div>
              <div className="cx3-card cx3-pad"><span className="bl-k">Solved by Nunmathi</span><b className="bl-big">{solved === null ? '—' : `${solved}%`}</b><span className="cx3-muted">{stats.handoffs || 0} passed to you</span></div>
              <div className="cx3-card cx3-pad"><span className="bl-k">Questions understood</span><b className="bl-big">{understood === null ? '—' : `${understood}%`}</b><span className="cx3-muted">{stats.missed || 0} not understood</span></div>
              <div className="cx3-card cx3-pad"><span className="bl-k">Answers rated helpful</span><b className="bl-big">{helpful === null ? '—' : `${helpful}%`}</b><span className="cx3-muted">{stats.up || 0} 👍 · {stats.down || 0} 👎</span></div>
            </div>

            <div className="sp-grid">
              <section className="cx3-card sp-list">
                <nav className="mc-seg sp-tabs" aria-label="Filter">
                  {TABS.map(([k, l]) => {
                    const n = k === 'open' ? counts.open : k === 'all' ? null : counts[k]?.n;
                    return <Link key={k} href={`/partner/support?tab=${k}`} className={tab === k ? 'on' : ''}>{l}{n ? <em className={k === 'open' ? 'hot' : ''}>{n}</em> : null}</Link>;
                  })}
                </nav>
                {!list.length ? <p className="cx3-muted" style={{ padding: 20, margin: 0 }}>{tab === 'open' ? 'Nothing waiting. Nunmathi has it covered.' : 'No conversations here.'}</p> : (
                  <ul className="sp-rows">
                    {list.map((c) => {
                      const st = STATUS[c.status] || [c.status, ''];
                      return (
                        <li key={c.id}>
                          <Link href={`/partner/support/${c.id}`} className={c.unread_admin ? 'unread' : ''}>
                            <span className="sp-who"><b>{c.workspace_name}</b><small>{c.user_name || c.user_email || '—'}</small></span>
                            <span className="sp-prev">{c.subject && c.subject !== c.preview ? <b>{c.subject}</b> : null}<span>{c.preview || '—'}</span></span>
                            <span className="sp-meta"><span className={`sp-st ${st[1]}`}>{st[0]}</span><small>{timeAgo(c.last_message_at)}</small>{c.unread_admin ? <em>{c.unread_admin}</em> : null}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <aside className="sp-side">
                <section className="cx3-card cx3-pad">
                  <h2>Top topics · 30 days</h2>
                  {!topics.length ? <p className="cx3-muted">No questions yet.</p> : (
                    <ul className="sp-bars">{topics.map((t) => <li key={t.intent}><span>{TOPIC[t.intent] || t.intent}</span><i style={{ width: `${(t.n / maxTopic) * 100}%` }} /><b>{t.n}</b></li>)}</ul>
                  )}
                </section>
                <section className="cx3-card cx3-pad">
                  <h2>Couldn’t answer well</h2>
                  <p className="cx3-muted" style={{ marginTop: 0 }}>Not understood or rated 👎. Add an article for the common ones.</p>
                  {!unanswered.length ? <p className="cx3-muted">Nothing yet.</p> : (
                    <ul className="sp-miss">{unanswered.map((u) => <li key={u.id}><Link href={`/partner/support/${u.conversation_id}`}>“{String(u.question || '').slice(0, 120)}”</Link><small>{u.workspace_name} · {timeAgo(u.created_at)}</small></li>)}</ul>
                  )}
                  <Link href="/partner/support/kb/new" className="cx3-btn sm" style={{ marginTop: 10 }}>Add an article</Link>
                </section>
              </aside>
            </div>
          </>
        )}
      </main>
    </>
  );
}
