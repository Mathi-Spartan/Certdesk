'use client';

import { useEffect, useState } from 'react';

/** Select-all checkbox + live selection count for the partner orders table. */
export function SelectAll({ formId }) {
  const [state, setState] = useState({ n: 0, all: false });
  useEffect(() => {
    const form = document.getElementById(formId);
    if (!form) return;
    const sync = () => {
      const boxes = [...form.querySelectorAll('input[name="ids"]')];
      const n = boxes.filter((b) => b.checked).length;
      setState({ n, all: boxes.length > 0 && n === boxes.length });
      form.querySelectorAll('[data-selcount]').forEach((el) => { el.textContent = n ? `${n} selected` : 'None selected'; });
      form.querySelectorAll('[data-needsel]').forEach((el) => { el.disabled = n === 0; });
      form.querySelectorAll('tr[data-row]').forEach((tr) => tr.classList.toggle('sel', tr.querySelector('input[name="ids"]')?.checked));
    };
    form.addEventListener('change', sync);
    sync();
    return () => form.removeEventListener('change', sync);
  }, [formId]);
  return (
    <input
      type="checkbox"
      aria-label="Select all orders on this page"
      checked={state.all}
      onChange={(e) => {
        const form = document.getElementById(formId);
        form.querySelectorAll('input[name="ids"]').forEach((b) => { b.checked = e.target.checked; });
        form.dispatchEvent(new Event('change', { bubbles: true }));
      }}
    />
  );
}
