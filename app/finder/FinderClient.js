'use client';

import SslFinder from '@/components/site/SslFinder';

export default function FinderClient(props) {
  return <SslFinder {...props} orderHref={(p) => `/buy?product=${p.id}`} />;
}
