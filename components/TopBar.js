import Link from 'next/link';

export function TopBar({ crumbs, children }) {
  return (
    <header className="topbar">
      <nav aria-label="Breadcrumb" className="crumbs">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'flex', gap: 8 }}>
            {i > 0 ? <span aria-hidden="true">/</span> : null}
            {c.href ? <Link href={c.href}>{c.label}</Link> : i === crumbs.length - 1 ? <strong>{c.label}</strong> : <span>{c.label}</span>}
          </span>
        ))}
      </nav>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>{children}</div>
    </header>
  );
}

export default TopBar;
