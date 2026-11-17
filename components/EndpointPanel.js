import { q } from '@/lib/db';
import { ENDPOINTS } from '@/lib/gogetssl-v2';
import { timeAgo } from './ui';

const GROUP = { caas: 'CaaS', ais: 'Plan + Automate' };
const METHOD_TONE = { GET: 'green', POST: 'violet', PATCH: 'amber', DELETE: 'red' };

function toRegex(path) {
  return new RegExp('^' + path.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[a-zA-Z]+\}/g, '[^/]+') + '$');
}

/** The v2 endpoints behind one subscription, with the item id filled in and the last call made to each. */
export default async function EndpointPanel({ kind, itemId }) {
  const list = ENDPOINTS.filter((e) => e.group === GROUP[kind] && e.path !== `/certificates/${kind}`);
  const calls = itemId
    ? await q(
        `select path, method, ok, error, created_at from console.api_log
          where api = 'v2' and path like $1 order by created_at desc limit 80`,
        [`/certificates/${kind}/${Number(itemId)}%`]
      )
    : [];
  return (
    <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="between"><h2>API v2 endpoints</h2><a className="small" href="/subscriptions/endpoints">Reference</a></div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.map((e) => {
          const concrete = e.path.replace('{id}', String(itemId || '{id}'));
          const re = toRegex(concrete);
          const last = calls.find((c) => (!c.method || c.method === e.method) && re.test(c.path));
          return (
            <li key={e.method + e.path} style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span className={`badge tone-${METHOD_TONE[e.method]}`} style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 10, minWidth: 48, justifyContent: 'center' }}>{e.method}</span>
                <span className="mono" style={{ overflowWrap: 'anywhere' }}>{concrete}</span>
              </span>
              <span className="muted">{e.use}</span>
              {last ? (
                <span style={{ color: last.ok ? 'var(--green-strong, #15803D)' : 'var(--red-strong)' }}>
                  Last call {timeAgo(last.created_at)} · {last.ok ? 'OK' : last.error}
                </span>
              ) : <span className="muted">Not called yet</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
