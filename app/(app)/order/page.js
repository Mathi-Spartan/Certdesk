import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import TopBar from '@/components/TopBar';
import Icon from '@/components/Icon';

export const metadata = { title: 'Order SSL · CertDesk' };

const ROWS = [
  ['Who renews it', 'You reissue and renew from this dashboard', 'Renews and reissues automatically'],
  ['Who installs it', 'You download it and install it on your server', 'The AutoInstall agent, or your ACME client'],
  ['Domains', 'One domain, a wildcard, or several names on one certificate', 'One domain per plan, or many with ACME'],
  ['Best for', 'A few sites, or servers where you control installs', 'Many sites, and the move to 100-day certificates']
];

export default async function OrderSsl() {
  await requireWorkspace();
  return (
    <>
      <TopBar crumbs={[{ label: 'Order SSL' }]} />
      <main className="page" style={{ maxWidth: 1000 }}>
        <div>
          <h1 className="title">What would you like to order?</h1>
          <p className="sub">Pick one. You can always order the other type later.</p>
        </div>

        <div className="order-choice">
          <Link href="/buy" className="order-card">
            <span className="oc-icon"><Icon name="lock" size={22} /></span>
            <span className="oc-title">SSL certificate</span>
            <span className="oc-text">A certificate you install yourself. We guide you through validation, then you download it.</span>
            <ul>
              <li><Icon name="tick" size={14} />DV, OV and EV, single, wildcard or multi-domain</li>
              <li><Icon name="tick" size={14} />Free reissues while the order runs</li>
              <li><Icon name="tick" size={14} />Create the CSR in your browser if you need one</li>
            </ul>
            <span className="btn" style={{ alignSelf: 'flex-start' }}>Order a certificate<Icon name="arrow" /></span>
          </Link>
          <Link href="/subscriptions/new" className="order-card featured">
            <span className="oc-badge">Recommended</span>
            <span className="oc-icon"><Icon name="loop" size={22} /></span>
            <span className="oc-title">Automated SSL</span>
            <span className="oc-text">A subscription that keeps your sites covered on its own. No reissues or renewals to remember.</span>
            <ul>
              <li><Icon name="tick" size={14} />Plan + Automate: installed for you by AutoInstall SSL</li>
              <li><Icon name="tick" size={14} />ACME CaaS: unlimited certificates for your own ACME client</li>
              <li><Icon name="tick" size={14} />Ready for 100-day certificates in 2027</li>
            </ul>
            <span className="btn primary" style={{ alignSelf: 'flex-start' }}>Start a subscription<Icon name="arrow" stroke="#fff" /></span>
          </Link>
        </div>

        <section className="card">
          <div className="card-head"><h2>Not sure? Compare</h2></div>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th /><th>SSL certificate</th><th>Automated SSL</th></tr></thead>
              <tbody>
                {ROWS.map(([k, a, b]) => (
                  <tr key={k}><td style={{ fontWeight: 600 }}>{k}</td><td>{a}</td><td>{b}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
