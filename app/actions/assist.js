'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { q, one } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

const enc = encodeURIComponent;
const isId = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ''));

async function conv(id) {
  if (!isId(id)) redirect('/partner/support?err=' + enc('Conversation not found'));
  const c = await one('select * from console.assist_conversations where id = $1', [id]);
  if (!c) redirect('/partner/support?err=' + enc('Conversation not found'));
  return c;
}

async function system(id, body) {
  await q(`insert into console.assist_messages (conversation_id, role, body) values ($1, 'system', $2)`, [id, body]);
}

/** Reply as the support team. Used by the thread page (returns, no redirect). */
export async function replyChat(id, text) {
  const ctx = await requireAdmin();
  const c = await conv(id);
  const body = String(text || '').trim().slice(0, 4000);
  if (!body) return { error: 'Type a reply' };
  if (c.status !== 'human') {
    await q(`update console.assist_conversations set status = 'human', assigned_to = coalesce(assigned_to, $2) where id = $1`, [id, ctx.user.id]);
    await system(id, `${ctx.user.name || 'Support'} joined the chat.`);
  }
  await q(`insert into console.assist_messages (conversation_id, role, body, author_id) values ($1, 'agent', $2, $3)`, [id, body, ctx.user.id]);
  await q(`update console.assist_conversations set last_message_at = now(), unread_customer = unread_customer + 1, unread_admin = 0 where id = $1`, [id]);
  return { ok: true };
}

export async function claimChat(formData) {
  const ctx = await requireAdmin();
  const id = String(formData.get('id'));
  const c = await conv(id);
  if (c.status !== 'human') await system(id, `${ctx.user.name || 'Support'} joined the chat.`);
  await q(`update console.assist_conversations set status = 'human', assigned_to = $2, unread_admin = 0 where id = $1`, [id, ctx.user.id]);
  revalidatePath(`/partner/support/${id}`);
}

export async function returnToBot(formData) {
  await requireAdmin();
  const id = String(formData.get('id'));
  await conv(id);
  await q(`update console.assist_conversations set status = 'bot', unread_admin = 0 where id = $1`, [id]);
  await system(id, 'The assistant is back. Ask anything, or tap Talk to support again if you need us.');
  revalidatePath(`/partner/support/${id}`);
}

export async function resolveChat(formData) {
  await requireAdmin();
  const id = String(formData.get('id'));
  await conv(id);
  await q(`update console.assist_conversations set status = 'resolved', resolved_at = now(), unread_admin = 0 where id = $1`, [id]);
  await system(id, 'This conversation was marked as resolved. Start a new chat any time.');
  redirect('/partner/support?ok=' + enc('Conversation resolved'));
}

export async function markSeen(id) {
  await requireAdmin();
  if (isId(id)) await q('update console.assist_conversations set unread_admin = 0 where id = $1', [id]);
}

// ───────── knowledge base

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'article';
}

export async function saveArticle(formData) {
  await requireAdmin();
  const id = Number(formData.get('id')) || null;
  const title = String(formData.get('title') || '').trim().slice(0, 160);
  const body = String(formData.get('body') || '').trim().slice(0, 20000);
  const category = String(formData.get('category') || 'General').trim().slice(0, 40) || 'General';
  const keywords = String(formData.get('keywords') || '').split(',').map((k) => k.trim().toLowerCase()).filter(Boolean).slice(0, 30);
  const published = formData.get('published') === 'on';
  const back = id ? `/partner/support/kb/${id}` : '/partner/support/kb/new';
  if (!title || !body) redirect(back + '?err=' + enc('Title and answer are required'));
  if (id) {
    await q(
      `update console.assist_articles set title = $2, body = $3, category = $4, keywords = $5, published = $6, updated_at = now() where id = $1`,
      [id, title, body, category, keywords, published]
    );
    redirect(`/partner/support/kb?ok=${enc('Saved “' + title + '”')}`);
  }
  let slug = slugify(title);
  if (await one('select 1 from console.assist_articles where slug = $1', [slug])) slug = `${slug}-${Date.now().toString(36)}`;
  await q(
    `insert into console.assist_articles (slug, title, body, category, keywords, published) values ($1, $2, $3, $4, $5, $6)`,
    [slug, title, body, category, keywords, published]
  );
  redirect(`/partner/support/kb?ok=${enc('Added “' + title + '”')}`);
}
