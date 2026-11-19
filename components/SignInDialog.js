'use client';

import { useEffect, useRef } from 'react';
import { useActionState } from 'react';
import { login } from '@/app/actions/auth';

/**
 * Sign-in on the landing page. Any element with data-signin opens it; ?signin=1 opens it on load.
 */
export default function SignInDialog({ openOnLoad, contact }) {
  const ref = useRef(null);
  const [state, action, pending] = useActionState(login, null);

  useEffect(() => {
    const d = ref.current;
    const open = (e) => {
      const t = e.target.closest('[data-signin]');
      if (!t) return;
      e.preventDefault();
      if (!d.open) d.showModal();
      setTimeout(() => d.querySelector('input[name=email]')?.focus(), 30);
    };
    document.addEventListener('click', open);
    if (openOnLoad && !d.open) d.showModal();
    const backdrop = (e) => { if (e.target === d) d.close(); };
    d.addEventListener('click', backdrop);
    return () => { document.removeEventListener('click', open); d.removeEventListener('click', backdrop); };
  }, [openOnLoad]);

  useEffect(() => {
    if (state?.error && ref.current && !ref.current.open) ref.current.showModal();
  }, [state]);

  return (
    <dialog ref={ref} className="lp-dialog" aria-labelledby="signin-title">
      <form method="dialog" className="lp-dialog-close-form">
        <button className="lp-dialog-close" aria-label="Close">×</button>
      </form>
      <div className="lp-dialog-head">
        <span className="lp-logo" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" /><path d="m9 12 2 2 4-4" /></svg>
        </span>
        <div>
          <h2 id="signin-title">Sign in to CertDesk</h2>
          <p>Use the account your provider created for you.</p>
        </div>
      </div>
      <form action={action} className="lp-dialog-form">
        <label>
          <span>Email</span>
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          <span>Password</span>
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {state?.error ? <div role="alert" className="lp-dialog-error">{state.error}</div> : null}
        <button className="lp-btn lp-btn-primary lp-btn-block" type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="lp-dialog-foot">No account yet? <a href={contact}>Request one</a></p>
    </dialog>
  );
}
