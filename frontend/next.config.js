/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Next.js 15+ configuration
  experimental: {
    // Enable React 19 features
    reactCompiler: false,
  },
  
  env: {
    // Use relative URLs for production (nginx proxies /api to backend)
    // For local dev without nginx, set NEXT_PUBLIC_API_URL=http://localhost:5000/api
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || '',
  },
  
  // Rewrites only used in development mode
  async rewrites() {
    // Only apply rewrites in development when not using nginx
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:5000/api/:path*',
        },
      ];
    }
    return [];
  },
  
  // Suppress hydration warnings during development
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};

module.exports = nextConfig;
