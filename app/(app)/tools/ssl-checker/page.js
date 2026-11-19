import { requireWorkspace } from '@/lib/auth';
import ToolPage from '@/components/tools/ToolPage';
import { SslChecker } from '@/components/tools/Tools';

export const metadata = { title: 'SSL checker · CertDesk' };

export default async function Page({ searchParams }) {
  await requireWorkspace();
  const host = String((await searchParams)?.host || '').slice(0, 253);
  return (
    <ToolPage slug="ssl-checker" title="SSL checker" desc="Check that a website's certificate is installed correctly and trusted by browsers."
      about={['Certificate covers the domain name', 'Full chain is served and trusted', 'Days left before expiry', 'TLS version and cipher in use']}
      privacy="We connect to the public site on port 443 only. Nothing about the check is stored.">
      <SslChecker initial={host} />
    </ToolPage>
  );
}
