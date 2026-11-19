import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { loadPortfolio } from '@/lib/portfolio';
import { fmtDate } from '@/components/ui';

export const metadata = { title: 'Renewals & automation · CertDesk' };

const DAY = 86400000;
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const LIFE = [
  { when: 'Until 15 Mar 2026', days: 398 },
  { when: 'From 15 Mar 2026', days: 200, now: true },
  { when: 'From 15 Mar 2027', days: 100 },
  { when: 'From 15 Mar 2029', days: 47 }
];

export default async function Renewals() {
  const ctx = await requireWorkspace();
  const p = await loadPortfolio(ctx.workspaceId);
  const live = p.live;
  const certs = live.filter((i) => i.type === 'cert' && i.date?.at).sort((a, b) => a.date.days - b.date.days);
  const soon = certs.filter((i) => i.date.days <= 90);
  const later = certs.filter((i) => i.date.days > 90);
  const subs = live.filter((i) => i.type === 'auto');
  const automated = live.filter((i) => i.type === 'auto' || i.autoRenew).length;
  const to100 = Math.max(0, Math.ceil((new Date('2027-03-15T00:00:00Z') - Date.now()) / DAY));

  const Row = ({ i }) => {
    const hot = i.date.days <= 30;
    const cta = i.next?.cta ? { label: i.next.cta, href: i.next.href } : { label: 'Renew', href: `/buy?renew=${i.id}` };
    return (
      <tr>
        <td><Link href={i.href} className="cx3-cn">{i.domain}</Link><div className="cx3-sub">{i.product}</div></td>
        <td><div className={hot ? 't-red' : ''} style={{ fontWeight: 600 }}>{i.date.days < 0 ? `Expired ${-i.date.days} days ago` : `${i.date.days} days`}</div><div className="cx3-sub">{fmtDate(i.date.at)}</div></td>
        <td><span className={`cx3-flag ${i.autoRenew ? 'on' : ''}`}>{i.autoRenew ? 'On' : 'Off'}</span></td>
        <td className="cx3-sub">{i.next?.text}</td>
        <td className="cx3-actions"><Link className={`cx3-btn sm ${hot ? 'dark' : ''}`} href={cta.href}>{cta.label}</Link></td>
      </tr>
    );
  };

  return (
    <main className="cx3-page">
      <div className="cx3-head">
        <div>
          <h1>Renewals &amp; automation</h1>
          <p>Keep every site covered as certificate lifetimes shrink.</p>
        </div>
        <Link className="cx3-btn primary" href="/subscriptions/new">Start an automation plan</Link>
      </div>

      <div className="cx3-kpis">
        <div className="cx3-kpi"><div className="cx3-kpi-top"><span>Auto-renew coverage</span></div><b>{pct(automated, live.length)}%</b><div className="cx3-meter"><span style={{ width: `${pct(automated, live.length)}%` }} /></div></div>
        <div className="cx3-kpi"><div className="cx3-kpi-top"><span>Expiring in 30 days</span></div><b className={certs.filter((i) => i.date.days <= 30).length ? 't-red' : ''}>{certs.filter((i) => i.date.days <= 30).length}</b><small>Manual certificates</small></div>
        <div className="cx3-kpi"><div className="cx3-kpi-top"><span>Automation plans</span></div><b>{subs.length}</b><small>Install and renew on their own</small></div>
        <div className="cx3-kpi"><div className="cx3-kpi-top"><span>Until 100-day certificates</span></div><b>{to100}</b><small>days · from 15 Mar 2027</small></div>
      </div>

      <section className="cx3-card">
        <div className="cx3-card-head cx3-pad-h"><h2>Due in the next 90 days</h2><span className="cx3-muted">{soon.length} certificate{soon.length === 1 ? '' : 's'}</span></div>
        {soon.length === 0 ? <div className="cx3-clear"><span><strong>Nothing is due in the next 90 days.</strong> {later.length ? `Next expiry: ${later[0].domain} on ${fmtDate(later[0].date.at)}.` : ''}</span></div> : (
          <div className="cx3-table-wrap flush">
            <table className="cx3-table">
              <thead><tr><th>Common name</th><th>Expires</th><th>Auto-renew</th><th>What happens next</th><th><span className="sr">Actions</span></th></tr></thead>
              <tbody>{soon.map((i) => <Row key={i.id} i={i} />)}</tbody>
            </table>
          </div>
        )}
      </section>

      <div className="cx3-grid two">
        <section className="cx3-card">
          <div className="cx3-card-head cx3-pad-h"><h2>Automated SSL</h2><Link href="/orders?f=auto" className="cx3-link-sm">View all</Link></div>
          {subs.length === 0 ? (
            <div className="cx3-clear"><span><strong>No automation plans yet.</strong> A plan installs and renews certificates for you, so the shorter lifetimes need no extra work.</span></div>
          ) : (
            <ul className="cx3-list">
              {subs.map((s) => (
                <li key={s.id}>
                  <span className={`cx3-dot ${s.group === 'ok' ? 'green' : s.group === 'action' ? 'amber' : 'accent'}`} />
                  <div>
                    <div className="cx3-li-title"><span className="mono">{s.domain}</span> {s.extra ? <span className="cx3-muted">{s.extra}</span> : null}</div>
                    <div className="cx3-li-sub">{s.product} · {s.date?.at ? `${s.date.label} ${fmtDate(s.date.at)}` : s.next.text}</div>
                  </div>
                  <Link className={`cx3-btn sm ${s.next?.cta ? 'dark' : ''}`} href={s.next?.cta ? s.next.href : s.href}>{s.next?.cta || 'Manage'}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="cx3-card cx3-dark">
          <div className="cx3-kicker">CA/B FORUM SC-081 · MAXIMUM LIFETIME</div>
          <h2>Certificates will need replacing up to eight times a year</h2>
          <div className="cx3-life">
            {LIFE.map((l) => (
              <div key={l.when} className={l.now ? 'now' : ''}>
                <div className="cx3-life-top"><span>{l.when}</span>{l.now ? <em>Now</em> : null}</div>
                <div className="cx3-life-bar"><i style={{ width: `${(l.days / 398) * 100}%` }} /></div>
                <b>{l.days} days</b>
              </div>
            ))}
          </div>
          <Link href="/subscriptions/new" className="cx3-btn light">Automate a domain</Link>
        </section>
      </div>
    </main>
  );
}
