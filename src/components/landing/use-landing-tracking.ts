'use client';

/**
 * Landing-page instrumentation — one hook, used by the shared renderer, so every campaign page gets
 * the same events for free. The pages themselves are Firestore documents; only this template renders
 * them, so October's campaign inherits this with nothing to remember and nothing to copy.
 *
 * WHAT IT ANSWERS, and why each one exists:
 *  - which stay card gets clicked  -> decides what the NEXT campaign advertises
 *  - where the scroll dies         -> which section loses them (25/50/75; GA4's built-in fires at 90 only)
 *  - which CTA earned the click    -> hero, stay card and footer were previously one undifferentiated number
 *  - leaving for the main site     -> the page failed to answer something; worth knowing what they went for
 *
 * Every event carries `campaign` and `landing`, so a report can be cut per flight or per page without
 * relying on session attribution surviving the hop into the booking flow.
 *
 * These ride the existing dataLayer -> GTM -> GA4 path. They are consent-gated like everything else;
 * measured capture is ~31% of arrivals, not zero, because Consent Mode still sends cookieless pings.
 */
import { useEffect, useRef } from 'react';
import { trackUiEvent, trackViewItem } from '@/lib/tracking';
import { trackMetaViewContent } from '@/lib/meta-tracking';

/** Registered as GA4 custom dimensions — parameter names must match exactly or reports show nothing. */
export interface LandingEventBase {
  campaign: string;
  landing: string;
}

/** Enough to identify the product being viewed — mirrors what the property page sends. */
export interface LandingProduct {
  propertySlug: string;
  propertyName: string;
  city?: string | null;
  advertisedRate?: number;
  baseCurrency?: string;
}

export function useLandingTracking(base: LandingEventBase, product?: LandingProduct) {
  // The one event that was missing entirely, and the reason a month of paid traffic built no
  // retargeting audience: `view_item` / `ViewContent` were mounted ONLY on the property pages
  // (track-page-view.tsx, imported by /properties/[slug]). The campaign pages the ads actually point
  // at fired neither. Measured: the flight pointed at /ro logged 88 pixel ViewContents and 675
  // view_items; the two pointed at /lp logged 0 and 24.
  //
  // Same events, same shape, so a "viewed the property" audience covers both destinations rather
  // than quietly excluding the paid half.
  const productKey = product ? `${product.propertySlug}:${product.advertisedRate ?? ''}` : '';
  const firedViewContent = useRef(false);
  useEffect(() => {
    if (!product) return;

    // GA4 side goes out immediately — Consent Mode handles the denied case itself.
    trackViewItem({
      slug: product.propertySlug,
      name: product.propertyName,
      location: product.city ? { city: product.city } : null,
      pricePerNight: product.advertisedRate,
      baseCurrency: product.baseCurrency,
    });

    // The Pixel side CANNOT be fire-and-forget on mount. `fbq` does not exist until the visitor
    // grants marketing consent, and the consent question now waits for a quarter of the page or
    // twelve seconds — so at mount the answer is always "no pixel yet", and a one-shot effect would
    // no-op every single time. This is the difference between shipping the fix and shipping nothing.
    //
    // So: fire when `fbq` actually appears, whether that is the script finishing on a returning
    // visitor or the banner being accepted a minute in. Once only, and never if they decline.
    const sendViewContent = () => {
      if (firedViewContent.current) return false;
      if (typeof (window as { fbq?: unknown }).fbq !== 'function') return false;
      firedViewContent.current = true;
      trackMetaViewContent({
        slug: product.propertySlug,
        pricePerNight: product.advertisedRate,
        baseCurrency: product.baseCurrency,
      });
      return true;
    };

    if (sendViewContent()) return;

    // The banner dispatches this the moment either button is tapped.
    const onConsent = () => { window.setTimeout(sendViewContent, 300); };
    window.addEventListener('consent-updated', onConsent);
    // Plus a short poll for the returning visitor whose cookie is already set and whose pixel script
    // is simply still loading. Bounded: if it has not appeared in 15s, consent was not given.
    const poll = window.setInterval(() => { if (sendViewContent()) window.clearInterval(poll); }, 500);
    const stop = window.setTimeout(() => window.clearInterval(poll), 15000);

    return () => {
      window.removeEventListener('consent-updated', onConsent);
      window.clearInterval(poll);
      window.clearTimeout(stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productKey]);

  /** Folds campaign+landing into every push; the shared helper clears stale params. */
  const emit = (event: string, b: LandingEventBase, params: Record<string, unknown>) =>
    trackUiEvent(event, { ...b, ...params });

  const seen = useRef<Set<number>>(new Set());

  // Scroll depth. GA4's enhanced measurement only fires at 90%, which tells you who reached the end
  // and nothing about where everyone else stopped — the drop between thresholds is the signal.
  useEffect(() => {
    const thresholds = [25, 50, 75];
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const pct = Math.min(100, Math.round((window.scrollY / max) * 100));
      for (const t of thresholds) {
        if (pct >= t && !seen.current.has(t)) {
          seen.current.add(t);
          emit('scroll_depth', base, { percent_scrolled: t });
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // a short page may already be past a threshold on load
    return () => window.removeEventListener('scroll', onScroll);
  }, [base]);

  return {
    /** A stay card's book button. `position` is its index so a winning slot is visible, not just a winning date. */
    trackStayClick: (stay: { start: string; end: string; nights: number; guests?: number | null; priceHint?: number | null }, index: number) =>
      emit('select_item', base, {
        position: `stay_${index + 1}`,
        stay_dates: `${stay.start}_${stay.end}`,
        stay_nights: stay.nights,
        stay_guests: stay.guests ?? undefined,
        value: stay.priceHint ?? undefined,
      }),

    /** Hero / footer booking CTAs. Without `position` these collapse into one meaningless total. */
    trackCtaClick: (position: 'hero' | 'footer') => emit('check_dates_click', base, { position }),

    /** Leaving the landing page for the main site — the page did not close the argument. */
    trackNavToSite: (destination: string) => emit('nav_to_site', base, { destination }),

  };
}
