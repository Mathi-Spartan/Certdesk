import Link from 'next/link';
import CustomerNav from './CustomerNav';
import { logout } from '@/app/actions/auth';

function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

/** The customer portal: a light top-navigation layout, separate from the partner console. */
export default function CustomerShell({ user, workspace, needs, help, children }) {
  return (
    <div className="cx">
      <header className="cx-head">
        <div className="cx-head-in">
          <Link href="/dashboard" className="cx-brand" aria-label="CertDesk home">
            <span className="cx-logo" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" /><path d="m9 12 2 2 4-4" /></svg>
            </span>
            <span className="cx-brand-text">
              <strong>CertDesk</strong>
              <span>{workspace?.name}</span>
            </span>
          </Link>
          <CustomerNav needs={needs} />
          <div className="cx-actions">
            {help ? <a href={help} className="cx-help">Help</a> : null}
            <Link href="/order" className="cx-order">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              Order SSL
            </Link>
            <details className="cx-user">
              <summary aria-label="Account menu"><span className="cx-avatar">{initials(user.name)}</span></summary>
              <div className="cx-menu">
                <div className="cx-menu-who"><strong>{user.name}</strong><span>{user.email}</span></div>
                <Link href="/account">Account & password</Link>
                <Link href="/orders">Order history</Link>
                <form action={logout}><button type="submit">Sign out</button></form>
              </div>
            </details>
          </div>
        </div>
      </header>
      <div className="cx-body">{children}</div>
      <footer className="cx-foot">
        <span>© {new Date().getFullYear()} CertDesk</span>
        <span>Certificates are issued by globally trusted certificate authorities.</span>
      </footer>
    </div>
  );
}
