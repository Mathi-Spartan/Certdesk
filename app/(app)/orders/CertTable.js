'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import BrandLogo from '@/components/site/BrandLogo';
import { bulkOrderAutoRenew, bulkRefresh } from '@/app/actions/orders';

const DAY = 86400000;
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const short = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—');
const ago = (d) => {
  if (!d) return 'never';
  const m = Math.round((Date.now() - new Date(d)) / 60000);
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};
const BRAND_NAME = { digicert: 'DigiCert', sectigo: 'Sectigo', comodo: 'Comodo', geotrust: 'GeoTrust', thawte: 'Thawte', rapidssl: 'RapidSSL', gogetssl: 'GoGetSSL' };
const BRAND_COLOR = { digicert: '#0174C3', sectigo: '#0F766E', comodo: '#B91C1C', geotrust: '#1E40AF', thawte: '#BE123C', rapidssl: '#C2410C', gogetssl: '#15803D' };
const Brand = ({ slug }) => <span className="ct-brand" style={{ '--bc': BRAND_COLOR[slug] || '#3F3F46' }}>{BRAND_NAME[slug] || 'SSL'}</span>;
const stripBrand = (name, slug) => String(name || '').replace(new RegExp(`^${BRAND_NAME[slug] || ''}\\s*`, 'i'), '') || name;
const tone = (days, warn = 30, hot = 14) => (days == null ? 'mute' : days < 0 ? 'red' : days <= hot ? 'red' : days <= warn ? 'amber' : 'green');
const urgency = (r) => (r.group === 'action' ? 0 : r.group === 'progress' ? 1 : r.group === 'ok' ? 2 : 3);
const certDays = (r) => (r.cert ? r.cert.days : r.autoDate ? r.autoDate.days : 99999);
const subDays = (r) => (r.sub ? r.sub.days : 99999);

function Life({ days, pct, line, warn, hot, empty }) {
  if (empty) return <div className="ct-life mute"><span className="ct-life-d">{empty}</span></div>;
  const t = tone(days, warn, hot);
  return (
    <div className={`ct-life ${t}`}>
      <div className="ct-life-top">
        <b>{days == null ? '—' : days < 0 ? `${-days} days ago` : days === 0 ? 'Today' : `${days} days`}</b>
        <span className="ct-life-d">{line}</span>
      </div>
      <div className="ct-track" aria-hidden="true"><i style={{ width: `${Math.max(2, Math.min(100, pct ?? 0))}%` }} /></div>
    </div>
  );
}

function certPct(r) {
  if (!r.cert) return null;
  const from = r.certFrom ? new Date(r.certFrom).getTime() : null;
  const to = new Date(r.cert.at).getTime();
  if (!from || to <= from) return r.cert.days > 0 ? 50 : 0;
  return ((to - Date.now()) / (to - from)) * 100;
}
function subPct(r) {
  if (!r.sub?.start) return r.sub ? (r.sub.days > 0 ? 50 : 0) : null;
  const a = new Date(r.sub.start).getTime();
  const b = new Date(r.sub.end).getTime();
  return ((b - Date.now()) / (b - a)) * 100;
}

function Menu({ r }) {
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) ref.current.open = false; };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  const host = String(r.domain || '').replace(/^\*\./, '');
  return (
    <details className="ct-menu" ref={ref}>
      <summary aria-label={`More actions for ${r.domain}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
      </summary>
      <div className="ct-menu-list" role="menu">
        <Link href={r.href} role="menuitem">Open certificate</Link>
        {r.canDownload ? <a href={`/api/orders/${r.id}/download?format=fullchain`} role="menuitem">Download full chain</a> : null}
        {r.canDownload ? <a href={`/api/orders/${r.id}/download?format=crt`} role="menuitem">Download certificate only</a> : null}
        {r.type === 'cert' && r.sub && !r.sub.ended ? <Link href={`/certificates/${r.id}/reissue`} role="menuitem">Reissue</Link> : null}
        {host ? <Link href={`/tools/ssl-checker?host=${encodeURIComponent(host)}`} role="menuitem">Run SSL check</Link> : null}
        {r.ref ? (
          <button type="button" role="menuitem" onClick={() => { navigator.clipboard?.writeText(String(r.ref)); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? 'Copied ✓' : `Copy order number #${r.ref}`}
          </button>
        ) : null}
      </div>
    </details>
  );
}

