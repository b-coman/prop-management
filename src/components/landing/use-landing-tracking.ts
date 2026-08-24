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
import { trackMetaViewContentWhenReady } from '@/lib/meta-tracking';

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

    // The Pixel side cannot be fire-and-forget: `fbq` does not exist until consent is granted AND
    // the script has loaded. Shared waiter, so the property pages get the identical behaviour.
    return trackMetaViewContentWhenReady({
      slug: product.propertySlug,
      pricePerNight: product.advertisedRate,
      baseCurrency: product.baseCurrency,
    });

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
    /**
     * `header` and `mobile_bar` are the always-visible buttons in the shared header. They were
     * untracked, and worse than untracked: with no #hero on a landing page the header's fallback
     * navigated paid visitors to the property homepage instead of the booking flow.
     */
    trackCtaClick: (position: 'hero' | 'footer' | 'header' | 'mobile_bar') => emit('check_dates_click', base, { position }),

    /** Leaving the landing page for the main site — the page did not close the argument. */
    trackNavToSite: (destination: string) => emit('nav_to_site', base, { destination }),

  };
}
