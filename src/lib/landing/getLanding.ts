/**
 * getLanding — server-only. Fetches a landing config + its property/overrides/template/reviews, resolves
 * multilingual text to the target language and image storagePaths to URLs, and returns a flat LandingModel
 * the client renderer consumes (docs/landing-page-engine-design.md). Reuses the same data the property
 * pages use (getPropertyBySlug, propertyOverrides, websiteTemplates) — no duplication.
 */
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
    url: img.thumbnailUrl || img.url || '',
    blurDataURL: img.blurDataURL,
    alt: serverTranslateContent(img.alt, lang) || '',
    storagePath,
  };
}

/** Fetch the raw config (Admin SDK). Null if not found. */
export async function getLandingConfig(slug: string): Promise<LandingConfig | null> {
  const db = await getAdminDb();
  const snap = await db.collection('landingPages').doc(slug).get();
  if (!snap.exists) return null;
  return { slug, ...(snap.data() as Omit<LandingConfig, 'slug'>) };
}

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
  const checkDatesUrl = period.kind === 'window' && period.start && period.end
    ? withDates(period.start, period.end)
    : withDates();

  const exampleStays = (config.exampleStays ?? []).map((s) => ({
    start: s.start, end: s.end, nights: s.nights, label: tr(s.label),
    occasion: s.occasion ?? null, priceHint: s.priceHint ?? null, guests: s.guests ?? null,
    bookUrl: withDates(s.start, s.end, s.guests),
  }));

  return {
    slug: config.slug, language: lang, isCustomDomain,
    propertySlug: config.propertyId, propertyName, themeId: property.themeId || 'airbnb',
    baseCurrency, advertisedRate: property.advertisedRate || property.pricePerNight,
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
