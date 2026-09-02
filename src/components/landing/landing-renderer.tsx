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

const t = (lang: string, en: string, ro: string) => (lang === 'ro' ? ro : en);

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
          baseCurrency={m.baseCurrency as never}
          onNavClick={track.trackNavToSite}
          bookingHref={m.checkDatesUrl}
          onBookingClick={track.trackCtaClick}
        />

        {/* ── HERO ── */}
        <section className="relative flex min-h-[78vh] items-center justify-center overflow-hidden">
          {m.hero.image ? (
            <SafeImage src={displaySrc(m.hero.image)} alt={m.hero.image.alt || m.hero.headline} fill priority
              blurDataURL={m.hero.image.blurDataURL} className="object-cover" sizes="100vw" />
          ) : <div className="absolute inset-0 bg-primary/20" />}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/70" />
          <div className="relative z-10 mx-auto max-w-3xl px-5 pt-20 pb-10 text-center text-white">
            {m.period.label && (
              <Badge className="mb-4 bg-white/15 text-white backdrop-blur-sm border-white/20">{m.period.label}</Badge>
            )}
            <h1 className="text-3xl font-bold leading-tight drop-shadow-md sm:text-4xl md:text-5xl">{m.hero.headline}</h1>
            {m.hero.subcopy && <p className="mx-auto mt-4 max-w-xl text-base text-white/90 drop-shadow sm:text-lg">{m.hero.subcopy}</p>}

            {/* The three facts that were previously buried: what people think of it, how big it is,
                and what it costs. Measured 19-22 Aug: the first price sat at 48% scroll depth and the
                rating at ~80%, while only 24% of visitors ever reached 50%. So three quarters of the
                traffic decided without ever seeing a price, a review or the capacity — which the page
                never stated at all. A rate with no denominator reads as expensive.

                Wraps to a centred stack on a phone and sits on one line from `sm` up; the dot
                separators are hidden when wrapped so a broken row never shows a dangling bullet. */}
            {(m.ratings || m.maxGuests || m.advertisedRate) && (
              <ul className="mx-auto mt-5 flex max-w-2xl flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-sm text-white/95 drop-shadow sm:max-w-3xl sm:gap-x-4 sm:text-base">
                {m.ratings && m.ratings.count > 0 && (
                  <li className="inline-flex items-center gap-1.5">
                    <Star className="h-4 w-4 flex-shrink-0 fill-amber-400 text-amber-400" aria-hidden />
                    <span><span className="font-semibold">{m.ratings.average.toFixed(1)}</span>
                      <span className="text-white/80"> · {m.ratings.count} {t(lang, 'reviews', 'recenzii')}</span></span>
                  </li>
                )}
                {(m.maxAdults || m.maxGuests) ? (
                  <li className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="hidden text-white/40 sm:inline">·</span>
                    <Users className="h-4 w-4 flex-shrink-0" aria-hidden />
                    {/* The adults/children split when the property states one. "Up to 7 guests" is the
                        booking engine's occupancy ceiling, not a promise the place can make to seven
                        adults — saying so on the page would be selling something it cannot deliver. */}
                    <span>{m.maxAdults && m.maxChildren
                      ? t(lang, `Whole chalet, ${m.maxAdults} adults + ${m.maxChildren} children`, `Toată casa, ${m.maxAdults} adulți + ${m.maxChildren} copii`)
                      : m.maxAdults
                        ? t(lang, `Whole chalet, up to ${m.maxAdults} adults`, `Toată casa, până la ${m.maxAdults} adulți`)
                        : t(lang, `Whole chalet, up to ${m.maxGuests} guests`, `Toată casa, până la ${m.maxGuests} persoane`)}</span>
                  </li>
                ) : null}
                {m.advertisedRate ? (
                  <li className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="hidden text-white/40 sm:inline">·</span>
                    <span>{t(lang, 'from', 'de la')} <span className="font-semibold">{Math.round(m.advertisedRate).toLocaleString()} {m.baseCurrency}</span>{t(lang, ' / night', ' / noapte')}</span>
                  </li>
                ) : null}
              </ul>
            )}

            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {m.phone && <CallButton phone={m.phone} label={t(lang, 'Call us', 'Sună-ne')} size="lg" className="w-full sm:w-auto" />}
              {m.showBooking && (
                <Button variant="outline" size="lg" asChild className="w-full border-white bg-white/10 text-white backdrop-blur-sm hover:bg-white hover:text-foreground sm:w-auto">
                  <Link href={m.checkDatesUrl} onClick={() => track.trackCtaClick('hero')}><CalendarDays className="mr-2 h-5 w-5" />{t(lang, 'Check dates', 'Vezi datele')}</Link>
                </Button>
              )}
            </div>
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
          <section className="bg-muted/40 py-14 sm:py-20">
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
