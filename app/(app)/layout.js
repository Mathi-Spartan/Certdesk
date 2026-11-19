import { requireUser } from '@/lib/auth';
import { one } from '@/lib/db';
import Link from 'next/link';
import SideNav from '@/components/SideNav';
import { supportEmail, helpHref } from '@/lib/support';
import Icon from '@/components/Icon';
import { logout } from '@/app/actions/auth';
import { exitWorkspace } from '@/app/actions/admin';
import CustomerShell from '@/components/CustomerShell';

export const dynamic = 'force-dynamic';

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export default async function AppLayout({ children }) {
  const ctx = await requireUser();
  const groups = [];

  let needs = 0;
  if (ctx.workspaceId) {
    const c = await one(
      `select
         (select count(*) from console.orders where workspace_id = $1 and (
            status in ('validating','incomplete','reissuing')
            or (status = 'issued' and (valid_till <= current_date + reminder_days or order_expires_at <= current_date + 30))))::int
       + (select count(*) from console.subscriptions where workspace_id = $1 and status = 'active' and cancel_requested_at is null
            and auto_renew = false and coalesce(next_renewal_at, end_at) <= now() + interval '30 days')::int as needs`,
      [ctx.workspaceId]
    );
    needs = c.needs;
    groups.push({
      items: [
        { href: '/dashboard', label: 'My SSL', icon: 'lock', count: needs || null, tone: needs ? 'red' : null },
        { href: '/orders', label: 'Order history', icon: 'receipt' },
        { href: '/account', label: 'Account', icon: 'key' }
      ]
    });
  }

  if (!ctx.isAdmin) {
    const help = helpHref(await supportEmail(), { subject: `Help with CertDesk · ${ctx.workspace?.name || ''}` });
    return <CustomerShell user={ctx.user} workspace={ctx.workspace} needs={needs} help={help}>{children}</CustomerShell>;
  }

  if (ctx.isAdmin) {
    groups.push({
      label: 'PARTNER',
      items: [
        { href: '/partner', label: 'Customer workspaces', icon: 'building' },
        { href: '/partner/catalogue', label: 'Catalogue', icon: 'list' },
        { href: '/partner/pricing', label: 'Customer prices', icon: 'receipt' },
        { href: '/partner/api', label: 'Provider API', icon: 'code' },
        { href: '/partner/endpoints', label: 'API v2 reference', icon: 'list' }
      ]
    });
    if (!ctx.workspaceId) groups.push({ label: 'ACCOUNT', items: [{ href: '/account', label: 'Account', icon: 'key' }] });
  }

  const wsName = ctx.workspace ? ctx.workspace.name : 'Partner account';
  const help = ctx.workspaceId && !ctx.isAdmin ? helpHref(await supportEmail(), { subject: `Help with CertDesk · ${wsName}` }) : null;
  return (
    <div className="shell">
      <aside className="side">
        <Link href="/" className="side-brand" aria-label="CertDesk home">
          <span className="side-brand-logo" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" /><path d="m9 12 2 2 4-4" /></svg>
          </span>
          <strong>CertDesk</strong>
        </Link>
        <div className="ws-card">
          <span className={`ws-badge ${ctx.workspace ? '' : 'violet'}`}>{initials(wsName)}</span>
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wsName}</span>
            <span className="small muted">{ctx.workspace ? (ctx.isAdmin ? 'Opened as partner' : 'Customer workspace') : 'Master account'}</span>
          </span>
        </div>
        {ctx.isAdmin && ctx.workspaceId ? (
          <form action={exitWorkspace}>
            <button className="btn sm" style={{ width: '100%' }} type="submit">Back to partner view</button>
          </form>
        ) : null}
        {ctx.workspaceId ? (
          <Link href="/order" className="side-order"><Icon name="plus" stroke="#fff" width={2.4} />Order SSL</Link>
        ) : null}
        <SideNav groups={groups} />
        {help ? <a className="help-link" href={help} style={{ marginTop: 'auto' }}><Icon name="info" />Need help? Message us</a> : null}
        <div className="side-foot" style={help ? { marginTop: 0 } : undefined}>
          <span className="avatar">{initials(ctx.user.name)}</span>
          <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{ctx.user.name}</span>
            <span className="small muted">{ctx.isAdmin ? 'Partner admin' : 'Customer'}</span>
          </span>
          <form action={logout}>
            <button type="submit" className="btn sm ghost" aria-label="Sign out" title="Sign out"><Icon name="out" /></button>
          </form>
        </div>
      </aside>
      <div className="main-col">{children}</div>
    </div>
  );
}
