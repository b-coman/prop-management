import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Import Inter font
import './globals.css';
import { Toaster } from '@/components/ui/toaster'; // Import Toaster
// AuthProvider is deliberately NOT here. It lives in src/app/admin/layout.tsx
// and src/app/login/layout.tsx, the only places with a client that needs the
// Firebase user. Mounting it globally put the Auth SDK on every guest pageview.
import { CurrencyProvider } from '@/contexts/CurrencyContext'; // Import CurrencyProvider directly
import { ThemeProvider } from '@/contexts/ThemeContext'; // Import ThemeProvider
import { ErrorBoundary } from '@/components/error-boundary'; // Import ErrorBoundary
import { LanguageProvider } from '@/lib/language-system'; // Import unified language system
import { GoogleTagManager, GoogleTagManagerNoscript } from '@/components/tracking/gtm';
import { MetaPixel } from '@/components/tracking/meta-pixel';
import { getPixelIdForProperty } from '@/lib/meta-pixels';
import { getLandingConfig } from '@/lib/landing/getLanding';
import { CookieConsent } from '@/components/cookie-consent';
import { UTMCapture } from '@/components/tracking/utm-capture';
import { LanguageHtmlUpdater } from '@/components/language-html-updater';
import { headers, cookies } from 'next/headers';
import { NO_TRACK_COOKIE, NO_TRACK_HEADER, shouldSuppressTracking } from '@/lib/no-track';
import { DEFAULT_LANGUAGE } from '@/lib/language-constants';
import { getServerTranslations } from '@/lib/language-system/server-translations';

// Instantiate the Inter font
const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'RentalSpot - Your Vacation Getaway', // More specific title
  description: 'Book unique vacation rentals like the Prahova Mountain Chalet and Coltei Apartment Bucharest.', // Updated description
};

/**
 * The property behind a campaign landing page (/lp/{campaign}), so its pixel loads like every other
 * page's. Returns null for an unknown campaign, which resolves to no pixel - same multi-property
 * discipline as an unconfigured property.
 */
async function propertyForCampaign(campaign: string | null): Promise<string | null> {
  if (!campaign) return null;
  const config = await getLandingConfig(campaign);
  return config?.propertyId ?? null;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read language + resolved property from middleware-set headers
  const headersList = await headers();
  const detectedLang = headersList.get('x-language') || DEFAULT_LANGUAGE;
  // Per-property Meta pixel: only the current property's pixel loads (multi-property).
  // Campaign landing pages have no property in their URL, so middleware hands us the campaign and we
  // resolve the owning property here. Skipping this is what left /lp/* with NO pixel at all.
  const metaPixelId = await getPixelIdForProperty(
    headersList.get('x-property-slug') ?? (await propertyForCampaign(headersList.get('x-campaign-slug')))
  );

  // The owner's own visits, and every hour spent in /admin, used to land in the same GA4 property
  // and the same pixel as real guests. At 33 booking-page visitors a week that is not noise. When
  // this is on the tags are never RENDERED — not loaded-but-silenced — so there is nothing to
  // misfire, and the consent question is not asked either (there would be nothing to consent to).
  const noTrack = shouldSuppressTracking(
    (await cookies()).get(NO_TRACK_COOKIE)?.value,
    headersList.get(NO_TRACK_HEADER)
  );

  return (
    <html lang={detectedLang}>
      <head>
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" />
        {!noTrack && <GoogleTagManager />}
        {!noTrack && <MetaPixel pixelId={metaPixelId} />}
      </head>
      {/* Apply font variable to body */}
      <body className={`${inter.variable} font-sans antialiased`}>
        {!noTrack && <GoogleTagManagerNoscript />}
        <ErrorBoundary>
          <CurrencyProvider> {/* Wrap with CurrencyProvider */}
            <ThemeProvider> {/* Wrap with ThemeProvider */}
              {/* Seeded from the server, which it never was. Without these the provider starts at
                  DEFAULT_LANGUAGE with isLoading=true and fetches the dictionary client-side, so
                  everything mounted here - the cookie notice above all - renders its English
                  fallbacks first and races a JSON fetch to become Romanian. A cookie notice in the
                  wrong language does not read as a routine formality, it reads as a broken foreign
                  site, and that is a consent nobody gives. Page-level providers (the landing pages,
                  the property pages) seed themselves already; this is the one that did not. */}
              <LanguageProvider
                initialLanguage={detectedLang}
                initialTranslations={getServerTranslations(detectedLang)}
                enablePerformanceTracking={true}
                enableDebugMode={process.env.NODE_ENV === 'development'}
              >
                <LanguageHtmlUpdater />
                {children}
                <Toaster />
                {!noTrack && <CookieConsent />}
                <UTMCapture />
                {/* A kill-switch you cannot see is one you forget you left on, and then spend an
                    afternoon wondering why your own visit never reached GA4. Deliberately plain and
                    out of the way; `?rs_test=0` turns it off. */}
                {noTrack && (
                  <div
                    aria-live="polite"
                    className="fixed bottom-2 left-2 z-[9999] rounded-md border border-amber-500/60 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 shadow-sm dark:bg-amber-950 dark:text-amber-100"
                  >
                    Test mode &middot; not tracked
                  </div>
                )}
              </LanguageProvider>
            </ThemeProvider>
          </CurrencyProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}