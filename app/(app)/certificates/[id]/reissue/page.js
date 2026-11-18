import { notFound } from 'next/navigation';
import { requireWorkspace } from '@/lib/auth';
import { getOrderForWorkspace } from '@/lib/orders';
import TopBar from '@/components/TopBar';
import ReissueForm from './ReissueForm';

export const metadata = { title: 'Reissue · CertDesk' };

export default async function ReissuePage({ params }) {
  const { id } = await params;
  const ctx = await requireWorkspace();
  const order = await getOrderForWorkspace(id, ctx.workspaceId);
  if (!order) notFound();
  return (
    <>
      <TopBar crumbs={[{ label: 'My SSL', href: '/certificates' }, { label: order.common_name, href: `/certificates/${order.id}` }, { label: 'Reissue' }]} />
      <main className="page" style={{ maxWidth: 860 }}>
        <div>
          <h1 className="title">Reissue {order.common_name}</h1>
          <p className="sub">Get a new certificate on the same order, with a new key. Use this if the key was lost or exposed. It doesn't cost anything.</p>
        </div>
        <ReissueForm orderId={order.id} commonName={order.common_name} sans={order.sans || []} wildcard={String(order.common_name || '').startsWith('*.')} />
      </main>
    </>
  );
}
