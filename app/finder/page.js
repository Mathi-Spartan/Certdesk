import { getContext } from '@/lib/auth';
import { q } from '@/lib/db';
import { supportEmail } from '@/lib/support';
import SignInDialog from '@/components/SignInDialog';
import { SiteHeader, SiteFooter, UtilityBar } from '@/components/site/SiteChrome';
import FinderClient from './FinderClient';
import '../landing.css';
import '../finder.css';

export const metadata = {
  title: 'SSL Finder · Which SSL certificate do I need? · CertDesk',
  description: 'Answer a few questions and get the right SSL or code signing certificate: DV, OV, EV, wildcard, multi-domain or automated, from DigiCert, Sectigo, GeoTrust and more.'
};

export default async function FinderPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const [ctx, email, products] = await Promise.all([
    getContext().catch(() => null),
    supportEmail().catch(() => null),
    q('select id, name, brand, validation, wildcard, multidomain, san_max, automation from console.products order by name').catch(() => [])
  ]);
  const signedIn = !!ctx;
  const consoleHref = ctx ? (ctx.isAdmin && !ctx.workspaceId ? '/partner' : '/orders') : '#signin';
  const contact = email ? `mailto:${email}?subject=${encodeURIComponent('Which certificate should I choose?')}` : '#';
  return (
    <div className="lp">
      <UtilityBar email={email} />
      <SiteHeader signedIn={signedIn} consoleHref={consoleHref} />
      <main id="main" className="lp-wrap" style={{ padding: '32px 24px 72px' }}>
        <FinderClient products={products} signedIn={signedIn && !!ctx?.workspaceId} contact={contact} />
      </main>
      <SiteFooter email={email} contact={email ? `mailto:${email}?subject=${encodeURIComponent('CertDesk account request')}` : '#'} />
      {!signedIn ? <SignInDialog openOnLoad={sp.signin === '1'} contact={contact} /> : null}
    </div>
  );
}
