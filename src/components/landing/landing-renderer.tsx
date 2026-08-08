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
import { Star, MapPin, ArrowRight, CalendarDays, Moon } from 'lucide-react';
import type { LandingModel } from '@/lib/landing/contracts';

const t = (lang: string, en: string, ro: string) => (lang === 'ro' ? ro : en);

function fmtRange(start: string, end: string, lang: string): string {
  const loc = lang === 'ro' ? 'ro-RO' : 'en-GB';
  const f = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short' });
  try { return `${f.format(new Date(start))} – ${f.format(new Date(end))}`; } catch { return `${start} – ${end}`; }
}

function ThemeAndCurrencyEffects({ baseCurrency }: { baseCurrency?: string }) {
  const { setDefaultCurrency } = useCurrency();
  useEffect(() => { if (baseCurrency) setDefaultCurrency(baseCurrency as never); }, [baseCurrency, setDefaultCurrency]);
  return null;
}

export function LandingRenderer({ m }: { m: LandingModel }) {
  const theme = getThemeById(m.themeId);
  const themeStyles = themeToInlineStyles(theme);
  const fontUrl = theme.typography?.fontFamilyUrl;
  const lang = m.language;

  // The root layout's <ThemeProvider> (default 'airbnb') sets :root --primary inline; the shared Header's
  // applyThemeToHeader reads --primary FROM :root, so it would paint the header airbnb-red at the top.
  // Force this landing's theme onto :root with !important (beats the provider's inline set) so the header
  // uses the property's real theme colour. SSR-emitted, so no flash/race.
  const rootThemeCss = `:root{${Object.entries(themeStyles).map(([k, v]) => `${k}:${v as string} !important`).join(';')}}`;
  const galleryCols = (() => {
    const n = m.gallery.length;
    if (n === 1) return 'grid-cols-1';
    if (n === 2) return 'grid-cols-2';
    if (n === 4) return 'grid-cols-2';
    return 'grid-cols-2 sm:grid-cols-3';
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
        />

        {/* ── HERO ── */}
        <section className="relative flex min-h-[78vh] items-center justify-center overflow-hidden">
          {m.hero.image ? (
            <SafeImage src={m.hero.image.url} alt={m.hero.image.alt || m.hero.headline} fill priority
              blurDataURL={m.hero.image.blurDataURL} className="object-cover" sizes="100vw" />
          ) : <div className="absolute inset-0 bg-primary/20" />}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/70" />
          <div className="relative z-10 mx-auto max-w-3xl px-5 pt-20 pb-10 text-center text-white">
            {m.period.label && (
              <Badge className="mb-4 bg-white/15 text-white backdrop-blur-sm border-white/20">{m.period.label}</Badge>
            )}
            <h1 className="text-3xl font-bold leading-tight drop-shadow-md sm:text-4xl md:text-5xl">{m.hero.headline}</h1>
            {m.hero.subcopy && <p className="mx-auto mt-4 max-w-xl text-base text-white/90 drop-shadow sm:text-lg">{m.hero.subcopy}</p>}
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {m.phone && <CallButton phone={m.phone} label={t(lang, 'Call us', 'Sună-ne')} size="lg" className="w-full sm:w-auto" />}
              {m.showBooking && (
                <Button variant="outline" size="lg" asChild className="w-full border-white bg-white/10 text-white backdrop-blur-sm hover:bg-white hover:text-foreground sm:w-auto">
                  <Link href={m.checkDatesUrl}><CalendarDays className="mr-2 h-5 w-5" />{t(lang, 'Check dates', 'Vezi datele')}</Link>
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* ── OFFER strip ── */}
        {m.offer && (
          <div className="bg-primary py-3 text-center text-sm font-medium text-primary-foreground sm:text-base">{m.offer}</div>
        )}

        {/* ── STORY ── */}
        {m.story && (m.story.title || m.story.body) && (
          <section className="mx-auto w-full max-w-3xl px-5 py-14 text-center sm:py-20">
            {m.story.title && <h2 className="text-2xl font-semibold sm:text-3xl">{m.story.title}</h2>}
            {m.story.body && <p className="mt-5 whitespace-pre-line text-base leading-relaxed text-muted-foreground sm:text-lg">{m.story.body}</p>}
          </section>
        )}

        {/* ── EXAMPLE STAYS ── */}
        {m.exampleStays.length > 0 && (
          <section className="bg-muted/40 py-14 sm:py-20">
            <div className="mx-auto max-w-5xl px-5">
              <h2 className="text-center text-2xl font-semibold sm:text-3xl">{t(lang, 'Stays that fit this window', 'Sejururi potrivite pentru această perioadă')}</h2>
              <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">{t(lang, 'Real dates, ready to book.', 'Date reale, gata de rezervare.')}</p>
              {/* flex-wrap + justify-center keeps 1, 2, or 3 cards centered and evenly sized (no left-shifted orphans). */}
              <div className="mt-8 flex flex-wrap justify-center gap-5">
                {m.exampleStays.map((s, i) => (
                  <Card key={i} className="flex w-full flex-col overflow-hidden transition-shadow hover:shadow-lg sm:w-[340px]">
                    <CardContent className="flex flex-1 flex-col p-5">
                      {s.occasion && <Badge variant="secondary" className="mb-3 w-fit">{s.occasion}</Badge>}
                      <p className="text-lg font-semibold">{s.label}</p>
                      <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" />{fmtRange(s.start, s.end, lang)}</span>
                        <span className="inline-flex items-center gap-1"><Moon className="h-4 w-4" />{s.nights} {t(lang, 'nights', 'nopți')}</span>
                      </div>
                      {s.priceHint ? (
                        <p className="mt-3 text-sm text-muted-foreground">{t(lang, 'from', 'de la')} <span className="text-lg font-bold text-foreground">{s.priceHint.toLocaleString()} {m.baseCurrency}</span></p>
                      ) : null}
                      {/* Cards in a flex-wrap row stretch to equal height; mt-auto (on the rendered <a>, which
                          is the direct flex child of CardContent) pins each button to the bottom so they align. */}
                      <Button variant="cta" className="mt-6 mt-auto" asChild>
                        <Link href={s.bookUrl}>{t(lang, 'Book this', 'Rezervă acesta')}<ArrowRight className="ml-1 h-4 w-4" /></Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── GALLERY (no heading; balanced grid whose column count adapts to the image count so there
              are no orphaned/left-shifted cells; bigger images) ── */}
        {m.gallery.length > 0 && (
          <section className="mx-auto w-full max-w-5xl px-5 py-12 sm:py-16">
            {/* w-full above is REQUIRED: as a direct flex-column child, mx-auto would otherwise shrink this
                to content width, and fill-images have zero intrinsic width — collapsing the section to ~52px. */}
            <div className={`grid gap-3 ${galleryCols}`}>
              {m.gallery.map((g, i) => (
                // Inline aspect-ratio (NOT the Tailwind `aspect-[4/3]` class — the slash in an arbitrary
                // value breaks Tailwind's parser, collapsing the box to 0 height and hiding fill images).
                <div key={i} className="relative overflow-hidden rounded-xl" style={{ aspectRatio: m.gallery.length === 1 ? '16 / 9' : '4 / 3' }}>
                  <SafeImage src={g.url} alt={g.alt} fill blurDataURL={g.blurDataURL} className="object-cover transition-transform duration-500 hover:scale-105" sizes="(max-width:640px) 50vw, 33vw" />
                </div>
              ))}
            </div>
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
            <h2 className="text-2xl font-bold sm:text-3xl">{t(lang, 'Ready when you are', 'Te așteptăm la munte')}</h2>
            <p className="mx-auto mt-3 max-w-md text-primary-foreground/85">{t(lang, 'Call us for the best direct price, or check the dates online.', 'Sună-ne pentru cel mai bun preț direct, sau vezi datele online.')}</p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {m.phone && <CallButton phone={m.phone} label={m.phone} size="lg" className="w-full bg-white text-foreground hover:bg-white/90 sm:w-auto" />}
              {m.showBooking && (
                <Button variant="outline" size="lg" asChild className="w-full border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary sm:w-auto">
                  <Link href={m.checkDatesUrl}><MapPin className="mr-2 h-5 w-5" />{t(lang, 'See availability', 'Vezi disponibilitatea')}</Link>
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
        />
      </div>
    </ThemeProvider>
  );
}
