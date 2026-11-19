import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';

export const metadata = { title: 'Certificate converter · CertDesk' };

export default async function Converter() {
  await requireWorkspace();
  return (
    <main className="page cc-page cc-page-wide">
      <header className="cc-page-head">
        <div>
          <nav className="cc-crumbs" aria-label="Breadcrumb"><Link href="/dashboard">Dashboard</Link><span>/</span><Link href="/tools">Tools</Link></nav>
          <h1>Certificate converter</h1>
          <p>Convert a certificate, key and CA bundle into PFX, JKS, PEM, DER, P7B or a server-ready pack. It runs entirely in your browser, so nothing is uploaded.</p>
        </div>
        <a className="btn" href="/tools/certforge.html" target="_blank" rel="noopener">Open full screen ↗</a>
      </header>
      <div className="cc-card cc-frame">
        <iframe src="/tools/certforge.html" title="CertForge certificate converter" loading="lazy" />
      </div>
    </main>
  );
}
