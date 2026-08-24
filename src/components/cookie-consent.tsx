"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/lib/language-system/useLanguage';
import { Shield } from 'lucide-react';

// Routes where the cookie consent banner should NOT appear (e.g., internal/housekeeping
// share pages that don't run analytics or marketing).
const SUPPRESS_ON_PATHS = ['/calendar/'];

interface ConsentPreferences {
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

const COOKIE_NAME = 'cookie_consent';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 365 days in seconds

/**
 * A beat after the page has finished loading, so the visitor has actually SEEN the chalet before
 * being asked anything. The hero needs >1.2s from Firebase Storage, which is why "ask at 500ms"
 * put the question over a dark rectangle.
 */
const SETTLE_AFTER_LOAD_MS = 1200;
/** Ask anyway. A slow phone must not mean no question at all. */
const HARD_CAP_MS = 5000;

function getConsentCookie(): ConsentPreferences | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match.split('=')[1]));
  } catch {
    return null;
  }
}

function setConsentCookie(prefs: ConsentPreferences) {
  const value = encodeURIComponent(JSON.stringify(prefs));
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax; Secure`;
}

function updateGtagConsent(prefs: ConsentPreferences) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('consent', 'update', {
    analytics_storage: prefs.analytics ? 'granted' : 'denied',
    ad_storage: prefs.marketing ? 'granted' : 'denied',
    ad_user_data: prefs.marketing ? 'granted' : 'denied',
    ad_personalization: prefs.marketing ? 'granted' : 'denied',
  });
}


/**
 * Report what happened to the banner. GA4 cannot distinguish "rejected" from "never looked at it" —
 * both end as denied with no session — so the decision is recorded first-party. Fire-and-forget:
 * a failed beacon must never delay or block the visitor's choice.
 */
function reportConsentOutcome(outcome: 'shown' | 'accept' | 'reject' | 'preferences', analytics?: boolean) {
  try {
    const params = new URLSearchParams(window.location.search);
    const body = JSON.stringify({
      outcome,
      analytics,
      path: window.location.pathname,
      campaign: params.get('utm_campaign') ?? undefined,
      // Only meaningful on `shown`: how long after the page started loading the question appeared.
      // The page is the only thing that can measure this honestly — an external probe cannot see the
      // moment before it starts running. And it measures it where it matters, on the visitor's own
      // phone and connection, rather than on a desktop over fibre.
      shownAfterMs: outcome === 'shown' ? Math.round(performance.now()) : undefined,
    });
    // sendBeacon survives the page being closed straight after a click; fetch is the fallback.
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/consent-log', new Blob([body], { type: 'application/json' }));
    } else {
      void fetch('/api/consent-log', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true });
    }
  } catch {
    /* never break the page for a counter */
  }
}

export function CookieConsent() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  /** The page says it is time to ask; rendering still waits on translations. */
  const [dueToAsk, setDueToAsk] = useState(false);
  /** Set the moment either button is used, so the reveal effect can never re-open the card. */
  const answered = useRef(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [marketingEnabled, setMarketingEnabled] = useState(false);

  const suppressed = SUPPRESS_ON_PATHS.some(p => pathname?.startsWith(p));

  // Derive privacy URL: on custom domains it's just /privacy-policy,
  // on the main app domain we need /properties/{slug}/privacy-policy
  const privacyUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/privacy-policy';
    const path = window.location.pathname;
    const match = path.match(/^\/properties\/([^/]+)/);
    if (match) return `/properties/${match[1]}/privacy-policy`;
    return '/privacy-policy';
  }, []);

  useEffect(() => {
    if (suppressed) return;
    const stored = getConsentCookie();
    if (stored) {
      updateGtagConsent(stored);
      return;
    }

    // WHEN to ask, revised twice, so the reasoning is worth stating.
    //
    // 500ms was too early: the hero photo needs >1.2s, so the question landed on a dark rectangle.
    // The correction (a quarter of the page, or 12s) then went too far the other way: it ambushes
    // someone mid-read, and it breaks the pattern people already know. A cookie notice that appears
    // as a page settles gets dismissed reflexively, because that is what every site does and the
    // visitor is still in "arriving somewhere" mode. One that appears after they have started
    // reading is an interruption, and interruptions get considered rather than dismissed.
    //
    // So: a beat after load. Seen the chalet, still arriving, question answered, gone.
    let fired = false;
    const show = () => {
      if (fired) return;
      fired = true;
      setDueToAsk(true);
    };

    let settle: ReturnType<typeof setTimeout>;
    const cap = setTimeout(show, HARD_CAP_MS);
    const onReady = () => {
      clearTimeout(cap);
      settle = setTimeout(show, SETTLE_AFTER_LOAD_MS);
    };
    if (document.readyState === 'complete') onReady();
    else window.addEventListener('load', onReady, { once: true });

    return () => {
      clearTimeout(cap);
      clearTimeout(settle);
      window.removeEventListener('load', onReady);
    };
  }, [suppressed]);

  // Translations gate the RENDER, never the clock.
  //
  // These were one effect, and the coupling was quietly awful: the timers only started once
  // translations had loaded, so the moment of asking drifted with however long a JSON fetch took.
  // The decision of WHEN to ask belongs to the page; translations only decide whether we can put
  // the question into words yet. Because they must: an early banner renders the English fallbacks
  // to a Romanian reader who arrived from a Romanian ad, and a notice in the wrong language reads
  // as a broken foreign site rather than a formality. Nobody consents to that.
  //
  // Ask `t` directly rather than trusting `isLoading`. The provider sets isLoading=true for its own
  // client-side fetch even when the server already seeded the dictionary, so gating on it inherited
  // exactly the fetch the seeding exists to skip — measured live: banner at 11.2s on a page that
  // finished loading at 0.6s. An empty fallback that comes back non-empty means the real copy is
  // present, whatever the loading flag happens to say.
  const copyReady = t('cookieConsent.title', '') !== '' && t('cookieConsent.acceptAll', '') !== '';
  useEffect(() => {
    // ONCE ANSWERED, NEVER RE-ASK. Without this guard the banner was unclosable, on every browser.
    //
    // Answering sets `visible` to false, which is a dependency of this effect, so the effect re-ran,
    // found `dueToAsk` still true and put the banner straight back up — and logged another `shown`
    // while doing it. Tapping Accept or Decline appeared to do nothing at all. Reported from an
    // iPhone 24 Aug and reproduced immediately in Chrome; it was never iOS-specific.
    //
    // Live since 19 Aug, which also means every `shown` count since then is inflated by the re-opens
    // and the accept RATE correspondingly understated.
    //
    // The cookie is the durable record of an answer, so it is what the guard reads: `answered` alone
    // would miss a visitor who decided on an earlier page load.
    if (answered.current || getConsentCookie()) return;
    if (!dueToAsk || !copyReady || visible) return;
    setVisible(true);
    reportConsentOutcome('shown');
  }, [dueToAsk, copyReady, visible]);

  // A question you can scroll past is not a question — but a question you cannot ANSWER is worse.
  //
  // The first version of this lock pinned the body: `position:fixed` plus a negative `top` equal to
  // the scroll offset, the standard iOS trick. On iOS it broke the banner outright — reported from a
  // real iPhone 24 Aug: the card renders, and neither Accept nor Decline responds. Pinning the body
  // moves the layout viewport out from under a `position:fixed` overlay on iOS Safari, so the taps
  // no longer land on the buttons that are visibly there.
  //
  // That is a total loss of the platform carrying ~89% of this site's traffic, which is far worse
  // than a banner someone can scroll past. So the body is never repositioned now. `overflow:hidden`
  // on the root holds desktop and Android; iOS may still scroll behind the card, and that is the
  // right trade — a lower consent rate beats an unusable site.
  useEffect(() => {
    if (!visible) return;
    const { body, documentElement: html } = document;
    const prev = {
      bodyOverflow: body.style.overflow,
      htmlOverflow: html.style.overflow,
      paddingRight: body.style.paddingRight,
    };
    // Removing the scrollbar would otherwise shift the whole layout sideways under the card.
    const scrollbar = window.innerWidth - html.clientWidth;
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    return () => {
      body.style.overflow = prev.bodyOverflow;
      html.style.overflow = prev.htmlOverflow;
      body.style.paddingRight = prev.paddingRight;
    };
  }, [visible]);

  // Listen for footer "open cookie settings" event
  useEffect(() => {
    const handler = () => {
      const stored = getConsentCookie();
      if (stored) {
        setAnalyticsEnabled(stored.analytics);
        setMarketingEnabled(stored.marketing);
      }
      setShowPreferences(true);
        setVisible(true);
    };
    window.addEventListener('open-cookie-settings', handler);
    return () => window.removeEventListener('open-cookie-settings', handler);
  }, []);

  const applyConsent = useCallback((prefs: ConsentPreferences) => {
    answered.current = true;
    setConsentCookie(prefs);
    updateGtagConsent(prefs);
    window.dispatchEvent(new CustomEvent('consent-updated', { detail: prefs }));
    setVisible(false);
    setShowPreferences(false);
  }, []);

  const handleAcceptAll = useCallback(() => {
    reportConsentOutcome('accept', true);
    applyConsent({ analytics: true, marketing: true, timestamp: new Date().toISOString() });
  }, [applyConsent]);

  const handleRejectAll = useCallback(() => {
    reportConsentOutcome('reject', false);
    applyConsent({ analytics: false, marketing: false, timestamp: new Date().toISOString() });
  }, [applyConsent]);

  const handleSavePreferences = useCallback(() => {
    reportConsentOutcome('preferences', analyticsEnabled);
    applyConsent({ analytics: analyticsEnabled, marketing: marketingEnabled, timestamp: new Date().toISOString() });
  }, [applyConsent, analyticsEnabled, marketingEnabled]);

  if (suppressed) return null;
  if (!visible) return null;

  return (
    <>
      {/* A DECISION IS REQUIRED — measured, not assumed. The passive bottom bar produced a 100%
          ignore rate (consentEvents, 18 Aug): nobody declined, nobody accepted, everyone scrolled
          past. A bar you can ignore collects nothing.

          It is still not a cookie wall: both options are present, one tap each, and declining gives
          the same full access to the site. What is removed is the option to not answer.

          The earlier overlay was pulled on 14 Aug for a real reason — it covered the hero, the price
          and the booking CTA. This avoids that by waiting for the visitor to have SEEN the property
          first (4s or first scroll, unchanged), then asking once and getting out of the way. The
          backdrop is light rather than a blackout, so the chalet stays visible behind the question. */}
      <div className="fixed inset-x-0 top-0 z-[69] h-[100dvh] bg-black/25 backdrop-blur-[2px] transition-opacity duration-300" style={{ opacity: visible ? 1 : 0 }} />
      <div
        /* `inset-0` resolves against the LARGE viewport on iOS Safari, which extends behind the
           browser toolbar. Bottom-anchored on a phone, that put the decline link and the lower edge
           of Accept underneath the toolbar: visible, and not tappable. `100dvh` tracks the viewport
           as the toolbars come and go, and the safe-area padding keeps the buttons clear of the home
           indicator. */
        className="fixed inset-x-0 top-0 z-[70] flex h-[100dvh] items-end sm:items-center justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {/* Now that the document is locked, the card is the only thing that may scroll — otherwise
            the preferences panel can run off a short phone screen with no way to reach its buttons. */}
        <div className="w-full max-w-md max-h-[85vh] overflow-y-auto overscroll-contain bg-background rounded-2xl border border-border shadow-2xl ring-1 ring-black/5">
          <div className="p-4 md:px-6 md:py-3">
            {!showPreferences ? (
              /* Main banner view. Kept deliberately short: this overlays a
                 booking page, and every row here is a row of the chalet the
                 visitor cannot see. */
              <div className="space-y-4">
                <div className="flex items-start gap-2.5">
                  <Shield className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary md:w-5 md:h-5 md:mt-0" />
                  <div className="min-w-0">
                    <span className="block text-base md:text-lg font-semibold text-foreground mb-1">
                      {t('cookieConsent.title', 'We value your privacy')}
                    </span>
                    <p className="text-sm text-muted-foreground leading-snug">
                      {t('cookieConsent.description', 'We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. You can choose which cookies you allow.')}
                    </p>
                  </div>
                </div>

                {/* Accept is the button; declining is a plain text link beside it. Emphasis may
                    differ — accessibility may not — so the link stays ONE TAP, on the same layer,
                    in a legible size with real contrast, never a grey whisper in a corner. */}
                {/* Two decisions, stacked, nothing else competing for the tap. Accept fills the
                    width; declining sits directly beneath it — one tap, same layer, legible.
                    Preferences and the policy drop to a single quiet line so the CHOICE is the only
                    thing that reads as an action; four equal-weight links is what produced a room
                    full of people scrolling past. */}
                {/* Two buttons, side by side, in the shape every consent notice on the Romanian web
                    already uses. Declining as an underlined text link read as a link to more
                    information rather than a decision, which is the opposite of what a notice
                    needs: the visitor has to see two options and pick one without thinking. Accept
                    keeps the emphasis; both are one tap, on the same layer, at the same size. */}
                <div className="flex gap-2">
                  <button
                    onClick={handleRejectAll}
                    className="flex-1 touch-manipulation px-4 py-3 text-sm font-medium rounded-xl border border-border bg-background text-foreground hover:bg-muted active:scale-[0.99] transition-all"
                  >
                    {t('cookieConsent.rejectAll', 'Only necessary')}
                  </button>
                  <button
                    onClick={handleAcceptAll}
                    className="flex-1 touch-manipulation px-4 py-3 text-sm font-semibold rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-[0.99] transition-all"
                  >
                    {t('cookieConsent.acceptAll', 'Accept')}
                  </button>
                </div>
                <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground/70">
                  <button
                    onClick={() => {
                      const stored = getConsentCookie();
                      if (stored) {
                        setAnalyticsEnabled(stored.analytics);
                        setMarketingEnabled(stored.marketing);
                      }
                      setShowPreferences(true);
                    }}
                    className="hover:text-foreground transition-colors"
                  >
                    {t('cookieConsent.managePreferences', 'Manage Preferences')}
                  </button>
                  <span aria-hidden>·</span>
                  <a href={privacyUrl} className="hover:text-foreground transition-colors">
                    {t('cookieConsent.privacyPolicy', 'Privacy Policy')}
                  </a>
                </div>
              </div>
            ) : (
              /* Preferences panel */
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {t('cookieConsent.managePreferences', 'Manage Preferences')}
                </h3>

                <div className="space-y-3">
                  {/* Necessary — always on */}
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked
                      disabled
                      className="mt-1 h-4 w-4 rounded border-border"
                    />
                    <span>
                      <span className="text-sm font-medium text-foreground block">
                        {t('cookieConsent.necessary', 'Necessary')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t('cookieConsent.necessaryDesc', 'Essential cookies required for the website to function. These cannot be disabled.')}
                      </span>
                    </span>
                  </label>

                  {/* Analytics */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={analyticsEnabled}
                      onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-border"
                    />
                    <span>
                      <span className="text-sm font-medium text-foreground block">
                        {t('cookieConsent.analytics', 'Analytics')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t('cookieConsent.analyticsDesc', 'Help us understand how visitors use our website to improve the experience.')}
                      </span>
                    </span>
                  </label>

                  {/* Marketing */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={marketingEnabled}
                      onChange={(e) => setMarketingEnabled(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-border"
                    />
                    <span>
                      <span className="text-sm font-medium text-foreground block">
                        {t('cookieConsent.marketing', 'Marketing')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t('cookieConsent.marketingDesc', 'Used to deliver relevant advertisements and measure campaign effectiveness.')}
                      </span>
                    </span>
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleAcceptAll}
                    className="flex-1 px-5 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    {t('cookieConsent.acceptAll', 'Accept All')}
                  </button>
                  <button
                    onClick={handleSavePreferences}
                    className="flex-1 px-5 py-2.5 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors"
                  >
                    {t('cookieConsent.savePreferences', 'Save Preferences')}
                  </button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  <button
                    onClick={handleRejectAll}
                    className="underline hover:text-foreground transition-colors"
                  >
                    {t('cookieConsent.rejectAll', 'Reject All')}
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
