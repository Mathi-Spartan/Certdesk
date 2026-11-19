import { requireWorkspace } from '@/lib/auth';
import ToolPage from '@/components/tools/ToolPage';
import { CsrGenerator } from '@/components/tools/Tools';

export const metadata = { title: 'CSR generator · CertDesk' };

export default async function Page() {
  await requireWorkspace();
  return (
    <ToolPage slug="csr" title="CSR generator" desc="Create a certificate signing request and its private key."
      about={['RSA 2048, RSA 4096 or ECDSA P-256 key', 'Extra domain names added as SANs', 'Organisation details for OV and EV', 'Download the CSR and key as files']}
      privacy="The key pair is created by your browser. The private key is never sent to us, so save it before you leave the page.">
      <CsrGenerator />
    </ToolPage>
  );
}
