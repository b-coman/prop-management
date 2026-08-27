/**
 * GuestContactActions — the two low-friction ways off the booking page.
 *
 * `TalkActions` is a WhatsApp + phone pair; `OtaAlternatives` is a pair of text links to the
 * property's own OTA listings. They exist for the same reason and are deliberately weighted
 * differently, so this file holds both and the hierarchy stays visible in one place.
 *
 * WHY THIS EXISTS. The page already had a "Contact Host" action, but it opened a four-field form
 * (name, surname, email, phone) before anyone could say a word — which is the friction, not the
 * cure. Measured 17-25 Aug: 33 people reached the booking page and ONE pressed any of the three
 * action buttons. So this replaces that button rather than joining it; the form is still reachable
 * from a text link underneath, for people who would rather write than talk.
 *
 * THE HIERARCHY IS THE DESIGN. Four weights, never five equals:
 *   1. Book now      filled, accent      the only filled button on the page
 *   2. Hold dates    muted fill
 *   3. TalkActions   outlined pair, grouped under a label  ← here
 *   4. OtaAlternatives  text links, no button chrome        ← here
 * If the OTA block looks like a button it gets pressed like one, and an Airbnb booking costs ~8%
 * more than a direct one (see `OtaAlternatives` for the arithmetic).
 *
 * MULTI-PROPERTY. Nothing here is specific to one property: the phone comes from
 * `property.contactPhone` and the OTA links from the `channels` collection. A property with no
 * phone renders no talk buttons; one with no active listings renders no OTA block. Both degrade to
 * nothing rather than to a broken link.
 */
"use client";

import React from 'react';
import { useBooking } from '../contexts';
import { useLanguage } from '@/hooks/useLanguage';
import { trackUiEvent } from '@/lib/tracking';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

/** Where on the page the control was pressed. Reported so the dead-end rescue can be counted apart. */
export type TalkPosition = 'summary_panel' | 'mobile_bar' | 'mobile_header' | 'unavailable_dates';

export interface OtaLink {
  /** Channel id — 'airbnb', 'booking.com', 'vrbo'. */
  id: string;
  /** Human label as configured on the channel doc ("Airbnb", "Booking.com"). */
  label: string;
  url: string;
}

/**
 * The WhatsApp mark, in `currentColor`.
 *
 * Deliberately NOT brand green: two branded greens fighting the property's own accent looks cheap,
 * and the glyph is recognisable from its shape alone — which is what lets it sit inside the
 * property theme instead of overriding it.
 */
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm0 18.15h-.01a8.2 8.2 0 01-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 01-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 012.41 5.83c0 4.54-3.7 8.22-8.24 8.22zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.16 0-.43.06-.65.31-.22.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.16 1.73 2.64 4.19 3.7.59.25 1.04.4 1.4.52.59.19 1.12.16 1.54.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.22-.16-.47-.28z" />
    </svg>
  );
}

function PhoneGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

/** wa.me wants digits only — no '+', no spaces, no punctuation. */
function waDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Hook shared by every talk control: the tel: and wa.me hrefs, or null when the property has no
 * phone configured (in which case nothing renders anywhere).
 *
 * THE PREFILLED TEXT IS THE WHOLE TRICK. Without it every conversation opens with "Bună ziua" and
 * the owner has to ask for the dates, the party size and which property — slower for him than the
 * form this replaces. With it, the first message already carries the answer.
 */
export function useTalkLinks(variant: 'general' | 'unavailable' = 'general') {
  const { property, checkInDate, checkOutDate, guestCount, pricing } = useBooking();
  const { t, currentLang } = useLanguage();

  const phone = property?.contactPhone;
  if (!phone) return null;

  const locale = currentLang === 'ro' ? ro : undefined;
  const dateFmt = currentLang === 'ro' ? 'd MMM' : 'MMM d';
  const propertyName = typeof property.name === 'string' ? property.name : property.name?.en ?? '';

  const stay = checkInDate && checkOutDate
    ? `${format(checkInDate, dateFmt, { locale })} – ${format(checkOutDate, dateFmt, { locale })}`
    : null;

  const lines: string[] = [];
  if (variant === 'unavailable' && stay) {
    lines.push(t(
      'booking.waUnavailable',
      `Hello! I tried ${stay} at ${propertyName} but those dates show as taken. What else is free?`,
      { stay, property: propertyName }
    ));
  } else {
    lines.push(t('booking.waGreeting', `Hello! I'm interested in ${propertyName}.`, { property: propertyName }));
    if (stay) {
      lines.push(t('booking.waDates', `Dates: ${stay}, ${guestCount} guests.`, { stay, guests: guestCount }));
    }
    if (pricing?.totalPrice) {
      lines.push(t(
        'booking.waQuoted',
        `Quoted total: ${Math.round(pricing.totalPrice)} ${pricing.currency}.`,
        { total: Math.round(pricing.totalPrice), currency: pricing.currency }
      ));
    }
  }

  return {
    tel: `tel:${phone}`,
    whatsapp: `https://wa.me/${waDigits(phone)}?text=${encodeURIComponent(lines.join('\n'))}`,
  };
}

