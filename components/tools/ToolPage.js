import Link from 'next/link';

const ALL = [
  { href: '/tools/ssl-checker', name: 'SSL checker', text: 'Test a live site' },
  { href: '/tools/csr', name: 'CSR generator', text: 'Create a key and CSR' },
  { href: '/tools/csr-decoder', name: 'CSR decoder', text: 'Inspect a CSR' },
  { href: '/tools/cert-decoder', name: 'Certificate decoder', text: 'Read a certificate' },
  { href: '/tools/converter', name: 'Format converter', text: 'PFX, JKS, PEM, P7B' }
];

/** Page frame shared by every customer tool: header band, work area, explanatory side column. */
export default function ToolPage({ slug, title, desc, about = [], privacy, actions, wide = false, children }) {
  return (
    <main className="page cc-page">
      <header className="cc-page-head">
        <div>
          <nav className="cc-crumbs" aria-label="Breadcrumb"><Link href="/orders">My certificates</Link><span>/</span><Link href="/tools">Tools</Link><span>/</span><span>{title}</span></nav>
          <h1>{title}</h1>
          <p>{desc}</p>
        </div>
        {actions ? <div className="cc-head-actions">{actions}</div> : null}
      </header>
      {wide ? children : (
        <div className="cc-tool-grid">
          <div className="cc-tool-main">{children}</div>
          <aside className="cc-tool-aside">
            {about.length ? (
              <section className="cc-card cc-aside-card">
                <h2>What it checks</h2>
                <ul className="cc-ticks">{about.map((a) => <li key={a}>{a}</li>)}</ul>
              </section>
            ) : null}
            {privacy ? (
              <section className="cc-card cc-aside-card cc-aside-note">
                <h2><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>Privacy</h2>
                <p>{privacy}</p>
              </section>
            ) : null}
            <section className="cc-card cc-aside-card">
              <h2>Other tools</h2>
              <ul className="cc-related">
                {ALL.filter((t) => t.href !== `/tools/${slug}`).map((t) => (
                  <li key={t.href}><Link href={t.href}><strong>{t.name}</strong><span>{t.text}</span></Link></li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}
