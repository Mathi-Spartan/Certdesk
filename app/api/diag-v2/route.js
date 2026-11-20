import { getContext } from '@/lib/auth';
// Temporary probe: does GoGetSSL API v2 accept switching the Plan + Automate install method?
// Calls use a non-existent subscription id, so nothing is changed. Removed after the check.
export const dynamic = 'force-dynamic';

const BASE = (process.env.GOGETSSL_API_V2_URL || 'https://my.gogetssl.com/api/v2').replace(/\/+$/, '');

export async function GET() {
  const ctx = await getContext().catch(() => null);
  if (!ctx?.isAdmin) return new Response('Not found', { status: 404 });
  const code = process.env.GOGETSSL_PARTNER_CODE;
  const pass = process.env.GOGETSSL_V2_PASS || process.env.GOGETSSL_PASS;
  const headers = { Authorization: `GGS ${code}:${pass}`, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'CertDesk/1.0' };
  const FAKE = 987654321;
  const probes = [
    ['GET', '/authentication/validate'],
    ['GET', `/certificates/ais/${FAKE}`],
    ['PATCH', `/certificates/ais/${FAKE}`, { install_method: 'acme' }],
    ['PUT', `/certificates/ais/${FAKE}`, { install_method: 'acme' }],
    ['POST', `/certificates/ais/${FAKE}/install-method`, { install_method: 'acme' }],
    ['PATCH', `/certificates/ais/${FAKE}/install-method`, { install_method: 'acme' }],
    ['POST', `/certificates/ais/${FAKE}/switch`, { install_method: 'acme' }],
    ['PATCH', `/certificates/ais/${FAKE}/subscription`, { auto_renew: false }],
    ['GET', '/products/400'],
    ['OPTIONS', `/certificates/ais/${FAKE}`]
  ];
  const out = [];
  for (const [method, path, body] of probes) {
    try {
      const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
      const t = await r.text();
      out.push({ method, path, status: r.status, allow: r.headers.get('allow'), body: t.slice(0, path === '/products/400' ? 3000 : 600) });
    } catch (e) {
      out.push({ method, path, error: e.message });
    }
  }
  return new Response(JSON.stringify(out, null, 2), { headers: { 'content-type': 'application/json' } });
}
