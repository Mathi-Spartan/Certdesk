import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { q } from '@/lib/db';
import { ensureSeed } from '@/lib/assist/engine';
import TopBar from '@/components/TopBar';
import { FlashFromSearch, timeAgo } from '@/components/ui';

export const metadata = { title: 'Knowledge base · CertDesk' };
export const dynamic = 'force-dynamic';

export default async function KnowledgeBase({ searchParams }) {
  const sp = await searchParams;
  await requireAdmin();
  let rows = [];
  let ready = true;
  try {
    await ensureSeed();
    rows = await q('select id, slug, title, category, keywords, published, views, helpful, unhelpful, updated_at from console.assist_articles order by category, title');
  } catch (e) {
    if (!/assist_/.test(String(e.message))) throw e;
    ready = false;
  }
  const groups = rows.reduce((m, r) => ((m[r.category] ||= []).push(r), m), {});
  return (
    <>
      <TopBar crumbs={[{ label: 'Support inbox', href: '/partner/support' }, { label: 'Knowledge base' }]}>
        <Link href="/partner/support/kb/new" className="btn primary">New article</Link>
      </TopBar>
      <main className="page">
        <div>
          <h1 className="title">Knowledge base</h1>
          <p className="sub">Approved answers Nunmathi gives word for word. It finds them by title, keywords and text, so add the words customers actually type.</p>
        </div>
        <FlashFromSearch searchParams={sp} />
        {!ready ? <div className="cx3-alert amber"><div>Support chat isn’t set up yet. The tables in <code>db/assist.sql</code> need to be created once.</div></div> : null}
        {Object.entries(groups).map(([cat, list]) => (
          <section key={cat} className="cx3-card cx3-pad bl-sec">
            <h2>{cat}</h2>
            <ul className="kb-rows">
              {list.map((a) => (
                <li key={a.id}>
                  <Link href={`/partner/support/kb/${a.id}`}><b>{a.title}</b>{a.published ? null : <span className="sp-st gray">Hidden</span>}</Link>
                  <small>{a.keywords.slice(0, 6).join(', ')}</small>
                  <span className="kb-stats">{a.views} shown · {a.helpful} 👍 · {a.unhelpful} 👎 · {timeAgo(a.updated_at)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </>
  );
}
