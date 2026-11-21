import { q, one } from '../db';

export const MSG_COLS = 'id, role, body, data, intent, matched, helpful, created_at';

export async function openConversation(ctx) {
  return one(
    `select * from console.assist_conversations
      where workspace_id = $1 and user_id = $2 and status <> 'resolved' and last_message_at > now() - interval '7 days'
      order by last_message_at desc limit 1`,
    [ctx.workspaceId, ctx.user.id]
  );
}

export async function getConversation(ctx, id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) return null;
  return one('select * from console.assist_conversations where id = $1 and workspace_id = $2', [id, ctx.workspaceId]);
}

export async function createConversation(ctx) {
  return one(
    `insert into console.assist_conversations (workspace_id, user_id) values ($1, $2) returning *`,
    [ctx.workspaceId, ctx.user.id]
  );
}

export async function addMessage(convId, { role, body, data = {}, intent = null, matched = null, authorId = null }) {
  const m = await one(
    `insert into console.assist_messages (conversation_id, role, body, data, intent, matched, author_id)
     values ($1, $2, $3, $4, $5, $6, $7) returning ${MSG_COLS}`,
    [convId, role, String(body || '').slice(0, 8000), JSON.stringify(data || {}), intent, matched, authorId]
  );
  const bump = role === 'user' ? ', unread_admin = case when status in (\'waiting\',\'human\') then unread_admin + 1 else unread_admin end'
    : role === 'agent' ? ', unread_customer = unread_customer + 1' : '';
  await q(`update console.assist_conversations set last_message_at = now()${bump} where id = $1`, [convId]);
  return m;
}

export async function messagesAfter(convId, after = 0) {
  return q(`select ${MSG_COLS} from console.assist_messages where conversation_id = $1 and id > $2 order by id asc limit 200`, [convId, Number(after) || 0]);
}

export async function setContext(convId, patch) {
  await q(`update console.assist_conversations set context = context || $2::jsonb where id = $1`, [convId, JSON.stringify(patch)]);
}

/** Messages a user sent in the last hour, for the rate limit. */
export async function recentUserMessages(userId) {
  const r = await one(
    `select count(*)::int as n from console.assist_messages m join console.assist_conversations c on c.id = m.conversation_id
      where c.user_id = $1 and m.role = 'user' and m.created_at > now() - interval '1 hour'`,
    [userId]
  );
  return r?.n || 0;
}

export function publicConversation(c) {
  if (!c) return null;
  return { id: c.id, status: c.status, unread: c.unread_customer, subject: c.subject };
}
