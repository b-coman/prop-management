import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  let host = process.env.NEXT_PUBLIC_MAIN_APP_HOST || 'localhost:3000';
  // Strip protocol if already included to avoid double-protocol (https://https://...)
  host = host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const baseUrl = host.includes('localhost') ? `http://${host}` : `https://${host}`;

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin/', '/api/'] },
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