function Preview({ r }) {
  return (
    <div className="ct-pop" role="tooltip">
      <div className="ct-pop-head"><BrandLogo slug={r.brand} name={BRAND_NAME[r.brand]} height={14} /><span>{r.status}</span></div>
      <dl>
        <div><dt>Product</dt><dd>{r.product}</dd></div>
        {r.facts ? <div><dt>Issuer</dt><dd>{r.facts.issuer}</dd></div> : null}
        {r.facts ? <div><dt>Key</dt><dd>{r.facts.key}</dd></div> : null}
        {r.facts ? <div><dt>Names</dt><dd>{r.facts.sans} on the certificate</dd></div> : null}
        <div><dt>Validation</dt><dd>{r.method || '—'}</dd></div>
        {r.cert ? <div><dt>Certificate</dt><dd>{fmt(r.certFrom)} – {fmt(r.cert.at)}</dd></div> : null}
        {r.sub ? <div><dt>Subscription</dt><dd>{fmt(r.sub.start)} – {fmt(r.sub.end)}</dd></div> : null}
        <div><dt>Last synced</dt><dd>{ago(r.synced)}</dd></div>
      </dl>
    </div>
  );
}

const SORTS = {
  urgency: (a, b) => urgency(a) - urgency(b) || Math.min(certDays(a), subDays(a)) - Math.min(certDays(b), subDays(b)),
  name: (a, b) => String(a.domain).replace(/^\*\./, '').localeCompare(String(b.domain).replace(/^\*\./, '')),
  cert: (a, b) => certDays(a) - certDays(b),
  sub: (a, b) => subDays(a) - subDays(b)
};

