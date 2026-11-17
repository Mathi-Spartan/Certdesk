import { requireUser } from '@/lib/auth';
import { one } from '@/lib/db';
import SideNav from '@/components/SideNav';
import Icon from '@/components/Icon';
import { logout } from '@/app/actions/auth';
import { exitWorkspace } from '@/app/actions/admin';

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

  if (ctx.workspaceId) {
    const c = await one(
      `select count(*) filter (where status not in ('cancelled','draft'))::int as total,
              count(*) filter (where status in ('validating','incomplete','reissuing'))::int as validating,
              count(*) filter (where status = 'issued' and valid_till <= current_date + 30)::int as expiring
         from console.orders where workspace_id = $1`,
      [ctx.workspaceId]
    );
    groups.push({
      items: [
        { href: '/', label: 'Overview', icon: 'overview' },
        { href: '/certificates', label: 'Certificates', icon: 'lock', count: c.total },
        { href: '/validation', label: 'Validation', icon: 'check', count: c.validating || null, tone: c.validating ? 'amber' : null },
        { href: '/renewals', label: 'Renewals & automation', icon: 'renew', count: c.expiring || null, tone: c.expiring ? 'red' : null },
        { label: 'Endpoint monitoring', icon: 'pulse', disabled: true },
        { href: '/orders', label: 'Orders & billing', icon: 'card' }
      ]
    });
    groups.push({ label: 'ACCOUNT', items: [{ href: '/account', label: 'Profile & password', icon: 'key' }] });
  }

  if (ctx.isAdmin) {
    groups.push({
      label: 'PARTNER',
      items: [
        { href: '/partner', label: 'Customer workspaces', icon: 'building' },
        { href: '/partner/catalogue', label: 'Catalogue', icon: 'list' },
        { href: '/partner/api', label: 'Provider API', icon: 'code' }
      ]
    });
    if (!ctx.workspaceId) groups.push({ label: 'ACCOUNT', items: [{ href: '/account', label: 'Profile & password', icon: 'key' }] });
  }

  const wsName = ctx.workspace ? ctx.workspace.name : 'Partner account';
  return (
    <div className="shell">
      <aside className="side">
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
        <SideNav groups={groups} />
        <div className="side-foot">
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
