import { getContext } from '@/lib/auth';
import { getOrderForWorkspace } from '@/lib/orders';
import { fullchainPem, leafPem, chainPem } from '@/lib/certs';
import { makeZip } from '@/lib/zip';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx?.workspaceId) return new Response('Not signed in', { status: 401 });
  const order = await getOrderForWorkspace(id, ctx.workspaceId);
  if (!order) return new Response('Not found', { status: 404 });
  const format = new URL(req.url).searchParams.get('format') || 'fullchain';
  const base = String(order.common_name || 'certificate').replace(/^\*\./, 'wildcard.').replace(/[^a-z0-9.-]/gi, '_');
  if (format === 'zip') {
    const leaf = leafPem(order);
    if (!leaf) return new Response('This certificate is not issued yet', { status: 404 });
    const files = [
      { name: `${base}.crt`, data: leaf },
      chainPem(order) && { name: `${base}.ca-bundle.crt`, data: chainPem(order) },
      fullchainPem(order) && { name: `${base}.fullchain.pem`, data: fullchainPem(order) },
      order.csr && { name: `${base}.csr`, data: order.csr },
      { name: 'README.txt', data: README(base) }
    ].filter(Boolean);
    return new Response(makeZip(files), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${base}.zip"`,
        'Cache-Control': 'no-store'
      }
    });
  }
  let body;
  let name;
  if (format === 'crt') [body, name] = [leafPem(order), `${base}.crt`];
  else if (format === 'ca') [body, name] = [chainPem(order), `${base}.ca-bundle.crt`];
  else if (format === 'csr') [body, name] = [order.csr, `${base}.csr`];
  else [body, name] = [fullchainPem(order), `${base}.fullchain.pem`];
  if (!body) return new Response('This file is not available yet', { status: 404 });
  return new Response(body, {
    headers: {
      'Content-Type': 'application/x-pem-file',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store'
    }
  });
}

function README(b) {
  return [
    `Certificate files for ${b}`,
    '',
    `${b}.crt              Your server certificate`,
    `${b}.ca-bundle.crt    Intermediate CA certificates`,
    `${b}.fullchain.pem    Certificate + intermediates (Nginx, HAProxy, most servers)`,
    `${b}.csr              The request this certificate was issued for`,
    '',
    'Use them together with the private key you saved when the CSR was created.',
    'Apache: SSLCertificateFile = .crt, SSLCertificateChainFile = .ca-bundle.crt',
    'Nginx:  ssl_certificate = .fullchain.pem',
    'IIS / Windows or Java: convert to PFX or JKS with the format converter in your console.',
    ''
  ].join('\r\n');
}
