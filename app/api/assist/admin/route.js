import { getContext } from '@/lib/auth';
import { one } from '@/lib/db';
import { messagesAfter } from '@/lib/assist/store';

export const dynamic = 'force-dynamic';

/** Master account: poll one conversation for new messages while the thread page is open. */
export async function GET(req) {
  const ctx = await getContext();
  if (!ctx?.isAdmin) return Response.json({ error: 'Not allowed' }, { status: 403 });
  const u = new URL(req.url);
  const id = u.searchParams.get('c');
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) return Response.json({ error: 'Bad id' }, { status: 400 });
  const conv = await one('select id, status, unread_admin from console.assist_conversations where id = $1', [id]);
  if (!conv) return Response.json({ error: 'Not found' }, { status: 404 });
  const messages = await messagesAfter(id, u.searchParams.get('after'));
  return Response.json({ conversation: conv, messages }, { headers: { 'Cache-Control': 'no-store' } });
}
