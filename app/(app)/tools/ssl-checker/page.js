import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { SslChecker } from '@/components/tools/Tools';

export const metadata = { title: 'SSL checker · CertDesk' };

export default async function Page() {
  await requireWorkspace();
  return (
    <main className="page cc-page">
      <header className="cc-page-head">
        <div>
          <nav className="cc-crumbs" aria-label="Breadcrumb"><Link href="/dashboard">Dashboard</Link><span>/</span><Link href="/tools">Tools</Link></nav>
          <h1>SSL checker</h1>
          <p>Check that a website's certificate is installed correctly and trusted.</p>
        </div>
      </header>
      <SslChecker />
    </main>
  );
}
