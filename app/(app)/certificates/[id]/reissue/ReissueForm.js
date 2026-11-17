'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CsrStep from '@/components/CsrStep';
import { reissue } from '@/app/actions/orders';

export default function ReissueForm({ orderId, commonName, sans, wildcard }) {
  const router = useRouter();
  const [csr, setCsr] = useState({ mode: 'generate', csr: '', keyType: 'ec' });
  const [dcv, setDcv] = useState('dns');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const r = await reissue({ orderId, csr: csr.csr, dcvMethod: dcv });
    if (r?.error) {
      setErr(r.error);
      setBusy(false);
      return;
    }
    router.push(`/certificates/${orderId}?ok=${encodeURIComponent('Reissue requested. Complete validation below.')}`);
  }

  return (
    <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h2>1. New key and CSR</h2>
      <CsrStep commonName={commonName} sans={sans} value={csr} onChange={setCsr} />
      <h2>2. Validation</h2>
      <div className="seg" role="radiogroup" aria-label="Validation method">
        {['dns', 'http', 'https'].map((m) => (
          <button key={m} type="button" role="radio" aria-checked={dcv === m} className={dcv === m ? 'on' : ''} disabled={wildcard && m !== 'dns'} onClick={() => setDcv(m)}>
            {m.toUpperCase()}
          </button>
        ))}
      </div>
      {err ? <div role="alert" className="alert red">{err}</div> : null}
      <button type="button" className="btn primary" style={{ alignSelf: 'flex-start' }} disabled={busy || !csr.csr.includes('BEGIN CERTIFICATE REQUEST')} onClick={submit}>
        {busy ? 'Sending…' : 'Request reissue'}
      </button>
    </div>
  );
}
