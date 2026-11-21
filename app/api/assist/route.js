import { getContext } from '@/lib/auth';
import { q } from '@/lib/db';
import { answer, runAction, articleAnswer, ensureSeed } from '@/lib/assist/engine';
import {
  openConversation, getConversation, createConversation, addMessage, messagesAfter,
  setContext, recentUserMessages, publicConversation
} from '@/lib/assist/store';

export const dynamic = 'force-dynamic';
const LIMIT_PER_HOUR = 60;

const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

async function auth() {
  const ctx = await getContext();
  if (!ctx?.workspaceId) return null;
  return ctx;
}

/** GET: the open conversation (or one by id) and its messages after ?after=. */
export async function GET(req) {
  const ctx = await auth();
  if (!ctx) return json({ error: 'Not signed in' }, 401);
  const u = new URL(req.url);
  try {
    const conv = u.searchParams.get('c') ? await getConversation(ctx, u.searchParams.get('c')) : await openConversation(ctx);
    if (!conv) return json({ conversation: null, messages: [] });
    const messages = await messagesAfter(conv.id, u.searchParams.get('after'));
    if (u.searchParams.get('seen') && conv.unread_customer) await q('update console.assist_conversations set unread_customer = 0 where id = $1', [conv.id]);
    return json({ conversation: publicConversation(conv), messages });
  } catch (e) {
    return json({ error: setupError(e) }, 503);
  }
}

function setupError(e) {
  return /assist_(conversations|messages|articles)/.test(String(e?.message)) && /does not exist/.test(String(e?.message))
    ? 'Support chat is being set up. Please try again later.'
    : 'Something went wrong. Please try again.';
}

function botData(res) {
  return {
    blocks: res.blocks || [],
    buttons: res.buttons || [],
    orderId: res.orderId || null,
    articleSlug: res.articleSlug || null
  };
}

export async function POST(req) {
  const ctx = await auth();
  if (!ctx) return json({ error: 'Not signed in' }, 401);
  let input;
  try { input = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const op = String(input?.op || '');
  try {
    await ensureSeed();
    if (op === 'feedback') {
      const id = Number(input.messageId);
      const helpful = !!input.helpful;
      const m = await q(
        `update console.assist_messages m set helpful = $3 from console.assist_conversations c
          where m.id = $1 and m.conversation_id = c.id and c.workspace_id = $2 and m.role = 'bot' returning m.data`,
        [id, ctx.workspaceId, helpful]
      );
      const slug = m[0]?.data?.articleSlug;
      if (slug) await q(`update console.assist_articles set ${helpful ? 'helpful = helpful + 1' : 'unhelpful = unhelpful + 1'} where slug = $1`, [slug]);
      return json({ ok: true });
    }

    if (op === 'clear') {
      const c = input.c ? await getConversation(ctx, input.c) : null;
      if (c && c.status !== 'resolved') {
        await q(`update console.assist_conversations set status = 'resolved', resolved_at = now(), unread_customer = 0, context = context || '{"cleared":true}'::jsonb where id = $1`, [c.id]);
        await addMessage(c.id, { role: 'system', body: 'The customer cleared this chat.' });
      }
      return json({ ok: true });
    }

    let conv = input.c ? await getConversation(ctx, input.c) : null;
    if (op === 'new' || !conv || conv.status === 'resolved') conv = await createConversation(ctx);
    const after = Number(input.after) || 0;

    if (op === 'new') {
      const res = await answer(ctx, conv, 'hi', { forcedIntent: 'greet' });
      await addMessage(conv.id, { role: 'bot', body: res.body, data: botData(res), intent: res.intent, matched: true });
      return json({ conversation: publicConversation(conv), messages: await messagesAfter(conv.id, after) });
    }

    if (op === 'send' || op === 'pick' || op === 'article') {
      const text = op === 'send' ? String(input.text || '').trim().slice(0, 1000) : String(input.label || '').slice(0, 200);
      if (op === 'send' && !text) return json({ error: 'Type a message' }, 400);
      if ((await recentUserMessages(ctx.user.id)) >= LIMIT_PER_HOUR) return json({ error: 'You’ve sent a lot of messages in the last hour. Please wait a little, or email support.' }, 429);
      await addMessage(conv.id, { role: 'user', body: text || '…' });
      if (!conv.subject && op === 'send') await q('update console.assist_conversations set subject = $2 where id = $1', [conv.id, text.slice(0, 140)]);

      // A human has the chat: the bot stays quiet.
      if (conv.status === 'waiting' || conv.status === 'human') {
        return json({ conversation: publicConversation(await getConversation(ctx, conv.id)), messages: await messagesAfter(conv.id, after) });
      }

      let res;
      if (op === 'article') res = await articleAnswer(String(input.slug || ''));
      else if (op === 'pick') res = await answer(ctx, conv, text, { forcedIntent: input.intent || conv.context?.pendingIntent || 'status', forcedOrderId: String(input.orderId || '') });
      else res = await answer(ctx, conv, text);
      await addMessage(conv.id, { role: 'bot', body: res.body, data: botData(res), intent: res.intent, matched: res.matched !== false });
      await setContext(conv.id, { ...(res.orderId ? { orderId: res.orderId, at: Date.now() } : {}), pendingIntent: res.pendingIntent || null, lastIntent: res.intent || null });
      return json({ conversation: publicConversation(conv), messages: await messagesAfter(conv.id, after) });
    }

    if (op === 'action') {
      const label = String(input.label || 'Action').slice(0, 120);
      await addMessage(conv.id, { role: 'user', body: label });
      const res = await runAction(ctx, String(input.action || ''), String(input.orderId || ''));
      await addMessage(conv.id, { role: 'bot', body: res.body, data: botData(res), intent: 'action', matched: res.matched !== false });
      if (res.orderId) await setContext(conv.id, { orderId: res.orderId, at: Date.now() });
      return json({ conversation: publicConversation(conv), messages: await messagesAfter(conv.id, after) });
    }

    if (op === 'handoff') {
      const note = String(input.note || '').trim().slice(0, 1000);
      if (note) await addMessage(conv.id, { role: 'user', body: note });
      await q(
        `update console.assist_conversations set status = 'waiting', unread_admin = unread_admin + 1, subject = coalesce(subject, $2) where id = $1`,
        [conv.id, (note || 'Support request').slice(0, 140)]
      );
      await addMessage(conv.id, {
        role: 'system',
        body: 'Your chat has been passed to the support team. They’ll reply right here. You can close this window and come back later; replies stay in the chat.'
      });
      return json({ conversation: publicConversation(await getConversation(ctx, conv.id)), messages: await messagesAfter(conv.id, after) });
    }

    return json({ error: 'Unknown request' }, 400);
  } catch (e) {
    console.error('assist', e);
    return json({ error: setupError(e) }, 500);
  }
}
