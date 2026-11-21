'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const I = {
  certs: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  order: <><path d="M12 5v14M5 12h14" /></>,
  help: <><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" /></>,
  tools: <><path d="M14.7 6.3a4 4 0 0 0 5 5L22 14l-8 8-2.3-2.3a4 4 0 0 0-5-5L4 12l8-8z" transform="scale(.9) translate(1 1)" /></>,
  account: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>
};
const Ico = ({ n }) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[n]}</svg>;

/** Phone navigation: thumb-reachable tabs at the bottom of the screen. */
export default function MobileTabBar({ attention = 0 }) {
  const p = usePathname() || '';
  const tabs = [
    { href: '/orders', label: 'Certificates', icon: 'certs', on: p === '/orders' || p.startsWith('/certificates') || p.startsWith('/subscriptions/') || p === '/renewals' || p === '/validation', n: attention },
    { href: '/order', label: 'Order', icon: 'order', on: p === '/order' || p.startsWith('/buy') || p === '/subscriptions/new' },
    { help: true, label: 'Nunmathi', icon: 'help' },
    { href: '/tools', label: 'Tools', icon: 'tools', on: p.startsWith('/tools') },
    { href: '/account', label: 'Account', icon: 'account', on: p === '/account' }
  ];
  return (
    <nav className="mt-bar" aria-label="Main">
      {tabs.map((t) => t.help ? (
        <button key="help" type="button" className="mt-tab mt-help" onClick={() => window.dispatchEvent(new Event('assist:open'))}>
          <span className="mt-ico"><Ico n={t.icon} /></span><span>{t.label}</span>
        </button>
      ) : (
        <Link key={t.href} href={t.href} className={`mt-tab ${t.on ? 'on' : ''}`} aria-current={t.on ? 'page' : undefined}>
          <span className="mt-ico"><Ico n={t.icon} />{t.n ? <em>{t.n > 99 ? '99+' : t.n}</em> : null}</span><span>{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
