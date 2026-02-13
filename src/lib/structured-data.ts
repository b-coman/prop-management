import type { Property, Amenity, Review, RichReview } from '@/types';
import { normalizeCountryCode } from '@/lib/country-utils';

// Map amenity English names (lowercased) to schema.org LocationFeatureSpecification names
// Reference: https://developers.google.com/search/docs/appearance/structured-data/vacation-rental
const AMENITY_NAME_TO_SCHEMA: Record<string, string> = {
  'wifi': 'wifi',
  'wi-fi': 'wifi',
  'air conditioning': 'ac',
  'ac': 'ac',
  'heating': 'heating',
  'kitchen': 'kitchen',
  'tv': 'tv',
  'television': 'tv',
  'washer': 'washerDryer',
  'dryer': 'washerDryer',
  'washer/dryer': 'washerDryer',
  'washing machine': 'washerDryer',
  'pool': 'pool',
  'swimming pool': 'pool',
  'hot tub': 'hotTub',
  'jacuzzi': 'hotTub',
  'fireplace': 'fireplace',
  'gym': 'gymFitnessEquipment',
  'fitness': 'gymFitnessEquipment',
  'fitness center': 'gymFitnessEquipment',
  'balcony': 'balcony',
  'patio': 'patio',
  'barbecue': 'outdoorGrill',
  'grill': 'outdoorGrill',
  'bbq': 'outdoorGrill',
  'elevator': 'elevator',
  'parking': 'parkingType',
  'free parking': 'parkingType',
  'iron': 'ironingBoard',
  'ironing board': 'ironingBoard',
  'microwave': 'microwave',
  'oven': 'ovenStove',
  'stove': 'ovenStove',
  'crib': 'crib',
  'baby crib': 'crib',
  'child friendly': 'childFriendly',
  'kids friendly': 'childFriendly',
  'pets allowed': 'petsAllowed',
  'pet friendly': 'petsAllowed',
  'wheelchair accessible': 'wheelchairAccessible',
  'beach access': 'beachAccess',
  'self check-in': 'selfCheckinCheckout',
  'instant book': 'instantBookable',
};

interface VacationRentalJsonLdOptions {
  property: Property;
  amenities?: Amenity[];
  canonicalUrl: string;
  telephone?: string;
  publishedReviewCount?: number;
  publishedReviews?: Review[];
  language?: string;
  descriptionOverride?: string | { en?: string; ro?: string };
}

function isPlaceholderValue(value?: string): boolean {
  if (!value) return true;
  const lower = value.toLowerCase();
  return lower.includes('example') || lower.includes('(555)') || lower.includes('555-');
}

