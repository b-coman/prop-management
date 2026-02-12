import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

export default async function robots(): Promise<MetadataRoute.Robots> {
  // Use the requesting host so custom domains get their own sitemap URL
  const headersList = await headers();
  const forwardedHost = headersList.get('x-forwarded-host') || headersList.get('host') || '';
  const requestHost = forwardedHost.replace(/^https?:\/\//, '').replace(/\/+$/, '');

  let baseUrl: string;
  if (requestHost && !requestHost.includes('localhost')) {
    baseUrl = `https://${requestHost}`;
  } else {
    let host = process.env.NEXT_PUBLIC_MAIN_APP_HOST || 'localhost:3000';
    host = host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    baseUrl = host.includes('localhost') ? `http://${host}` : `https://${host}`;
  }

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
