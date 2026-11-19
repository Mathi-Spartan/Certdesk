import { requireWorkspace } from '@/lib/auth';
import ToolPage from '@/components/tools/ToolPage';
import { CsrDecoder } from '@/components/tools/Tools';

export const metadata = { title: 'CSR decoder · CertDesk' };

export default async function Page() {
  await requireWorkspace();
  return (
    <ToolPage slug="csr-decoder" title="CSR decoder" desc="Check what a CSR contains before you use it to request a certificate."
      about={['Common name and extra names', 'Organisation, city, state and country', 'Key type and size', 'Keys too weak for a CA']}
      privacy="A CSR holds only public information. It is read on our server and not stored.">
      <CsrDecoder />
    </ToolPage>
  );
}
