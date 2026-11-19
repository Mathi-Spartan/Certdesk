import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { CsrDecoder } from '@/components/tools/Tools';

export const metadata = { title: 'CSR decoder · CertDesk' };

export default async function Page() {
  await requireWorkspace();
  return (
    <main className="page cc-page">
      <header className="cc-page-head">
        <div>
          <nav className="cc-crumbs" aria-label="Breadcrumb"><Link href="/dashboard">Dashboard</Link><span>/</span><Link href="/tools">Tools</Link></nav>
          <h1>CSR decoder</h1>
          <p>Check what a CSR contains before you use it to request a certificate.</p>
        </div>
      </header>
      <CsrDecoder />
    </main>
  );
}
