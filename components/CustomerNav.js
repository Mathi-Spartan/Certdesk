'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/dashboard', label: 'My SSL', match: (p) => p === '/dashboard' || p.startsWith('/certificates') || /^\/subscriptions\/[0-9a-f-]{36}/.test(p) },
  { href: '/order', label: 'Buy', match: (p) => p === '/order' || p.startsWith('/buy') || p === '/subscriptions/new' },
  { href: '/orders', label: 'Orders', match: (p) => p === '/orders' },
  { href: '/account', label: 'Account', match: (p) => p === '/account' }
];

export default function CustomerNav({ needs }) {
  const path = usePathname() || '';
  return (
    <nav className="cx-nav" aria-label="Main">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} className={i.match(path) ? 'on' : ''} aria-current={i.match(path) ? 'page' : undefined}>
          {i.label}
          {i.href === '/dashboard' && needs ? <span className="cx-badge" aria-label={`${needs} need attention`}>{needs}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
