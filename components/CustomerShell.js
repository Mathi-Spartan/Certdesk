import { Suspense } from 'react';
import Link from 'next/link';
import CustomerNav, { Crumbs } from './CustomerNav';
import { logout } from '@/app/actions/auth';
import { exitWorkspace } from '@/app/actions/admin';

function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

/** Customer console: white sidebar (workspace, jump search, nav, user) and a slim header bar. */
export default function CustomerShell({ user, workspace, counts, help, admin = false, children }) {
  const wsName = workspace?.name || 'Partner account';
  return (
    <div className="cx3">
      <aside className="cx3-side">
        <Link href={workspace ? '/orders' : '/partner'} className="cx3-ws" title={wsName}>
          <span className={`cx3-ws-mark ${workspace ? '' : 'accent'}`}>{initials(wsName)}</span>
          <span className="cx3-ws-text"><strong>{wsName}</strong><small>{workspace ? 'Customer account' : 'Master account'}</small></span>
        </Link>
        {workspace ? <form action="/orders" className="cx3-jump" role="search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <label className="sr" htmlFor="cx3-q">Search certificates</label>
          <input id="cx3-q" name="q" type="search" placeholder="Search domains or orders…" />
        </form> : null}
        <Suspense fallback={null}><CustomerNav counts={counts} partner={admin} workspace={!!workspace} /></Suspense>
        <details className="cx3-me">
          <summary>
            <span className="cx3-avatar">{initials(user.name)}</span>
            <span className="cx3-me-text"><strong>{user.name}</strong><small>{admin ? 'Partner admin' : user.email}</small></span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 15 5 5 5-5M7 9l5-5 5 5" /></svg>
          </summary>
          <div className="cx3-menu">
            <Link href="/account">Profile &amp; password</Link>
            {help ? <a href={help}>Contact support</a> : null}
            <form action={logout}><button type="submit">Sign out</button></form>
          </div>
        </details>
      </aside>
      <div className="cx3-body">
        <header className="cx3-bar">
          <Suspense fallback={<span />}><Crumbs workspace={wsName} /></Suspense>
          <div className="cx3-bar-actions">
            {help ? <a href={help} className="cx3-iconbtn" aria-label="Contact support" title="Contact support"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4M12 17h.01" /></svg></a> : null}
            {workspace ? <Link href="/order" className="cx3-buy">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              Buy certificate
            </Link> : null}
          </div>
        </header>
        {admin && workspace ? (
          <div className="cx3-asuser" role="status">
            <span><strong>Partner preview:</strong> you are seeing {workspace.name}&apos;s account exactly as their users see it.</span>
            <form action={exitWorkspace}><button type="submit" className="cx3-btn sm light">← Back to master account</button></form>
          </div>
        ) : null}
        <div className="cx3-main">{children}</div>
      </div>
    </div>
  );
}
