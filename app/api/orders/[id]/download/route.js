import { getContext } from '@/lib/auth';
import { getOrderForWorkspace } from '@/lib/orders';
import { fullchainPem, leafPem, chainPem } from '@/lib/certs';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx?.workspaceId) return new Response('Not signed in', { status: 401 });
  const order = await getOrderForWorkspace(id, ctx.workspaceId);
  if (!order) return new Response('Not found', { status: 404 });
  const format = new URL(req.url).searchParams.get('format') || 'fullchain';
  const base = String(order.common_name || 'certificate').replace(/^\*\./, 'wildcard.').replace(/[^a-z0-9.-]/gi, '_');
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
