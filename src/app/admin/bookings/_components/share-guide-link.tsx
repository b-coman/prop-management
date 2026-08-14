'use client';

/**
 * Hands the guest guide link over to a guest.
 *
 * Same manual-send philosophy as the campaign outbox: a wa.me click-to-chat
 * link pre-fills the text and the owner presses send himself. The server never
 * touches WhatsApp.
 *
 * Two languages because the page itself is currently English-only while the
 * Romanian copy is reworked - so a Romanian guest gets a Romanian covering
 * message even though the guide behind it is in English. The guest's booking
 * language picks the default; both are always available.
 *
 * "Copy message" matters more than it looks: most bookings arrive through
 * Airbnb or Booking, where the conversation happens in the platform inbox
 * rather than on WhatsApp, and some have no phone number at all.
 */
import { useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** wa.me needs digits only; the text is pre-filled but not auto-sent. */
function waLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

type Lang = 'en' | 'ro';

export function ShareGuideLink({
  url,
  phone,
  firstName,
  guestLanguage,
  templates,
}: {
  url: string;
  phone?: string;
  firstName?: string;
  guestLanguage: Lang;
  templates: Partial<Record<Lang, string>>;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const flash = (what: string) => {
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  const message = (lang: Lang): string =>
    (templates[lang] ?? '{link}')
      .replaceAll('{name}', (firstName ?? '').trim())
      .replaceAll('{link}', url);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash(what);
    } catch {
      window.prompt('Copy:', text);
    }
  };

  // The guest's own language first, so the obvious button is the right one.
  const langs: Lang[] = guestLanguage === 'ro' ? ['ro', 'en'] : ['en', 'ro'];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {langs.map((lang, i) => (
          <Button
            key={lang}
            variant={i === 0 ? 'default' : 'outline'}
            size="sm"
            asChild={!!phone}
            disabled={!phone}
            className="gap-1.5"
            title={phone ? undefined : 'No phone number on this booking'}
          >
            {phone ? (
              <a href={waLink(phone, message(lang))} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp ({lang.toUpperCase()})
              </a>
            ) : (
              <span>
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp ({lang.toUpperCase()})
              </span>
            )}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {langs.map((lang) => (
          <Button
            key={lang}
            variant="outline"
            size="sm"
            onClick={() => copy(message(lang), `msg-${lang}`)}
            className="gap-1.5"
          >
            {copied === `msg-${lang}` ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied === `msg-${lang}` ? 'Copied' : `Copy message (${lang.toUpperCase()})`}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => copy(url, 'url')} className="gap-1.5">
          {copied === 'url' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied === 'url' ? 'Copied' : 'Copy link only'}
        </Button>
        <Button variant="ghost" size="sm" asChild className="gap-1.5">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            Preview
          </a>
        </Button>
      </div>

      {!phone && (
        <p className="text-xs text-muted-foreground">
          No phone on this booking - use Copy message and paste it into the platform inbox.
        </p>
      )}
    </div>
  );
}
