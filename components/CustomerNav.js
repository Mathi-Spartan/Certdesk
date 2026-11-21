'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const I = {
  dash: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  check: <><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></>,
  renew: <><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></>,
  cart: <><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L22 7H6" /></>,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m10.8 12.2 9.2-9.2M17 6l3 3" /></>,
  doc: <><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  shield: <><path d="M12 3 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6z" /><path d="m9 12 2 2 4-4" /></>,
  swap: <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
  building: <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1" />,
  wallet: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M16 15h2" /></>,
  tag: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  code: <path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14" />,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" /><path d="M4 19.5V21h16" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>
};

function Ico({ n }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[n]}</svg>;
}

const isCert = (p) => p === '/orders' || p.startsWith('/certificates') || /^\/subscriptions\/[0-9a-f-]{36}/.test(p);

export default function CustomerNav({ counts = {}, partner = false, workspace = true }) {
  const path = usePathname() || '';
  // Customer (user) accounts: a deliberately small menu — their orders, and ordering new ones.
  const customer = [
    {
      items: [
        { href: '/orders', label: 'My certificates', icon: 'lock', on: isCert(path) || path === '/validation' || path === '/renewals', n: counts.all, tone: 'plain' },
        { href: '/order', label: 'Order new certificate', icon: 'cart', on: path === '/order' || path.startsWith('/buy') || path === '/subscriptions/new' },
        { href: '/tools', label: 'Tools', icon: 'search', on: path.startsWith('/tools') }
      ]
    }
  ];
  const partnerGroup = {
    label: 'Partner',
    items: [
      { href: '/partner', label: 'Customer workspaces', icon: 'building', on: path === '/partner' || path.startsWith('/partner/workspaces') },
      { href: '/partner/orders', label: 'All orders', icon: 'lock', on: path === '/partner/orders' },
      { href: '/partner/catalogue', label: 'Catalogue', icon: 'grid', on: path === '/partner/catalogue' },
      { href: '/partner/pricing', label: 'Customer prices', icon: 'tag', on: path === '/partner/pricing' },
      { href: '/partner/billing', label: 'Billing', icon: 'wallet', on: path === '/partner/billing' },
      { href: '/partner/api', label: 'Provider API', icon: 'code', on: path === '/partner/api' },
      { href: '/partner/endpoints', label: 'API v2 reference', icon: 'book', on: path === '/partner/endpoints' },
      { href: '/account', label: 'Profile & password', icon: 'user', on: path === '/account' }
    ]
  };
  const groups = workspace ? customer : partner ? [partnerGroup] : [];
  return (
    <nav aria-label="Main" className="cx3-nav">
      {groups.map((g, gi) => (
        <div key={gi} className="cx3-group">
          {g.label ? <div className="cx3-label">{g.label}</div> : null}
          {g.items.map((i) => (
            <Link key={i.href} href={i.href} className={`cx3-link ${i.on ? 'on' : ''}`} aria-current={i.on ? 'page' : undefined}>
              <Ico n={i.icon} /><span>{i.label}</span>
              {i.n ? <em className={`cx3-n ${i.tone}`}>{i.n}</em> : null}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

const TITLES = [
  [(p) => p === '/dashboard', 'My certificates'],
  [(p) => p === '/orders', 'My certificates'],
  [(p) => p.startsWith('/certificates/'), 'My certificates', 'Certificate'],
  [(p) => p === '/subscriptions/new', 'Order', 'Automation plan'],
  [(p) => p.startsWith('/subscriptions/'), 'Certificates', 'Automated SSL'],
  [(p) => p === '/validation', 'Validation'],
  [(p) => p === '/renewals', 'Reissues & renewals'],
  [(p) => p.startsWith('/buy') || p === '/order', 'Order', 'SSL certificate'],
  [(p) => p === '/tools', 'Tools'],
  [(p) => p === '/tools/finder', 'Tools', 'SSL Finder'],
  [(p) => p.startsWith('/tools/'), 'Tools', null],
  [(p) => p === '/account', 'Profile & password'],
  [(p) => p === '/partner', 'Partner', 'Customer workspaces'],
  [(p) => p.startsWith('/partner/workspaces'), 'Partner', 'Workspace'],
  [(p) => p === '/partner/orders', 'Partner', 'All orders'],
  [(p) => p === '/partner/catalogue', 'Partner', 'Catalogue'],
  [(p) => p === '/partner/pricing', 'Partner', 'Customer prices'],
  [(p) => p === '/partner/api', 'Partner', 'Provider API'],
  [(p) => p === '/partner/endpoints', 'Partner', 'API v2 reference']
];
const TOOL = { 'ssl-checker': 'SSL checker', csr: 'CSR generator', 'csr-decoder': 'CSR decoder', 'cert-decoder': 'Certificate decoder', converter: 'Format converter' };

/** Breadcrumb for the header bar, derived from the current path. */
export function Crumbs({ workspace }) {
  const path = usePathname() || '';
  const sp = useSearchParams();
  const hit = TITLES.find(([t]) => t(path));
  let parts = hit ? [hit[1], hit[2]].filter(Boolean) : [];
  if (path.startsWith('/tools/')) parts = ['Tools', TOOL[path.split('/')[2]] || 'Tool'];
  if (path === '/orders' && sp?.get('f')) parts = ['Certificates', { action: 'Needs action', expiring: 'Expiring soon', auto: 'Automated SSL', pending: 'In progress', closed: 'Closed' }[sp.get('f')] || 'Filtered'];
  return (
    <nav aria-label="Breadcrumb" className="cx3-crumbs">
      <span>{workspace}</span>
      {parts.map((p, i) => (
        <span key={i} className={i === parts.length - 1 ? 'here' : ''}><i aria-hidden="true">/</i>{i === 0 && parts.length > 1 ? <Link href={p === 'Tools' ? '/tools' : p === 'Certificates' ? '/orders' : p === 'Partner' ? '/partner' : '/order'}>{p}</Link> : p}</span>
      ))}
    </nav>
  );
}
