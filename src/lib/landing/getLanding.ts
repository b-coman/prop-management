/**
 * getLanding — server-only. Fetches a landing config + its property/overrides/template/reviews, resolves
 * multilingual text to the target language and image storagePaths to URLs, and returns a flat LandingModel
 * the client renderer consumes (docs/landing-page-engine-design.md). Reuses the same data the property
 * pages use (getPropertyBySlug, propertyOverrides, websiteTemplates) — no duplication.
 */
import { cache } from 'react';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { getPropertyBySlug } from '@/lib/property-utils';
import { serverTranslateContent } from '@/lib/server-language-utils';
import { DEFAULT_LANGUAGE } from '@/lib/language-constants';
import type { LandingConfig, LandingModel, LandingImage, Ml } from '@/lib/landing/contracts';

function resolveImage(storagePath: string | undefined, images: any[], lang: string): LandingImage | null {
  if (!storagePath) return null;
  const img = images.find((i) => i?.storagePath === storagePath);
  if (!img) return null;
  return {
    // next/image runs UNOPTIMIZED on Firebase App Hosting (/_next/image 404s and
    // no srcset is emitted), so whatever goes in here is what the phone downloads.
    // Ship the 1200px derivative; keep `url` for anything that wants full size.
    url: img.url || img.thumbnailUrl || '',
    displayUrl: img.displayUrl,
    blurDataURL: img.blurDataURL,
    alt: serverTranslateContent(img.alt, lang) || '',
    storagePath,
  };
}

/**
 * Fetch the raw config (Admin SDK). Null if not found.
 *
 * `cache()`d per request: generateMetadata, the page and now the root layout (which needs the
 * property behind the campaign to resolve the Meta pixel) all ask for the same document, and
 * without this that is three Firestore reads on the hottest paid-traffic page. One read now.
 */
export const getLandingConfig = cache(async (slug: string): Promise<LandingConfig | null> => {
  const db = await getAdminDb();
  const snap = await db.collection('landingPages').doc(slug).get();
  if (!snap.exists) return null;
  return { slug, ...(snap.data() as Omit<LandingConfig, 'slug'>) };
});

/**
 * Build the full render model for a landing page in a given language. Returns null if the config or its
 * property can't be found. `host` (the request host) is compared to the property's custom domain to set
 * `isCustomDomain` (which drives nav/footer/CTA link resolution — mirrors the property route).
 */
