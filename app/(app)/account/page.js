import { requireUser } from '@/lib/auth';
import TopBar from '@/components/TopBar';
import PasswordForm from './PasswordForm';

export const metadata = { title: 'Profile · CertDesk' };

export default async function Account() {
  const ctx = await requireUser();
  return (
    <>
      <TopBar crumbs={[{ label: 'Account' }]} />
      <main className="page" style={{ maxWidth: 720 }}>
        <h1 className="title">Profile &amp; password</h1>
        <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2>Profile</h2>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 13 }}>
            <div><dt className="muted">Name</dt><dd style={{ margin: 0 }}>{ctx.user.name}</dd></div>
            <div><dt className="muted">Email</dt><dd style={{ margin: 0 }}>{ctx.user.email}</dd></div>
            <div><dt className="muted">Role</dt><dd style={{ margin: 0 }}>{ctx.isAdmin ? 'Partner admin' : 'Customer'}</dd></div>
            {ctx.workspace ? <div><dt className="muted">Workspace</dt><dd style={{ margin: 0 }}>{ctx.workspace.name}</dd></div> : null}
          </dl>
          <div className="small muted">To change your name or email, contact your partner.</div>
        </section>
        <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2>Change password</h2>
          <PasswordForm />
        </section>
      </main>
    </>
  );
}