export function buildVacationRentalJsonLd(options: VacationRentalJsonLdOptions): Record<string, unknown> {
  const { property, amenities = [], canonicalUrl, telephone, publishedReviewCount, publishedReviews = [], language = 'en', descriptionOverride } = options;
  // Prefer per-property contactPhone, fall back to template-level telephone
  const rawPhone = property.contactPhone || telephone;
  const validTelephone = rawPhone && !isPlaceholderValue(rawPhone) ? rawPhone : undefined;

  // Helper to pick the right language from bilingual fields
  const pickLang = (value: string | { en?: string; ro?: string } | undefined): string | undefined => {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    return value[language as 'en' | 'ro'] || value.en || value.ro || undefined;
  };

  const name = pickLang(property.name) || '';

  // Prefer override description (from propertyMeta), fall back to property.description
  const description = pickLang(descriptionOverride) || pickLang(property.description);

  // Build images array — featured first, then by sortOrder
  const images = (property.images || [])
    .slice()
    .sort((a, b) => {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
    })
    .map(img => img.url);

  // Build address
  const address = property.location ? {
    '@type': 'PostalAddress' as const,
    ...(property.location.address && { streetAddress: property.location.address }),
    ...(property.location.city && { addressLocality: property.location.city }),
    ...(property.location.state && { addressRegion: property.location.state }),
    ...(property.location.country && { addressCountry: normalizeCountryCode(property.location.country) || property.location.country }),
    ...(property.location.zipCode && { postalCode: property.location.zipCode }),
  } : undefined;

  // Build amenity features from resolved amenity documents
  const amenityFeatures: Record<string, unknown>[] = [];
  const seenSchemaNames = new Set<string>();

  for (const amenity of amenities) {
    const amenityName = (typeof amenity.name === 'string'
      ? amenity.name
      : (amenity.name.en || '')).toLowerCase().trim();

    const schemaName = AMENITY_NAME_TO_SCHEMA[amenityName];
    if (schemaName && !seenSchemaNames.has(schemaName)) {
      seenSchemaNames.add(schemaName);
      amenityFeatures.push({
        '@type': 'LocationFeatureSpecification',
        name: schemaName,
        value: schemaName === 'parkingType' ? 'Free' : true,
      });
    }
  }

  // Determine floor size unit: MTK (sq meters) for European currencies
  // squareFeet field stores imperial values; convert to m² for metric properties
  const isMetric = property.baseCurrency === 'EUR' || property.baseCurrency === 'RON';
  const floorSizeUnit = isMetric ? 'MTK' : 'FTK';
  const floorSizeValue = property.squareFeet
    ? (isMetric ? Math.round(property.squareFeet / 10.764) : property.squareFeet)
    : undefined;

  // Map propertyType to Google-accepted Accommodation additionalType enum values.
  // Valid values: EntirePlace, PrivateRoom, SharedRoom, HotelRoom
  const PROPERTY_TYPE_TO_ACCOMMODATION: Record<string, string> = {
    entire_place: 'EntirePlace',
    chalet: 'EntirePlace',
    cabin: 'EntirePlace',
    villa: 'EntirePlace',
    apartment: 'EntirePlace',
    house: 'EntirePlace',
    cottage: 'EntirePlace',
    studio: 'EntirePlace',
    bungalow: 'EntirePlace',
    private_room: 'PrivateRoom',
    shared_room: 'SharedRoom',
    hotel_room: 'HotelRoom',
  };
  const accommodationType = PROPERTY_TYPE_TO_ACCOMMODATION[property.propertyType || ''] || 'EntirePlace';

  // Build bed details from bedConfiguration (flatten rooms into bed type totals)
  const bedDetails: Record<string, unknown>[] = [];
  if (property.bedConfiguration?.length) {
    const bedTotals = new Map<string, number>();
    for (const room of property.bedConfiguration) {
      for (const bed of room.beds) {
        bedTotals.set(bed.type, (bedTotals.get(bed.type) || 0) + bed.count);
      }
    }
    const BED_TYPE_TO_SCHEMA: Record<string, string> = {
      king: 'King', queen: 'Queen', double: 'Double', single: 'Single',
      sofa_bed: 'SofaBed', bunk: 'BunkBed', crib: 'Crib',
    };
    for (const [type, count] of bedTotals) {
      bedDetails.push({
        '@type': 'BedDetails',
        typeOfBed: BED_TYPE_TO_SCHEMA[type] || type,
        numberOfBeds: count,
      });
    }
  }

  // Build containsPlace (Accommodation)
  const containsPlace: Record<string, unknown> = {
    '@type': 'Accommodation',
    additionalType: accommodationType,
    occupancy: {
      '@type': 'QuantitativeValue',
      value: property.maxGuests,
    },
    ...(property.bedrooms && { numberOfBedrooms: property.bedrooms }),
    ...(property.beds && { numberOfBeds: property.beds }),
    ...(property.bathrooms && { numberOfBathroomsTotal: property.bathrooms }),
    ...(bedDetails.length > 0 && { bed: bedDetails }),
    ...(floorSizeValue && {
      floorSize: {
        '@type': 'QuantitativeValue',
        value: floorSizeValue,
        unitCode: floorSizeUnit,
      },
    }),
    ...(amenityFeatures.length > 0 && { amenityFeature: amenityFeatures }),
  };

  // Format check-in/out times to ISO 8601 (HH:MM:SS)
  const formatTime = (time?: string) => {
    if (!time) return undefined;
    // Handle "HH:MM" 24h format
    if (/^\d{1,2}:\d{2}$/.test(time)) {
      const [h, m] = time.split(':');
      return `${h.padStart(2, '0')}:${m}:00`;
    }
    // Handle "3:00 PM" / "11:00 AM" format
    const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const period = match[3].toUpperCase();
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      return `${String(hours).padStart(2, '0')}:${minutes}:00`;
    }
    return time;
  };

  // Build aggregate rating — only when actual published reviews exist in Firestore.
  // property.ratings may contain stale/manual data; publishedReviewCount is the source of truth.
  const hasRealReviews = typeof publishedReviewCount === 'number' && publishedReviewCount > 0;
  const aggregateRating = hasRealReviews && property.ratings && property.ratings.average > 0
    ? {
        '@type': 'AggregateRating',
        ratingValue: property.ratings.average,
        ratingCount: publishedReviewCount,
        bestRating: 5,
      }
    : undefined;

  // Build price range from base price
  const priceRange = property.pricePerNight
    ? `${property.pricePerNight} ${property.baseCurrency}/night`
    : undefined;

  // Build individual Review objects (up to 5) from published reviews
  const reviewJsonLd = publishedReviews.slice(0, 5).map((review) => {
    const dateStr = typeof review.date === 'string'
      ? review.date.split('T')[0]  // ISO date to YYYY-MM-DD
      : undefined;
    return {
      '@type': 'Review' as const,
      author: { '@type': 'Person' as const, name: review.guestName },
      ...(dateStr && { datePublished: dateStr }),
      reviewBody: review.comment,
      reviewRating: {
        '@type': 'Rating' as const,
        ratingValue: review.rating,
        bestRating: 5,
      },
    };
  });

  // Map propertyType to VacationRental additionalType (human-readable subtype).
  // This is different from Accommodation additionalType which uses a strict enum.
  const PROPERTY_TYPE_TO_RENTAL_SUBTYPE: Record<string, string> = {
    chalet: 'Chalet',
    cabin: 'Cabin',
    villa: 'Villa',
    apartment: 'Apartment',
    house: 'House',
    cottage: 'Cottage',
    studio: 'Studio',
    bungalow: 'Bungalow',
    entire_place: 'VacationRental',
  };
  const rentalSubtype = PROPERTY_TYPE_TO_RENTAL_SUBTYPE[property.propertyType || ''];

  // Assemble the full JSON-LD
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'VacationRental',
    ...(rentalSubtype && { additionalType: rentalSubtype }),
    name,
    identifier: property.slug || property.id,
    url: canonicalUrl,
    ...(description && { description }),
    ...(images.length > 0 && { image: images }),
    ...(validTelephone && { telephone: validTelephone }),
    ...(priceRange && { priceRange }),
    ...(property.location?.coordinates && {
      latitude: String(property.location.coordinates.latitude),
      longitude: String(property.location.coordinates.longitude),
    }),
    ...(address && { address }),
    ...(formatTime(property.checkInTime) && { checkinTime: formatTime(property.checkInTime) }),
    ...(formatTime(property.checkOutTime) && { checkoutTime: formatTime(property.checkOutTime) }),
    containsPlace,
    ...(aggregateRating && { aggregateRating }),
    ...(reviewJsonLd.length > 0 && { review: reviewJsonLd }),
    knowsLanguage: ['en', 'ro'],
  };

  return jsonLd;
}

