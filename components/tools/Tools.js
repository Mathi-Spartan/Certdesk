'use client';

import { useActionState, useRef, useState } from 'react';
import { generateCsr } from '@/lib/csr-browser';
import { decodeCsrTool, decodeCertTool, checkSslTool } from '@/app/actions/tools';

const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function Copy({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn sm" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch {} }}>
      {done ? 'Copied' : label}
    </button>
  );
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/x-pem-file' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

function Rows({ rows }) {
  return (
    <dl className="cc-dl">
      {rows.filter(([, v]) => v != null && v !== '').map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}

function Waiting({ title, text }) {
  return (
    <div className="cc-card cc-wait">
      <span aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6z" /><path d="m9 12 2 2 4-4" /></svg></span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function Err({ children }) {
  return children ? <div className="cc-alert bad" role="alert">{children}</div> : null;
}

/* ------------------------------------------------------------- CSR generator */
export function CsrGenerator() {
  const [f, setF] = useState({ cn: '', sans: '', o: '', ou: '', l: '', st: '', c: 'IN', keyType: 'rsa2048' });
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function go(e) {
    e.preventDefault();
    setErr('');
    const cn = f.cn.trim().toLowerCase();
    if (!/^(\*\.)?([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(cn)) return setErr('Enter the domain the certificate is for, like www.example.com');
    if (f.c && !/^[A-Za-z]{2}$/.test(f.c)) return setErr('Country must be a two-letter code, like IN or US.');
    setBusy(true);
    try {
      const sans = f.sans.split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
      setOut(await generateCsr({ cn, sans, o: f.o.trim(), ou: f.ou.trim(), l: f.l.trim(), st: f.st.trim(), c: f.c.trim().toUpperCase(), keyType: f.keyType }));
    } catch (e2) {
      setErr(e2.message || 'Could not generate the CSR in this browser.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cc-tool">
      <form className="cc-card cc-form" onSubmit={go}>
        <h2>Certificate details</h2>
        <div className="field"><label htmlFor="cn">Common name (domain)</label><input id="cn" className="input" value={f.cn} onChange={set('cn')} placeholder="www.example.com" required /></div>
        <div className="field"><label htmlFor="sans">Additional domains <span className="muted">(optional)</span></label><input id="sans" className="input" value={f.sans} onChange={set('sans')} placeholder="example.com, mail.example.com" /></div>
        <div className="cc-grid2">
          <div className="field"><label htmlFor="o">Organisation <span className="muted">(OV/EV)</span></label><input id="o" className="input" value={f.o} onChange={set('o')} /></div>
          <div className="field"><label htmlFor="ou">Department</label><input id="ou" className="input" value={f.ou} onChange={set('ou')} /></div>
          <div className="field"><label htmlFor="l">City</label><input id="l" className="input" value={f.l} onChange={set('l')} /></div>
          <div className="field"><label htmlFor="st">State</label><input id="st" className="input" value={f.st} onChange={set('st')} /></div>
          <div className="field"><label htmlFor="c">Country code</label><input id="c" className="input" value={f.c} onChange={set('c')} maxLength={2} /></div>
          <div className="field"><label htmlFor="kt">Key</label>
            <select id="kt" className="input" value={f.keyType} onChange={set('keyType')}>
              <option value="rsa2048">RSA 2048 (most compatible)</option>
              <option value="rsa4096">RSA 4096</option>
              <option value="ec">ECDSA P-256 (fast, modern)</option>
            </select>
          </div>
        </div>
        <Err>{err}</Err>
        <div><button className="btn primary" disabled={busy}>{busy ? 'Generating…' : 'Generate CSR'}</button></div>
        <p className="small muted">The private key is created in your browser and is never sent to us. Save it before leaving this page.</p>
      </form>
      {out ? (
        <div className="cc-results">
          <section className="cc-card cc-out">
            <header><h2>CSR</h2><div className="cc-row"><Copy text={out.csr} /><button type="button" className="btn sm" onClick={() => download(`${f.cn.trim() || 'request'}.csr`, out.csr)}>Download</button></div></header>
            <textarea className="input" readOnly rows={10} value={out.csr} />
            <p className="small muted">Paste this when you request a certificate.</p>
          </section>
          <section className="cc-card cc-out warn">
            <header><h2>Private key</h2><div className="cc-row"><Copy text={out.privateKey} /><button type="button" className="btn sm primary" onClick={() => download(`${f.cn.trim() || 'request'}.key`, out.privateKey)}>Download key</button></div></header>
            <textarea className="input" readOnly rows={10} value={out.privateKey} />
            <p className="small"><strong>Keep this secret and safe.</strong> You need it to install the certificate, and nobody can recover it for you.</p>
          </section>
        </div>
      ) : <Waiting title="Your CSR and key will appear here" text="Fill in the domain and choose a key type. Generation takes a second or two." />}
    </div>
  );
}

/* ------------------------------------------------------------- CSR decoder */
export function CsrDecoder() {
  const [state, action, pending] = useActionState(decodeCsrTool, null);
  const get = (k) => state?.subject?.find((s) => s.key === k)?.value;
  return (
    <div className="cc-tool">
      <form className="cc-card cc-form" action={action}>
        <h2>Paste your CSR</h2>
        <textarea name="csr" className="input" rows={12} defaultValue={state?.pem || ''} placeholder="-----BEGIN CERTIFICATE REQUEST-----" required />
        <Err>{state?.error}</Err>
        <div><button className="btn primary" disabled={pending}>{pending ? 'Decoding…' : 'Decode CSR'}</button></div>
      </form>
      {state?.ok ? (
        <section className="cc-card cc-out">
          <header><h2>{get('CN') || 'CSR'}</h2><span className="db-pill ok"><i />Valid CSR</span></header>
          <Rows rows={[
            ['Common name', get('CN')],
            ['Additional names', state.sans.filter((s) => s !== get('CN')).join(', ') || 'None'],
            ['Organisation', get('O')], ['Department', get('OU')], ['City', get('L')], ['State', get('ST')], ['Country', get('C')], ['Email', get('Email')],
            ['Key', `${state.key.type} ${state.key.size || ''}`.trim()]
          ]} />
          {state.key.type === 'RSA' && state.key.size < 2048 ? <div className="cc-alert bad">RSA keys under 2048 bits are rejected by every CA. Generate a new CSR.</div> : null}
        </section>
      ) : <Waiting title="Nothing decoded yet" text="Paste a CSR on the left to see its domain, organisation details and key." />}
    </div>
  );
}

/* ------------------------------------------------------------- Certificate decoder */
function CertCard({ c, title }) {
  const tone = c.daysLeft < 0 ? 'action' : c.daysLeft <= 30 ? 'progress' : 'ok';
  return (
    <section className="cc-card cc-out">
      <header>
        <h2>{title || c.cn || 'Certificate'}</h2>
        <span className={`db-pill ${tone}`}><i />{c.daysLeft < 0 ? `Expired ${-c.daysLeft} days ago` : `${c.daysLeft} days left`}</span>
      </header>
      <Rows rows={[
        ['Common name', c.cn],
        ['Names covered', c.sans.join(', ') || c.cn],
        ['Organisation', c.org],
        ['Issued by', c.issuerCn && c.issuer && c.issuerCn !== c.issuer ? `${c.issuer} · ${c.issuerCn}` : c.issuer || c.issuerCn],
        ['Valid', `${fmt(c.validFrom)} → ${fmt(c.validTo)}`],
        ['Key', c.key],
        ['Serial', <span className="mono small" key="s">{c.serial}</span>],
        ['SHA-256', <span className="mono small cc-break" key="f">{c.sha256}</span>],
        ['Self-signed', c.selfSigned ? 'Yes' : null]
      ]} />
    </section>
  );
}

export function CertDecoder() {
  const [state, action, pending] = useActionState(decodeCertTool, null);
  return (
    <div className="cc-tool">
      <form className="cc-card cc-form" action={action}>
        <h2>Paste a certificate</h2>
        <textarea name="cert" className="input" rows={12} defaultValue={state?.pem || ''} placeholder="-----BEGIN CERTIFICATE-----" required />
        <p className="small muted">You can paste a full chain; each certificate is shown separately.</p>
        <Err>{state?.error}</Err>
        <div><button className="btn primary" disabled={pending}>{pending ? 'Decoding…' : 'Decode certificate'}</button></div>
      </form>
      {state?.ok ? <div className="cc-results">{state.certs.map((c, i) => <CertCard key={c.sha256} c={c} title={state.certs.length > 1 ? `${i === 0 ? 'Server' : 'Chain'} · ${c.cn || c.issuer}` : null} />)}</div> : <Waiting title="Nothing decoded yet" text="Paste a certificate to see its names, issuer, validity and fingerprint." />}
    </div>
  );
}

/* ------------------------------------------------------------- SSL checker */
export function SslChecker({ initial = '' }) {
  const [state, action, pending] = useActionState(checkSslTool, null);
  const ref = useRef(null);
  const leaf = state?.chain?.[0];
  const ok = state?.ok && state.authorized && state.covers && leaf?.daysLeft >= 0;
  return (
    <div className="cc-tool">
      <form className="cc-card cc-form" action={action}>
        <label className="cc-flabel" htmlFor="host">Website address</label>
        <div className="cc-combo">
          <span className="cc-prefix">https://</span>
          <input id="host" name="host" ref={ref} defaultValue={state?.host || initial} placeholder="www.example.com" autoComplete="off" spellCheck="false" required />
          <button className="btn primary" disabled={pending}>{pending ? 'Checking…' : 'Run check'}</button>
        </div>
        <div className="cc-try">Try:{['www.google.com', 'github.com', 'www.digicert.com'].map((d) => <button key={d} type="button" onClick={() => { if (ref.current) { ref.current.value = d; ref.current.form?.requestSubmit(); } }}>{d}</button>)}</div>
      </form>
      <Err>{state?.error}</Err>
      {state?.ok ? (
        <>
          <section className={`cc-card cc-verdict ${ok ? 'good' : 'bad'}`}>
            <strong>{ok ? `${state.host} is correctly secured` : `${state.host} has a problem`}</strong>
            <ul>
              <li className={state.covers ? 'y' : 'n'}>{state.covers ? 'The certificate covers this name' : 'The certificate does not cover this name'}</li>
              <li className={state.authorized ? 'y' : 'n'}>{state.authorized ? 'Trusted by browsers, chain complete' : `Not trusted: ${state.reason || 'chain problem'}`}</li>
              {leaf ? <li className={leaf.daysLeft > 30 ? 'y' : 'n'}>{leaf.daysLeft < 0 ? 'Expired' : `Expires ${fmt(leaf.validTo)} (in ${leaf.daysLeft} days)`}</li> : null}
              <li className="y">{state.protocol} · {state.cipher} · {state.ip} · {state.ms} ms</li>
            </ul>
          </section>
          <div className="cc-results">{state.chain.map((c, i) => <CertCard key={c.sha256 + i} c={c} title={`${i === 0 ? 'Server certificate' : i === state.chain.length - 1 && c.selfSigned ? 'Root' : 'Intermediate'} · ${c.cn || c.issuer}`} />)}</div>
        </>
      ) : <Waiting title={pending ? 'Checking…' : 'No check run yet'} text="Enter a domain above. You'll see whether the certificate is trusted, which names it covers and when it expires." />}
    </div>
  );
}
