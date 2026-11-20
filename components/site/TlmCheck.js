'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

const QS = [
  { k: 'count', q: 'How many certificates do you manage today?', opts: [['small', 'Under 50'], ['mid', '50 – 500'], ['large', 'More than 500']] },
  { k: 'private', q: 'Do you issue private certificates (Microsoft CA, devices, users, Wi-Fi, VPN)?', opts: [['yes', 'Yes'], ['no', 'No']] },
  { k: 'multica', q: 'Are your certificates spread across more than one CA or team?', opts: [['yes', 'Yes'], ['no', 'No']] },
  { k: 'unknown', q: 'Do you need to find certificates you don’t know about (network, cloud, servers)?', opts: [['yes', 'Yes'], ['no', 'No']] },
  { k: 'integr', q: 'Do certificates need to flow into tools like ServiceNow, F5, Kubernetes, MDM or HSMs?', opts: [['yes', 'Yes'], ['no', 'No']] },
  { k: 'policy', q: 'Do you need approval workflows, policies or audit reports for compliance?', opts: [['yes', 'Yes'], ['no', 'No']] }
];

export default function TlmCheck({ contact }) {
  const [a, setA] = useState({});
  const answered = QS.filter((x) => a[x.k]).length;
  const done = answered === QS.length;

  const r = useMemo(() => {
    const yes = ['private', 'multica', 'unknown', 'integr', 'policy'].filter((k) => a[k] === 'yes');
    const big = a.count === 'large';
    const mid = a.count === 'mid';
    let score = yes.length * 18 + (big ? 30 : mid ? 12 : 0);
    score = Math.min(100, score);
    const tlm = big || (mid && yes.length >= 2) || yes.length >= 3;
    const reasons = [];
    if (big) reasons.push('A large certificate estate benefits from central discovery and automation.');
    if (a.private === 'yes') reasons.push('Private PKI (users, devices, Microsoft CA) can be managed alongside public certificates.');
    if (a.multica === 'yes') reasons.push('CA-agnostic management brings certificates from different CAs and teams into one inventory.');
    if (a.unknown === 'yes') reasons.push('Network and cloud discovery finds certificates nobody is tracking yet.');
    if (a.integr === 'yes') reasons.push('Pre-built integrations and ACME, SCEP and EST protocols connect to your systems.');
    if (a.policy === 'yes') reasons.push('Policies, workflows and reporting support audits and compliance.');
    const why = !tlm
      ? [
          a.count === 'small' ? 'With under 50 certificates, a full CLM platform is more than you need.' : 'Your needs are mostly public TLS certificates for websites.',
          'Plan + Automate installs and renews certificates on Apache, NGINX or IIS for you.',
          'ACME Certificate-as-a-Service covers many domains through Certbot, acme.sh, Caddy or cert-manager.',
          'Ready for 100-day (2027) and 47-day (2029) certificate lifetimes without manual work.'
        ]
      : reasons;
    return { tlm, score: tlm ? Math.max(score, 70) : Math.min(score, 45), why };
  }, [a]);

  return (
    <div className="tc">
      <div className="tc-qs">
        <div className="tc-head">
          <strong>Do you need Trust Lifecycle Manager?</strong>
          <span>{answered} of {QS.length} answered</span>
        </div>
        <div className="tc-progress" aria-hidden="true"><i style={{ width: `${(answered / QS.length) * 100}%` }} /></div>
        <ol>
          {QS.map((x, i) => (
            <li key={x.k} className={a[x.k] ? 'done' : ''}>
              <span className="tc-n">{a[x.k] ? '✓' : i + 1}</span>
              <div>
                <p>{x.q}</p>
                <div className="tc-opts" role="radiogroup" aria-label={x.q}>
                  {x.opts.map(([v, l]) => (
                    <button key={v} type="button" role="radio" aria-checked={a[x.k] === v} className={a[x.k] === v ? 'on' : ''} onClick={() => setA((s) => ({ ...s, [x.k]: v }))}>{l}</button>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className={`tc-result ${done ? (r.tlm ? 'tlm' : 'retail') : 'wait'}`} aria-live="polite">
        {!done ? (
          <div className="tc-wait">
            <span className="tc-wait-ico" aria-hidden="true">?</span>
            <strong>Answer the {QS.length} questions</strong>
            <p>We’ll tell you whether an enterprise platform like DigiCert Trust Lifecycle Manager fits, or whether retail automation is the simpler, better choice.</p>
          </div>
        ) : (
          <div className="tc-out" key={r.tlm ? 't' : 'r'}>
            <span className="tc-tag">{r.tlm ? 'Recommended: enterprise CLM' : 'Recommended: retail automation'}</span>
            <h3>{r.tlm ? 'DigiCert Trust Lifecycle Manager is a good fit' : 'You don’t need TLM. Retail automation will do the job.'}</h3>
            <div className="tc-meter" aria-label={`TLM fit ${r.score} out of 100`}>
              <div><i style={{ width: `${r.score}%` }} /></div>
              <span>TLM fit <b>{r.score}</b>/100</span>
            </div>
            <ul>{r.why.map((w) => <li key={w}>{w}</li>)}</ul>
            <div className="tc-ctas">
              {r.tlm ? (
                <>
                  <a className="lp-btn lp-btn-primary" href={contact}>Book a TLM consultation</a>
                  <a className="lp-btn lp-btn-ghost" href="#automation">Compare with retail automation</a>
                </>
              ) : (
                <>
                  <Link className="lp-btn lp-btn-primary" href="/ssl?type=auto">See automated SSL plans</Link>
                  <Link className="lp-btn lp-btn-ghost" href="/finder">Find my certificate</Link>
                </>
              )}
            </div>
            <button type="button" className="tc-reset" onClick={() => setA({})}>Start again</button>
          </div>
        )}
      </div>
    </div>
  );
}
