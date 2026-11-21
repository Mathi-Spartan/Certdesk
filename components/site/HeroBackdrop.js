// Monochrome hero backdrop: aurora curtains, stars, and a globe of linked certificate nodes on the horizon.

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const r = rng(42);
const STARS = Array.from({ length: 140 }, () => ({
  x: +(r() * 1600).toFixed(1),
  y: +(r() * 620).toFixed(1),
  s: +(r() * 1.1 + 0.3).toFixed(2),
  o: +(r() * 0.6 + 0.2).toFixed(2)
}));

// Globe: centre below the fold, nodes along its upper surface.
const CX = 800, CY = 1720, R = 1060;
const n = rng(7);
const NODES = Array.from({ length: 26 }, (_, i) => {
  const a = (-Math.PI / 2) + (i / 25 - 0.5) * 1.5 + (n() - 0.5) * 0.05;
  const depth = 0.86 + n() * 0.13;
  return { x: +(CX + Math.cos(a) * R * depth).toFixed(1), y: +(CY + Math.sin(a) * R * depth).toFixed(1), big: n() > 0.78 };
});
const LINKS = [];
NODES.forEach((p, i) => {
  [1, 2, 3].forEach((k) => {
    const q = NODES[i + k];
    if (q && (k === 1 || n() > 0.55)) LINKS.push([p, q]);
  });
});

export default function HeroBackdrop() {
  return (
    <div className="hb" aria-hidden="true">
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMin slice">
        <defs>
          <linearGradient id="hbCurtain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".25" stopColor="#fff" stopOpacity=".55" />
            <stop offset=".6" stopColor="#fff" stopOpacity=".18" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <pattern id="hbRays" width="14" height="900" patternUnits="userSpaceOnUse">
            <rect width="14" height="900" fill="#000" />
            <rect x="1" width="2" height="900" fill="#fff" opacity=".55" />
            <rect x="6" width="1" height="900" fill="#fff" opacity=".28" />
            <rect x="10" width="3" height="900" fill="#fff" opacity=".42" />
          </pattern>
          <mask id="hbRayMask"><rect width="1600" height="900" fill="url(#hbRays)" /></mask>
          <filter id="hbSoft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" /></filter>
          <filter id="hbGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="40" /></filter>
          <radialGradient id="hbGlobe" cx="50%" cy="0%" r="60%">
            <stop offset="0" stopColor="#fff" stopOpacity=".10" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="hbPool" cx="28%" cy="48%" r="38%">
            <stop offset="0" stopColor="#0A0A0A" stopOpacity=".72" />
            <stop offset="1" stopColor="#0A0A0A" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hbFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset=".55" stopColor="#0A0A0A" stopOpacity="0" />
            <stop offset="1" stopColor="#0A0A0A" stopOpacity=".85" />
          </linearGradient>
        </defs>

        <g className="hb-stars">
          {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#fff" opacity={s.o} />)}
        </g>

        {/* soft glow behind the curtains */}
        <ellipse cx="520" cy="120" rx="520" ry="170" fill="#fff" opacity=".07" filter="url(#hbGlow)" />
        <ellipse cx="1180" cy="80" rx="420" ry="140" fill="#fff" opacity=".05" filter="url(#hbGlow)" />

        {/* aurora curtains */}
        <g className="hb-aur a1" mask="url(#hbRayMask)" filter="url(#hbSoft)">
          <path d="M-100 40 C 200 -20, 420 260, 760 150 S 1240 -40, 1700 120 L 1700 420 C 1240 260, 1000 470, 760 390 S 220 230, -100 330 Z" fill="url(#hbCurtain)" />
        </g>
        <g className="hb-aur a2" mask="url(#hbRayMask)" filter="url(#hbSoft)" opacity=".55">
          <path d="M-100 160 C 300 60, 560 360, 900 250 S 1400 90, 1700 230 L 1700 460 C 1380 330, 1120 520, 880 470 S 300 330, -100 420 Z" fill="url(#hbCurtain)" />
        </g>

        {/* globe with trust network */}
        <g className="hb-globe">
          <circle cx={CX} cy={CY} r={R} fill="url(#hbGlobe)" stroke="#fff" strokeOpacity=".22" />
          {[0.94, 0.86, 0.76].map((k) => (
            <ellipse key={k} cx={CX} cy={CY} rx={R} ry={R * k} fill="none" stroke="#fff" strokeOpacity=".06" />
          ))}
          {[0.25, 0.55, 0.85].map((k) => (
            <ellipse key={k} cx={CX} cy={CY} rx={R * k} ry={R} fill="none" stroke="#fff" strokeOpacity=".05" />
          ))}
          {LINKS.map(([p, q], i) => (
            <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#fff" strokeOpacity=".16" strokeWidth=".8" />
          ))}
          {NODES.map((p, i) => (
            <g key={i} className={p.big ? 'hb-node big' : 'hb-node'} style={{ '--d': `${(i % 7) * 0.6}s` }}>
              {p.big && <circle cx={p.x} cy={p.y} r="9" fill="#fff" opacity=".08" />}
              <circle cx={p.x} cy={p.y} r={p.big ? 3 : 1.8} fill="#fff" opacity={p.big ? 0.9 : 0.5} />
            </g>
          ))}
        </g>

        <rect width="1600" height="900" fill="url(#hbPool)" />
        <rect width="1600" height="900" fill="url(#hbFade)" />
      </svg>
    </div>
  );
}
