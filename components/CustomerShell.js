import { Suspense } from 'react';
import Link from 'next/link';
import CustomerNav from './CustomerNav';
import { logout } from '@/app/actions/auth';

function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

/** Customer portal: navy top bar with search, white grouped sidebar (CertCentral-style). */
export default function CustomerShell({ user, workspace, counts, help, children }) {
  return (
    <div className="cc">
      <header className="cc-top">
        <Link href="/dashboard" className="cc-brand" aria-label="CertDesk dashboard">
          <span className="cc-logo" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" /><path d="m9 12 2 2 4-4" /></svg>
          </span>
          <strong>CertDesk</strong>
        </Link>
        <span className="cc-account" title="Your account">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1" /></svg>
          {workspace?.name}
        </span>
        <form action="/orders" className="cc-search" role="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <label className="sr" htmlFor="cc-q">Search orders</label>
          <input id="cc-q" name="q" type="search" placeholder="Search orders by domain or order number" />
        </form>
        <div className="cc-top-actions">
          <Link href="/order" className="cc-order">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Request certificate
          </Link>
          <details className="cc-user">
            <summary aria-label="Account menu"><span className="cc-avatar">{initials(user.name)}</span><span className="cc-user-name">{user.name}</span></summary>
            <div className="cc-menu">
              <div className="cc-menu-who"><strong>{user.name}</strong><span>{user.email}</span></div>
              <Link href="/account">Profile &amp; password</Link>
              {help ? <a href={help}>Contact support</a> : null}
              <form action={logout}><button type="submit">Sign out</button></form>
            </div>
          </details>
        </div>
      </header>
      <div className="cc-shell">
        <aside className="cc-side">
          <Suspense fallback={null}><CustomerNav counts={counts} /></Suspense>
          {help ? (
            <a href={help} className="cc-support">
              <span className="cc-support-ico" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg></span>
              <span><strong>Need a hand?</strong><small>Email your SSL team</small></span>
            </a>
          ) : null}
        </aside>
        <div className="cc-main">{children}</div>
      </div>
    </div>
  );
}
