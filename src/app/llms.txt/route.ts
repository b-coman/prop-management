import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { loggers } from '@/lib/logger';
import { SUPPORTED_LANGUAGES, LANGUAGE_OPTIONS } from '@/lib/language-constants';
import { buildPropertyTagline, formatAdvertisedPrice } from '@/lib/structured-data';
import { resolveHouseRules, isCancellationItem, isCheckInItem, isPetsItem, type PolicyItem } from '@/lib/house-policies';
import { getPublicListings } from '@/services/channelService';
import {
  requestHostFrom,
  resolvePropertySlugForHost,
  loadPropertySite,
  pageUrl,
  textInLanguage,
  getPageLabel,
  type PropertySite,
} from '@/lib/site-property';

export const dynamic = 'force-dynamic';

const logger = loggers.contentData;

const HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'public, max-age=3600, s-maxage=3600',
};

/** English text of a field, whether it is stored as a string or as { en, ro }. */
function english(value: unknown): string {
  return textInLanguage(value, 'en') || '';
}

function oneLine(text: string): string {
  return text.replace(/\s*\n+\s*/g, ' ').trim();
}

function isPlaceholder(value?: string | null): boolean {
  if (!value) return true;
  const lower = value.toLowerCase();
  return lower.includes('example') || lower.includes('(555)') || lower.includes('555-');
}

const GENERIC = `# Vacation rentals

> This address does not belong to a single property. Each property has its own website, with its own llms.txt.
`;

async function buildPropertyFile(site: PropertySite): Promise<string> {
  const { property, overrides, template, baseUrl, visiblePages } = site;
  const name = english(overrides?.propertyMeta?.name) || english(property.name) || site.slug;
  const tagline = buildPropertyTagline(property, 'en');
  const country = property.location?.country;
  const description = english(overrides?.propertyMeta?.description)
    || english(overrides?.propertyMeta?.shortDescription)
    || english(property.description);
  const lines: string[] = [];

  lines.push(`# ${name}`, '');
  lines.push(`> ${tagline}${country ? `, ${country}` : ''}.${description ? ` ${oneLine(description)}` : ''}`, '');

  const alternateNames = (property.alternateNames || []).filter((n) => typeof n === 'string' && n.trim());
  if (alternateNames.length > 0) {
    lines.push(`Also listed as: ${alternateNames.join('; ')}.`, '');
  }

  // Key facts. Cancellation is property.cancellationPolicy, the field the booking page and the
  // emails use; the House Rules page shows the same text (see lib/house-policies.ts).
  const houseRules = resolveHouseRules(template, overrides, property, visiblePages);
  const facts: string[] = [];
  facts.push(`What and where: ${tagline}${country ? `, ${country}` : ''}`);

  const capacity: string[] = [];
  if (property.maxGuests) {
    capacity.push(`up to ${property.maxGuests} guests${property.maxAdults ? ` (at most ${property.maxAdults} adults)` : ''}`);
  }
  if (property.bedrooms) capacity.push(`${property.bedrooms} bedrooms`);
  if (property.beds) capacity.push(`${property.beds} beds`);
  if (property.bathrooms) capacity.push(`${property.bathrooms} bathrooms`);
  if (capacity.length > 0) facts.push(`Sleeps: ${capacity.join(', ')}`);

  const price = formatAdvertisedPrice(property, 'en');
  if (price) {
    const note = english(property.advertisedRateNote);
    facts.push(`Price: ${price} when booked direct${note ? `. ${oneLine(note)}` : ''}`);
  }
  if (property.checkInTime) facts.push(`Check-in: from ${property.checkInTime}`);
  if (property.checkOutTime) facts.push(`Check-out: by ${property.checkOutTime}`);

  const cancellation = english(property.cancellationPolicy) || english(houseRules.find(isCancellationItem)?.description);
  if (cancellation) facts.push(`Cancellation: ${oneLine(cancellation)}`);
  const pets = houseRules.find(isPetsItem);
  if (pets) facts.push(`Pets: ${oneLine(english(pets.description) || english(pets.title))}`);
  facts.push(`Book direct: ${baseUrl}`);

  lines.push('## Key facts', '', ...facts.map((f) => `- ${f}`), '');

  // The rest of the House Rules page, as shown there
  const otherRules = houseRules.filter((r: PolicyItem) => !isCancellationItem(r) && !isCheckInItem(r) && !isPetsItem(r));
  if (otherRules.length > 0) {
    lines.push('## House rules', '');
    for (const rule of otherRules) {
      const title = english(rule.title);
      const text = oneLine(english(rule.description));
      if (title || text) lines.push(`- ${title}${title && text ? ': ' : ''}${text}`);
    }
    lines.push('');
  }

  // Contact, from the same place the footer reads it
  const contact = overrides?.footer?.contactInfo || {};
  const phone = [contact.phone, property.contactPhone].find((v) => v && !isPlaceholder(v));
  const email = [contact.email, property.contactEmail].find((v) => v && !isPlaceholder(v));
  if (phone || email) {
    lines.push('## Contact', '');
    if (phone) lines.push(`- Phone: ${phone}`);
    if (email) lines.push(`- Email: ${email}`);
    lines.push('');
  }

  // Main pages in both languages
  lines.push('## Pages', '');
  for (const pageName of visiblePages) {
    if (pageName === 'privacy-policy' || pageName === 'terms-of-service') continue;
    for (const lang of SUPPORTED_LANGUAGES) {
      const label = getPageLabel(pageName, lang, template, overrides) || pageName;
      lines.push(`- [${label}](${pageUrl(baseUrl, pageName, lang)}): ${LANGUAGE_OPTIONS.find((o) => o.code === lang)?.name || lang}`);
    }
  }
  lines.push('');

  const listings = await getPublicListings(site.slug);
  if (listings.length > 0) {
    lines.push('## Also listed on', '');
    for (const listing of listings) lines.push(`- [${listing.displayName}](${listing.url})`);
    lines.push('');
  }

  return lines.join('\n');
}

export async function GET() {
  const host = requestHostFrom(await headers());

  try {
    const slug = await resolvePropertySlugForHost(host);
    const site = slug ? await loadPropertySite(slug) : null;
    if (!site) return new NextResponse(GENERIC, { headers: HEADERS });
    return new NextResponse(await buildPropertyFile(site), { headers: HEADERS });
  } catch (error) {
    logger.error('Error generating llms.txt', error as Error, { host });
    return new NextResponse(GENERIC, { headers: HEADERS });
  }
}
