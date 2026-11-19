const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Subscription (order period) cell: "12 months · 3 Jun 2026 – 17 Jun 2027", then days left. */
export function SubPeriod({ sub, compact = false }) {
  if (!sub) return <span className="cx3-sub">—</span>;
  const left = sub.ended ? `Ended ${-sub.days} days ago` : sub.days === 0 ? 'Ends today' : `${sub.days} days left`;
  const warn = !sub.ended && sub.days <= 60;
  return (
    <>
      <div style={{ fontWeight: 600 }} className={sub.ended || warn ? 't-red' : ''}>{left}</div>
      <div className="cx3-sub">
        {sub.months ? `${sub.months} mo · ` : ''}
        {compact ? `until ${fmt(sub.end)}` : `${fmt(sub.start)} – ${fmt(sub.end)}`}
      </div>
    </>
  );
}

/** Certificate expiry cell. */
export function CertExpiry({ at, days, hot }) {
  if (!at) return <span className="cx3-sub">Not issued</span>;
  return (
    <>
      <div className={hot ? 't-red' : ''} style={{ fontWeight: 600 }}>{days < 0 ? `Expired ${-days} days ago` : days === 0 ? 'Today' : `${days} days`}</div>
      <div className="cx3-sub">{fmt(at)}</div>
    </>
  );
}

export { fmt as fmtSubDate };
