'use client';

/**
 * Hands the guest guide link to a guest, in their own language.
 *
 * One button. The booking's language picks the wording - there is no language
 * chooser, because the booking already knows. Same manual-send philosophy as
 * the campaign outbox: wa.me pre-fills the text and the owner presses send, so
 * the server never touches WhatsApp.
 *
 * Falls back to copying the message when a booking has no phone number, which
 * is the same button doing the only thing left available to it.
 */
import { useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** wa.me needs digits only; the text is pre-filled but not auto-sent. */
function waLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

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
  guestLanguage: 'en' | 'ro';
  templates: Partial<Record<'en' | 'ro', string>>;
}) {
  const [copied, setCopied] = useState(false);

  const message = (templates[guestLanguage] ?? '{link}')
    .replaceAll('{name}', (firstName ?? '').trim())
    .replaceAll('{link}', url);

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy the message:', message);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {phone ? (
        <Button size="sm" asChild className="gap-1.5">
          <a href={waLink(phone, message)} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-3.5 w-3.5" />
            Send on WhatsApp
          </a>
        </Button>
      ) : (
        <Button size="sm" onClick={copyMessage} className="gap-1.5">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy message'}
        </Button>
      )}

      <Button variant="ghost" size="sm" asChild className="gap-1.5">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3.5 w-3.5" />
          Preview
        </a>
      </Button>
    </div>
  );
}