/** One place to report a talk click, so channel and position are always both present. */
export function reportTalkClick(channel: 'whatsapp' | 'call', position: TalkPosition) {
  trackUiEvent('talk_click', { talk_channel: channel, talk_position: position });
}

/**
 * The outlined pair. `compact` drops the labels to glyphs — for the mobile sticky bar, where the
 * primary CTA has to stay dominant and a 44px icon is the most that can sit beside it without
 * competing.
 */
export function TalkActions({
  position,
  variant = 'general',
  compact = false,
  className = '',
}: {
  position: TalkPosition;
  variant?: 'general' | 'unavailable';
  compact?: boolean;
  className?: string;
}) {
  const links = useTalkLinks(variant);
  const { t } = useLanguage();
  if (!links) return null;

  const waLabel = t('booking.writeOnWhatsApp', 'Write on WhatsApp');
  const callLabel = t('booking.callUs', 'Call');

  if (compact) {
    return (
      <a
        href={links.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={waLabel}
        onClick={() => reportTalkClick('whatsapp', position)}
        className={`inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md border border-primary text-primary transition-colors hover:bg-primary/10 ${className}`}
      >
        <WhatsAppGlyph className="h-5 w-5" />
      </a>
    );
  }

  const base =
    'inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-primary px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 min-h-[44px]';

  return (
    <div className={`flex gap-2 ${className}`}>
      <a
        href={links.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => reportTalkClick('whatsapp', position)}
        className={base}
      >
        <WhatsAppGlyph className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{t('booking.whatsApp', 'WhatsApp')}</span>
      </a>
      <a
        href={links.tel}
        onClick={() => reportTalkClick('call', position)}
        className={base}
      >
        <PhoneGlyph className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{callLabel}</span>
      </a>
    </div>
  );
}

/**
 * "Also on Airbnb / Booking.com", as text links.
 *
 * WHY OFFER THEM AT ALL. The naive fear is cannibalisation, but the arithmetic is milder than the
 * commission rates suggest: because the OTAs are priced ABOVE direct, the higher gross absorbs most
 * of the commission. A 2-night stay quoted at 1,145 RON direct is ~1,294 on Airbnb, and 18.755% of
 * that still leaves 1,051 — so a defection costs ~8%, not ~19%. Break-even therefore needs the link
 * to rescue extra bookings worth only ~1% of direct volume, which the trust signal alone plausibly
 * clears.
 *
 * WHY IT LOOKS LIKE THIS. Text links, never buttons, and never adjacent to our own price — beside
 * "1,145 RON" it invites a comparison we don't control; at the foot of the page it reads as
 * reassurance. The sentence underneath does the commercial work.
 *
 * "USUALLY", NOT "ALWAYS". After the 17 Aug repricing direct wins 15 of 17 windows, not all of
 * them. A price claim that is false even occasionally is worse than no claim, so the copy hedges
 * and the parity tool (`scripts/parity-*`) is what keeps it honest.
 */
export function OtaAlternatives({
  links,
  className = '',
}: {
  links: OtaLink[];
  className?: string;
}) {
  const { t } = useLanguage();
  const { pricing } = useBooking();
  if (!links.length) return null;

  return (
    <div className={`border-t border-border pt-4 text-center ${className}`}>
      <p className="text-sm text-muted-foreground">
        {t('booking.alsoListedOn', 'Also on')}{' '}
        {links.map((l, i) => (
          <React.Fragment key={l.id}>
            {i > 0 && <span aria-hidden="true"> · </span>}
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              onClick={() =>
                trackUiEvent('ota_click', {
                  ota_channel: l.id,
                  // What the visitor was being quoted here at the moment they left.
                  direct_total: pricing?.totalPrice ?? undefined,
                  currency: pricing?.currency ?? undefined,
                })
              }
              className="underline underline-offset-4 hover:text-foreground"
            >
              {l.label}
              <span aria-hidden="true"> ↗</span>
            </a>
          </React.Fragment>
        ))}
      </p>
      <p className="mt-1 text-xs text-muted-foreground/80">
        {t('booking.directIsUsuallyCheaper', 'Booking here is usually 10-15% less.')}
      </p>
    </div>
  );
}
