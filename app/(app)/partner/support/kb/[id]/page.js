import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { one } from '@/lib/db';
import { saveArticle } from '@/app/actions/assist';
import TopBar from '@/components/TopBar';
import { FlashFromSearch } from '@/components/ui';

export const metadata = { title: 'Edit article · CertDesk' };
export const dynamic = 'force-dynamic';

const CATS = ['Validation', 'Lifecycle', 'Install', 'Ordering', 'Billing', 'Troubleshooting', 'General'];

export default async function EditArticle({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  await requireAdmin();
  const isNew = id === 'new';
  const a = isNew ? { title: '', body: '', category: 'General', keywords: [], published: true } : await one('select * from console.assist_articles where id = $1', [Number(id) || 0]);
  if (!a) notFound();
  return (
    <>
      <TopBar crumbs={[{ label: 'Support inbox', href: '/partner/support' }, { label: 'Knowledge base', href: '/partner/support/kb' }, { label: isNew ? 'New article' : a.title }]} />
      <main className="page" style={{ maxWidth: 860 }}>
        <h1 className="title">{isNew ? 'New article' : 'Edit article'}</h1>
        <FlashFromSearch searchParams={sp} />
        <form action={saveArticle} className="cx3-card cx3-pad kb-form">
          {isNew ? null : <input type="hidden" name="id" value={a.id} />}
          <label className="cx3-field"><span>Title (also what customers see first)</span><input name="title" defaultValue={a.title} required maxLength={160} /></label>
          <div className="kb-two">
            <label className="cx3-field"><span>Category</span>
              <select name="category" defaultValue={a.category}>{[...new Set([...CATS, a.category])].map((c) => <option key={c}>{c}</option>)}</select>
            </label>
            <label className="cx3-field"><span>Keywords, comma separated (words customers type)</span><input name="keywords" defaultValue={(a.keywords || []).join(', ')} placeholder="refund, money back, cancel" /></label>
          </div>
          <label className="cx3-field"><span>Answer</span><textarea name="body" defaultValue={a.body} required rows={16} className="mono" /></label>
          <p className="cx3-muted" style={{ margin: 0 }}>Formatting: <code>**bold**</code>, <code>`code`</code>, lines starting with <code>- </code> or <code>1. </code> for lists, a blank line between paragraphs.</p>
          <label className="kb-check"><input type="checkbox" name="published" defaultChecked={a.published} /> Published (Arivu can use it)</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="cx3-btn primary" type="submit">Save</button>
            <Link className="cx3-btn" href="/partner/support/kb">Cancel</Link>
          </div>
        </form>
      </main>
    </>
  );
}
