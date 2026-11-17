import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { q } from '@/lib/db';
import { syncStale, daysLeft, displayStatus, primaryMethod } from '@/lib/orders';
import TopBar from '@/components/TopBar';
import Icon from '@/components/Icon';
import { StatusBadge, Empty, fmtDate, FlashFromSearch } from '@/components/ui';

export const metadata = { title: 'Certificates · CertDesk' };

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'due', label: 'Reissue / renewal due', tone: 'var(--red-strong)' },
  { key: 'validation', label: 'In validation', tone: '#B45309' },
  { key: 'active', label: 'Active' },
  { key: 'closed', label: 'Expired & cancelled' }
];

function tabOf(o) {
  const s = displayStatus(o).key;
  if (['reissue_due', 'renew_due', 'expired'].includes(s)) return 'due';
  if (s === 'active') return 'active';
  if (['order_ended', 'cancelled', 'cancel_requested'].includes(s)) return 'closed';
  return 'validation';
}

export default async function Certificates({ searchParams }) {
  const sp = await searchParams;
  const ctx = await requireWorkspace();
  await syncStale(ctx.workspaceId, 10);
  const all = await q(`select * from console.orders where workspace_id = $1 and status <> 'draft' order by valid_till asc nulls first, created_at desc`, [ctx.workspaceId]);
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab : 'all';
  const term = String(sp.q || '').trim().toLowerCase();
  const tag = String(sp.tag || '').trim();
  const counts = Object.fromEntries(TABS.map((t) => [t.key, 0]));
  for (const o of all) {
    counts.all++;
    counts[tabOf(o)]++;
  }
  const rows = all.filter((o) => {
    if (tab !== 'all' && tabOf(o) !== tab) return false;
    if (tag && !(o.tags || []).includes(tag)) return false;
    if (term) {
      const hay = [o.common_name, ...(o.sans || []), String(o.gg_order_id || ''), o.product_name].join(' ').toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });
  const allTags = [...new Set(all.flatMap((o) => o.tags || []))].sort();
  const link = (patch) => {
    const p = new URLSearchParams({ ...(tab !== 'all' ? { tab } : {}), ...(term ? { q: term } : {}), ...(tag ? { tag } : {}), ...patch });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    const s = p.toString();
    return '/certificates' + (s ? '?' + s : '');
  };

  return (
    <>
      <TopBar crumbs={[{ label: ctx.workspace.name }, { label: 'Certificates' }]}>
        <Link className="btn primary" href="/buy"><Icon name="plus" stroke="#fff" width={2.4} />Buy certificate</Link>
      </TopBar>
      <main className="page" style={{ gap: 16 }}>
        <div>
          <h1 className="title">Certificates</h1>
          <p className="sub">Every certificate in this workspace, its validation state and when it expires.</p>
        </div>
        <FlashFromSearch searchParams={sp} />

        <nav className="tabs" aria-label="Status">
          {TABS.map((t) => (
            <Link key={t.key} href={link({ tab: t.key === 'all' ? '' : t.key })} className={tab === t.key ? 'on' : ''}>
              {t.label} <span style={{ color: t.tone || 'var(--muted)', fontWeight: t.tone ? 600 : 500 }}>{counts[t.key]}</span>
            </Link>
          ))}
        </nav>

        <form className="between" style={{ justifyContent: 'flex-start', gap: 8 }} action="/certificates">
          {tab !== 'all' ? <input type="hidden" name="tab" value={tab} /> : null}
          {tag ? <input type="hidden" name="tag" value={tag} /> : null}
          <label style={{ flex: '1 1 260px', display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 12px', border: '1px solid var(--input)', borderRadius: 8, background: '#fff' }}>
            <Icon name="search" stroke="var(--muted)" />
            <span className="sr">Filter certificates</span>
            <input name="q" defaultValue={term} type="search" placeholder="Filter by domain, product or GoGetSSL order ID" style={{ border: 0, outline: 'none', flex: 1, font: 'inherit', background: 'transparent' }} />
          </label>
          {allTags.map((t) => (
            <Link key={t} href={link({ tag: tag === t ? '' : t })} className={`btn sm ${tag === t ? '' : ''}`}
              style={tag === t ? { background: 'var(--accent-soft)', borderColor: '#C4B8FF', color: 'var(--accent-ink)' } : { borderStyle: 'dashed' }}>
              {tag === t ? `Tag: ${t} ×` : `#${t}`}
            </Link>
          ))}
        </form>

        <div className="card">
          {rows.length === 0 ? (
            <Empty title={all.length ? 'Nothing matches these filters' : 'No certificates yet'}>
              {all.length ? <Link href="/certificates">Clear filters</Link> : <Link className="btn primary" href="/buy">Buy certificate</Link>}
            </Empty>
          ) : (
            <div className="table-wrap">
              <table className="t" style={{ minWidth: 980 }}>
                <thead>
                  <tr>
                    <th>Common name</th><th>Product</th><th>Status</th><th>Certificate expires</th><th>Order ends</th><th>Validation</th><th>Tags</th><th>GoGetSSL order</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => {
                    const d = daysLeft(o.valid_till);
                    const urgent = d !== null && d <= 30;
                    return (
                      <tr key={o.id}>
                        <td>
                          <Link className="cn" href={`/certificates/${o.id}`}>{o.common_name || 'Pending'}</Link>
                          {o.sans?.length ? <span className="small muted"> +{o.sans.length} SAN{o.sans.length > 1 ? 's' : ''}</span> : null}
                        </td>
                        <td>{o.product_name || `Product ${o.product_id || '?'}`}</td>
                        <td><StatusBadge order={o} /></td>
                        <td>
                          {o.valid_till && o.status === 'issued' ? (
                            <>
                              <div style={{ fontWeight: 600, color: urgent ? 'var(--red-strong)' : undefined }}>{d < 0 ? `${-d} days ago` : `${d} days`}</div>
                              <div className="small muted">{fmtDate(o.valid_till)}</div>
                            </>
                          ) : <span className="muted">Not issued</span>}
                        </td>
                        <td>
                          {o.order_expires_at ? (
                            <>
                              <div style={{ fontWeight: 600, color: daysLeft(o.order_expires_at) <= 30 ? 'var(--red-strong)' : undefined }}>{daysLeft(o.order_expires_at)} days</div>
                              <div className="small muted">{fmtDate(o.order_expires_at)}</div>
                            </>
                          ) : <span className="muted">—</span>}
                        </td>
                        <td>{primaryMethod(o)}</td>
                        <td>{(o.tags || []).map((t) => <span key={t} className="tag" style={{ marginRight: 4 }}>{t}</span>)}</td>
                        <td className="mono small muted">{o.gg_order_id || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="small muted">Showing {rows.length} of {all.length}</div>
      </main>
    </>
  );
}
