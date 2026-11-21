'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import CertTable from './CertTable';

const TABS = [
  { key: '', label: 'All' },
  { key: 'action', label: 'Needs action', hot: true },
  { key: 'expiring', label: 'Expiring soon' },
  { key: 'ok', label: 'Valid' },
  { key: 'pending', label: 'In progress', optional: true },
  { key: 'auto', label: 'Automated', optional: true },
  { key: 'closed', label: 'Closed', optional: true }
];
const CHIPS = [
  { key: 'validate', cta: 'Validate', label: 'to validate', tone: 'amber' },
  { key: 'reissue', cta: 'Reissue', label: 'to reissue', tone: 'amber' },
  { key: 'renew', cta: 'Renew', label: 'to renew', tone: 'red' }
];

/** Filters, chips and search all run in the browser, so switching is instant. */
export default function CertBrowser({ rows, initialFilter = '', initialTerm = '', admin }) {
  const [f, setF] = useState(initialFilter);
  const [term, setTerm] = useState(initialTerm);
  const [, startTransition] = useTransition();

  const pick = (key) => startTransition(() => setF((cur) => (cur === key && CHIPS.some((c) => c.key === key) ? 'action' : key)));

  // keep the address bar in step without a page load
  useEffect(() => {
    const qs = new URLSearchParams({ ...(f ? { f } : {}), ...(term.trim() ? { q: term.trim() } : {}) }).toString();
    window.history.replaceState(window.history.state, '', '/orders' + (qs ? '?' + qs : ''));
  }, [f, term]);

  const counts = useMemo(() => {
    const c = {};
    for (const t of TABS) c[t.key] = rows.filter((r) => r.fk.includes(t.key)).length;
    for (const ch of CHIPS) c[ch.key] = rows.filter((r) => r.fk.includes('action') && r.next?.cta === ch.cta).length;
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const chip = CHIPS.find((c) => c.key === f);
    const t = term.trim().toLowerCase();
    return rows
      .filter((r) => (chip ? r.fk.includes('action') && r.next?.cta === chip.cta : r.fk.includes(f)))
      .filter((r) => !t || [r.domain, r.product, String(r.ref || ''), ...(r.tags || [])].join(' ').toLowerCase().includes(t));
  }, [rows, f, term]);

  const back = '/orders' + (f ? `?f=${f}` : '');
  const chipsShown = CHIPS.filter((c) => counts[c.key]);

  return (
    <>
      {chipsShown.length ? (
        <div className="mc-chips" aria-label="What needs you">
          {chipsShown.map((c) => (
            <button key={c.key} type="button" className={`mc-chip ${c.tone} ${f === c.key ? 'on' : ''}`} onClick={() => pick(c.key)} aria-pressed={f === c.key}>
              <b>{counts[c.key]}</b>{c.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mc-bar">
        <nav className="mc-seg" aria-label="Filter certificates">
          {TABS.filter((t) => !t.optional || counts[t.key]).map((t) => (
            <button key={t.key || 'all'} type="button" className={f === t.key ? 'on' : ''} aria-pressed={f === t.key} onClick={() => pick(t.key)}>
              {t.label}<em className={t.hot && counts[t.key] ? 'hot' : ''}>{counts[t.key]}</em>
            </button>
          ))}
        </nav>
        <div className="mc-search" role="search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search domain or order" aria-label="Search certificates" enterKeyHint="search" />
          {term ? <button type="button" className="mc-x" aria-label="Clear search" onClick={() => setTerm('')}>×</button> : null}
        </div>
      </div>

      <CertTable rows={shown} admin={admin} back={back} empty={rows.length ? 'none' : 'first'} />
    </>
  );
}
