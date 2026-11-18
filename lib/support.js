import { one } from './db';

/** Where customers send questions: SUPPORT_EMAIL, or the partner admin's email. */
export async function supportEmail() {
  if (process.env.SUPPORT_EMAIL) return process.env.SUPPORT_EMAIL;
  const row = await one(`select email from console.users where role = 'admin' and is_active order by created_at limit 1`);
  return row?.email || null;
}

export function helpHref(email, { subject, body } = {}) {
  if (!email) return null;
  const p = new URLSearchParams();
  if (subject) p.set('subject', subject);
  if (body) p.set('body', body);
  return `mailto:${email}${p.toString() ? '?' + p.toString().replace(/\+/g, '%20') : ''}`;
}
