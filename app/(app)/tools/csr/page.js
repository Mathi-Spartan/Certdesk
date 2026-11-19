import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { CsrGenerator } from '@/components/tools/Tools';

export const metadata = { title: 'CSR generator · CertDesk' };

export default async function Page() {
  await requireWorkspace();
  return (
    <main className="page cc-page">
      <header className="cc-page-head">
        <div>
          <nav className="cc-crumbs" aria-label="Breadcrumb"><Link href="/dashboard">Dashboard</Link><span>/</span><Link href="/tools">Tools</Link></nav>
          <h1>CSR generator</h1>
          <p>Create a certificate signing request and private key in your browser.</p>
        </div>
      </header>
      <CsrGenerator />
    </main>
  );
}
