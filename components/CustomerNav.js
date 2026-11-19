'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const I = {
  dash: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  alert: <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h.01" /></>,
  loop: <path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />,
  plus: <path d="M12 5v14M5 12h14" />,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  key: <><circle cx="8" cy="15" r="4" /><path d="m10.8 12.2 9.2-9.2M17 6l3 3" /></>,
  doc: <><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  shield: <><path d="M12 3 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6z" /><path d="m9 12 2 2 4-4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>,
  swap: <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>
};

function Ico({ n }) {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[n]}</svg>;
}

export default function CustomerNav({ counts = {} }) {
  const path = usePathname() || '';
  const sp = useSearchParams();
  const f = sp?.get('f') || '';
  const groups = [
    { items: [{ href: '/dashboard', label: 'Dashboard', icon: 'dash', on: path === '/dashboard' }] },
    {
      label: 'Certificates',
      items: [
        { href: '/orders', label: 'Orders', icon: 'list', on: (path === '/orders' && !f) || path.startsWith('/certificates') || /^\/subscriptions\/[0-9a-f-]{36}/.test(path), n: counts.all },
        { href: '/orders?f=action', label: 'Needs action', icon: 'alert', on: path === '/orders' && f === 'action', n: counts.action, tone: 'red' },
        { href: '/orders?f=expiring', label: 'Expiring soon', icon: 'clock', on: path === '/orders' && f === 'expiring', n: counts.expiring, tone: 'amber' },
        { href: '/orders?f=auto', label: 'Automated SSL', icon: 'loop', on: path === '/orders' && f === 'auto', n: counts.auto }
      ]
    },
    {
      label: 'Request',
      items: [
        { href: '/buy', label: 'New certificate', icon: 'plus', on: path.startsWith('/buy') || path === '/order' },
        { href: '/subscriptions/new', label: 'Automated SSL', icon: 'bolt', on: path === '/subscriptions/new' }
      ]
    },
    {
      label: 'Tools',
      items: [
        { href: '/tools/csr', label: 'CSR generator', icon: 'key', on: path === '/tools/csr' },
        { href: '/tools/csr-decoder', label: 'CSR decoder', icon: 'doc', on: path === '/tools/csr-decoder' },
        { href: '/tools/cert-decoder', label: 'Certificate decoder', icon: 'shield', on: path === '/tools/cert-decoder' },
        { href: '/tools/converter', label: 'Certificate converter', icon: 'swap', on: path === '/tools/converter' },
        { href: '/tools/ssl-checker', label: 'SSL checker', icon: 'search', on: path === '/tools/ssl-checker' },
        { label: 'Key matcher', icon: 'link', soon: true }
      ]
    },
    {
      label: 'Account',
      items: [
        { href: '/account', label: 'Profile & password', icon: 'user', on: path === '/account' },
        { label: 'Domains', icon: 'globe', soon: true },
        { label: 'Users', icon: 'users', soon: true },
        { label: 'Billing', icon: 'card', soon: true }
      ]
    }
  ];
  return (
    <nav aria-label="Main" className="cc-nav">
      {groups.map((g, gi) => (
        <div key={gi} className="cc-group">
          {g.label ? <div className="cc-label">{g.label}</div> : null}
          {g.items.map((i) =>
            i.soon ? (
              <span key={i.label} className="cc-link soon" aria-disabled="true"><Ico n={i.icon} />{i.label}<em>Soon</em></span>
            ) : (
              <Link key={i.label} href={i.href} className={`cc-link ${i.on ? 'on' : ''}`} aria-current={i.on ? 'page' : undefined}>
                <Ico n={i.icon} />{i.label}
                {i.n ? <span className={`cc-n ${i.tone || ''}`}>{i.n}</span> : null}
              </Link>
            )
          )}
        </div>
      ))}
    </nav>
  );
}
