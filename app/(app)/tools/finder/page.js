import { requireWorkspace } from '@/lib/auth';
import { q } from '@/lib/db';
import { supportEmail } from '@/lib/support';
import FinderClient from '@/app/finder/FinderClient';
import '@/app/finder.css';

export const metadata = { title: 'SSL Finder · CertDesk' };

export default async function ToolsFinder() {
  await requireWorkspace();
  const [products, email] = await Promise.all([
    q('select id, name, brand, validation, wildcard, multidomain, san_max, automation from console.products order by name'),
    supportEmail().catch(() => null)
  ]);
  const contact = email ? `mailto:${email}?subject=${encodeURIComponent('Which certificate should I choose?')}` : '#';
  return (
    <main className="cx3-page cx3-wide">
      <FinderClient products={products} signedIn contact={contact} />
    </main>
  );
}
