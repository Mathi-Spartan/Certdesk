'use client';

import { useActionState } from 'react';
import { changePassword } from '@/app/actions/auth';

export default function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="field"><label htmlFor="cur">Current password</label><input className="input" id="cur" name="current" type="password" autoComplete="current-password" required /></div>
      <div className="field"><label htmlFor="new">New password (at least 10 characters)</label><input className="input" id="new" name="next" type="password" autoComplete="new-password" minLength={10} required /></div>
      {state?.error ? <div role="alert" className="alert red">{state.error}</div> : null}
      {state?.ok ? <div role="status" className="alert green">{state.ok}</div> : null}
      <button className="btn primary" type="submit" disabled={pending} style={{ alignSelf: 'flex-start' }}>{pending ? 'Saving…' : 'Change password'}</button>
    </form>
  );
}
