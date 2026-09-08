"use client";

import Script from 'next/script';
import { isConsentSuspended } from '@/lib/consent-suspension';

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

export function GoogleTagManager() {
  if (!GTM_ID) return null;

  // While the consent gate is suspended (see consent-suspension.ts — a dated, self-expiring
  // override) Consent Mode starts GRANTED instead of denied, so GA4 measures every visitor rather
  // than the ~53% who answer the banner. Everything below is otherwise untouched: the redaction and
  // passthrough settings still apply, and the moment the date lapses this reverts to 'denied' on the
  // next render with no deploy.
  const suspended = isConsentSuspended();
  const state = suspended ? 'granted' : 'denied';

  return (
    <>
      {/* Consent Mode v2 defaults — must run before GTM loads */}
      <Script
        id="gtm-consent-defaults"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('consent', 'default', {
              'analytics_storage': '${state}',
              'ad_storage': '${state}',
              'ad_user_data': '${state}',
              'ad_personalization': '${state}',
              'wait_for_update': 500
            });
            // The two settings that decide how much survives a DENIED answer, and both were missing.
            //
            // ads_data_redaction strips ad click identifiers from the tags that still fire when
            // ad_storage is denied - the privacy-correct behaviour, and a precondition for Google
            // treating this as a proper Consent Mode implementation rather than tags leaking ids.
            //
            // url_passthrough is the one that pays: with cookies denied there is no client id, so a
            // paid visitor who moves from the landing page into the booking flow arrives looking
            // like a brand new direct session. Passing gclid/gbraid through the URL keeps that hop
            // attributed to the campaign that paid for it. That is a large part of why 40 GA4
            // sessions had to stand in for 196 landing views.
            gtag('set', 'ads_data_redaction', true);
            gtag('set', 'url_passthrough', true);
          `,
        }}
      />

      {/* GTM container script */}
      <Script
        id="gtm-script"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${GTM_ID}');
          `,
        }}
      />
    </>
  );
}

export function GoogleTagManagerNoscript() {
  if (!GTM_ID) return null;

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
      />
    </noscript>
  );
}