export function buildBreadcrumbJsonLd(
  propertyName: string,
  propertySlug: string,
  baseUrl: string,
  pageName?: string,
  pageLabel?: string,
  customDomain?: string | null,
): Record<string, unknown> {
  // On custom domains, the property is at root; on main app, it's under /properties/{slug}
  const propertyUrl = customDomain
    ? baseUrl
    : `${baseUrl}/properties/${propertySlug}`;

  const items: Record<string, unknown>[] = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: propertyUrl,
    },
  ];

  // Only add property name as separate breadcrumb level when on a subpage
  if (pageName && pageName !== 'homepage' && pageLabel) {
    items.push(
      {
        '@type': 'ListItem',
        position: 2,
        name: propertyName,
        item: propertyUrl,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: pageLabel,
        item: `${propertyUrl}/${pageName}`,
      },
    );
  } else {
    items.push({
      '@type': 'ListItem',
      position: 2,
      name: propertyName,
      item: propertyUrl,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}

function normalizeHost(): string {
  let host = process.env.NEXT_PUBLIC_MAIN_APP_HOST || 'localhost:3000';
  // Strip protocol if already included
  host = host.replace(/^https?:\/\//, '');
  // Strip trailing slash
  host = host.replace(/\/+$/, '');
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

export function getCanonicalUrl(slug: string, customDomain?: string | null, pagePath?: string): string {
  const pageSuffix = pagePath && pagePath !== 'homepage' ? `/${pagePath}` : '';
  if (customDomain) {
    // Custom domain serves the property at the root
    const domain = customDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return `https://${domain}${pageSuffix}`;
  }
  return `${normalizeHost()}/properties/${slug}${pageSuffix}`;
}

export function getBaseUrl(customDomain?: string | null): string {
  if (customDomain) {
    const domain = customDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return `https://${domain}`;
  }
  return normalizeHost();
}

/**
 * Build LodgingBusiness JSON-LD for Google Maps visibility.
 * Coexists with VacationRental schema — Google uses LodgingBusiness for Maps.
 */
export function buildLodgingBusinessJsonLd(options: {
  property: Property;
  canonicalUrl: string;
  telephone?: string;
  publishedReviewCount?: number;
  publishedReviews?: Review[];
  language?: string;
  descriptionOverride?: string | { en?: string; ro?: string };
}): Record<string, unknown> {
  const { property, canonicalUrl, telephone, publishedReviewCount, publishedReviews = [], language = 'en', descriptionOverride } = options;

  const pickLang = (value: string | { en?: string; ro?: string } | undefined): string | undefined => {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    return value[language as 'en' | 'ro'] || value.en || value.ro || undefined;
  };

  const name = pickLang(property.name) || '';
  const description = pickLang(descriptionOverride) || pickLang(property.description);
  const rawPhone = property.contactPhone || telephone;
  const validTelephone = rawPhone && !isPlaceholderValue(rawPhone) ? rawPhone : undefined;

  const images = (property.images || [])
    .slice()
    .sort((a, b) => {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
    })
    .map(img => img.url);

  const address = property.location ? {
    '@type': 'PostalAddress' as const,
    ...(property.location.address && { streetAddress: property.location.address }),
    ...(property.location.city && { addressLocality: property.location.city }),
    ...(property.location.state && { addressRegion: property.location.state }),
    ...(property.location.country && { addressCountry: normalizeCountryCode(property.location.country) || property.location.country }),
    ...(property.location.zipCode && { postalCode: property.location.zipCode }),
  } : undefined;

  const geo = property.location?.coordinates ? {
    '@type': 'GeoCoordinates',
    latitude: property.location.coordinates.latitude,
    longitude: property.location.coordinates.longitude,
  } : undefined;

  const hasRealReviews = typeof publishedReviewCount === 'number' && publishedReviewCount > 0;
  const aggregateRating = hasRealReviews && property.ratings && property.ratings.average > 0
    ? {
        '@type': 'AggregateRating',
        ratingValue: property.ratings.average,
        ratingCount: publishedReviewCount,
        bestRating: 5,
      }
    : undefined;

  const priceRange = property.pricePerNight
    ? `${property.pricePerNight} ${property.baseCurrency}/night`
    : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    additionalType: 'VacationRental',
    name,
    url: canonicalUrl,
    ...(description && { description }),
    ...(images.length > 0 && { image: images }),
    ...(validTelephone && { telephone: validTelephone }),
    ...(address && { address }),
    ...(geo && { geo }),
    ...(priceRange && { priceRange }),
    ...(aggregateRating && { aggregateRating }),
    ...(publishedReviews.length > 0 && {
      review: publishedReviews.slice(0, 5).map((review) => ({
        '@type': 'Review',
        author: { '@type': 'Person', name: review.guestName },
        ...(typeof review.date === 'string' && { datePublished: review.date.split('T')[0] }),
        reviewBody: review.comment,
        reviewRating: { '@type': 'Rating', ratingValue: review.rating, bestRating: 5 },
      })),
    }),
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '00:00',
      closes: '23:59',
    },
    knowsLanguage: ['en', 'ro'],
  };
}

/**
 * Build ImageGallery JSON-LD for gallery pages.
 */
export function buildImageGalleryJsonLd(options: {
  property: Property;
  canonicalUrl: string;
  language?: string;
}): Record<string, unknown> {
  const { property, canonicalUrl, language = 'en' } = options;

  const pickLang = (value: string | { en?: string; ro?: string } | undefined): string | undefined => {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    return value[language as 'en' | 'ro'] || value.en || value.ro || undefined;
  };

  const name = pickLang(property.name) || '';
  const images = (property.images || [])
    .sort((a, b) => {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
    })
    .map(img => ({
      '@type': 'ImageObject',
      contentUrl: img.url,
      ...(img.alt && { description: img.alt }),
      ...(img.alt && { name: img.alt }),
    }));

  const galleryTitle = language === 'ro'
    ? `Galerie Foto - ${name}`
    : `Photo Gallery - ${name}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: galleryTitle,
    url: canonicalUrl,
    mainEntity: {
      '@type': 'ImageGallery',
      name: galleryTitle,
      ...(images.length > 0 && { image: images }),
    },
  };
}

// ---------------------------------------------------------------------------
// Article structured data — for area guide pages
// ---------------------------------------------------------------------------

export function buildAreaGuideJsonLd(options: {
  property: Property;
  canonicalUrl: string;
  language?: string;
  descriptionOverride?: string | { en?: string; ro?: string };
}): Record<string, unknown> {
  const { property, canonicalUrl, language = 'en', descriptionOverride } = options;

  const pickLang = (value: string | { en?: string; ro?: string } | undefined): string | undefined => {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    return value[language as 'en' | 'ro'] || value.en || value.ro || undefined;
  };

  const name = pickLang(property.name) || '';
  const city = property.location?.city || '';
  const headline = language === 'ro'
    ? `Ghid Local - ${name}${city ? `, ${city}` : ''}`
    : `Area Guide - ${name}${city ? `, ${city}` : ''}`;

  const description = pickLang(descriptionOverride) || pickLang(property.description);

  const images = (property.images || [])
    .slice()
    .sort((a, b) => {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
    })
    .slice(0, 3)
    .map(img => img.url);

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    url: canonicalUrl,
    ...(description && { description }),
    ...(images.length > 0 && { image: images }),
    inLanguage: language === 'ro' ? 'ro' : 'en',
  };
}

// ---------------------------------------------------------------------------
// FAQPage structured data — auto-generated from property fields
// ---------------------------------------------------------------------------

interface FAQPageJsonLdOptions {
  property: Property;
  language?: string;
}

export function buildFAQPageJsonLd(options: FAQPageJsonLdOptions): Record<string, unknown> | null {
  const { property, language = 'en' } = options;
  const ro = language === 'ro';
  const faqs: Array<{ question: string; answer: string }> = [];
  const name = typeof property.name === 'string' ? property.name : (property.name as any)?.[language] || (property.name as any)?.en || '';

  // Capacity
  if (property.maxGuests) {
    faqs.push({
      question: ro ? `Câți oaspeți pot fi cazați la ${name}?` : `How many guests can stay at ${name}?`,
      answer: ro
        ? `Proprietatea poate găzdui până la ${property.maxGuests} oaspeți.`
        : `The property accommodates up to ${property.maxGuests} guests.`,
    });
  }

  // Bedrooms & bathrooms
  if (property.bedrooms && property.bathrooms) {
    faqs.push({
      question: ro ? `Câte dormitoare și băi are ${name}?` : `How many bedrooms and bathrooms does ${name} have?`,
      answer: ro
        ? `${name} are ${property.bedrooms} dormitoare și ${property.bathrooms} băi.`
        : `${name} has ${property.bedrooms} bedrooms and ${property.bathrooms} bathrooms.`,
    });
  }

  // Check-in / check-out
  if (property.checkInTime && property.checkOutTime) {
    faqs.push({
      question: ro ? `Care sunt orele de check-in și check-out?` : `What are the check-in and check-out times?`,
      answer: ro
        ? `Check-in este de la ${property.checkInTime}, iar check-out până la ${property.checkOutTime}.`
        : `Check-in is from ${property.checkInTime} and check-out is by ${property.checkOutTime}.`,
    });
  }

  // Amenity-based FAQs
  const refs = property.amenityRefs || [];
  const hasAmenity = (id: string) => refs.includes(id);

  if (hasAmenity('wifi')) {
    faqs.push({
      question: ro ? `Există WiFi la ${name}?` : `Is there WiFi at ${name}?`,
      answer: ro ? `Da, WiFi gratuit este disponibil.` : `Yes, free WiFi is available.`,
    });
  }

  if (hasAmenity('parking')) {
    faqs.push({
      question: ro ? `Există loc de parcare?` : `Is parking available?`,
      answer: ro ? `Da, locul de parcare este disponibil pentru oaspeți.` : `Yes, parking is available for guests.`,
    });
  }

  if (hasAmenity('kitchen')) {
    faqs.push({
      question: ro ? `Există bucătărie?` : `Is there a kitchen?`,
      answer: ro ? `Da, proprietatea dispune de bucătărie complet echipată.` : `Yes, the property has a fully equipped kitchen.`,
    });
  }

  // Cancellation policy
  if (property.cancellationPolicy) {
    const policy = typeof property.cancellationPolicy === 'string'
      ? property.cancellationPolicy
      : (property.cancellationPolicy as any)?.[language] || (property.cancellationPolicy as any)?.en || '';
    if (policy) {
      faqs.push({
        question: ro ? `Care este politica de anulare?` : `What is the cancellation policy?`,
        answer: policy,
      });
    }
  }

  // House rules
  if (property.houseRules?.length) {
    const rules = property.houseRules.map(r =>
      typeof r === 'string' ? r : ((r as any)?.[language] || (r as any)?.en || '')
    ).filter(Boolean);
    if (rules.length > 0) {
      faqs.push({
        question: ro ? `Care sunt regulile casei?` : `What are the house rules?`,
        answer: rules.join('. ') + '.',
      });
    }
  }

  if (faqs.length < 2) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

// ---------------------------------------------------------------------------
// Reviews page structured data — AggregateRating + individual Reviews
// ---------------------------------------------------------------------------

export function buildReviewPageJsonLd(options: {
  property: Property;
  reviews: RichReview[];
  canonicalUrl: string;
  language?: string;
}): Record<string, unknown> {
  const { property, reviews, canonicalUrl, language = 'en' } = options;

  const pickLang = (value: string | { en?: string; ro?: string } | undefined): string | undefined => {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    return value[language as 'en' | 'ro'] || value.en || value.ro || undefined;
  };

  const name = pickLang(property.name) || '';
  const totalCount = reviews.length;
  const averageRating = totalCount > 0
    ? Math.round(reviews.reduce((sum, r) => sum + r.rating, 0) / totalCount * 10) / 10
    : 0;

  // Build up to 10 individual Review objects
  const reviewJsonLd = reviews.slice(0, 10).map((review) => {
    const dateStr = typeof review.date === 'string'
      ? review.date.split('T')[0]
      : undefined;
    return {
      '@type': 'Review' as const,
      author: { '@type': 'Person' as const, name: review.guestName },
      ...(dateStr && { datePublished: dateStr }),
      reviewBody: review.positiveReview || review.comment || '',
      reviewRating: {
        '@type': 'Rating' as const,
        ratingValue: review.rating,
        bestRating: 5,
      },
    };
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'VacationRental',
    name,
    url: canonicalUrl,
    ...(totalCount > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: averageRating,
        ratingCount: totalCount,
        bestRating: 5,
      },
    }),
    ...(reviewJsonLd.length > 0 && { review: reviewJsonLd }),
  };
}
