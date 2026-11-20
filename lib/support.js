/** Public contact details shown on the website and in the console. */
export const COMPANY = {
  name: 'Vendhan Secure Encryption Software Consultancy',
  contact: 'Ranjitha Sundram',
  email: 'support@sslorbit.com'
};

/** Where customers send questions: SUPPORT_EMAIL if set, otherwise the company support address. */
export async function supportEmail() {
  return process.env.SUPPORT_EMAIL || COMPANY.email;
}

export function helpHref(email, { subject, body } = {}) {
  if (!email) return null;
  const p = new URLSearchParams();
  if (subject) p.set('subject', subject);
  if (body) p.set('body', body);
  return `mailto:${email}${p.toString() ? '?' + p.toString().replace(/\+/g, '%20') : ''}`;
}
