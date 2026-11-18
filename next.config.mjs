/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      { source: '/certificates', destination: '/', permanent: false },
      { source: '/subscriptions', destination: '/', permanent: false },
      { source: '/subscriptions/endpoints', destination: '/partner/endpoints', permanent: false },
      { source: '/validation', destination: '/?show=action', permanent: false },
      { source: '/renewals', destination: '/?show=action', permanent: false }
    ];
  },
  experimental: {
    serverActions: { bodySizeLimit: '1mb' }
  }
};

export default nextConfig;