export async function buildLandingModel(
  config: LandingConfig,
  language: string,
  host: string,
): Promise<LandingModel | null> {
  const lang = language || config.defaultLanguage || DEFAULT_LANGUAGE;
  const property: any = await getPropertyBySlug(config.propertyId);
  if (!property) return null;
  const isCustomDomain = !!(property.useCustomDomain && property.customDomain &&
    (host === property.customDomain || host === `www.${property.customDomain}`));

  const db = await getAdminDb();
  const [ovSnap, tplSnap] = await Promise.all([
    db.collection('propertyOverrides').doc(config.propertyId).get(),
    property.templateId ? db.collection('websiteTemplates').doc(property.templateId).get() : Promise.resolve(null as any),
  ]);
  const overrides: any = ovSnap.exists ? ovSnap.data() : {};
  const template: any = tplSnap?.exists ? tplSnap.data() : {};

  const images: any[] = property.images ?? [];
  const tr = (m: Ml | undefined): string => (m == null ? '' : serverTranslateContent(m as any, lang));

  // nav + footer (reused Header/Footer expect these shapes)
  const rawMenu = overrides.menuItems || template?.header?.menuItems || [];
  const menuItems = (rawMenu as any[]).map((mi) => ({ label: serverTranslateContent(mi.label, lang), url: mi.url, isButton: mi.isButton }));
  const logoSrc = template?.header?.logo?.src;
  const logoAlt = template?.header?.logo?.alt ? serverTranslateContent(template.header.logo.alt, lang) : undefined;
  const footer = {
    quickLinks: overrides.footer?.quickLinks || template?.footer?.quickLinks,
    contactInfo: overrides.footer?.contactInfo || template?.footer?.contactInfo,
    socialLinks: overrides.footer?.socialLinks,
  };
  const propertyName = serverTranslateContent(overrides.propertyMeta?.name || property.name, lang);
  const baseCurrency = property.baseCurrency || 'RON';
  const phone = config.cta?.phone || property.contactPhone || footer.contactInfo?.phone || null;

  // booking deep-links
  const langSeg = lang && lang !== DEFAULT_LANGUAGE ? `/${lang}` : `/${lang || DEFAULT_LANGUAGE}`;
  const bookBase = `/booking/check/${config.propertyId}${langSeg}`;
  const withDates = (ci?: string | null, co?: string | null, guests?: number | null) => {
    const p = new URLSearchParams();
    if (ci) p.set('checkIn', ci);
    if (co) p.set('checkOut', co);
    if (guests) p.set('guests', String(guests));
    p.set('currency', baseCurrency);
    const qs = p.toString();
    return qs ? `${bookBase}?${qs}` : bookBase;
  };

  const period = {
    kind: config.period?.kind ?? 'season',
    start: config.period?.start ?? null,
    end: config.period?.end ?? null,
    label: tr(config.period?.label),
  };
  /**
   * A campaign WINDOW is not a STAY, and treating it as one was quietly killing the funnel.
   *
   * Both September landings run 1-30 Sep, so this sent every "Vezi datele" click to the booking
   * page asking to book 29 CONSECUTIVE NIGHTS. The chalet has OTA bookings mid-month, so that is
   * unavailable by construction: the visitor's reward for clicking the main call to action was a
   * red "Datele Nu Sunt Disponibile".
   *
   * Measured 19-22 Aug, once booking_page_view existed to show it: 15 `unavailable` against 12
   * `priced`, and NINE of the fifteen were the 29-night request. The hero CTA took 8 of the 9
   * clicks the landing pages produced. It was the busiest path on the page and it led to a wall.
   *
   * A short window is still worth prefilling — "23-31 Aug" is a real stay someone might book whole.
   * Past a fortnight it cannot be, so send them to the picker instead and let them choose, which is
   * what "see the dates" says on the button anyway.
   *
   * Both dates are parsed the same way, so the comparison is timezone-safe even though
   * `Date.parse` reads a bare YYYY-MM-DD as UTC — the offset cancels in the subtraction.
   */
  const MAX_PREFILL_NIGHTS = 14;
  const checkDatesUrl = (() => {
    if (period.kind !== 'window' || !period.start || !period.end) return withDates();
    const nights = Math.round((Date.parse(period.end) - Date.parse(period.start)) / 86_400_000);
    return nights > 0 && nights <= MAX_PREFILL_NIGHTS
      ? withDates(period.start, period.end)
      : withDates();
  })();

  const exampleStays = (config.exampleStays ?? []).map((s) => ({
    start: s.start, end: s.end, nights: s.nights, label: tr(s.label),
    occasion: s.occasion ?? null, priceHint: s.priceHint ?? null, guests: s.guests ?? null,
    bookUrl: withDates(s.start, s.end, s.guests),
  }));

  return {
    slug: config.slug, language: lang, isCustomDomain,
    propertySlug: config.propertyId, propertyName, city: (property as any).location?.city ?? null,
    themeId: property.themeId || 'airbnb',
    baseCurrency, advertisedRate: property.advertisedRate || property.pricePerNight,
    maxGuests: (property as any).maxGuests ?? null,
    maxAdults: (property as any).maxAdults ?? null,
    maxChildren: (property as any).maxChildren ?? null,
    menuItems, logoSrc, logoAlt, footer,
    ratings: property.ratings ? { average: property.ratings.average, count: property.ratings.count } : null,
    hero: {
      image: resolveImage(config.hero?.imagePath, images, lang),
      headline: tr(config.hero?.headline),
      subcopy: tr(config.hero?.subcopy),
    },
    story: config.story ? { title: tr(config.story.title), body: tr(config.story.body) } : null,
    period,
    exampleStays,
    gallery: (config.gallery ?? []).map((sp) => resolveImage(sp, images, lang)).filter(Boolean) as LandingImage[],
    offer: config.offer ? tr(config.offer.text) : null,
    phone, showBooking: config.cta?.showBooking !== false,
    checkDatesUrl,
  };
}
