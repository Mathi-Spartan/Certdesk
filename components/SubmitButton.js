'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';

function fmt(s) {
  const m = Math.floor(s / 60);
  const r = String(s % 60).padStart(2, '0');
  return `${m}:${r}`;
}

/**
 * Submit button that disables itself while the form is sending, so one click = one call.
 * With lockedSeconds it stays disabled and counts down until GoGetSSL allows the call again.
 */
export default function SubmitButton({ children, pendingText = 'Working…', className = 'btn sm', lockedSeconds = 0, lockLabel = 'Available in' }) {
  const { pending } = useFormStatus();
  const router = useRouter();
  const [left, setLeft] = useState(lockedSeconds);

  useEffect(() => setLeft(lockedSeconds), [lockedSeconds]);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => {
      if (left === 1) router.refresh();
      setLeft(left - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [left, router]);

  const locked = left > 0;
  return (
    <button type="submit" className={className} disabled={pending || locked} aria-disabled={pending || locked}
      title={locked ? 'GoGetSSL allows this once every 5 minutes per order' : undefined}>
      {pending ? pendingText : locked ? `${lockLabel} ${fmt(left)}` : children}
    </button>
  );
}
