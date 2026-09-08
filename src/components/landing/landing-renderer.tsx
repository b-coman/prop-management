'use client';
/**
 * LandingRenderer — the campaign landing page (docs/landing-page-engine-design.md). Mirrors the property
 * renderer's theme plumbing (ThemeProvider + inline theme vars + font link) so SSR colors are correct,
 * reuses the site nav (Header) + Footer, and composes a story-driven page from the design system's
 * primitives (Button/Card/Badge/SafeImage + theme tokens). Mobile-first. Language is pre-resolved server
 * side; the reused Header/Footer still use LanguageProvider (supplied by the route).
 */
import Link from 'next/link';
import { useEffect } from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { getThemeById } from '@/lib/themes/theme-definitions';
import { themeToInlineStyles } from '@/lib/themes/theme-utils';
import { Header } from '@/components/generic-header-multipage';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SafeImage } from '@/components/ui/safe-image';
import { CallButton } from '@/components/landing/call-button';
import { useLandingTracking } from '@/components/landing/use-landing-tracking';
import { Star, MapPin, ArrowRight, CalendarDays, Moon, Users } from 'lucide-react';
import type { LandingModel, LandingImage } from '@/lib/landing/contracts';
import { displaySrc } from '@/lib/image-src';
import { capacityParts, asLanguage } from '@/lib/occupancy';

const t = (lang: string, en: string, ro: string) => (lang === 'ro' ? ro : en);

/** Anchor the hero button scrolls to. Language-neutral on purpose: the id is a target, not copy. */
const STAYS_ANCHOR = 'stays';

function fmtRange(start: string, end: string, lang: string): string {
  const loc = lang === 'ro' ? 'ro-RO' : 'en-GB';
  const f = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short' });
  try { return `${f.format(new Date(start))} – ${f.format(new Date(end))}`; } catch { return `${start} – ${end}`; }
}

// RO needs the singular for 1 (noapte) vs plural (nopți); EN night/nights.
const nightsWord = (n: number, lang: string) => (lang === 'ro' ? (n === 1 ? 'noapte' : 'nopți') : (n === 1 ? 'night' : 'nights'));

/** One gallery tile: a fixed-aspect box with a fill image (used by the single/pair/mosaic layouts). */
function GTile({ img, ratio, sizes }: { img: LandingImage; ratio: string; sizes: string }) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: ratio }}>
      <SafeImage src={displaySrc(img)} alt={img.alt} fill blurDataURL={img.blurDataURL}
        className="object-cover transition-transform duration-500 hover:scale-105" sizes={sizes} />
    </div>
  );
}

function ThemeAndCurrencyEffects({ baseCurrency }: { baseCurrency?: string }) {
  const { setDefaultCurrency } = useCurrency();
  useEffect(() => { if (baseCurrency) setDefaultCurrency(baseCurrency as never); }, [baseCurrency, setDefaultCurrency]);
  return null;
}

