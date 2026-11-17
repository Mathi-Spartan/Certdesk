import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { q } from '@/lib/db';
import { syncStale } from '@/lib/orders';
import { computeInsights } from '@/lib/insights';
import TopBar from '@/components/TopBar';
import Icon from '@/components/Icon';
import { Kpi, Empty, timeAgo, fmtDateTime } from '@/components/ui';

export const metadata = { title: 'Overview · CertDesk' };

const TONES = { red: 'var(--red-dot)', amber: '#F59E0B', violet: 'var(--accent-mid)' };
const LIFETIME_CUT = new Date('2027-03-15T00:00:00Z');

export default async function Overview() {
  const ctx = await requireWorkspace();
  await syncStale(ctx.workspaceId, 10);
  const orders = await q('select * from console.orders where workspace_id = $1 order by created_at desc', [ctx.workspaceId]);
  const events = await q(
    `select e.*, o.common_name, u.name as actor from console.order_events e
       join console.orders o on o.id = e.order_id left join console.users u on u.id = e.actor_user_id
      where o.workspace_id = $1 order by e.created_at desc limit 6`,
    [ctx.workspaceId]
  );
  const lastSync = orders.reduce((m, o) => (o.last_synced_at && (!m || o.last_synced_at > m) ? o.last_synced_at : m), null);
  const s = computeInsights(orders);
  const maxWeek = Math.max(1, ...s.weeks.map((w) => w.n));
  const daysToCut = Math.max(0, Math.ceil((LIFETIME_CUT - Date.now()) / 86400000));
  const total = s.live.length;
  const domains = new Set(s.live.flatMap((o) => [o.common_name, ...(o.sans || [])]).filter(Boolean)).size;
  const circ = 2 * Math.PI * 46;

  return (
    <>
      <TopBar crumbs={[{ label: ctx.workspace.name }, { label: 'Overview' }]}>
        <Link className="btn primary" href="/buy"><Icon name="plus" stroke="#fff" width={2.4} />Buy certificate</Link>
      </TopBar>
      <main className="page">
        <div>
          <h1 className="title">Overview</h1>
          <p className="sub">{total} certificate{total === 1 ? '' : 's'} across {domains} domain{domains === 1 ? '' : 's'} · synced from GoGetSSL {timeAgo(lastSync)}</p>
        </div>

        {total === 0 ? (
          <div className="card">
            <Empty title="No certificates yet">
              <span>Buy your first certificate, or ask your partner to assign your existing orders.</span>
              <Link className="btn primary" href="/buy">Buy certificate</Link>
            </Empty>
          </div>
        ) : (
          <>
            <div className="kpis">
              <Kpi label="Certificates" value={total} icon="lock" foot={<span className="small muted">{s.issued.length} active</span>} />
              <Kpi label="Expiring in 30 days" value={s.expiring.length} icon="clock" tone={s.expiring.length ? 'red' : undefined}
                foot={<span className="small muted">{s.autoOffExpiring} with auto-renew off</span>} />
              <Kpi label="Awaiting validation" value={s.validating.length} icon="check" tone={s.validating.length ? 'amber' : undefined}
                foot={<Link className="small" href="/validation">Open validation center</Link>} />
              <Kpi label="Auto-renew coverage" value={`${Math.round(s.pctAuto * 100)}%`} icon="renew"
                foot={<div className="bar"><span style={{ width: `${Math.round(s.pctAuto * 100)}%` }} /></div>} />
            </div>

            <div className="row">
              <section className="card pad" style={{ flex: '2 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="between">
                  <div><h2>Expiry horizon</h2><div className="small muted">Active certificates reaching end of life, per week</div></div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--muted)' }}>
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span className="dot" style={{ borderRadius: 3, background: TONES.red }} />Under 2 weeks</span>
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span className="dot" style={{ borderRadius: 3, background: TONES.amber }} />2–4 weeks</span>
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span className="dot" style={{ borderRadius: 3, background: TONES.violet }} />Later</span>
                  </div>
                </div>
                <div role="img" aria-label={`Certificates expiring per week: ${s.weeks.map((w) => w.n).join(', ')}`}
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 10, alignItems: 'end', height: 180, borderBottom: '1px solid var(--line)' }}>
                  {s.weeks.map((w, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 6, height: '100%' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: w.n ? 'var(--ink)' : 'var(--muted)' }}>{w.n}</span>
                      <div style={{ width: '100%', height: w.n ? `${Math.max(6, (w.n / maxWeek) * 85)}%` : 2, background: w.n ? TONES[w.tone] : 'var(--line)', borderRadius: w.n ? '5px 5px 0 0' : 0 }} />
                    </div>
                  ))}
                </div>
                <div aria-hidden="true" className="mono" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 10, fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: -8 }}>
                  {s.weeks.map((w, i) => (
                    <span key={i}>{w.from.toLocaleDateString('en-GB', { day: 'numeric', month: i === 0 || w.from.getUTCDate() <= 7 ? 'short' : undefined, timeZone: 'UTC' })}</span>
                  ))}
                </div>
              </section>

              <section className="card pad" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div><h2>Certificate health</h2><div className="small muted">How resilient your setup is to outages</div></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  <div style={{ position: 'relative', width: 108, height: 108, flex: 'none' }}>
                    <svg width="108" height="108" viewBox="0 0 108 108" role="img" aria-label={`Health score ${s.health} out of 100`}>
                      <circle cx="54" cy="54" r="46" fill="none" stroke="var(--accent-soft)" strokeWidth="10" />
                      <circle cx="54" cy="54" r="46" fill="none" stroke={s.health < 60 ? 'var(--red-dot)' : 'var(--accent)'} strokeWidth="10" strokeLinecap="round"
                        strokeDasharray={`${(s.health / 100) * circ} ${circ}`} transform="rotate(-90 54 54)" />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em' }}>{s.health}</span>
                      <span className="small muted">of 100</span>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>
                    {s.health >= 85 ? 'Good.' : s.health >= 60 ? 'Fair.' : 'At risk.'} Turning on auto-renew and DNS validation everywhere brings this to 100.
                  </p>
                </div>
                <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                  <div className="between"><dt className="muted">Auto-renew on</dt><dd style={{ margin: 0, fontWeight: 600 }}>{s.autoOn} / {total}</dd></div>
                  <div className="between"><dt className="muted">DNS validation (reusable)</dt><dd style={{ margin: 0, fontWeight: 600 }}>{s.methods.DNS} / {total}</dd></div>
                  <div className="between"><dt className="muted">Expiring in 30 days</dt><dd style={{ margin: 0, fontWeight: 600 }}>{s.expiring.length}</dd></div>
                </dl>
              </section>
            </div>

            <div className="row">
              <section className="card" style={{ flex: '2 1 520px', minWidth: 0 }}>
                <div className="card-head"><h2>Needs your attention</h2><span className="small muted">{s.attention.length} open</span></div>
                {s.attention.length === 0 ? (
                  <Empty title="All clear">Nothing needs action right now.</Empty>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {s.attention.map((a, i) => (
                      <li key={i} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: i < s.attention.length - 1 ? '1px solid var(--line-soft)' : 0 }}>
                        <span className="dot" style={{ background: TONES[a.tone] }} />
                        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>{a.title}</div>
                          <div className="small muted">{a.sub}</div>
                        </div>
                        <Link href={a.href} className={`btn sm ${a.primary ? 'dark-btn' : ''}`}>{a.cta}</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="dark" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="eyebrow">INDUSTRY CHANGE · CA/B FORUM SC-081</div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, lineHeight: 1.3 }}>Maximum certificate life drops to 100 days on 15 Mar 2027</h2>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.03em' }}>{daysToCut}</span>
                  <span style={{ color: '#D4D4D8' }}>days to go</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="between" style={{ fontSize: 13, color: '#D4D4D8' }}><span>Your readiness</span><span>{s.methods.DNS} of {total} use DNS</span></div>
                  <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', gap: 2, background: '#3F3F46' }}>
                    <div style={{ width: `${(s.methods.DNS / total) * 100}%`, background: 'var(--accent-mid)' }} />
                    <div style={{ width: `${(s.methods.Email / total) * 100}%`, background: '#F59E0B' }} />
                    <div style={{ width: `${(s.methods.HTTP / total) * 100}%`, background: '#71717A' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#D4D4D8' }}>
                    <span>DNS {s.methods.DNS}</span><span>Email {s.methods.Email}</span><span>HTTP {s.methods.HTTP}</span>
                  </div>
                </div>
                <Link href="/renewals" className="btn" style={{ marginTop: 'auto' }}>Get ready</Link>
              </section>
            </div>

            <div className="row">
              <section className="card pad" style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <h2>Portfolio</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="between small muted"><span>By validation level</span><span>{total}</span></div>
                  <div className="stack">
                    <div style={{ width: `${(s.byValidation.dv / total) * 100}%`, background: 'var(--accent)' }} />
                    <div style={{ width: `${(s.byValidation.ov / total) * 100}%`, background: 'var(--accent-mid)' }} />
                    <div style={{ width: `${(s.byValidation.ev / total) * 100}%`, background: '#D9D2FF' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
                    <span><strong>{s.byValidation.dv}</strong> DV</span><span><strong>{s.byValidation.ov}</strong> OV</span><span><strong>{s.byValidation.ev}</strong> EV</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="between small muted"><span>By brand</span><span>{total}</span></div>
                  <div className="stack">
                    {Object.entries(s.byBrand).map(([b, n], i) => (
                      <div key={b} style={{ width: `${(n / total) * 100}%`, background: ['#18181B', '#52525B', '#A1A1AA', '#D4D4D8'][i % 4] }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12 }}>
                    {Object.entries(s.byBrand).map(([b, n]) => <span key={b}><strong>{n}</strong> {b}</span>)}
                  </div>
                </div>
              </section>

              <section className="card pad" style={{ flex: '2 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h2>Activity</h2>
                {events.length === 0 ? <span className="muted">No activity yet.</span> : (
                  <ol className="feed">
                    {events.map((e) => (
                      <li key={e.id}>
                        <span className="when">{fmtDateTime(e.created_at)}</span>
                        <span><span className="mono">{e.common_name}</span> · {e.message}{e.actor ? <span className="muted"> · {e.actor}</span> : null}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </>
  );
}
