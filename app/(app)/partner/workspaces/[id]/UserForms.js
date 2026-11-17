'use client';

import { useActionState } from 'react';
import { createCustomerUser, resetUserPassword } from '@/app/actions/admin';
import CopyButton from '@/components/CopyButton';

function Credentials({ email, password }) {
  return (
    <div className="alert green" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <strong>Share these sign-in details with the customer. The password is shown only once.</strong>
      <div className="code"><span className="k">Email </span>{email}{'\n'}<br /><span className="k">Password </span>{password}</div>
      <CopyButton text={`Email: ${email}\nPassword: ${password}`} label="Copy both" />
    </div>
  );
}

export function CreateUserForm({ workspaceId }) {
  const [state, action, pending] = useActionState(createCustomerUser, null);
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input type="hidden" name="workspace_id" value={workspaceId} />
      <div className="field"><label htmlFor="un">Full name</label><input className="input" id="un" name="name" required /></div>
      <div className="field"><label htmlFor="ue">Email</label><input className="input" id="ue" name="email" type="email" required /></div>
      <div className="field"><label htmlFor="up">Password <span className="muted">(leave blank to generate)</span></label><input className="input" id="up" name="password" type="text" autoComplete="off" /></div>
      {state?.error ? <div role="alert" className="alert red">{state.error}</div> : null}
      {state?.ok ? <Credentials email={state.email} password={state.password} /> : null}
      <button className="btn primary" type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create login'}</button>
    </form>
  );
}

export function ResetPasswordButton({ userId }) {
  const [state, action, pending] = useActionState(resetUserPassword, null);
  if (state?.ok) {
    return (
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <span className="mono small">{state.password}</span>
        <CopyButton text={state.password} />
      </span>
    );
  }
  return (
    <form action={action} style={{ display: 'inline' }}>
      <input type="hidden" name="user_id" value={userId} />
      <button className="btn sm" type="submit" disabled={pending}>{pending ? '…' : 'Reset password'}</button>
    </form>
  );
}
