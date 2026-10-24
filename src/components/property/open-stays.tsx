/**
 * Free periods widget: a few bookable stays with real prices, each a link to the booking page with
 * the dates filled in. Data comes from `lib/website/openStaysServer` (server side), so every row is
 * a stay the booking page will price, never one it would refuse.
 *
 * Two looks from one block:
 *   - `section` (homepage): a full-width section with a heading, the rows and an "other dates" link.
 *   - `inline` (between gallery photos, on Details): a slim box, heading and rows only.
 *
 * The rows copy the booking page's dateless entry rows (BookingEntryPanel) on purpose: measured at
 * 390 px, two of those take a third of a phone screen, while the landing-page cards stack five
 * stays into about three screens. A visitor who taps here and lands there sees the same shape twice.
 *
 * Only the dates, the nights, the occasion and a "from" price. No guest count or cleaning note
 * (owner, 2026-10-20): the booking page is where the party is set and the price is exact.
 */
"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';
import { useCurrency } from '@/contexts/CurrencyContext';
import { trackUiEvent } from '@/lib/tracking';
import { formatShortDate } from '@/lib/date-short';
import type { CurrencyCode } from '@/types';

/** One row, already in the page language. */
export interface OpenStayView {
  start: string;
  end: string;
  nights: number;
  price: number | null;
  label: string | null;
  badge: { kind: string; text: string } | null;
}

export interface OpenStaysContent {
  variant?: 'section' | 'inline';
  /** Owner's heading from the block settings, already in the page language. */
  title?: string | null;
  rows: OpenStayView[];
  currency: string;
  /** `/booking/check/<slug>[/<lang>]`, no query. */
  bookBase: string;
  /** Which page this sits on (home, gallery, details), for the tracking. */
  position: string;
  /** Set by the gallery when it places the box between its photos, inside its own container. */
  embedded?: boolean;
}

const atNoonUtc = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
};

export function OpenStays({ content }: { content: OpenStaysContent }) {
  const { t, currentLang } = useLanguage();
  const { formatPrice, convertToSelectedCurrency } = useCurrency();
  const { variant = 'section', rows, bookBase, position } = content;
  const ref = useRef<HTMLDivElement>(null);
  // The currency context starts on USD with no rates on the server and only learns the visitor's
  // currency in the browser. So the server (and the first browser render) shows the property's own
  // currency, and the visitor's one replaces it after mount. Romanian visitors never see it change.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const money = (amount: number) => mounted
    ? formatPrice(convertToSelectedCurrency(amount, content.currency as CurrencyCode))
    : formatPrice(amount, content.currency as CurrencyCode);

  // Counted once, when at least half of the block is on screen, so taps can be divided by views.
  // Not GA4's `view_item_list`: GTM's ecommerce trigger matches `view_item` anywhere in a name, so
  // that event would fire both GA4 tags and every view would count twice.
  useEffect(() => {
    const el = ref.current;
    if (!el || rows.length === 0 || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      trackUiEvent('open_stays_view', { position, source: 'site_open_stays' });
      io.disconnect();
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [position, rows.length]);

  if (rows.length === 0) return null;

  const title = content.title || t('openStays.title', 'Free dates coming up');
  const href = (r: OpenStayView) => `${bookBase}?checkIn=${r.start}&checkOut=${r.end}`;
  const onTap = (r: OpenStayView, i: number) => trackUiEvent('select_item', {
    position: `${position}_${i + 1}`,
    source: 'site_open_stays',
    stay_dates: `${r.start}_${r.end}`,
    stay_nights: r.nights,
    value: r.price ?? undefined,
    badge: r.badge?.kind ?? 'none',
  });

  const list = (
    <div className={cn('grid gap-2 md:gap-3', variant === 'section' ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3')}>
      {rows.map((r, i) => (
        <Link
          key={`${r.start}-${r.end}`}
          href={href(r)}
          rel="nofollow"
          onClick={() => onTap(r, i)}
          className="flex min-h-[64px] w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-primary hover:bg-primary/5"
        >
          <span className="flex min-w-0 flex-col gap-1">
            {r.badge && (
              <span className="w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold leading-tight text-primary">
                {r.badge.text}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
              <CalendarDays className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              {formatShortDate(atNoonUtc(r.start), currentLang)} – {formatShortDate(atNoonUtc(r.end), currentLang)}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {r.nights} {r.nights === 1 ? t('common.night', 'night') : t('common.nights', 'nights')}
              {` · ${r.label || t('openStays.weekend', 'Weekend')}`}
            </span>
          </span>
          <span className="flex flex-shrink-0 items-center gap-1.5">
            {typeof r.price === 'number' && (
              <span className="flex flex-col items-end leading-tight">
                <span className="text-[11px] text-muted-foreground">{t('openStays.from', 'from')}</span>
                <span className="text-sm font-semibold text-foreground">{money(r.price)}</span>
              </span>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
          </span>
        </Link>
      ))}
    </div>
  );

  if (variant === 'inline') {
    const box = (
      <div ref={content.embedded ? ref : undefined} className="rounded-xl border border-border bg-muted/40 p-4">
        <h3 className="mb-3 text-base font-semibold text-foreground">{title}</h3>
        {list}
      </div>
    );
    // On its own (Details) it needs the page margins the gallery container otherwise gives it.
    return content.embedded ? box : <div ref={ref} className="container mx-auto max-w-5xl px-4 py-6">{box}</div>;
  }

  return (
    <section ref={ref} className="bg-muted/40 py-10 md:py-14">
      <div className="container mx-auto max-w-3xl px-4">
        <h2 className="mb-4 text-center text-2xl font-semibold text-foreground md:mb-6 md:text-3xl">{title}</h2>
        {list}
        <div className="mt-4 text-center">
          <Link
            href={bookBase}
            onClick={() => trackUiEvent('select_item', { position: `${position}_other`, source: 'site_open_stays' })}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t('openStays.moreDates', 'Other dates')}
          </Link>
        </div>
      </div>
    </section>
  );
}
