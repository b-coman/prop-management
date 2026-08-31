/**
 * BookingEntryPanel — what the booking page shows before any dates are chosen.
 *
 * WHY IT EXISTS. Arriving with no dates is the MOST COMMON way into this funnel, not an edge case:
 * measured over August 2026, `?currency=RON` (35 views) and the bare path (20) were the top two
 * entries, against 11 for the busiest dated URL — roughly 40% of all booking-page entries. What that
 * traffic used to meet was a grey calendar glyph, the heading "Select Your Dates", and the sentence
 * "choose your dates in the control panel" — copy written for the desktop two-column layout, where
 * this card fills the empty right-hand workspace and the picker really is in a panel to its left. On
 * a phone there is no panel: the fields are 200px above, so the screen asked the same question twice
 * and spent its entire first screen doing it.
 *
 * WHAT REPLACES IT. The two things a dateless visitor actually needs:
 *
 *   1. A REASON. One seasonal photograph and one sentence, both chosen by the current month. Nothing
 *      generic: the copy names what the place is like in *this* season, in the owner's own register.
 *   2. A WAY IN. Two real openings, with real totals. Someone who arrives without dates usually does
 *      not have any — asking them to invent some is the friction. These come from
 *      `buildExampleStays`, the same reasoner the campaign landing pages use, so every window is
 *      genuinely free, satisfies the per-date minimum stay, and carries the REAL quoted total. A
 *      tap fills the picker above and the page prices it immediately.
 *
 * Talking lives in the sticky bar the container renders beneath this, not here — see `entry_bar`.
 *
 * DEGRADES TO NOTHING, NEVER TO A LIE. `buildExampleStays` returns `[]` rather than throwing when
 * there is no honest inventory to show, and the season strip renders only if the property actually
 * has a photo tagged for this time of year. Either half can be absent and the panel still reads.
 */
"use client";

import React, { useMemo } from 'react';
import { SafeImage } from '@/components/ui/safe-image';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { useBooking } from '../contexts';
import { useLanguage } from '@/hooks/useLanguage';
import { useCurrency } from '@/contexts/CurrencyContext';
import { trackUiEvent } from '@/lib/tracking';
import type { PropertyImage } from '@/types';

/** One proposed opening, resolved server-side. Mirrors `ExampleStay` minus the multilingual label. */
export interface EntryStay {
  start: string;   // YYYY-MM-DD
  end: string;     // YYYY-MM-DD
  nights: number;
  label: string;   // already resolved to the request language
  priceHint?: number | null;
  guests?: number | null;
}

/**
 * Month → (season copy key, photo tags), northern hemisphere.
 *
 * The tags are ordered by preference and fall back to the next one, because a property is not
 * obliged to own a photo for every season — `fireplace` exists once in this library and `autumn`
 * seven times. A season with no usable photo simply shows its sentence alone.
 */
const SEASONS: { months: number[]; key: string; fallback: string; tags: string[] }[] = [
  { months: [8, 9, 10], key: 'booking.seasonAutumn', tags: ['autumn', 'fire', 'evening', 'garden'],
    fallback: 'Autumn is quiet up here. Warm days, fires in the evening, and the grill going late.' },
  { months: [11, 0, 1], key: 'booking.seasonWinter', tags: ['fireplace', 'evening', 'interior', 'living-room'],
    fallback: 'In winter the house warms up fast, and the snow stays until March.' },
  { months: [2, 3, 4], key: 'booking.seasonSpring', tags: ['garden', 'landscape', 'view', 'exterior'],
    fallback: 'In spring the hill turns green. It is the quietest time of the year.' },
  { months: [5, 6, 7], key: 'booking.seasonSummer', tags: ['playground', 'hammock', 'bbq', 'kids'],
    fallback: 'In summer the children never come indoors. Swing, grill, and shade until evening.' },
];

/** Noon UTC, the normalisation every other date setter on this page uses. */
const atNoonUtc = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
};

