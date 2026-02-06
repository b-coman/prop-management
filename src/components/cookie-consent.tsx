"use client";

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/hooks/useLanguage';

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

  useEffect(() => {
    const stored = getConsentCookie();
    if (stored) {
      updateGtagConsent(stored);
    } else {
      // Small delay so the page renders first
      const timer = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

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

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-50 transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="bg-background/80 backdrop-blur-md border-t border-border shadow-lg">
        <div className="container mx-auto px-4 py-3">
          {!showPreferences ? (
            /* Compact banner */
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <p className="text-sm text-muted-foreground flex-1 text-center sm:text-left">
                {t('cookieConsent.message', 'We use cookies for analytics and marketing.')}
              </p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleRejectAll}
                  className="px-4 py-1.5 text-sm rounded-md text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t('cookieConsent.rejectAll', 'Reject All')}
                </button>
                <button
                  onClick={handleAcceptAll}
                  className="px-4 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
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
                  className="px-4 py-1.5 text-sm rounded-md border border-border bg-background hover:bg-muted transition-colors"
                >
                  {t('cookieConsent.manage', 'More')}
                </button>
              </div>
            </div>
          ) : (
            /* Preferences panel */
            <div className="max-w-lg mx-auto py-2 space-y-4">
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
                      {t('cookieConsent.necessaryDesc', 'Essential cookies required for the website to function properly.')}
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
                      {t('cookieConsent.analyticsDesc', 'Help us understand how visitors interact with our website.')}
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
                      {t('cookieConsent.marketingDesc', 'Used to deliver relevant advertisements and track campaign performance.')}
                    </span>
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={handleRejectAll}
                  className="px-4 py-1.5 text-sm rounded-md border border-border bg-background hover:bg-muted transition-colors"
                >
                  {t('cookieConsent.rejectAll', 'Reject All')}
                </button>
                <button
                  onClick={handleSavePreferences}
                  className="px-4 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {t('cookieConsent.savePreferences', 'Save Preferences')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
