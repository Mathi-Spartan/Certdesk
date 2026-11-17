import Icon from './Icon';
import { displayStatus } from '@/lib/orders';

export function StatusBadge({ order }) {
  const s = displayStatus(order);
  return <span className={`badge tone-${s.tone}`}>{s.label}</span>;
}

export function Badge({ tone = 'gray', children }) {
  return <span className={`badge tone-${tone}`}>{children}</span>;
}

export function fmtDate(d) {
  if (!d) return '—';
  const x = new Date(d);
  if (isNaN(x.getTime())) return '—';
  return x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function fmtDateTime(d) {
  if (!d) return '—';
  const x = new Date(d);
  return x.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

export function timeAgo(d) {
  if (!d) return 'never';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export function Kpi({ label, value, icon, tone, foot }) {
  const color = tone === 'red' ? 'var(--red-strong)' : tone === 'amber' ? '#B45309' : undefined;
  return (
    <div className="card kpi">
      <div className="between k">
        <span>{label}</span>
        {icon ? <Icon name={icon} stroke={color || 'var(--muted)'} /> : null}
      </div>
      <div className="v" style={{ color }}>{value}</div>
      {foot}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 15 }}>{title}</div>
      {children}
    </div>
  );
}

export function FlashFromSearch({ searchParams }) {
  const ok = searchParams?.ok;
  const err = searchParams?.err;
  if (!ok && !err) return null;
  return (
    <div role="status" className={`alert ${err ? 'red' : 'green'}`}>
      <Icon name={err ? 'alert' : 'tick'} />
      <span>{err || ok}</span>
    </div>
  );
}
