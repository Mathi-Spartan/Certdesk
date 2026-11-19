import { redirect } from 'next/navigation';

// Sign-in lives on the home page now; keep /login working for old links and session redirects.
export default async function LoginPage({ searchParams }) {
  const sp = await searchParams;
  redirect('/?signin=1' + (sp?.next ? '&next=' + encodeURIComponent(sp.next) : ''));
}
