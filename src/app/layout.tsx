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
import { CookieConsent } from '@/components/cookie-consent';
import { UTMCapture } from '@/components/tracking/utm-capture';
import { LanguageHtmlUpdater } from '@/components/language-html-updater';
import { headers } from 'next/headers';
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read language + resolved property from middleware-set headers
  const headersList = await headers();
  const detectedLang = headersList.get('x-language') || DEFAULT_LANGUAGE;
  // Per-property Meta pixel: only the current property's pixel loads (multi-property).
  const metaPixelId = await getPixelIdForProperty(headersList.get('x-property-slug'));

  return (
    <html lang={detectedLang}>
      <head>
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" />
        <GoogleTagManager />
        <MetaPixel pixelId={metaPixelId} />
      </head>
      {/* Apply font variable to body */}
      <body className={`${inter.variable} font-sans antialiased`}>
        <GoogleTagManagerNoscript />
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
                <CookieConsent />
                <UTMCapture />
              </LanguageProvider>
            </ThemeProvider>
          </CurrencyProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}