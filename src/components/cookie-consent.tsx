"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/hooks/useLanguage';
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

export function CookieConsent() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
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

    // Ask AFTER the visitor has seen the property, not 500ms in.
    //
    // The Meta Pixel does not load at all without consent (see meta-pixel.tsx),
    // so a visitor who bounces off the banner is invisible to Facebook: no
    // PageView, no audience, nothing to optimise against. Bouncing them early
    // costs the consent AND the measurement, which is why this waits for a sign
    // of engagement instead of interrupting immediately.
    let fired = false;
    const show = () => {
      if (fired) return;
      fired = true;
      setVisible(true);
    };

    const timer = setTimeout(show, 4000);
    window.addEventListener('scroll', show, { once: true, passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', show);
    };
  }, [suppressed]);

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
    setConsentCookie(prefs);
    updateGtagConsent(prefs);
    window.dispatchEvent(new CustomEvent('consent-updated', { detail: prefs }));
    setVisible(false);
    setShowPreferences(false);
  }, []);

  const handleAcceptAll = useCallback(() => {
    applyConsent({ analytics: true, marketing: true, timestamp: new Date().toISOString() });
  }, [applyConsent]);

  const handleRejectAll = useCallback(() => {
    applyConsent({ analytics: false, marketing: false, timestamp: new Date().toISOString() });
  }, [applyConsent]);

  const handleSavePreferences = useCallback(() => {
    applyConsent({ analytics: analyticsEnabled, marketing: marketingEnabled, timestamp: new Date().toISOString() });
  }, [applyConsent, analyticsEnabled, marketingEnabled]);

  if (suppressed) return null;
  if (!visible) return null;

  return (
    <>
      {/* No dimming overlay and no scroll lock: blanking the page behind this
          took the hero, the price and the booking CTA with it.
          The hero booking widget sits low in the hero on every breakpoint, so
          this has to stay out of that band: a compact card on phones, and a
          single-row bar hugging the bottom edge from lg: up.
          z-[70] sits above the sticky mobile booking bar (z-50). */}
      <div
        className="fixed bottom-0 inset-x-0 z-[70] flex justify-center p-3 sm:p-4 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <div className="w-full max-w-md md:max-w-6xl bg-background rounded-xl border border-border shadow-2xl">
          <div className="p-4 md:px-6 md:py-3">
            {!showPreferences ? (
              /* Main banner view. Kept deliberately short: this overlays a
                 booking page, and every row here is a row of the chalet the
                 visitor cannot see. */
              <div className="space-y-2.5 md:space-y-0 md:flex md:items-center md:gap-5">
                <div className="flex items-start gap-2.5 md:flex-1">
                  <Shield className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary md:w-5 md:h-5 md:mt-0" />
                  <div className="min-w-0">
                    <span className="hidden md:block text-sm font-semibold text-foreground">
                      {t('cookieConsent.title', 'We value your privacy')}
                    </span>
                    <p className="text-xs md:text-sm text-muted-foreground leading-snug">
                      {t('cookieConsent.description', 'We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. You can choose which cookies you allow.')}
                    </p>
                  </div>
                </div>

                {/* Reject must be one tap, same as accept. Burying it behind
                    "Manage Preferences" reads as a dark pattern, which costs
                    trust and is not what the EDPB/CNIL guidance allows. */}
                <div className="flex flex-row gap-2 md:gap-3 md:flex-shrink-0">
                  <button
                    onClick={handleAcceptAll}
                    className="flex-1 md:flex-none px-3 md:px-5 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
                  >
                    {t('cookieConsent.acceptAll', 'Accept All')}
                  </button>
                  <button
                    onClick={handleRejectAll}
                    className="flex-1 md:flex-none px-3 md:px-5 py-2.5 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors whitespace-nowrap"
                  >
                    {t('cookieConsent.rejectAll', 'Only Necessary')}
                  </button>
                </div>
                {/* Secondary links share one row so they cost 16px, not 48px. */}
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground md:flex-shrink-0 md:flex-col md:gap-0.5 md:items-end">
                  <button
                    onClick={() => {
                      const stored = getConsentCookie();
                      if (stored) {
                        setAnalyticsEnabled(stored.analytics);
                        setMarketingEnabled(stored.marketing);
                      }
                      setShowPreferences(true);
                    }}
                    className="underline hover:text-foreground transition-colors"
                  >
                    {t('cookieConsent.managePreferences', 'Manage Preferences')}
                  </button>
                  <a href={privacyUrl} className="underline hover:text-foreground transition-colors">
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
