import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { CertDecoder } from '@/components/tools/Tools';

export const metadata = { title: 'Certificate decoder · CertDesk' };

export default async function Page() {
  await requireWorkspace();
  return (
    <main className="page cc-page">
      <header className="cc-page-head">
        <div>
          <nav className="cc-crumbs" aria-label="Breadcrumb"><Link href="/dashboard">Dashboard</Link><span>/</span><Link href="/tools">Tools</Link></nav>
          <h1>Certificate decoder</h1>
          <p>See who a certificate was issued to, by whom, and when it expires.</p>
        </div>
      </header>
      <CertDecoder />
    </main>
  );
}
