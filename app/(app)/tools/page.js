import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';

export const metadata = { title: 'Tools · CertDesk' };

const TOOLS = [
  { href: '/tools/csr', name: 'CSR generator', text: 'Create a CSR and private key in your browser.' },
  { href: '/tools/csr-decoder', name: 'CSR decoder', text: 'See the domain, organisation and key inside a CSR.' },
  { href: '/tools/cert-decoder', name: 'Certificate decoder', text: 'Read the names, issuer and expiry of any certificate.' },
  { href: '/tools/ssl-checker', name: 'SSL checker', text: 'Test a live website: trust, chain, names and expiry.' },
  { name: 'Key matcher', text: 'Confirm a certificate matches your private key.', soon: true }
];

export default async function ToolsHome() {
  await requireWorkspace();
  return (
    <main className="page cc-page">
      <header className="cc-page-head">
        <div>
          <nav className="cc-crumbs" aria-label="Breadcrumb"><Link href="/dashboard">Dashboard</Link></nav>
          <h1>Tools</h1>
          <p>Everyday SSL utilities. More order management tools are on the way.</p>
        </div>
      </header>
      <div className="cc-tiles">
        {TOOLS.map((t) => t.soon ? (
          <div key={t.name} className="cc-tile soon"><strong>{t.name}</strong><span>{t.text}</span><em>Coming soon</em></div>
        ) : (
          <Link key={t.name} href={t.href} className="cc-tile"><strong>{t.name}</strong><span>{t.text}</span><em>Open →</em></Link>
        ))}
      </div>
    </main>
  );
}