export function LandingRenderer({ m }: { m: LandingModel }) {
  // Every campaign page is this one template, so instrumenting here covers all of them — the two
  // live flights and every future one — without per-page work.
  const track = useLandingTracking(
    { campaign: m.slug, landing: m.slug },
    {
      propertySlug: m.propertySlug,
      propertyName: m.propertyName,
      city: m.city,
      advertisedRate: m.advertisedRate,
      baseCurrency: m.baseCurrency,
    }
  );
  const theme = getThemeById(m.themeId);
  const themeStyles = themeToInlineStyles(theme);
  const fontUrl = theme.typography?.fontFamilyUrl;
  const lang = m.language;

  // The root layout's <ThemeProvider> (default 'airbnb') sets :root --primary inline; the shared Header's
  // applyThemeToHeader reads --primary FROM :root, so it would paint the header airbnb-red at the top.
  // Force this landing's theme onto :root with !important (beats the provider's inline set) so the header
  // uses the property's real theme colour. SSR-emitted, so no flash/race.
  const rootThemeCss = `:root{${Object.entries(themeStyles).map(([k, v]) => `${k}:${v as string} !important`).join(';')}}`;
  // Example-stay cards: an equal-width grid whose column count matches the number of stays (1/2/3), so
  // every card sits on the same row at the top breakpoint and stacks cleanly on mobile — no orphans.
  // At most one stay is the RECOMMENDATION; the rest are fallbacks. Splitting them here rather than
  // in the map keeps the grid sizing honest — the column count must match the number of cards that
  // actually land in the row, not the total number of stays.
  const featuredStay = m.exampleStays.find((s) => s.featured) ?? null;
  const otherStays = m.exampleStays.filter((s) => s !== featuredStay);
  /**
   * Does this page have an offer of its own to point at? Measured 17 Aug - 8 Sep: the hero button
   * took 67 clicks from 54 people and the four stay cards took 8 from 7, because at 390px the hero
   * sits at y=486 — the only booking control in the first screen — while the first card starts at
   * y=1055, a full screen below. The hero then navigated to the DATELESS booking page, which builds
   * its own suggestions from a generic 60-day season query and so offered windows the ad never
   * mentioned (25-28 Sep and 24-28 Oct against an ad selling 14-17 Sep, 23-30 Sep, 2-4 Oct, 4-8 Oct).
   * The biggest control on the page was walking visitors past the offer and into a different one.
   *
   * So when the page HAS stays, the hero scrolls to them and the picker becomes a secondary link.
   * When it has none there is nothing to scroll to, and the old navigation is still the right answer
   * — which is also what keeps this safe for any campaign, not just the ones with cards.
   *
   * AND THE JUMP IS NOT SMOOTHED, deliberately. Two versions were tried and measured on the running
   * page, and both left the button dead: `scrollIntoView({ behavior: 'smooth' })` after a
   * `preventDefault` moved scrollTop 0 → 0, and so did `scroll-behavior: smooth` on the scrolling
   * element with the native jump — the hash reached the URL, the page stayed put. Smooth scrolling
   * is driven by animation frames, so anything that starves them (a backgrounded document,
   * reduced-motion, an embedded context) turns the page's primary call to action into a no-op that
   * still reports a click. An instant jump has no such dependency; the polish is not worth it.
   */
  const hasStays = m.exampleStays.length > 0;

  const staysCols = (() => {
    const n = otherStays.length;
    if (n <= 1) return 'max-w-sm grid-cols-1';
    if (n === 2) return 'max-w-3xl grid-cols-1 sm:grid-cols-2';
    return 'max-w-5xl grid-cols-1 md:grid-cols-3';
  })();

  return (
    <ThemeProvider initialThemeId={m.themeId}>
      {fontUrl && <link rel="stylesheet" href={fontUrl} precedence="default" />}
      <style dangerouslySetInnerHTML={{ __html: rootThemeCss }} />
      <ThemeAndCurrencyEffects baseCurrency={m.baseCurrency} />
      <div style={themeStyles} className="flex min-h-screen flex-col bg-background text-foreground">
        <Header
          propertyName={m.propertyName}
          propertySlug={m.propertySlug}
          menuItems={m.menuItems}
          logoSrc={m.logoSrc}
          logoAlt={m.logoAlt}
          isCustomDomain={m.isCustomDomain}
          advertisedRate={m.advertisedRate}
          advertisedRateNote={m.advertisedRateNote}
          baseCurrency={m.baseCurrency as never}
          onNavClick={track.trackNavToSite}
          bookingHref={m.checkDatesUrl}
          onBookingClick={track.trackCtaClick}
        />

        {/* ── HERO ──
            OVERLAY ON DESKTOP, STACKED ON A PHONE, and the split is not a matter of taste. Measured
            on the live page at 390x844: the text overlay was 575px of a 658px hero, so 87% of the
            photograph was covered; a full-height `from-black/50 via-black/30 to-black/70` scrim
            darkened the rest; and `min-h-[78vh]` forced a 1000x750 (4:3) photo into a 390x658 (0.59)
            box, which `object-cover` satisfies by cropping 55% OF THE IMAGE AWAY. The result was a
            narrow, dark vertical slice — the owner's words were "I can't see the picture, nor read
            everything". Moving text around could never fix the crop or the scrim.

            A wide viewport has room to put text BESIDE the subject, so desktop keeps the immersive
            overlay exactly as it was. A phone does not: the copy stacks vertically and inevitably
            covers the thing it is selling. So below `sm` the photo gets its own 4:3 band at its true
            aspect — nothing cropped, no scrim needed — and the copy sits underneath on a solid
            surface where small text is legible without a drop-shadow. */}
        <section className="relative overflow-hidden sm:flex sm:min-h-[78vh] sm:items-center sm:justify-center">
          {m.hero.image ? (
            // `fill` needs a positioned ancestor: on a phone that is this 4:3 band, from `sm` up it
            // goes back to being the whole section, which is what restores the desktop hero.
            <div className="relative aspect-[4/3] w-full sm:absolute sm:inset-0 sm:aspect-auto sm:h-full">
              <SafeImage src={displaySrc(m.hero.image)} alt={m.hero.image.alt || m.hero.headline} fill priority
                blurDataURL={m.hero.image.blurDataURL} className="object-cover" sizes="100vw" />
            </div>
          ) : <div className="aspect-[4/3] w-full bg-primary/20 sm:absolute sm:inset-0 sm:aspect-auto" />}
          {/* No scrim on a phone: nothing is written on the photo there, so darkening it only hides it. */}
          <div className="absolute inset-0 hidden bg-gradient-to-b from-black/50 via-black/30 to-black/70 sm:block" />
          <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-5 pb-10 pt-6 text-center sm:block sm:pt-20 sm:text-white">
            {m.period.label && (
              // Every colour below is paired: a legible value on the phone's solid surface, and the
              // original white-on-photo restored from `sm` up. A drop-shadow off the photo is just blur.
              /**
               * HIDDEN ON A PHONE. It is the weakest thing competing for the ~700px a real Safari
               * window actually gives you: its first half restates the headline ("Evadare de toamnă"
               * against "Toamna pe Valea Prahovei") and the exact dates it hints at are spelled out,
               * with prices, on the stay cards one tap away — which is now precisely what the primary
               * button promises. Two lines of metadata is a poor trade for a button above the fold.
               * Kept in full from `sm` up, where the space is not contested.
               */
              <Badge className="mb-3 hidden border-primary/20 bg-primary/10 text-foreground sm:mb-4 sm:inline-flex sm:border-white/20 sm:bg-white/15 sm:text-white sm:backdrop-blur-sm">{m.period.label}</Badge>
            )}
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl sm:drop-shadow-md md:text-5xl">{m.hero.headline}</h1>
            {m.hero.subcopy && <p className="order-last mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:order-none sm:mt-4 sm:text-lg sm:text-white/90 sm:drop-shadow">{m.hero.subcopy}</p>}

            {/* The three facts that were previously buried: what people think of it, how big it is,
                and what it costs. Measured 19-22 Aug: the first price sat at 48% scroll depth and the
                rating at ~80%, while only 24% of visitors ever reached 50%. So three quarters of the
                traffic decided without ever seeing a price, a review or the capacity — which the page
                never stated at all. A rate with no denominator reads as expensive.

                Wraps to a centred stack on a phone and sits on one line from `sm` up; the dot
                separators are hidden when wrapped so a broken row never shows a dangling bullet. */}
            {(m.ratings || m.maxGuests || m.advertisedRate) && (
              <ul className="mx-auto mt-4 flex max-w-2xl flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-sm text-foreground sm:mt-5 sm:max-w-3xl sm:gap-x-4 sm:text-base sm:text-white/95 sm:drop-shadow">
                {m.ratings && m.ratings.count > 0 && (
                  <li className="inline-flex items-center gap-1.5">
                    <Star className="h-4 w-4 flex-shrink-0 fill-amber-400 text-amber-400" aria-hidden />
                    <span><span className="font-semibold">{m.ratings.average.toFixed(1)}</span>
                      <span className="text-muted-foreground sm:text-white/80"> · {m.ratings.count} {t(lang, 'reviews', 'recenzii')}</span></span>
                  </li>
                )}
                {(() => {
                  /* Capacity is a TOTAL WITH AN ADULT CAP, never an additive pair. This line used to
                     read "Toată casa, 5 adulți + 2 copii", which happens to sum to seven and is why it
                     looked right — but it presents one legal party as the only one and understates a
                     house that also takes 4+3, to exactly the families most likely to fill it.
                     "Up to 7 guests" alone is the opposite error: an occupancy ceiling read as a
                     promise of seven adults. So both facts, with the qualifier dimmed like the review
                     count above it, because the number people scan for is the total. */
                  const capacity = capacityParts({ maxGuests: m.maxGuests ?? 0, maxAdults: m.maxAdults }, asLanguage(lang));
                  if (!capacity) return null;
                  return (
                    <li className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="hidden text-white/40 sm:inline">·</span>
                      <Users className="h-4 w-4 flex-shrink-0" aria-hidden />
                      <span>
                        {t(lang, 'Whole chalet,', 'Toată casa,')} {capacity.primary}
                        {capacity.qualifier ? <span className="text-muted-foreground sm:text-white/80"> {capacity.qualifier}</span> : null}
                      </span>
                    </li>
                  );
                })()}
                {m.advertisedRate ? (
                  <li className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="hidden text-white/40 sm:inline">·</span>
                    <span>{t(lang, 'from', 'de la')} <span className="font-semibold">{Math.round(m.advertisedRate).toLocaleString()} {m.baseCurrency}</span>{t(lang, ' / night', ' / noapte')}{m.advertisedRateNote ? <span aria-hidden="true">*</span> : null}</span>
                  </li>
                ) : null}
              </ul>
            )}

            {/* THE STAYS CTA LEADS, and the phone follows. Measured 17 Aug - 8 Sep: calling took 6
                clicks from 5 people, the stays button 67 from 54. The solid green was on the control
                people wanted ten times less, and it sat first, so on a phone it was often the only
                one above the fold. Weight and order now follow the behaviour, on every width — the
                same argument holds on desktop, and one `variant` swap reverts it if you disagree. */}
            <div className="mt-5 flex w-full flex-col items-center justify-center gap-3 sm:mt-7 sm:w-auto sm:flex-row">
              {m.showBooking && (
                <Button variant="cta" size="lg" asChild className="w-full sm:w-auto">
                  {hasStays ? (
                    /**
                     * A PLAIN ANCHOR, and the click handler only reports. The first version called
                     * `preventDefault()` and then `scrollIntoView({ behavior: 'smooth' })`, which
                     * measured as scrollTop 0 → 0: the smooth animation is silently dropped in some
                     * contexts (no user activation, a backgrounded document, reduced-motion), and
                     * having already cancelled the native jump the button then did NOTHING while
                     * still firing its tracking event. That is the exact failure this page has been
                     * bitten by before — a large, obvious control that only looked alive in GA4.
                     *
                     * So navigation is the browser's native hash jump, which cannot fail. See the
                     * `hasStays` doc comment for the full measurement.
                     */
                    <a
                      href={`#${STAYS_ANCHOR}`}
                      onClick={() => track.trackCtaClick('hero')}
                    ><CalendarDays className="mr-2 h-5 w-5" />{t(lang, 'Available dates', 'Date libere')}</a>
                  ) : (
                    <Link href={m.checkDatesUrl} onClick={() => track.trackCtaClick('hero')}><CalendarDays className="mr-2 h-5 w-5" />{t(lang, 'Check dates', 'Vezi datele')}</Link>
                  )}
                </Button>
              )}
              {m.phone && <CallButton phone={m.phone} label={t(lang, 'Call us', 'Sună-ne')} size="lg" variant="outline"
                className="w-full sm:w-auto sm:border-white sm:bg-white/10 sm:text-white sm:backdrop-blur-sm sm:hover:bg-white sm:hover:text-foreground" />}
            </div>
            {/* The escape hatch, deliberately quiet. It has to exist — 41 of 154 dated booking views
                were `unavailable`, so some visitors genuinely want other dates — but it must not be
                the loudest thing on screen, or it sends people away from the four stays being sold. */}
            {m.showBooking && hasStays && (
              <div className="mt-4 text-center">
                <Link
                  href={m.checkDatesUrl}
                  onClick={() => track.trackCtaClick('hero_other_dates')}
                  className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground sm:text-white/80 sm:drop-shadow sm:hover:text-white"
                >{t(lang, 'Looking for other dates?', 'Caut alte date')}</Link>
              </div>
            )}
          </div>
        </section>

        {/* ── OFFER strip ── */}
        {m.offer && (
          <div className="bg-primary py-3 text-center text-sm font-medium text-primary-foreground sm:text-base">{m.offer}</div>
        )}

        {/* ORDER IS THE POINT. Measured on the live page 19-22 Aug: the first price sat at 48% of the
            scroll and the first photo beyond the hero at 69%, while only 24% of visitors reached 50%
            and 23% reached 75%. Three quarters of paid traffic left having seen a headline, a
            paragraph and two buttons — no price, no second photo, no reviews. The stay cards took
            ZERO clicks in a week, not because they read badly but because almost nobody scrolled far
            enough to see them.

            So the two sections that answer "what does it cost" and "what does it look like" now come
            first, and the story — the part that only rewards someone already reading — comes after.
            No section was added or removed, so the page is no taller; the order changed. */}
        {/* ── EXAMPLE STAYS ── */}
        {m.exampleStays.length > 0 && (
          // `scroll-mt` keeps the heading clear of the sticky header when the hero button lands here;
          // without it the browser aligns the section top to the viewport top and the header covers it.
          <section id={STAYS_ANCHOR} className="scroll-mt-20 bg-muted/40 py-14 sm:py-20">
            <div className="mx-auto max-w-5xl px-5">
              <h2 className="text-center text-2xl font-semibold sm:text-3xl">{t(lang, 'Stays that fit this window', 'Sejururi potrivite pentru această perioadă')}</h2>
              <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">{t(lang, 'Real dates, ready to book.', 'Date reale, gata de rezervare.')}</p>
              {/* THE RECOMMENDATION, full width and visually ahead of the alternatives.
                  A row of equal cards cannot say "this is the one" — and on this window the whole
                  offer is the long stay, with the shorter ones there only so a reader who cannot
                  take a week still has somewhere to go. `note` carries the marginal arithmetic,
                  which is what actually persuades: the seventh night costs 16 lei. */}
              {featuredStay && (
                <Card className="mx-auto mt-8 w-full max-w-3xl overflow-hidden border-2 border-primary shadow-lg">
                  <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
                    <div className="flex flex-col gap-2">
                      <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                        {t(lang, 'Best value', 'Cea mai bună ofertă')}
                      </span>
                      <p className="text-xl font-semibold sm:text-2xl">{featuredStay.label}</p>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" />{fmtRange(featuredStay.start, featuredStay.end, lang)}</span>
                        <span className="inline-flex items-center gap-1"><Moon className="h-4 w-4" />{featuredStay.nights} {nightsWord(featuredStay.nights, lang)}</span>
                      </div>
                      {featuredStay.note ? (
                        <p className="text-sm font-medium text-primary">{featuredStay.note}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                      {featuredStay.priceHint ? (
                        <p className="text-sm text-muted-foreground">
                          {t(lang, 'from', 'de la')}{' '}
                          <span className="text-2xl font-bold text-foreground">{Math.round(featuredStay.priceHint).toLocaleString()} {m.baseCurrency}</span>
                        </p>
                      ) : null}
                      <Button variant="cta" size="lg" asChild>
                        <Link href={featuredStay.bookUrl} onClick={() => track.trackStayClick(featuredStay, 0)}>
                          {t(lang, 'Book this', 'Rezervă')}<ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              {featuredStay && otherStays.length > 0 && (
                <p className="mt-10 text-center text-sm font-medium text-muted-foreground">
                  {t(lang, 'Or, if a full week is too much', 'Sau, dacă o săptămână întreagă e prea mult')}
                </p>
              )}
              {/* Grid (not flex-wrap): equal columns matching the card count → all cards on one row, same
                  width; grid items stretch to equal height so the buttons align via mt-auto. */}
              <div className={`mx-auto mt-4 grid gap-5 ${staysCols}`}>
                {otherStays.map((s, i) => (
                  <Card key={i} className="flex w-full flex-col overflow-hidden transition-shadow hover:shadow-lg">
                    <CardContent className="flex flex-1 flex-col p-5">
                      <p className="text-lg font-semibold">{s.label}</p>
                      <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" />{fmtRange(s.start, s.end, lang)}</span>
                        <span className="inline-flex items-center gap-1"><Moon className="h-4 w-4" />{s.nights} {nightsWord(s.nights, lang)}</span>
                      </div>
                      {/* Rounded: this is a "from" price, and a stray decimal
                          (4,024.5) reads as careless. Rounding up by <1 RON can only
                          ever quote ABOVE what the booking form will charge. */}
                      {s.priceHint ? (
                        <p className="mt-3 text-sm text-muted-foreground">{t(lang, 'from', 'de la')} <span className="text-lg font-bold text-foreground">{Math.round(s.priceHint).toLocaleString()} {m.baseCurrency}</span></p>
                      ) : null}
                      <Button variant="cta" className="mt-6 mt-auto" asChild>
                        {/* Just "Rezervă" — "Rezervă acesta" is a literal translation of "Book this"
                            and reads stilted; Romanian drops the pronoun on a button. */}
                        <Link href={s.bookUrl} onClick={() => track.trackStayClick(s, i)}>{t(lang, 'Book this', 'Rezervă')}<ArrowRight className="ml-1 h-4 w-4" /></Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── GALLERY (a real mosaic) — 1 image = one wide hero; 2 = a clean pair; 3+ = a bento grid
              (a large feature tile + tightly-packed smaller ones) that reflows to 2 columns on mobile.
              `w-full` keeps the mx-auto section from collapsing around fill-images. ── */}
        {m.gallery.length > 0 && (
          <section className="mx-auto w-full max-w-5xl px-5 py-12 sm:py-16">
            {m.gallery.length === 1 ? (
              <GTile img={m.gallery[0]} ratio="16 / 9" sizes="(max-width:1024px) 100vw, 1024px" />
            ) : m.gallery.length === 2 ? (
              <div className="grid grid-cols-2 gap-3">
                {m.gallery.map((g, i) => <GTile key={i} img={g} ratio="4 / 3" sizes="(max-width:768px) 50vw, 33vw" />)}
              </div>
            ) : (
              // Bento mosaic: a large feature tile (first image) + smaller ones, densely packed into a
              // fixed-row grid so it stays tight with no gaps for the common ~5-image gallery; the feature
              // spans 2×2 and the rest backfill via dense flow. Reflows to 2 columns (feature full-width) on mobile.
              <div className="grid grid-flow-row-dense auto-rows-[8.5rem] grid-cols-2 gap-3 sm:auto-rows-[10.5rem] sm:grid-cols-3 lg:grid-cols-4">
                {m.gallery.map((g, i) => (
                  <div key={i} className={`relative overflow-hidden rounded-xl ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
                    <SafeImage src={displaySrc(g)} alt={g.alt} fill blurDataURL={g.blurDataURL}
                      className="object-cover transition-transform duration-500 hover:scale-105"
                      sizes={i === 0 ? '(max-width:640px) 100vw, 40vw' : '(max-width:640px) 50vw, 22vw'} />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── STORY ── */}
        {m.story && (m.story.title || m.story.body) && (
          <section className="mx-auto w-full max-w-3xl px-5 py-14 text-center sm:py-20">
            {m.story.title && <h2 className="text-2xl font-semibold sm:text-3xl">{m.story.title}</h2>}
            {m.story.body && <p className="mt-5 whitespace-pre-line text-base leading-relaxed text-muted-foreground sm:text-lg">{m.story.body}</p>}
          </section>
        )}

        {/* ── SOCIAL PROOF ── */}
        {m.ratings && m.ratings.count > 0 && (
          <section className="border-y bg-muted/30 py-10 text-center">
            <div className="flex items-center justify-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className={`h-6 w-6 ${i < Math.round(m.ratings!.average) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
              ))}
            </div>
            <p className="mt-2 text-lg font-semibold">{m.ratings.average.toFixed(1)} <span className="font-normal text-muted-foreground">{t(lang, 'from', 'din')} {m.ratings.count} {t(lang, 'reviews', 'recenzii')}</span></p>
          </section>
        )}

        {/* ── FINAL CTA BAND ── */}
        <section className="bg-primary py-16 text-center text-primary-foreground">
          <div className="mx-auto max-w-2xl px-5">
            {/* Name the town, not the terrain. `city` comes from the property, so the Bucharest
                apartment does not end up inviting people "la munte". */}
            <h2 className="text-2xl font-bold sm:text-3xl">
              {m.city
                ? t(lang, `See you in ${m.city}`, `Te așteptăm la ${m.city}`)
                : t(lang, 'Ready when you are', 'Te așteptăm')}
            </h2>
            {/* "cel mai bun preț", not "cel mai bun preț direct" — the qualifier made it sound like a
                category of price rather than simply the best one. */}
            <p className="mx-auto mt-3 max-w-md text-primary-foreground/85">{t(lang, 'Call us for the best price, or check the dates online.', 'Sună-ne pentru cel mai bun preț, sau vezi datele online.')}</p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {m.phone && <CallButton phone={m.phone} label={m.phone} size="lg" className="w-full bg-white text-foreground hover:bg-white/90 sm:w-auto" />}
              {m.showBooking && (
                <Button variant="outline" size="lg" asChild className="w-full border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary sm:w-auto">
                  <Link href={m.checkDatesUrl} onClick={() => track.trackCtaClick('footer')}><MapPin className="mr-2 h-5 w-5" />{t(lang, 'See availability', 'Vezi disponibilitatea')}</Link>
                </Button>
              )}
            </div>
          </div>
        </section>

        <Footer
          advertisedRateNote={m.advertisedRateNote}
          quickLinks={m.footer.quickLinks}
          contactInfo={m.footer.contactInfo}
          socialLinks={m.footer.socialLinks}
          propertyName={m.propertyName}
          propertySlug={m.propertySlug}
          isCustomDomain={m.isCustomDomain}
          onNavClick={track.trackNavToSite}
        />
      </div>
    </ThemeProvider>
  );
}
