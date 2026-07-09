"use client";

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Meta (Facebook/Instagram) browser Pixel.
 *
 * GDPR-aware: fires ONLY after the visitor grants *marketing* consent via the
 * cookie-consent banner (fbp is a marketing cookie). It reads the same
 * `cookie_consent` cookie the banner writes and reacts to its `consent-updated`
 * event. Pairs with the server-side Conversions API (`meta-capi.ts`), which
 * sends the authoritative Purchase/Lead/InitiateCheckout events.
 *
 * Receives the pixel id for the CURRENT property (resolved server-side in the
 * root layout from the middleware's x-property-slug). Renders nothing when a
 * property has no pixel — so one property never fires to another's pixel.
 */
const COOKIE_NAME = 'cookie_consent';

function hasMarketingConsent(): boolean {
  if (typeof document === 'undefined') return false;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${COOKIE_NAME}=`));
  if (!match) return false;
  try {
    const prefs = JSON.parse(decodeURIComponent(match.split('=')[1]));
    return prefs?.marketing === true;
  } catch {
    return false;
  }
}

export function MetaPixel({ pixelId }: { pixelId?: string }) {
  const pathname = usePathname();
  const [consented, setConsented] = useState(false);
  const skipFirstPageView = useRef(true);

  // Determine consent on mount and whenever the banner updates it.
  useEffect(() => {
    if (!pixelId) return;
    setConsented(hasMarketingConsent());
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail as { marketing?: boolean } | undefined;
      setConsented(detail?.marketing === true);
    };
    window.addEventListener('consent-updated', onUpdate);
    return () => window.removeEventListener('consent-updated', onUpdate);
  }, [pixelId]);

  // Fire PageView on client-side route changes. The base snippet already fires
  // the first PageView, so skip the initial run to avoid a double count.
  useEffect(() => {
    if (!pixelId || !consented) return;
    if (skipFirstPageView.current) {
      skipFirstPageView.current = false;
      return;
    }
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    if (typeof fbq === 'function') fbq('track', 'PageView');
  }, [pathname, consented, pixelId]);

  if (!pixelId || !consented) return null;

  return (
    <Script
      id="meta-pixel"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelId}');
          fbq('track', 'PageView');
        `,
      }}
    />
  );
}
