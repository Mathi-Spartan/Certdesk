import { redirect } from 'next/navigation';
import { getContext } from '@/lib/auth';
import LoginForm from './LoginForm';
import Icon from '@/components/Icon';

export const metadata = { title: 'Sign in · CertDesk' };

export default async function LoginPage() {
  const ctx = await getContext();
  if (ctx) redirect(ctx.isAdmin && !ctx.workspaceId ? '/partner' : '/dashboard');
  return (
    <main className="login-wrap">
      <div className="card login-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="ws-badge violet"><Icon name="lock" stroke="#fff" /></span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>CertDesk Console</div>
            <div className="muted small">Certificate lifecycle management</div>
          </div>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Sign in</h1>
          <p className="sub">Use the account your administrator created for you.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
