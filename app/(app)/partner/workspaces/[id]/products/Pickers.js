'use client';

import { useEffect, useState } from 'react';

function boxes(formId) {
  return [...(document.getElementById(formId)?.querySelectorAll('input[type=checkbox][name=product_id]') || [])];
}

/** Ticks (or clears) every product in a group, e.g. a brand or a brand's OV products. */
export function GroupToggle({ formId, group, label, off = false, small = false }) {
  return (
    <button
      type="button"
      className={`cx3-btn ${small ? 'sm' : ''}`}
      onClick={() => {
        const list = boxes(formId).filter((b) => (b.dataset.group || '').split(' ').includes(group));
        const target = off ? false : !list.every((b) => b.checked);
        list.forEach((b) => { b.checked = target; });
        document.getElementById(formId)?.dispatchEvent(new Event('change', { bubbles: true }));
      }}
    >
      {label}
    </button>
  );
}

/** Live "N of M selected". */
export function Counter({ formId, total }) {
  const [n, setN] = useState(null);
  useEffect(() => {
    const form = document.getElementById(formId);
    const update = () => setN(boxes(formId).filter((b) => b.checked).length);
    update();
    form?.addEventListener('change', update);
    return () => form?.removeEventListener('change', update);
  }, [formId]);
  return <span className="wp-count"><b>{n ?? '…'}</b> of {total} selected</span>;
}
