import type {NextConfig} from 'next';

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
    ],
  },
  // Add this section to allow requests from your Firebase Studio development environment
  // Replace the URL with the actual origin shown in the warning message in your terminal
  allowedDevOrigins: ["https://6000-idx-studio-1746248400476.cluster-l6vkdperq5ebaqo3qy4ksvoqom.cloudworkstations.dev"],
};

export default nextConfig;
