/**
 * Which property a request host serves, and the public facts about it, for the files crawlers read
 * outside the page tree: sitemap.xml and llms.txt.
 *
 * Those routes are excluded from the middleware matcher, so they get no x-property-slug header and
 * must resolve the host themselves. Same order as the middleware: the static domain map first, then
 * an active property whose `customDomain` is this host. Admin SDK, server only.
 */
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { DOMAIN_TO_PROPERTY_MAP } from '@/lib/domain-map';
import { DEFAULT_LANGUAGE } from '@/lib/language-constants';
import { getCanonicalUrl } from '@/lib/structured-data';
import { serverTranslateContent } from '@/lib/server-language-utils';
import type { Property } from '@/types';

const logger = loggers.contentData;

/** Host the visitor asked for: x-forwarded-host (App Hosting puts the custom domain there), lowercased, no port. */
export function requestHostFrom(headersList: Headers): string {
  const raw = headersList.get('x-forwarded-host') || headersList.get('host') || '';
  return raw.split(',')[0].trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '').split(':')[0];
}

function normalizeDomain(domain: string | null | undefined): string {
  return (domain || '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '').replace(/^www\./, '');
}

/** The property this host serves, or null for the app host, *.hosted.app, localhost and unknown hosts. */
export async function resolvePropertySlugForHost(host: string): Promise<string | null> {
  if (!host) return null;
  const bare = normalizeDomain(host);
  const mapped = DOMAIN_TO_PROPERTY_MAP[host] || DOMAIN_TO_PROPERTY_MAP[bare];
  if (mapped) return mapped;
  if (host.includes('localhost') || host.endsWith('.hosted.app')) return null;

  try {
    const db = await getAdminDb();
    const snap = await db.collection('properties')
      .where('customDomain', '==', bare)
      .where('useCustomDomain', '==', true)
      .limit(1)
      .get();
    const match = snap.docs.find((d) => (d.data().status ?? 'active') === 'active');
    return match ? match.id : null;
  } catch (error) {
    logger.warn('Could not resolve host to a property', { host, error: (error as Error)?.message });
    return null;
  }
}

export interface PropertySite {
  slug: string;
  property: Property;
  overrides: Record<string, any> | null;
  template: Record<string, any> | null;
  /** Canonical EN root of the property's pages, no trailing slash. */
  baseUrl: string;
  /** Pages a visitor can open, homepage first, in menu order. */
  visiblePages: string[];
  /** Latest edit to the property or its page content; undefined when neither records one. */
  lastModified?: Date;
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') return (value as { toDate: () => Date }).toDate();
  const seconds = (value as { _seconds?: number; seconds?: number })._seconds ?? (value as { seconds?: number }).seconds;
  if (typeof seconds === 'number') return new Date(seconds * 1000);
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

/**
 * Pages the property route will actually render: in the template, and in `visiblePages` when the
 * property sets it (the route 404s anything else, which is how /area-guide is hidden).
 */
export function visiblePagesOf(template: Record<string, any> | null, overrides: Record<string, any> | null): string[] {
  const templatePages = Object.keys(template?.pages || {});
  const visible: string[] | undefined = Array.isArray(overrides?.visiblePages) ? overrides!.visiblePages : undefined;
  const pages = (visible ?? templatePages).filter((p) => p === 'homepage' || templatePages.includes(p));
  return ['homepage', ...pages.filter((p) => p !== 'homepage')];
}

/**
 * The text in `language`, or null when the value has no version in that language. A plain string
 * counts as default-language text.
 */
export function textInLanguage(value: unknown, language: string): string | null {
  if (!value) return null;
  if (typeof value === 'string') return language === DEFAULT_LANGUAGE && value.trim() ? value : null;
  if (typeof value === 'object') {
    const text = (value as Record<string, unknown>)[language];
    return typeof text === 'string' && text.trim() ? text : null;
  }
  return null;
}

/**
 * What the property calls a page, in `language`: its own menu label first (the /booking page is
 * "House Rules" for a property that uses it that way), then the template's page title.
 */
export function getPageLabel(pageName: string, language: string, template: any, overrides: any): string | undefined {
  const links: Array<{ url?: string; label?: unknown }> = [
    ...(overrides?.menuItems || []),
    ...(overrides?.footer?.quickLinks || []),
  ];
  const own = links
    .filter((item) => item?.url === (pageName === 'homepage' ? '/' : `/${pageName}`))
    .map((item) => textInLanguage(item.label, language))
    .find(Boolean);
  if (own) return own;
  const templateTitle = template?.pages?.[pageName]?.title;
  return templateTitle ? serverTranslateContent(templateTitle, language) || undefined : undefined;
}

/** A page URL in a language: /gallery, /ro/gallery, /ro for the Romanian homepage. */
export function pageUrl(baseUrl: string, pageName: string, language: string): string {
  const langSegment = language !== DEFAULT_LANGUAGE ? `/${language}` : '';
  const pageSegment = pageName === 'homepage' ? '' : `/${pageName}`;
  return `${baseUrl}${langSegment}${pageSegment}`;
}

/** Everything the sitemap and llms.txt need about one property. Null if it does not exist. */
export async function loadPropertySite(slug: string, preloaded?: Record<string, any>): Promise<PropertySite | null> {
  const db = await getAdminDb();
  const [propertyData, overridesSnap] = await Promise.all([
    preloaded ? Promise.resolve(preloaded) : db.collection('properties').doc(slug).get().then((d) => (d.exists ? d.data() : null)),
    db.collection('propertyOverrides').doc(slug).get(),
  ]);
  if (!propertyData) return null;

  const property = { id: slug, slug, ...propertyData } as Property;
  const overrides = overridesSnap.exists ? (overridesSnap.data() as Record<string, any>) : null;

  let template: Record<string, any> | null = null;
  if (property.templateId) {
    const templateSnap = await db.collection('websiteTemplates').doc(property.templateId).get();
    template = templateSnap.exists ? (templateSnap.data() as Record<string, any>) : null;
  }

  const customDomain = property.useCustomDomain ? property.customDomain : null;
  const edits = [toDate(propertyData.updatedAt), toDate(overrides?.updatedAt)].filter((d): d is Date => !!d);

  return {
    slug,
    property,
    overrides,
    template,
    baseUrl: getCanonicalUrl(slug, customDomain),
    visiblePages: visiblePagesOf(template, overrides),
    lastModified: edits.length > 0 ? new Date(Math.max(...edits.map((d) => d.getTime()))) : undefined,
  };
}
