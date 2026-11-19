'use server';

import { redirect } from 'next/navigation';
import { one, q } from '@/lib/db';
import { createSession, destroySession, verifyPassword, hashPassword, requireUser } from '@/lib/auth';

export async function login(prev, formData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  if (!email || !password) return { error: 'Enter your email and password.' };
  const user = await one('select id, password_hash, is_active, role from console.users where email = $1', [email]);
  if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
    return { error: 'That email and password do not match an active account.' };
  }
  await createSession(user.id);
  await q('update console.users set last_login_at = now() where id = $1', [user.id]);
  redirect(user.role === 'admin' ? '/partner' : '/dashboard');
}

export async function logout() {
  await destroySession();
  redirect('/');
}

export async function changePassword(prev, formData) {
  const ctx = await requireUser();
  const current = String(formData.get('current') || '');
  const next = String(formData.get('next') || '');
  const user = await one('select password_hash from console.users where id = $1', [ctx.user.id]);
  if (!verifyPassword(current, user.password_hash)) return { error: 'Your current password is not correct.' };
  if (next.length < 10) return { error: 'Use at least 10 characters for the new password.' };
  await q('update console.users set password_hash = $2 where id = $1', [ctx.user.id, hashPassword(next)]);
  await q('delete from console.sessions where user_id = $1 and token_hash <> $2', [ctx.user.id, ctx.tokenHash]);
  return { ok: 'Password changed. Other devices have been signed out.' };
}
