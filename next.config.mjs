/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      { source: '/subscriptions', destination: '/certificates?view=auto', permanent: false },
      { source: '/subscriptions/endpoints', destination: '/partner/endpoints', permanent: false },
      { source: '/validation', destination: '/certificates?view=action', permanent: false },
      { source: '/renewals', destination: '/certificates?view=action', permanent: false }
    ];
  },
  experimental: {
    serverActions: { bodySizeLimit: '1mb' }
  }
};

export default nextConfig;
