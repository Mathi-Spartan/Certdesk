/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      { source: '/certificates', destination: '/dashboard', permanent: false },
      { source: '/subscriptions', destination: '/dashboard', permanent: false },
      { source: '/subscriptions/endpoints', destination: '/partner/endpoints', permanent: false },
    ];
  },
  experimental: {
    serverActions: { bodySizeLimit: '1mb' }
  }
};

export default nextConfig;
