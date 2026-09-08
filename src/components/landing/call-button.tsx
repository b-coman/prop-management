'use client';
/**
 * CallButton — the tracked click-to-call CTA (the landing page's PRIMARY conversion). No `tel:` link
 * existed anywhere on the site before this. On tap it fires a dataLayer `click_to_call` event (register
 * it as a GA key event) + Meta `Contact`, then dials. This is how the owner's real conversion — the phone
 * call — finally becomes measurable (people check the price, then call). See docs/landing-page-engine-design.md.
 */
import { Button } from '@/components/ui/button';
import { Phone } from 'lucide-react';
import { trackEvent } from '@/lib/tracking';

/**
 * `variant` exists so the caller can decide which control carries the visual weight. The landing hero
 * now leads with the stays CTA and demotes this one to an outline — measured 17 Aug - 8 Sep, calling
 * took 6 clicks from 5 people against 67 from 54 for the stays button, so the solid green was on the
 * control people wanted ten times less. Defaults to 'cta' so every other caller is unaffected.
 */
export function CallButton({ phone, label, size = 'lg', className, variant = 'cta' }: { phone: string; label: string; size?: 'default' | 'lg' | 'compact'; className?: string; variant?: 'cta' | 'outline' }) {
  const onCall = () => {
    try {
      trackEvent('click_to_call', { phone, source: 'landing_page' });
      const w = window as unknown as { fbq?: (...a: unknown[]) => void };
      if (typeof w.fbq === 'function') w.fbq('track', 'Contact');
    } catch { /* tracking must never block the call */ }
  };
  const tel = `tel:${phone.replace(/[^\d+]/g, '')}`;
  return (
    <Button variant={variant} size={size} className={className} asChild>
      <a href={tel} onClick={onCall}>
        <Phone className="mr-2 h-5 w-5" /> {label}
      </a>
    </Button>
  );
}
