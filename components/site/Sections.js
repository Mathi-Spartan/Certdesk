import Link from 'next/link';
import { LEVEL_CARDS, NEEDS } from './catalogData';

export function NeedsGrid() {
  return (
    <div className="lp-needs" style={{ paddingTop: 0 }}>
      {NEEDS.map((n) => (
        <Link key={n.key} href={`/ssl?type=${n.key}`} className={`lp-need lp-need-${n.key}`}>
          {n.isNew ? <span className="lp-new lp-need-new">New</span> : null}
          <span className="lp-glyph">{n.glyph}</span>
          <strong>{n.title}</strong>
          <span className="lp-need-text">{n.text}</span>
          <ul className="lp-checks">{n.points.map((x) => <li key={x}>{x}</li>)}</ul>
          <span className="lp-need-go">View certificates →</span>
        </Link>
      ))}
    </div>
  );
}

export function LevelCards() {
  return (
    <div className="lp-levels">
      {LEVEL_CARDS.map((c) => (
        <article key={c.key} className={`lp-levelcard lp-lc-${c.key} ${c.popular ? 'popular' : ''}`}>
          {c.popular ? <span className="lp-lc-flag">Most popular</span> : null}
          <div className="lp-lc-head">
            <span className="lp-glyph">{c.glyph}</span>
            <div><strong>{c.title}</strong><span>{c.sub}</span></div>
          </div>
          <ul>
            {c.rows.map(([k, v]) => (
              <li key={k}>
                <span className="lp-lc-k">{k}</span>
                <span className={`lp-lc-v ${v === true ? 'yes' : v === false ? 'no' : ''}`}>{v === true ? '✓' : v === false ? '✕' : v}</span>
              </li>
            ))}
          </ul>
          <Link href={`/ssl?type=${c.key}`} className="lp-btn lp-btn-ghost lp-btn-block">See {c.key.toUpperCase()} certificates</Link>
        </article>
      ))}
    </div>
  );
}
