'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from './Icon';

function isOn(pathname, href) {
  if (href === '/') return pathname === '/' || pathname.startsWith('/certificates') || /^\/subscriptions\/[0-9a-f-]{36}/.test(pathname);
  if (href === '/partner') return pathname === '/partner' || pathname.startsWith('/partner/workspaces');
  return pathname === href || pathname.startsWith(href + '/');
}

export default function SideNav({ groups }) {
  const pathname = usePathname() || '/';
  return (
    <>
      {groups.map((g) => (
        <nav key={g.label || 'main'} aria-label={g.label || 'Main'} className="nav">
          {g.label ? <div className="nav-label">{g.label}</div> : null}
          {g.items.map((it) =>
            it.disabled ? (
              <a key={it.label} className="disabled" aria-disabled="true">
                <Icon name={it.icon} />
                <span className="grow">{it.label}</span>
                <span className="small">Soon</span>
              </a>
            ) : (
              <Link key={it.href} href={it.href} className={isOn(pathname, it.href) ? 'on' : ''}>
                <Icon name={it.icon} />
                <span className="grow">{it.label}</span>
                {it.count != null ? (
                  it.tone ? (
                    <span className={`pill-count tone-${it.tone}`}>{it.count}</span>
                  ) : (
                    <span className="count">{it.count}</span>
                  )
                ) : null}
              </Link>
            )
          )}
        </nav>
      ))}
    </>
  );
}
