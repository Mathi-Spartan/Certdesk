import { redirect } from 'next/navigation';

// Customers have one home: My certificates. Keep /dashboard working for old links and sign-in.
export default async function Dashboard({ searchParams }) {
  const sp = (await searchParams) || {};
  const keep = new URLSearchParams();
  for (const k of ['ok', 'err']) if (sp[k]) keep.set(k, String(sp[k]));
  if (sp.show === 'action' || sp.show === 'expiring') keep.set('f', sp.show);
  if (sp.q) keep.set('q', String(sp.q));
  const qs = keep.toString();
  redirect('/orders' + (qs ? `?${qs}` : ''));
}
