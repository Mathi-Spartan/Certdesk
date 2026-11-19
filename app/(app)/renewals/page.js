import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { loadPortfolio } from '@/lib/portfolio';
import { fmtDate } from '@/components/ui';
import { SubPeriod, CertExpiry } from '@/components/SubPeriod';

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
  const certs = live.filter((i) => i.type === 'cert' && (i.cert?.at || i.sub));
  // Two clocks: a certificate expiring inside an active subscription is a free REISSUE;
  // only a subscription that is ending needs a RENEWAL (a new purchase).
  const reissueSoon = certs
    .filter((i) => i.cert?.at && i.cert.days <= 90 && i.sub && !i.sub.ended && i.sub.coversBeyondCert)
    .sort((a, b) => a.cert.days - b.cert.days);
  const renewSoon = certs
    .filter((i) => i.sub ? i.sub.days <= 90 && !i.sub.coversBeyondCert || (i.sub.ended && i.sub.days >= -30) : i.cert?.days <= 90)
    .filter((i) => !reissueSoon.includes(i))
    .sort((a, b) => (a.sub?.days ?? a.cert?.days) - (b.sub?.days ?? b.cert?.days));
  const nextCert = certs.filter((i) => i.cert?.days > 90).sort((a, b) => a.cert.days - b.cert.days)[0];
  const nextSub = certs.filter((i) => i.sub && i.sub.days > 90).sort((a, b) => a.sub.days - b.sub.days)[0];
  const subs = live.filter((i) => i.type === 'auto');
  const automated = live.filter((i) => i.type === 'auto' || i.autoRenew).length;
  const to100 = Math.max(0, Math.ceil((new Date('2027-03-15T00:00:00Z') - Date.now()) / DAY));

  const Row = ({ i, kind }) => {
    const hot = kind === 'reissue' ? i.cert.days <= 30 : (i.sub?.days ?? i.cert?.days) <= 30;
    const cta = kind === 'reissue'
      ? (i.next?.cta === 'Validate' ? { label: 'Validate', href: i.next.href } : { label: 'Reissue', href: `/certificates/${i.id}/reissue` })
      : { label: 'Renew', href: `/buy?renew=${i.id}` };
    return (
      <tr>
        <td><Link href={i.href} className="cx3-cn">{i.domain}</Link><div className="cx3-sub">{i.product}</div></td>
        <td>{i.cert?.at ? <CertExpiry at={i.cert.at} days={i.cert.days} hot={kind === 'reissue' && hot} /> : <span className="cx3-sub">Not issued</span>}</td>
        <td><SubPeriod sub={i.sub} /></td>
        <td className="cx3-sub">{i.next?.text}</td>
        <td className="cx3-actions"><Link className={`cx3-btn sm ${hot ? 'dark' : ''}`} href={cta.href}>{cta.label}</Link></td>
      </tr>
    );
  };
  const Head = () => <thead><tr><th>Common name</th><th>Certificate expires</th><th>Subscription</th><th>What happens next</th><th><span className="sr">Actions</span></th></tr></thead>;

  return (
    <main className="cx3-page">
      <div className="cx3-head">
        <div>
          <h1>Reissues, renewals &amp; automation</h1>
          <p>Reissue free while the subscription runs. Renew only when the subscription ends.</p>
        </div>
        <Link className="cx3-btn primary" href="/subscriptions/new">Start an automation plan</Link>
      </div>

      <div className="cx3-kpis">
        <div className="cx3-kpi"><div className="cx3-kpi-top"><span>Auto-renew coverage</span></div><b>{pct(automated, live.length)}%</b><div className="cx3-meter"><span style={{ width: `${pct(automated, live.length)}%` }} /></div></div>
        <div className="cx3-kpi"><div className="cx3-kpi-top"><span>Reissues due · 90 days</span></div><b className={reissueSoon.some((i) => i.cert.days <= 30) ? 't-red' : ''}>{reissueSoon.length}</b><small>Free, inside the subscription</small></div>
        <div className="cx3-kpi"><div className="cx3-kpi-top"><span>Renewals due · 90 days</span></div><b className={renewSoon.length ? 't-red' : ''}>{renewSoon.length}</b><small>Subscription ending</small></div>
        <div className="cx3-kpi"><div className="cx3-kpi-top"><span>Until 100-day certificates</span></div><b>{to100}</b><small>days · from 15 Mar 2027</small></div>
      </div>

      <section className="cx3-card">
        <div className="cx3-card-head cx3-pad-h"><div><h2>Reissue due</h2><p className="cx3-muted">Certificate expiring within 90 days, subscription still running. Reissue at no cost.</p></div><span className="cx3-muted">{reissueSoon.length}</span></div>
        {reissueSoon.length === 0 ? <div className="cx3-clear"><span><strong>No reissues due in the next 90 days.</strong> {nextCert ? `Next certificate expiry: ${nextCert.domain} on ${fmtDate(nextCert.cert.at)}.` : ''}</span></div> : (
          <div className="cx3-table-wrap flush">
            <table className="cx3-table"><Head /><tbody>{reissueSoon.map((i) => <Row key={i.id} i={i} kind="reissue" />)}</tbody></table>
          </div>
        )}
      </section>

      <section className="cx3-card">
        <div className="cx3-card-head cx3-pad-h"><div><h2>Renewal due</h2><p className="cx3-muted">The whole subscription ends within 90 days. Renew to keep the site covered.</p></div><span className="cx3-muted">{renewSoon.length}</span></div>
        {renewSoon.length === 0 ? <div className="cx3-clear"><span><strong>No subscriptions end in the next 90 days.</strong> {nextSub ? `Next subscription end: ${nextSub.domain} on ${fmtDate(nextSub.sub.end)}.` : ''}</span></div> : (
          <div className="cx3-table-wrap flush">
            <table className="cx3-table"><Head /><tbody>{renewSoon.map((i) => <Row key={i.id} i={i} kind="renew" />)}</tbody></table>
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
