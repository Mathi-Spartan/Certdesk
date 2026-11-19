import { requireWorkspace } from '@/lib/auth';
import ToolPage from '@/components/tools/ToolPage';

export const metadata = { title: 'Format converter · CertDesk' };

export default async function Page() {
  await requireWorkspace();
  return (
    <ToolPage slug="converter" wide title="Format converter" desc="Turn a certificate, key and CA bundle into PFX, JKS, PEM, DER, P7B or a server-ready pack. It runs in your browser, so nothing is uploaded."
      actions={<a className="btn" href="/tools/certforge.html" target="_blank" rel="noopener">Open full screen ↗</a>}>
      <div className="cc-card cc-frame">
        <iframe src="/tools/certforge.html" title="CertForge certificate format converter" loading="lazy" />
      </div>
    </ToolPage>
  );
}