export default function CertTable({ rows, admin, back, empty }) {
  const [view, setView] = useState('table');
  const [sort, setSort] = useState({ key: 'urgency', dir: 1 });
  const [sel, setSel] = useState(() => new Set());
  useEffect(() => {
    try { const v = localStorage.getItem('cd_cert_view'); if (v === 'cards' || v === 'table') setView(v); } catch {}
  }, []);
  const pickView = (v) => { setView(v); try { localStorage.setItem('cd_cert_view', v); } catch {} };

  const sorted = useMemo(() => [...rows].sort((a, b) => SORTS[sort.key](a, b) * sort.dir), [rows, sort]);
  const certIds = rows.filter((r) => r.type === 'cert').map((r) => r.id);
  const showAuto = rows.some((r) => r.autoRenew);
  const showPrice = rows.some((r) => r.price);
  const showCost = admin && rows.some((r) => r.cost);
  const allOn = certIds.length > 0 && certIds.every((id) => sel.has(id));
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSel(allOn ? new Set() : new Set(certIds));
  const sortBy = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }));
  const Th = ({ k, children }) => (
    <th aria-sort={sort.key === k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`ct-sort ${sort.key === k ? 'on' : ''}`} onClick={() => sortBy(k)}>
        {children}<span aria-hidden="true">{sort.key === k ? (sort.dir > 0 ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>
  );
  const ids = [...sel];

  if (!rows.length) {
    return (
      <div className="cx3-card cx3-none">
        <strong>{empty === 'none' ? 'No certificates in this view' : 'No certificates yet'}</strong>
        {empty === 'none' ? <Link href="/orders">Show all certificates</Link> : <Link className="cx3-btn primary" href="/buy">Order your first certificate</Link>}
      </div>
    );
  }

  const Action = ({ r }) => (r.next?.cta
    ? <Link className={`cx3-btn sm ${r.next.cta === 'Renew' ? 'ct-renew' : r.next.cta === 'Reissue' ? 'ct-reissue' : 'primary'}`} href={r.next.href}>{r.next.cta}</Link>
    : <Link className="cx3-btn sm" href={r.href}>Manage</Link>);

  const CertLife = ({ r }) => (r.type === 'cert'
    ? (r.cert ? <Life days={r.cert.days} pct={certPct(r)} line={fmt(r.cert.at)} warn={30} hot={14} /> : <Life empty={r.group === 'ended' ? '—' : 'Not issued yet'} />)
    : <Life days={r.autoDate?.days} pct={70} line={r.autoDate ? `renews ${fmt(r.autoDate.at)}` : 'Automated'} warn={14} hot={3} />);
  const SubLife = ({ r }) => (r.type === 'cert'
    ? (r.sub ? <Life days={r.sub.days} pct={subPct(r)} line={`${r.sub.months ? `${r.sub.months} mo · ` : ''}until ${fmt(r.sub.end)}`} warn={60} hot={30} /> : <Life empty="—" />)
    : <Life empty="Renews on its own" />);
  const Bars = ({ r }) => (
    <div className="ct-bars">
      <div><span className="ct-k">Certificate</span><CertLife r={r} /></div>
      <div><span className="ct-k">Subscription</span><SubLife r={r} /></div>
    </div>
  );

  // Card view groups
  const groups = [
    { k: 'now', title: 'Needs action', items: sorted.filter((r) => r.group === 'action') },
    { k: 'progress', title: 'In progress', items: sorted.filter((r) => r.group === 'progress') },
    { k: 'month', title: 'Coming up in 60 days', items: sorted.filter((r) => r.group === 'ok' && Math.min(certDays(r), subDays(r)) <= 60) },
    { k: 'later', title: 'Later', items: sorted.filter((r) => (r.group === 'ok' && Math.min(certDays(r), subDays(r)) > 60) || r.group === 'ended') }
  ].filter((g) => g.items.length);

  return (
    <div className="ct">
      <div className={`ct-toolbar ${ids.length ? 'sel' : ''}`}>
        {ids.length ? (
          <form className="ct-bulk">
            {ids.map((id) => <input key={id} type="hidden" name="id" value={id} />)}
            <input type="hidden" name="back" value={back} />
            <span className="ct-bulk-n"><b>{ids.length}</b> selected</span>
            <a className="cx3-btn sm ct-ghost" href={`/api/orders/export?ids=${ids.join(',')}`}>Export CSV</a>
            <button className="cx3-btn sm ct-ghost" formAction={bulkRefresh}>Refresh status</button>
            <button className="cx3-btn sm ct-ghost" formAction={bulkOrderAutoRenew} name="auto_on" value="true">Auto-renew on</button>
            <button className="cx3-btn sm ct-ghost" formAction={bulkOrderAutoRenew} name="auto_on" value="false">Auto-renew off</button>
            <button type="button" className="ct-clear" onClick={() => setSel(new Set())}>Clear</button>
          </form>
        ) : (
          <>
            <span className="ct-count">{rows.length} certificate{rows.length === 1 ? '' : 's'}</span>
          </>
        )}
        <div className="ct-view" role="group" aria-label="View">
          <button type="button" className={view === 'table' ? 'on' : ''} onClick={() => pickView('table')} aria-pressed={view === 'table'}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" /></svg>Table
          </button>
          <button type="button" className={view === 'cards' ? 'on' : ''} onClick={() => pickView('cards')} aria-pressed={view === 'cards'}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>Cards
          </button>
        </div>
      </div>

      {view === 'table' ? (
        <div className="cx3-card ct-wrap">
          <table className="ct-table">
            <colgroup>
              <col style={{ width: 44 }} /><col /><col style={{ width: 200 }} /><col style={{ width: 190 }} /><col style={{ width: 220 }} />
              {showAuto ? <col style={{ width: 100 }} /> : null}{showPrice ? <col style={{ width: 110 }} /> : null}{showCost ? <col style={{ width: 120 }} /> : null}
              <col style={{ width: 150 }} />
            </colgroup>
            <thead>
              <tr>
                <th className="ct-chk"><input type="checkbox" checked={allOn} onChange={toggleAll} aria-label="Select all certificates" /></th>
                <Th k="name">Certificate</Th>
                <Th k="urgency">Status</Th>
                <Th k="cert">Certificate expires</Th>
                <Th k="sub">Subscription</Th>
                {showAuto ? <th>Auto-renew</th> : null}
                {showPrice ? <th>Price</th> : null}
                {showCost ? <th>Partner cost</th> : null}
                <th className="ct-act"><span className="sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const c = r.group === 'action' ? (r.next?.cta === 'Renew' ? 'red' : 'amber') : r.group === 'progress' ? 'violet' : r.group === 'ended' ? 'mute' : 'green';
                return (
                  <tr key={r.key} className={`ct-row ${c} ${sel.has(r.id) ? 'picked' : ''}`}>
                    <td className="ct-chk">{r.type === 'cert' ? <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.domain}`} /> : null}</td>
                    <td className="ct-name">
                      <div className="ct-name-in" tabIndex={0}>
                        <div className="ct-name-txt">
                          <Link href={r.href} className="ct-cn">{r.domain}</Link>
                          <span className="ct-meta"><Brand slug={r.brand} /><span className="ct-meta-t">{stripBrand(r.product, r.brand)} · {r.kind}{r.extra ? ` · ${r.extra}` : ''}</span></span>
                        </div>
                        <Preview r={r} />
                      </div>
                    </td>
                    <td>
                      <span className={`ct-pill ${c}`}><i />{r.status}</span>
                      <span className="ct-sub-line">{r.method ? `${r.method} validation` : ''}{r.ref ? `${r.method ? ' · ' : ''}#${r.ref}` : ''}</span>
                    </td>
                    <td><CertLife r={r} /></td>
                    <td><SubLife r={r} /></td>
                    {showAuto ? <td><span className={`cx3-flag ${r.autoRenew ? 'on' : ''}`}>{r.autoRenew ? 'On' : 'Off'}</span></td> : null}
                    {showPrice ? <td className="ct-price">{r.price || '—'}</td> : null}
                    {showCost ? <td className="mono ct-meta">{r.cost || '—'}</td> : null}
                    <td className="ct-act"><div className="ct-act-in"><Action r={r} /><Menu r={r} /></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="ct-groups">
          {groups.map((g) => (
            <section key={g.k} className={`ct-group ${g.k}`}>
              <h3>{g.title}<span>{g.items.length}</span></h3>
              <div className="ct-cards">
                {g.items.map((r) => {
                  const c = r.group === 'action' ? (r.next?.cta === 'Renew' ? 'red' : 'amber') : r.group === 'progress' ? 'violet' : r.group === 'ended' ? 'mute' : 'green';
                  return (
                    <article key={r.key} className={`ct-card ${c} ${sel.has(r.id) ? 'picked' : ''}`}>
                      <div className="ct-card-top">
                        <Brand slug={r.brand} />
                        <span className={`ct-pill ${c}`}><i />{r.status}</span>
                        {r.type === 'cert' ? <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.domain}`} /> : null}
                      </div>
                      <Link href={r.href} className="ct-cn">{r.domain}</Link>
                      <span className="ct-meta"><span className="ct-meta-t">{stripBrand(r.product, r.brand)} · {r.kind}{r.ref ? ` · #${r.ref}` : ''}</span></span>
                      <Bars r={r} />
                      <div className="ct-card-foot"><span className="ct-method">{r.method || ''}</span><div className="ct-act-in"><Action r={r} /><Menu r={r} /></div></div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
