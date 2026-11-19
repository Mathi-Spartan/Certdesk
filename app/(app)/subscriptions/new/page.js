import { requireWorkspace } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { canOrder } from '@/lib/ordering';
import { one } from '@/lib/db';
import { SUBSCRIPTION_PRODUCTS } from '@/lib/subscriptions';
import TopBar from '@/components/TopBar';
import NewSubscriptionForm from './NewSubscriptionForm';

export const metadata = { title: 'New subscription · CertDesk' };

export default async function NewSubscription() {
  const ctx = await requireWorkspace();
  if (!canOrder(ctx)) redirect('/buy?type=auto');
  // product names follow the GoGetSSL v2 catalogue once the partner has read it
  const cached = await one(`select value from console.kv where key = 'v2_products'`);
  const live = Array.isArray(cached?.value) ? cached.value : [];
  const products = SUBSCRIPTION_PRODUCTS.map((p) => {
    const hit = live.find((x) => Number(x.id) === p.id);
    return { ...p, name: hit?.name || p.name };
  });
  const ws = await one('select contact_email from console.workspaces where id = $1', [ctx.workspaceId]);
  return (
    <>
      <TopBar crumbs={[{ label: 'Order SSL', href: '/order' }, { label: 'Automated SSL' }]} />
      <main className="page" style={{ maxWidth: 920 }}>
        <div>
          <h1 className="title">New automated SSL subscription</h1>
          <p className="sub">Ordered through GoGetSSL API v2. Certificates inside a subscription are reissued and renewed automatically.</p>
        </div>
        <NewSubscriptionForm products={products} defaultEmail={ws?.contact_email || ctx.user.email || ''} />
      </main>
    </>
  );
}
