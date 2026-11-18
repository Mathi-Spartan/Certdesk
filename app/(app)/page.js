import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { q } from '@/lib/db';
import { loadPortfolio } from '@/lib/portfolio';
import TopBar from '@/components/TopBar';
import Icon from '@/components/Icon';
import { TypeChip } from '@/components/ItemRow';
import { fmtDate, fmtDateTime } from '@/components/ui';

export const metadata = { title: 'Home · CertDesk' };

const LIFETIME_CUT = new Date('2027-03-15T00:00:00Z');

export default async function Home() {
  const ctx = await requireWorkspace();
  const p = await loadPortfolio(ctx.workspaceId);
  const events = await q(
    `(select e.created_at, e.message, o.common_name as domain, ('/certificates/' || o.id) as href
        from console.order_events e join console.orders o on o.id = e.order_id where o.workspace_id = $1)
     union all
     (select e.created_at, e.message, s.primary_domain as domain, ('/subscriptions/' || s.id) as href
        from console.subscription_events e join console.subscriptions s on s.id = e.subscription_id where s.workspace_id = $1)
     order by created_at desc limit 6`,
    [ctx.workspaceId]
  );
  const todo = [...p.action, ...p.progress];
  const firstName = String(ctx.user.name || '').split(' ')[0];
  const daysToCut = Math.max(0, Math.ceil((LIFETIME_CUT - Date.now()) / 86400000));

  return (
    <>
      <TopBar crumbs={[{ label: ctx.workspace.name }, { label: 'Home' }]}>
        <Link className="btn primary" href="/order"><Icon name="plus" stroke="#fff" width={2.4} />Order SSL</Link>
      </TopBar>
      <main className="page">
        <div>
          <h1 className="title">Welcome back{firstName ? `, ${firstName}` : ''}</h1>
          <p className="sub">
            {p.live.length === 0
              ? 'Welcome to CertDesk. Order your first SSL to get started.'
              : p.action.length
                ? `${p.action.length} thing${p.action.length === 1 ? '' : 's'} need${p.action.length === 1 ? 's' : ''} your attention.`
                : 'Everything is in order. Nothing needs your attention.'}
          </p>
        </div>

        <div className="kpis">
          <Link href="/certificates" className="kpi-link">
            <span className="small muted">Domains protected</span>
            <span className="kpi-num">{p.domains}</span>
          </Link>
          <Link href="/certificates?view=cert" className="kpi-link">
            <span className="small muted">Certificates</span>
            <span className="kpi-num">{p.certs}</span>
          </Link>
          <Link href="/certificates?view=auto" className="kpi-link">
            <span className="small muted">Automated subscriptions</span>
            <span className="kpi-num">{p.autos}</span>
          </Link>
          <Link href="/certificates?view=action" className={`kpi-link ${p.action.length ? 'alert' : ''}`}>
            <span className="small muted">Needs action</span>
            <span className="kpi-num">{p.action.length}</span>
          </Link>
        </div>

        <div className="row top">
          <section className="card" style={{ flex: '2 1 560px', minWidth: 0 }}>
            <div className="card-head"><h2>To do</h2><Link className="small" href="/certificates?view=action">See all</Link></div>
            {todo.length === 0 ? (
              <div className="pad" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span className="ok-circle"><Icon name="tick" stroke="#fff" width={3} /></span>
                <div>
                  <div style={{ fontWeight: 600 }}>You&apos;re all set</div>
                  <div className="small muted">We&apos;ll list anything here as soon as it needs you.</div>
                </div>
              </div>
            ) : (
              <ul className="todo">
                {todo.slice(0, 8).map((i) => (
                  <li key={i.type + i.id}>
                    <span className={`dot ${i.group === 'action' ? 'red' : 'amber'}`} aria-hidden="true" />
                    <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Link href={i.href} className="mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>{i.domain}</Link>
                        <TypeChip type={i.type} />
                      </div>
                      <div className="small" style={{ color: 'var(--ink-2)' }}>{i.next.text}</div>
                    </div>
                    {i.next.cta ? <Link className="btn sm primary" href={i.next.href}>{i.next.cta}</Link> : <span className="small muted">Waiting</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card" style={{ flex: '1 1 300px' }}>
            <div className="card-head"><h2>Coming up</h2></div>
            {p.upcoming.length === 0 ? <p className="pad muted" style={{ margin: 0 }}>No dates coming up.</p> : (
              <ul className="todo">
                {p.upcoming.map((i) => (
                  <li key={i.type + i.id}>
                    <div className="date-box"><span>{new Date(i.date.at).toLocaleDateString('en-GB', { month: 'short' })}</span><strong>{new Date(i.date.at).getDate()}</strong></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={i.href} className="mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>{i.domain}</Link>
                      <div className="small muted">{i.date.label} {fmtDate(i.date.at)} · in {i.date.days} days</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="row top">
          <section className="card pad" style={{ flex: '2 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2>Recent activity</h2>
            {events.length === 0 ? <span className="muted">No activity yet.</span> : (
              <ol className="feed">
                {events.map((e, n) => (
                  <li key={n}>
                    <span className="when">{fmtDateTime(e.created_at)}</span>
                    <span><Link href={e.href} className="mono" style={{ color: 'var(--ink)' }}>{e.domain || '—'}</Link> · {e.message}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          {p.certs > 0 ? (
            <section className="card pad" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--accent-bg)', borderColor: '#DDD6FE' }}>
              <div className="small" style={{ fontWeight: 600, color: 'var(--accent-ink)' }}>Heads up · {daysToCut} days</div>
              <h2 style={{ fontSize: 16, lineHeight: 1.35 }}>From 15 Mar 2027 certificates last at most 100 days</h2>
              <p className="small" style={{ margin: 0, color: 'var(--ink-2)' }}>
                Manual certificates will need reissuing about every 3 months. An automated subscription does that for you.
              </p>
              <Link className="btn sm" href="/subscriptions/new" style={{ alignSelf: 'flex-start' }}>See automated SSL</Link>
            </section>
          ) : null}
        </div>
      </main>
    </>
  );
}
