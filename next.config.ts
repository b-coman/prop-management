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
  // The allowedDevOrigins should be inside the experimental object
  experimental: {
    allowedDevOrigins: [
      "https://6000-idx-studio-1746248400476.cluster-l6vkdperq5ebaqo3qy4ksvoqom.cloudworkstations.dev", 
      "https://9000-idx-studio-1746248400476.cluster-l6vkdperq5ebaqo3qy4ksvoqom.cloudworkstations.dev",
      "https://*.cloudworkstations.dev", 
      "https://*.prahova-chalet.ro"
    ]
  }
};

export default nextConfig;