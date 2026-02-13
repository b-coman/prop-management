"use client";

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { Shield } from 'lucide-react';

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
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [marketingEnabled, setMarketingEnabled] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    const stored = getConsentCookie();
    if (stored) {
      updateGtagConsent(stored);
    } else {
      // Small delay so the page renders first
      const timer = setTimeout(() => {
        setIsFirstVisit(true);
        setVisible(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Lock body scroll when overlay is shown
  useEffect(() => {
    if (visible && isFirstVisit) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [visible, isFirstVisit]);

  // Listen for footer "open cookie settings" event
  useEffect(() => {
    const handler = () => {
      const stored = getConsentCookie();
      if (stored) {
        setAnalyticsEnabled(stored.analytics);
        setMarketingEnabled(stored.marketing);
      }
      setShowPreferences(true);
      setIsFirstVisit(false); // No overlay when reopening from footer
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
    setIsFirstVisit(false);
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

  if (!visible) return null;

  return (
    <>
      {/* Dark overlay — only on first visit */}
      {isFirstVisit && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" />
      )}

      {/* Banner card */}
      <div
        className={`fixed bottom-0 inset-x-0 ${isFirstVisit ? 'z-[61]' : 'z-50'} flex justify-center p-4 transition-opacity duration-300`}
        style={{ opacity: visible ? 1 : 0 }}
      >
        <div className="w-full max-w-lg bg-background rounded-xl border border-border shadow-2xl">
          <div className="p-6">
            {!showPreferences ? (
              /* Main banner view */
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {t('cookieConsent.title', 'We value your privacy')}
                  </h3>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t('cookieConsent.description', 'We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. You can choose which cookies you allow.')}
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleAcceptAll}
                    className="flex-1 px-5 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    {t('cookieConsent.acceptAll', 'Accept All')}
                  </button>
                  <button
                    onClick={() => {
                      const stored = getConsentCookie();
                      if (stored) {
                        setAnalyticsEnabled(stored.analytics);
                        setMarketingEnabled(stored.marketing);
                      }
                      setShowPreferences(true);
                    }}
                    className="flex-1 px-5 py-2.5 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors"
                  >
                    {t('cookieConsent.managePreferences', 'Manage Preferences')}
                  </button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  <a href="/privacy-policy" className="underline hover:text-foreground transition-colors">
                    {t('cookieConsent.privacyPolicy', 'Privacy Policy')}
                  </a>
                </p>
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
