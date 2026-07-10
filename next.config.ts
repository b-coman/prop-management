import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  /* config options here */
  // NOTE: Do NOT set `output: 'standalone'` here. Firebase App Hosting's
  // Next.js adapter produces its own deployable output and copies the full
  // `public/` folder. With a manual `output: 'standalone'`, recent adapter
  // builds only shipped public assets that were referenced in build-time code
  // (e.g. og-image.jpg via resolveOgImage), and dropped every image referenced
  // only through runtime Firestore data — causing all /images/** to 404 in
  // production. Letting the adapter manage output restores full public serving.
  typescript: {
    ignoreBuildErrors: false,
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
      {
        protocol: 'https',
        hostname: '*.firebasestorage.app',
      },
    ],
  },
  // Support for multi-page structure and custom domains
  experimental: {
    allowedDevOrigins: ["*"],
    serverActions: {
      // When adding a new custom domain, add it here too — otherwise
      // server actions (form submissions) will fail with a 500 error
      // due to Next.js CSRF protection (Origin vs Host mismatch).
      allowedOrigins: ['prahova-chalet.ro', 'www.prahova-chalet.ro'],
    },
  },
  // External packages that need special handling
  serverExternalPackages: ['firebase-admin', 'node-ical'],
  // WebAssembly config for firebase-admin dependencies
  webpack: (config, { isServer }) => {
    // Only apply these configurations in production builds or non-Turbopack dev
    if (!process.env.TURBOPACK) {
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true
      };
      config.module.rules.push({
        test: /\.wasm$/,
        type: 'webassembly/async',
      });
    }
    return config;
  },
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

export default withSentryConfig(nextConfig, {
  // Suppress source map upload logs
  silent: true,

  // Disable source map upload — no SENTRY_AUTH_TOKEN needed
  sourcemaps: {
    disable: true,
  },

  // Disable telemetry
  telemetry: false,
});