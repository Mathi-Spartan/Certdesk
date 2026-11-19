'use client';

import { useState } from 'react';

// Official logo files in /public/brands. Two-line logos (with "powered by digicert") get a little more height.
const FILES = {
  digicert: { file: 'digicert.png', scale: 1 },
  sectigo: { file: 'sectigo.svg', scale: 1 },
  comodo: { file: 'comodo.png', scale: 1.35 },
  geotrust: { file: 'geotrust.png', scale: 1.4 },
  thawte: { file: 'thawte.png', scale: 1.4 },
  rapidssl: { file: 'rapidssl.png', scale: 0.9 }
};

/** A CA's logo; falls back to its name when there is no logo file. */
export default function BrandLogo({ slug, name, height = 26, className = '' }) {
  const [failed, setFailed] = useState(false);
  const f = FILES[slug];
  if (!f || failed) return <span className={`lp-logo-text ${className}`}>{name}</span>;
  const h = Math.round(height * f.scale);
  return (
    <img
      src={`/brands/${f.file}`}
      alt={name}
      height={h}
      style={{ height: h, width: 'auto', maxWidth: '100%', objectFit: 'contain' }}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
