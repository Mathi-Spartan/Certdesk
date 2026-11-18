'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import CsrStep from '@/components/CsrStep';
import { preflight, approverEmails, placeOrder } from '@/app/actions/orders';

const STEPS = ['Domain', 'Certificate', 'Key', 'Validation', 'Review'];
const LEVELS = {
  dv: { label: 'Domain validated', note: 'Issued in minutes. Right for most websites.' },
  ov: { label: 'Business validated', note: 'Shows your organisation in the certificate. 1–3 days.' },
  ev: { label: 'Extended validation', note: 'Strictest company checks. 3–7 days.' }
};
const VLABEL = { dv: 'DV', ov: 'OV', ev: 'EV', code: 'Code signing' };

function kindLabel(p) {
  if (p.validation === 'code') return 'Code signing';
  if (p.wildcard) return `${VLABEL[p.validation]} · Wildcard`;
  if (p.multidomain) return `${VLABEL[p.validation]} · Multi-domain`;
  return VLABEL[p.validation] || 'SSL';
}

function months(n) {
  if (n % 12 === 0) return `${n / 12} year${n === 12 ? '' : 's'}`;
  return `${n} months`;
}

export default function BuyWizard({ products, renewal, defaults }) {
  const router = useRouter();
  const [step, setStep] = useState(renewal ? 2 : 0);
  const [moreDomains, setMoreDomains] = useState(!!renewal?.sans?.length);
  const [level, setLevel] = useState(null);
  const [showContact, setShowContact] = useState(false);
  const [productId, setProductId] = useState(renewal?.productId && products.some((p) => p.id === renewal.productId) ? renewal.productId : products[0].id);
  const [cn, setCn] = useState(renewal?.commonName || '');
  const [sansText, setSansText] = useState((renewal?.sans || []).join('\n'));
  const [checks, setChecks] = useState(null);
  const [period, setPeriod] = useState(renewal?.period || 12);
  const [csr, setCsr] = useState({ mode: 'generate', csr: '', keyType: 'ec', org: defaults.org?.name || '', country: defaults.org?.country || '' });
  const [dcv, setDcv] = useState(renewal?.dcvMethod || 'dns');
  const [emails, setEmails] = useState([]);
  const [approver, setApprover] = useState('');
  const [contact, setContact] = useState({ firstname: defaults.firstname, lastname: defaults.lastname, email: defaults.email, phone: defaults.phone, title: defaults.title });
  const [org, setOrg] = useState({ name: '', division: '', addressline1: '', city: '', region: '', postalcode: '', country: '', phone: '', ...(defaults.org || {}) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const product = products.find((p) => p.id === productId) || products[0];
  const sans = useMemo(() => sansText.split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean), [sansText]);
  const periods = (product.prices || []).map((p) => p.months).filter((m) => m > 0);
  const periodList = periods.length ? periods : [12];
  const needsOrg = product.validation === 'ov' || product.validation === 'ev';
  const wildcard = cn.startsWith('*.');
  // products that fit what the customer typed
  const fitting = useMemo(() => {
    const isWild = cn.trim().startsWith('*.');
    const many = sans.length > 0;
    let list = products.filter((p) => p.validation !== 'code' && (isWild ? p.wildcard : !p.wildcard) && (many ? p.multidomain : true));
    if (!many) {
      const single = list.filter((p) => !p.multidomain);
      if (single.length) list = single;
    }
    return list;
  }, [products, cn, sans]);
  const levels = ['dv', 'ov', 'ev'].filter((l) => fitting.some((p) => p.validation === l));
  const activeLevel = level && levels.includes(level) ? level : levels[0];
  const shown = fitting.filter((p) => p.validation === activeLevel);

  function pickProduct(p) {
    setProductId(p.id);
    setLevel(p.validation);
    const ps = (p.prices || []).map((x) => x.months).filter((m) => m > 0);
    if (ps.length && !ps.includes(Number(period))) setPeriod(ps.includes(12) ? 12 : ps[0]);
  }
  const productFits = fitting.some((p) => p.id === product.id);
  function canNext() {
    if (step === 0) return /^(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}$/i.test(cn.trim()) && fitting.length > 0;
    if (step === 1) return productFits && periodList.includes(Number(period));
    if (step === 2) return csr.csr.includes('BEGIN CERTIFICATE REQUEST');
    if (step === 3) return dcv !== 'email' || !!approver;
    return !!(contact.firstname && contact.lastname && contact.email);
  }

  async function runPreflight() {
    if (!cn.trim()) return;
    setChecks({ loading: true });
    const r = await preflight(cn);
    setChecks(r);
  }

  async function loadEmails() {
    if (emails.length) return;
    const r = await approverEmails(cn);
    setEmails(r.emails || []);
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    const r = await placeOrder({
      productId: product.id,
      commonName: cn.trim().toLowerCase(),
      sans,
      period: Number(period),
      csr: csr.csr,
      dcvMethod: dcv,
      approverEmail: approver,
      contact,
      org: needsOrg ? org : null,
      renewalOf: renewal?.id || null,
      tags: renewal?.tags || []
    });
    if (r?.error) {
      setErr(r.error);
      setBusy(false);
      return;
    }
    router.push(`/certificates/${r.id}?ok=${encodeURIComponent('Order placed with GoGetSSL. Complete validation below.')}`);
  }

  const dcvOptions = [
    { id: 'dns', label: 'Add a DNS record', note: 'Add one record. Best for wildcards, and keeping it in place speeds up reissues.', badge: 'Recommended' },
    { id: 'http', label: 'Upload a file (HTTP)', note: 'Upload a small text file to /.well-known/pki-validation/.', badge: 'Single server', disabled: wildcard },
    { id: 'https', label: 'Upload a file (HTTPS)', note: 'Same as HTTP, served over HTTPS.', badge: 'Single server', disabled: wildcard },
    { id: 'email', label: 'Approve by email', note: 'Click a link sent to admin@, webmaster@ or similar.', badge: 'Email', disabled: sans.length > 0 }
  ];

  return (
    <div style={{ maxWidth: 1280, width: '100%', margin: '0 auto', padding: '28px 24px 48px', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
      <nav aria-label="Steps" style={{ flex: '1 1 200px', maxWidth: 230 }}>
        {renewal ? <div className="alert violet small" style={{ marginBottom: 12 }}>Renewing the order for <span className="mono">{renewal.commonName}</span>. This places a new order. Settings are copied from the current one.</div> : null}
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {STEPS.map((label, i) => (
            <li key={label}>
              <button type="button" onClick={() => i < step && setStep(i)} disabled={i > step}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, height: 42, padding: '0 10px', border: 0, borderRadius: 8, background: i === step ? 'var(--accent-soft)' : 'transparent', cursor: i < step ? 'pointer' : 'default', font: 'inherit', color: 'var(--ink)', textAlign: 'left' }}>
                <span className={`node ${i < step ? 'done' : i === step ? 'now' : 'todo'}`} style={{ width: 24, height: 24, color: i === step ? '#fff' : 'var(--muted)', fontSize: 12, fontWeight: 600, boxShadow: 'none' }}>
                  {i < step ? <Icon name="tick" size={12} stroke="#fff" width={3.5} /> : i + 1}
                </span>
                <span style={{ fontWeight: i === step ? 600 : 500 }}>{label}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <section className="card" style={{ flex: '999 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
          {step === 0 ? (
            <>
              <div><h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Which domain do you want to secure?</h1><p className="sub">Type it and we&apos;ll suggest the certificates that fit. Start with *. for a wildcard.</p></div>
              <div className="field">
                <label htmlFor="cn">Domain</label>
                <input className="input mono" id="cn" value={cn} autoFocus onChange={(e) => { setCn(e.target.value.trim().toLowerCase()); setChecks(null); setEmails([]); }} onBlur={runPreflight}
                  placeholder="example.com or *.example.com" disabled={!!renewal} style={{ height: 46, fontSize: 16 }} />
              </div>
              {!moreDomains ? (
                <button type="button" className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setMoreDomains(true)} disabled={!!renewal}><Icon name="plus" />Add more domains to the same certificate</button>
              ) : (
                <div className="field">
                  <label htmlFor="sans">More domains <span className="muted">(one per line)</span></label>
                  <textarea className="input mono" id="sans" rows={3} value={sansText} onChange={(e) => setSansText(e.target.value)} disabled={!!renewal} placeholder={'www.example.com\nshop.example.com'} />
                </div>
              )}
              {cn && fitting.length === 0 ? <div className="alert amber"><Icon name="info" />No certificate on offer covers {sans.length ? 'several domains' : wildcard ? 'a wildcard' : 'this'} yet. Ask your provider to enable one.</div> : null}
              {checks?.loading ? <div className="small muted">Checking DNS…</div> : null}
              {checks?.error ? <div className="alert red">{checks.error}</div> : null}
              {checks?.checks ? (
                <ul style={{ listStyle: 'none', margin: 0, padding: '14px 16px', background: '#FAFAFA', border: '1px solid var(--line)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                  {checks.checks.map((c, i) => (
                    <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      {c.ok ? <Icon name="tick" stroke="var(--green)" width={2.6} /> : <Icon name="info" stroke="#B45309" />}{c.text}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}

          {step === 1 ? (
            <>
              <div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Choose your certificate</h1>
                <p className="sub">These fit <span className="mono">{cn}{sans.length ? ` +${sans.length}` : ''}</span>.</p>
              </div>
              {levels.length > 1 ? (
                <div className="choices" role="radiogroup" aria-label="Level of checks">
                  {levels.map((l) => (
                    <button key={l} type="button" role="radio" aria-checked={activeLevel === l} className={`choice ${activeLevel === l ? 'on' : ''}`}
                      onClick={() => { const first = fitting.find((p) => p.validation === l); if (first) pickProduct(first); }}>
                      <span className="t">{LEVELS[l].label}</span>
                      <span className="d">{LEVELS[l].note}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="choices" role="radiogroup" aria-label="Certificate">
                {shown.map((p, i) => (
                  <button key={p.id} type="button" role="radio" aria-checked={p.id === productId} className={`choice ${p.id === productId ? 'on' : ''}`} onClick={() => pickProduct(p)}>
                    <span className="between" style={{ gap: 8 }}>
                      <span className="t">{p.name}</span>
                      {i === 0 ? <span className="badge tone-violet">Suggested</span> : null}
                    </span>
                    <span className="d">{p.brand} · {kindLabel(p)}{p.multidomain && p.san_max ? ` · up to ${p.san_max} domains` : ''}</span>
                  </button>
                ))}
              </div>
              <div className="field" style={{ maxWidth: 360 }}>
                <label htmlFor="term">Order term</label>
                <select className="input" id="term" value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
                  {periodList.map((m) => <option key={m} value={m}>{months(m)}</option>)}
                </select>
                <span className="small muted">Each certificate lasts up to 200 days. Reissue free as often as you like during the term.</span>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div><h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Create your key</h1><p className="sub">Easiest: generate it here. Your private key downloads to your computer and never reaches us. Or paste a CSR from your server.</p></div>
              <CsrStep commonName={cn} sans={sans} value={csr} onChange={setCsr} />
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div><h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>How will you prove you own {cn}?</h1><p className="sub">You&apos;ll get exact instructions right after ordering.</p></div>
              <div role="radiogroup" aria-label="Validation method" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {dcvOptions.map((d) => (
                  <button key={d.id} type="button" role="radio" aria-checked={dcv === d.id} disabled={d.disabled} className={`choice ${dcv === d.id ? 'on' : ''}`}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', opacity: d.disabled ? 0.5 : 1 }}
                    onClick={() => { setDcv(d.id); if (d.id === 'email') loadEmails(); }}>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span className="t">{d.label}</span><span className="d">{d.disabled ? 'Not available for this domain' : d.note}</span></span>
                    <span className="small" style={{ fontWeight: 600, color: dcv === d.id ? 'var(--accent-ink)' : 'var(--muted)', whiteSpace: 'nowrap' }}>{d.badge}</span>
                  </button>
                ))}
              </div>
              {dcv === 'email' ? (
                <div className="field">
                  <label htmlFor="appr">Approver email</label>
                  <select className="input" id="appr" value={approver} onChange={(e) => setApprover(e.target.value)}>
                    <option value="">{emails.length ? 'Choose an address' : 'Loading addresses…'}</option>
                    {emails.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              ) : null}
            </>
          ) : null}

          {step === 4 ? (
            <>
              <div><h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Check and place your order</h1><p className="sub">Nothing is ordered until you click Place order.</p></div>
              <dl style={{ margin: 0, border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                {[
                  ['Domain', <span className="mono" key="d">{cn}{sans.length ? ` +${sans.length}` : ''}</span>, 0],
                  ['Certificate', product.name, 1],
                  ['Order term', months(Number(period)), 1],
                  ['Key', csr.mode === 'generate' ? `Made in your browser · ${csr.keyType === 'ec' ? 'ECDSA P-256' : csr.keyType.toUpperCase()}` : 'Your own CSR', 2],
                  ['Validation', dcv === 'email' ? `Email · ${approver}` : dcvOptions.find((d) => d.id === dcv)?.label, 3]
                ].map(([k, val, go]) => (
                  <div key={k} className="between" style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-soft)' }}>
                    <dt className="muted">{k}</dt>
                    <dd style={{ margin: 0, fontWeight: 600, display: 'flex', gap: 12, alignItems: 'center' }}>
                      {val}
                      {!renewal || go >= 2 ? <button type="button" className="btn sm ghost" onClick={() => setStep(go)}>Change</button> : null}
                    </dd>
                  </div>
                ))}
              </dl>
              {!showContact && !needsOrg && contact.firstname && contact.lastname && contact.email ? (
                <div className="between" style={{ padding: '12px 16px', border: '1px solid var(--line)', borderRadius: 10 }}>
                  <span><span className="muted">Contact</span> <strong style={{ marginLeft: 8 }}>{contact.firstname} {contact.lastname}</strong> <span className="muted">· {contact.email}</span></span>
                  <button type="button" className="btn sm ghost" onClick={() => setShowContact(true)}>Change</button>
                </div>
              ) : (
                <div>
                  <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>Contact for this certificate</h2>
                  <div className="grid-form">
                    {[['firstname', 'First name'], ['lastname', 'Last name'], ['email', 'Email'], ['phone', 'Phone'], ['title', 'Job title']].map(([k, l]) => (
                      <div className="field" key={k}><label htmlFor={`c-${k}`}>{l}</label><input className="input" id={`c-${k}`} value={contact[k]} onChange={(e) => setContact({ ...contact, [k]: e.target.value })} /></div>
                    ))}
                  </div>
                </div>
              )}
              {needsOrg ? (
                <div>
                  <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>Your organisation (checked by the CA)</h2>
                  <div className="grid-form">
                    {[['name', 'Legal name'], ['division', 'Department'], ['addressline1', 'Address'], ['city', 'City'], ['region', 'State / region'], ['postalcode', 'Postal code'], ['country', 'Country code (e.g. IN)'], ['phone', 'Phone']].map(([k, l]) => (
                      <div className="field" key={k}><label htmlFor={`o-${k}`}>{l}</label><input className="input" id={`o-${k}`} value={org[k] || ''} onChange={(e) => setOrg({ ...org, [k]: e.target.value })} /></div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {err ? <div role="alert" className="alert red"><Icon name="alert" />{err}</div> : null}
        </div>

        <div className="between" style={{ padding: '16px 28px', borderTop: '1px solid var(--line)' }}>
          <button type="button" className="btn" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0 || busy}>Back</button>
          <span className="small muted">Step {step + 1} of {STEPS.length}</span>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn primary" onClick={() => { setErr(null); if (step === 0) { if (!checks) runPreflight(); if (!productFits) { const first = fitting.find((p) => p.validation === activeLevel) || fitting[0]; if (first) pickProduct(first); } } setStep(step + 1); }} disabled={!canNext()}>Continue</button>
          ) : (
            <button type="button" className="btn dark-btn" onClick={submit} disabled={busy}>{busy ? 'Placing order…' : renewal ? 'Place renewal order' : 'Place order'}</button>
          )}
        </div>
      </section>

      <aside className="card pad" aria-label="Summary" style={{ flex: '1 1 260px', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="small muted" style={{ fontWeight: 600, letterSpacing: '.06em' }}>SUMMARY</div>
        {step >= 1 ? <div><div style={{ fontWeight: 600, fontSize: 16 }}>{product.name}</div><div className="small muted">{kindLabel(product)} · {product.brand}</div></div> : <div className="small muted">Your choices appear here.</div>}
        <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
          <div className="between"><dt className="muted">Domain</dt><dd style={{ margin: 0 }} className="mono">{cn || '—'}</dd></div>
          <div className="between"><dt className="muted">Order term</dt><dd style={{ margin: 0 }}>{months(Number(period))}</dd></div>
          <div className="between"><dt className="muted">Validation</dt><dd style={{ margin: 0 }}>{dcv.toUpperCase()}</dd></div>
        </dl>
        <div className="small muted">Billing is handled by your provider.</div>
      </aside>
    </div>
  );
}