export function BookingEntryPanel({ stays = [] }: { stays?: EntryStay[] }) {
  const { property, setCheckInDate, setCheckOutDate, setGuestCount } = useBooking();
  const { t, currentLang } = useLanguage();
  const { formatPrice, convertToSelectedCurrency } = useCurrency();

  const locale = currentLang === 'ro' ? ro : undefined;
  const dateFmt = currentLang === 'ro' ? 'd MMM' : 'MMM d';

  const season = useMemo(() => {
    const month = new Date().getMonth();
    const s = SEASONS.find((x) => x.months.includes(month)) ?? SEASONS[0];
    const images: PropertyImage[] = property?.images ?? [];
    // First tag that this property actually has a photo for; featured photos win inside a tag.
    let photo: PropertyImage | undefined;
    for (const tag of s.tags) {
      const matches = images.filter((i) => i.tags?.includes(tag) && i.showInGallery !== false);
      if (matches.length) {
        photo = matches.find((i) => i.isFeatured) ?? matches[0];
        break;
      }
    }
    return { line: t(s.key, s.fallback), photo };
  }, [property?.images, t]);

  const alt = (() => {
    const a = season.photo?.alt;
    if (!a) return '';
    return typeof a === 'string' ? a : (currentLang === 'ro' ? a.ro : a.en) || a.en || a.ro || '';
  })();

  const applyStay = (s: EntryStay, index: number) => {
    setCheckInDate(atNoonUtc(s.start));
    setCheckOutDate(atNoonUtc(s.end));
    if (s.guests) setGuestCount(s.guests);
    trackUiEvent('entry_stay_click', {
      stay_dates: `${s.start}_${s.end}`,
      stay_nights: s.nights,
      stay_position: index + 1,
    });
  };

  if (!season.line && stays.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* The warm half. A 56px thumbnail rather than a hero: this screen's first job is still the
          date picker above it, which costs 319px on its own. The shortest phone in this site's real
          traffic is 360x780 (GA4, Aug 2026), and there a full-width image would push the openings —
          the part that actually converts — behind the sticky bar. At 56px both survive. Uses
          `displayUrl`, the 1000px WebP tier, so the whole strip costs a few KB. */}
      {season.line && (
        <div className="flex items-center gap-3">
          {season.photo && (
            <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
              {/* SafeImage, not a bare next/image: it is what the gallery and the campaign landing
                  pages use here, and it degrades to a labelled placeholder instead of a broken frame
                  if the Storage URL ever fails. This library has history with image delivery on App
                  Hosting, and a warm-up strip is the last thing that should show a broken icon. */}
              <SafeImage
                src={season.photo.displayUrl || season.photo.url}
                alt={alt}
                fill
                sizes="56px"
                className="object-cover"
              />
            </div>
          )}
          <p className="min-w-0 text-sm leading-relaxed text-muted-foreground">{season.line}</p>
        </div>
      )}

      {/* The useful half. Same row shape as the unavailable-dates alternatives, deliberately: a
          visitor who meets both should recognise the second from the first. The difference is the
          right-hand column — there it is the night count, here it is the PRICE, because that is the
          question a dateless visitor is really asking and the one this page has been worst at
          answering early. */}
      {stays.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            {t('booking.entryFreeDates', 'A few dates free right now')}
          </h3>
          <div className="flex flex-col gap-2">
            {stays.map((s, i) => (
              <button
                key={`${s.start}-${s.end}`}
                type="button"
                onClick={() => applyStay(s, i)}
                className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-primary hover:bg-primary/5"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <CalendarDays className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    {format(atNoonUtc(s.start), dateFmt, { locale })} – {format(atNoonUtc(s.end), dateFmt, { locale })}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {s.nights} {s.nights === 1 ? t('common.night', 'night') : t('common.nights', 'nights')}
                    {s.label ? ` · ${s.label}` : ''}
                  </span>
                </span>
                {typeof s.priceHint === 'number' && (
                  <span className="flex-shrink-0 text-sm font-semibold text-foreground">
                    {formatPrice(convertToSelectedCurrency(s.priceHint, property?.baseCurrency || 'EUR'))}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
