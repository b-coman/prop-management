
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
       { // Add pattern for Firebase Storage if you use it for images
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
  // Add this section to allow requests from your Firebase Studio development environment
  allowedDevOrigins: ["https://6000-idx-studio-1746248400476.cluster-l6vkdperq5ebaqo3qy4ksvoqom.cloudworkstations.dev", "https://9000-idx-studio-1746248400476.cluster-l6vkdperq5ebaqo3qy4ksvoqom.cloudworkstations.dev"], // Added the 9000 port origin seen in logs
};

export default nextConfig;
