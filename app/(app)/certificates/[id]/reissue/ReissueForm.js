'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CsrStep from '@/components/CsrStep';
import { reissue } from '@/app/actions/orders';

export default function ReissueForm({ orderId, commonName, sans, wildcard, multi = false }) {
  const router = useRouter();
  const [csr, setCsr] = useState({ mode: 'generate', csr: '', keyType: 'ec' });
  const [dcv, setDcv] = useState('dns');
  const [names, setNames] = useState((sans || []).join('\n'));
  const list = names.split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const r = await reissue({ orderId, csr: csr.csr, dcvMethod: dcv, sans: multi ? list : undefined });
    if (r?.error) {
      setErr(r.error);
      setBusy(false);
      return;
    }
    router.push(`/certificates/${orderId}?ok=${encodeURIComponent('Reissue requested. Complete validation below.')}`);
  }

  return (
    <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {multi ? (
        <>
          <h2>1. Domains on this certificate</h2>
          <div className="field">
            <label htmlFor="ri-sans">Extra domains (one per line). The main domain {commonName} stays.</label>
            <textarea id="ri-sans" className="input mono" rows={Math.min(10, Math.max(3, list.length + 1))} value={names} onChange={(e) => setNames(e.target.value)} placeholder={'www.example.com\nshop.example.com'} />
            <span className="small muted">{list.length} extra domain{list.length === 1 ? '' : 's'}. You can only use as many as the order has slots for.</span>
          </div>
        </>
      ) : null}
      <h2>{multi ? '2' : '1'}. New key and CSR</h2>
      <CsrStep commonName={commonName} sans={multi ? list : sans} value={csr} onChange={setCsr} />
      <h2>{multi ? '3' : '2'}. Validation</h2>
      <div className="seg" role="radiogroup" aria-label="Validation method">
        {['dns', 'http', 'https'].map((m) => (
          <button key={m} type="button" role="radio" aria-checked={dcv === m} className={dcv === m ? 'on' : ''} disabled={wildcard && m !== 'dns'} onClick={() => setDcv(m)}>
            {m.toUpperCase()}
          </button>
        ))}
      </div>
      {err ? <div role="alert" className="alert red">{err}</div> : null}
      <button type="button" className="btn primary ri-submit" disabled={busy || !csr.csr.includes('BEGIN CERTIFICATE REQUEST')} onClick={submit}>
        {busy ? 'Sending…' : 'Request reissue'}
      </button>
    </div>
  );
}
