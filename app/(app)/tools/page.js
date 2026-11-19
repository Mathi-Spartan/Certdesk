import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';

export const metadata = { title: 'Tools · CertDesk' };

const P = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m10.8 12.2 9.2-9.2M17 6l3 3" /></>,
  doc: <><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  shield: <><path d="M12 3 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6z" /><path d="m9 12 2 2 4-4" /></>,
  star: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />,
  swap: <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
};

const TOOLS = [
  { href: '/tools/finder', icon: 'star', name: 'SSL Finder', text: 'Answer a few questions and get the right certificate, with the reasons.' },
  { href: '/tools/ssl-checker', icon: 'search', name: 'SSL checker', text: 'Test a live website: trust, chain, names covered and expiry.' },
  { href: '/tools/csr', icon: 'key', name: 'CSR generator', text: 'Create a CSR and private key in your browser.' },
  { href: '/tools/csr-decoder', icon: 'doc', name: 'CSR decoder', text: 'See the domain, organisation and key inside a CSR.' },
  { href: '/tools/cert-decoder', icon: 'shield', name: 'Certificate decoder', text: 'Read the names, issuer and expiry of any certificate.' },
  { href: '/tools/converter', icon: 'swap', name: 'Format converter', text: 'Convert to PFX, JKS, PEM, DER, P7B or a server-ready pack.' }
];

export default async function ToolsHome() {
  await requireWorkspace();
  return (
    <main className="page cc-page">
      <header className="cc-page-head">
        <div>
          <nav className="cc-crumbs" aria-label="Breadcrumb"><Link href="/dashboard">Dashboard</Link><span>/</span><span>Tools</span></nav>
          <h1>Tools</h1>
          <p>Everyday SSL utilities for checking, creating and converting certificates.</p>
        </div>
      </header>
      <div className="cc-tiles cc-tiles-lg">
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className="cc-tile">
            <span className="cc-tile-ico" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{P[t.icon]}</svg></span>
            <strong>{t.name}</strong><span>{t.text}</span><em>Open tool →</em>
          </Link>
        ))}
      </div>
    </main>
  );
}
