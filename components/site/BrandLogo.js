'use client';

import { useState } from 'react';

/**
 * Official CA logo from /public/brands/<slug>.svg (or .png). Falls back to the brand name
 * until the logo file is added.
 */
export default function BrandLogo({ slug, name, height = 26, className = '' }) {
  const [step, setStep] = useState(0); // 0 svg, 1 png, 2 text
  if (step >= 2) return <span className={`lp-logo-text ${className}`}>{name}</span>;
  return (
    <img
      src={`/brands/${slug}.${step === 0 ? 'svg' : 'png'}`}
      alt={name}
      height={height}
      style={{ height, width: 'auto', maxWidth: '100%', objectFit: 'contain' }}
      className={className}
      onError={() => setStep((s) => s + 1)}
    />
  );
}
