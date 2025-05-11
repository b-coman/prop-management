import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
  // Support for multi-page structure and custom domains
  experimental: {
    allowedOrigins: ["*"],
    allowedDevOrigins: ["*"]
  },
  // External packages that need special handling
  serverExternalPackages: [],
  // Handle custom domains
  async rewrites() {
    return {
      beforeFiles: [
        // Rewrite API requests from custom domains
        {
          source: '/api/:path*',
          destination: '/api/:path*',
          has: [{ type: 'host', value: '(?!localhost).*' }],
        },
      ],
    };
  },
};

export default nextConfig;