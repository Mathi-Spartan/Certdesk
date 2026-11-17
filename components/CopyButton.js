'use client';

import { useState } from 'react';

export default function CopyButton({ text, label = 'Copy', dark = false }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn sm"
      style={dark ? { background: '#27272A', color: '#E4E4E7', borderColor: '#3F3F46' } : undefined}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text || '');
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {done ? 'Copied' : label}
    </button>
  );
}
