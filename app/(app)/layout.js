import { requireUser } from '@/lib/auth';
import { one } from '@/lib/db';
import { supportEmail, helpHref } from '@/lib/support';
import CustomerShell from '@/components/CustomerShell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }) {
  const ctx = await requireUser();

  let counts = {};
  if (ctx.workspaceId) {
    const c = await one(
      `select
         (select count(*) from console.orders where workspace_id = $1 and status not in ('cancelled','draft'))::int
           + (select count(*) from console.subscriptions where workspace_id = $1 and status not in ('cancelled','expired'))::int as total,
         (select count(*) from console.orders where workspace_id = $1 and status = 'issued' and valid_till <= now() + interval '30 days')::int as expiring,
         (select count(*) from console.subscriptions where workspace_id = $1 and status not in ('cancelled','expired'))::int as auto,
         (select count(*) from console.orders where workspace_id = $1 and status in ('validating','incomplete','reissuing'))::int as validation`,
      [ctx.workspaceId]
    );
    counts = { all: c.total, expiring: c.expiring, auto: c.auto, validation: c.validation, renewals: c.expiring };
  }
  const help = ctx.isAdmin ? null : helpHref(await supportEmail(), { subject: `Help with CertDesk · ${ctx.workspace?.name || ''}` });
  return (
    <CustomerShell user={ctx.user} workspace={ctx.workspaceId ? ctx.workspace : null} counts={counts} help={help} admin={ctx.isAdmin}>
      {children}
    </CustomerShell>
  );
}
