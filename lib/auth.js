import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { q, one } from './db';

const COOKIE = 'cd_session';
const SESSION_DAYS = 30;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, saltB64, hashB64] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}

export function generatePassword() {
  return crypto.randomBytes(9).toString('base64url');
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await q(
    `insert into console.sessions (token_hash, user_id, expires_at) values ($1, $2, now() + ($3 || ' days')::interval)`,
    [sha256(token), userId, String(SESSION_DAYS)]
  );
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await q('delete from console.sessions where token_hash = $1', [sha256(token)]);
  jar.delete(COOKIE);
}

/**
 * Returns the signed-in context or null.
 * workspaceId is the customer's own workspace, or for the admin the workspace they opened.
 */
export async function getContext() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const row = await one(
    `select s.token_hash, s.acting_workspace_id, u.id, u.email, u.name, u.role, u.workspace_id, u.is_active
       from console.sessions s join console.users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [sha256(token)]
  );
  if (!row || !row.is_active) return null;
  const isAdmin = row.role === 'admin';
  const workspaceId = isAdmin ? row.acting_workspace_id : row.workspace_id;
  const workspace = workspaceId
    ? await one('select id, name, contact_email, contact from console.workspaces where id = $1', [workspaceId])
    : null;
  return {
    tokenHash: row.token_hash,
    user: { id: row.id, email: row.email, name: row.name, role: row.role },
    isAdmin,
    workspaceId: workspace ? workspace.id : null,
    workspace
  };
}

export async function requireUser() {
  const ctx = await getContext();
  if (!ctx) redirect('/login');
  return ctx;
}

/** Signed-in user with a workspace in scope (customers always; admin after opening one). */
export async function requireWorkspace() {
  const ctx = await requireUser();
  if (!ctx.workspaceId) redirect('/partner');
  return ctx;
}

export async function requireAdmin() {
  const ctx = await requireUser();
  if (!ctx.isAdmin) redirect('/');
  return ctx;
}

export async function setActingWorkspace(tokenHash, workspaceId) {
  await q('update console.sessions set acting_workspace_id = $2 where token_hash = $1', [tokenHash, workspaceId]);
}
