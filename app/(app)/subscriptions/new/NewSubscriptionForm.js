'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Icon from '@/components/Icon';
import { orderSubscription } from '@/app/actions/subscriptions';

function Submit({ kind }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn primary" type="submit" disabled={pending}>
      {pending ? 'Ordering from GoGetSSL…' : kind === 'caas' ? 'Order ACME subscription' : 'Order Plan + Automate'}
    </button>
  );
}

export default function NewSubscriptionForm({ products, defaultEmail }) {
  const [state, action] = useActionState(orderSubscription, null);
  const [kind, setKind] = useState('caas');
  const list = products.filter((p) => p.kind === kind);
  const [productId, setProductId] = useState(list[0]?.id);
  const product = products.find((p) => p.id === productId) || list[0];
  const wildcard = /wildcard/i.test(product?.name || '');

  function pickKind(k) {
    setKind(k);
    setProductId(products.find((p) => p.kind === k)?.id);
  }

  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <input type="hidden" name="product_id" value={product?.id || ''} />
      {state?.error ? <div role="alert" className="alert red"><Icon name="alert" />{state.error}</div> : null}

      <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>1 · Type of automation</h2>
        <div className="choices">
          <button type="button" className={`choice ${kind === 'caas' ? 'on' : ''}`} onClick={() => pickKind('caas')} aria-pressed={kind === 'caas'}>
            <span className="t">ACME Certificate-as-a-Service</span>
            <span className="d">Many domains, unlimited certificates. You run Certbot, acme.sh, Caddy or cert-manager with the EAB credentials we give you.</span>
          </button>
          <button type="button" className={`choice ${kind === 'ais' ? 'on' : ''}`} onClick={() => pickKind('ais')} aria-pressed={kind === 'ais'}>
            <span className="t">Plan + Automate</span>
            <span className="d">One domain. Use the AutoInstall agent or your own ACME client, and switch any time.</span>
          </button>
        </div>
      </section>

      <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>2 · Product</h2>
        <div className="choices">
          {list.map((p) => (
            <button key={p.id} type="button" className={`choice ${product?.id === p.id ? 'on' : ''}`} onClick={() => setProductId(p.id)} aria-pressed={product?.id === p.id}>
              <span className="t">{p.name}</span>
              <span className="d">{p.blurb}</span>
              <span className="small muted mono">GoGetSSL product {p.id}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>3 · {kind === 'caas' ? 'Domains' : 'Domain'}</h2>
        {kind === 'caas' ? (
          <div className="field">
            <label htmlFor="domains">Domains, one per line. Wildcards like *.example.com are allowed. You can add or remove domains later.</label>
            <textarea id="domains" name="domains" className="input mono" rows={5} placeholder={'example.com\nwww.example.com\n*.example.com'} required />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="domains">{wildcard ? 'Wildcard domain' : 'Domain'}</label>
            <input id="domains" name="domains" className="input mono" placeholder={wildcard ? '*.example.com' : 'example.com'} required />
            {wildcard ? <span className="small muted">We add the *. prefix if you leave it out.</span> : null}
          </div>
        )}
      </section>

      {kind === 'ais' ? (
        <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2>4 · Contacts</h2>
          <div className="grid-form">
            <div className="field">
              <label htmlFor="primary_email">Primary contact email</label>
              <input id="primary_email" name="primary_email" type="email" className="input" defaultValue={defaultEmail} required />
            </div>
            <div className="field">
              <label htmlFor="technical_email">Technical contact email</label>
              <input id="technical_email" name="technical_email" type="email" className="input" defaultValue={defaultEmail} />
            </div>
          </div>
          <span className="small muted">The AutoInstall SSL sign-in and certificate notices go to these addresses.</span>
        </section>
      ) : null}

      <div className="alert amber"><Icon name="info" />This places a real, charged order in GoGetSSL. Cancel it from the subscription page if it was a test.</div>
      <div><Submit kind={kind} /></div>
    </form>
  );
}
