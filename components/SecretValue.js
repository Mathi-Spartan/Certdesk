'use client';

import { useState } from 'react';
import CopyButton from './CopyButton';

/** A credential shown masked until the user asks to see it. */
export default function SecretValue({ value, label }) {
  const [shown, setShown] = useState(false);
  if (!value) return <span style={{ color: '#A2A2A2' }}>Not issued yet</span>;
  return (
    <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span className="mono" style={{ overflowWrap: 'anywhere', flex: '1 1 200px', color: '#fff' }}>
        {shown ? value : '•'.repeat(Math.min(32, value.length))}
      </span>
      <button type="button" className="btn sm" style={{ background: '#272727', color: '#E4E4E4', borderColor: '#404040' }} onClick={() => setShown((s) => !s)} aria-label={`${shown ? 'Hide' : 'Show'} ${label}`}>
        {shown ? 'Hide' : 'Show'}
      </button>
      <CopyButton text={value} dark />
    </span>
  );
}
