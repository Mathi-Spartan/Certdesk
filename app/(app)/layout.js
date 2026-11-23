import { after } from 'next/server';
import { requireUser } from '@/lib/auth';
import { maybeImportNew } from '@/lib/autosync';
import { RENEWED_SQL } from '@/lib/orders';
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
         (select count(*) from console.orders o where workspace_id = $1 and status = 'issued' and valid_till <= now() + interval '30 days' and not ${RENEWED_SQL})::int as expiring,
         (select count(*) from console.subscriptions where workspace_id = $1 and status not in ('cancelled','expired'))::int as auto,
         (select count(*) from console.orders where workspace_id = $1 and status in ('validating','incomplete','reissuing'))::int as validation,
         (select count(*) from console.orders o where workspace_id = $1 and (status in ('validating','incomplete','reissuing') or (status = 'issued' and (valid_till <= now() + interval '30 days' or order_expires_at <= now() + interval '30 days')) or (status = 'expired' and order_expires_at >= now() - interval '30 days')) and not ${RENEWED_SQL})::int as attention`,
      [ctx.workspaceId]
    );
    counts = { all: c.total, expiring: c.expiring, auto: c.auto, validation: c.validation, renewals: c.expiring, attention: c.attention };
  }
  // Master account in use: check GoGetSSL for new orders in the background (at most every 10 minutes).
  if (ctx.isAdmin) after(() => maybeImportNew().catch(() => {}));
  if (ctx.isAdmin && !ctx.workspaceId) {
    try {
      const s = await one(`select count(*)::int as n from console.assist_conversations where status = 'waiting' or (status = 'human' and unread_admin > 0)`);
      counts = { support: s?.n || 0 };
    } catch {
      counts = {};
    }
  }
  const help = ctx.isAdmin ? null : helpHref(await supportEmail(), { subject: `Help with CertDesk · ${ctx.workspace?.name || ''}` });
  return (
    <CustomerShell user={ctx.user} workspace={ctx.workspaceId ? ctx.workspace : null} counts={counts} help={help} admin={ctx.isAdmin}>
      {children}
    </CustomerShell>
  );
}
