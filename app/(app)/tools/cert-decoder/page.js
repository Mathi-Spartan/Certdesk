import { requireWorkspace } from '@/lib/auth';
import ToolPage from '@/components/tools/ToolPage';
import { CertDecoder } from '@/components/tools/Tools';

export const metadata = { title: 'Certificate decoder · CertDesk' };

export default async function Page() {
  await requireWorkspace();
  return (
    <ToolPage slug="cert-decoder" title="Certificate decoder" desc="See who a certificate was issued to, who issued it, and when it expires."
      about={['Names the certificate covers', 'Issuing CA and validity dates', 'Key type, serial and SHA-256 fingerprint', 'Every certificate in a pasted chain']}
      privacy="Certificates are public. They are read on our server and not stored.">
      <CertDecoder />
    </ToolPage>
  );
}
