import Link from 'next/link';
import Icon from './Icon';
import { fmtDate } from './ui';

export function TypeChip({ type }) {
  return type === 'auto' ? (
    <span className="type-chip auto"><Icon name="loop" size={12} />Automated</span>
  ) : (
    <span className="type-chip"><Icon name="lock" size={12} />Certificate</span>
  );
}

export function DateCell({ date }) {
  if (!date?.at) return <span className="muted">—</span>;
  const d = date.days;
  const urgent = d !== null && d <= 30;
  return (
    <>
      <div style={{ fontWeight: 600, color: urgent ? 'var(--red-strong)' : undefined }}>
        {d < 0 ? `${-d} days ago` : d === 0 ? 'Today' : `in ${d} days`}
      </div>
      <div className="small muted">{date.label} {fmtDate(date.at)}</div>
    </>
  );
}

/** One row of the My SSL list: what it is, its state, its date and the one thing to do next. */
export default function ItemRow({ item, showRef }) {
  return (
    <tr>
      <td>
        <Link className="cn" href={item.href}>{item.domain}</Link>
        {item.extra ? <span className="small muted"> {item.extra}</span> : null}
        <div className="small muted">{item.product}{showRef && item.ref ? <span className="mono"> · #{item.ref}</span> : null}</div>
      </td>
      <td><TypeChip type={item.type} /></td>
      <td><span className={`badge tone-${item.status.tone}`}>{item.status.label}</span></td>
      <td><DateCell date={item.date} /></td>
      <td style={{ minWidth: 260 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
          <span className="small" style={{ color: 'var(--ink-2)' }}>{item.next?.text}</span>
          {item.next?.cta ? (
            <Link className={`btn sm ${item.next.primary ? 'primary' : ''}`} href={item.next.href} style={{ flex: 'none' }}>{item.next.cta}</Link>
          ) : (
            <Link className="btn sm ghost" href={item.href} style={{ flex: 'none' }} aria-label={`Open ${item.domain}`}>Open</Link>
          )}
        </div>
      </td>
    </tr>
  );
}
