'use client';

import { useState } from 'react';
import { generateCsr } from '@/lib/csr-browser';
import { decodeCsr } from '@/app/actions/orders';
import Icon from './Icon';

function download(name, text) {
  const blob = new Blob([text], { type: 'application/x-pem-file' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * value: { mode, csr, keySaved, keyType, org, country }
 */
export default function CsrStep({ commonName, sans = [], value, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [decoded, setDecoded] = useState(null);
  const [key, setKey] = useState(null);
  const v = value;
  const set = (patch) => onChange({ ...v, ...patch });
  const keyName = `${String(commonName || 'certificate').replace(/^\*\./, 'wildcard.')}.key`;

  async function generate() {
    setBusy(true);
    setErr(null);
    try {
      const r = await generateCsr({ cn: commonName, sans, o: v.org || undefined, c: v.country || undefined, keyType: v.keyType || 'ec' });
      setKey(r.privateKey);
      download(keyName, r.privateKey);
      set({ csr: r.csr, keySaved: true });
    } catch (e) {
      setErr('Your browser could not create the key: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    setBusy(true);
    setErr(null);
    const r = await decodeCsr(v.csr);
    setBusy(false);
    if (r.error) setErr('GoGetSSL could not read this CSR: ' + r.error);
    else setDecoded(r);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="seg" role="radiogroup" aria-label="CSR source">
        {[
          ['generate', 'Generate for me'],
          ['paste', 'Paste my CSR']
        ].map(([m, label]) => (
          <button key={m} type="button" role="radio" aria-checked={v.mode === m} className={v.mode === m ? 'on' : ''} onClick={() => set({ mode: m, csr: '', keySaved: false })}>
            {label}
          </button>
        ))}
      </div>

      {v.mode === 'generate' ? (
        <>
          <div className="grid-form">
            <div className="field">
              <label htmlFor="kt">Key type</label>
              <select className="input" id="kt" value={v.keyType || 'ec'} onChange={(e) => set({ keyType: e.target.value, csr: '', keySaved: false })}>
                <option value="ec">ECDSA P-256 (recommended)</option>
                <option value="rsa2048">RSA 2048</option>
                <option value="rsa4096">RSA 4096</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="org">Organisation (optional for DV)</label>
              <input className="input" id="org" value={v.org || ''} onChange={(e) => set({ org: e.target.value, csr: '', keySaved: false })} />
            </div>
            <div className="field">
              <label htmlFor="ctry">Country code</label>
              <input className="input" id="ctry" maxLength={2} value={v.country || ''} placeholder="IN" onChange={(e) => set({ country: e.target.value.toUpperCase(), csr: '', keySaved: false })} />
            </div>
          </div>
          <div className="alert violet">
            <Icon name="lock" stroke="var(--accent)" />
            <span style={{ flex: '1 1 300px' }}>The private key is created in your browser and saved to your computer as <span className="mono">{keyName}</span>. It is never sent to CertDesk or the CA, so keep that file safe.</span>
          </div>
          {v.csr ? (
            <div className="alert green">
              <Icon name="tick" />
              <span style={{ flex: '1 1 300px' }}>Key and CSR created for <span className="mono">{commonName}</span>. The key file was downloaded.</span>
              {key ? <button type="button" className="btn sm" onClick={() => download(keyName, key)}>Download key again</button> : null}
            </div>
          ) : (
            <button type="button" className="btn primary" disabled={busy || !commonName} onClick={generate} style={{ alignSelf: 'flex-start' }}>
              {busy ? 'Creating key…' : 'Generate key and CSR'}
            </button>
          )}
        </>
      ) : (
        <>
          <div className="field">
            <label htmlFor="csr">CSR</label>
            <textarea className="input" id="csr" rows={8} value={v.csr} onChange={(e) => { set({ csr: e.target.value }); setDecoded(null); }}
              placeholder={'-----BEGIN CERTIFICATE REQUEST-----\n...\n-----END CERTIFICATE REQUEST-----'} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn sm" disabled={busy || !v.csr.includes('BEGIN CERTIFICATE REQUEST')} onClick={check}>{busy ? 'Checking…' : 'Check CSR'}</button>
            {decoded ? (
              <span className="small" style={{ color: decoded.cn && commonName && decoded.cn.toLowerCase() !== commonName.toLowerCase() ? 'var(--red-strong)' : 'var(--green)' }}>
                CN {decoded.cn || '?'}{decoded.o ? ` · ${decoded.o}` : ''}{decoded.keySize ? ` · ${decoded.keySize}` : ''}
                {decoded.cn && commonName && decoded.cn.toLowerCase() !== commonName.toLowerCase() ? ' — does not match the domain you entered' : ' — looks good'}
              </span>
            ) : null}
          </div>
        </>
      )}
      {err ? <div role="alert" className="alert red">{err}</div> : null}
    </div>
  );
}
