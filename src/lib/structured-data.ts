import type { Property, Amenity, Review } from '@/types';

// Map full country names to ISO 3166-1 alpha-2 codes (Google requires ISO codes)
const COUNTRY_TO_ISO: Record<string, string> = {
  'romania': 'RO',
  'united states': 'US',
  'united kingdom': 'GB',
  'france': 'FR',
  'germany': 'DE',
  'italy': 'IT',
  'spain': 'ES',
  'greece': 'GR',
  'portugal': 'PT',
  'austria': 'AT',
  'switzerland': 'CH',
  'netherlands': 'NL',
  'belgium': 'BE',
  'hungary': 'HU',
  'bulgaria': 'BG',
  'croatia': 'HR',
  'czech republic': 'CZ',
  'poland': 'PL',
};

function normalizeCountry(country: string): string {
  // If already an ISO code (2 letters), return as-is
  if (/^[A-Z]{2}$/.test(country)) return country;
  return COUNTRY_TO_ISO[country.toLowerCase()] || country;
}

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
}

function isPlaceholderValue(value?: string): boolean {
  if (!value) return true;
  const lower = value.toLowerCase();
  return lower.includes('example') || lower.includes('(555)') || lower.includes('555-');
}

export function buildVacationRentalJsonLd(options: VacationRentalJsonLdOptions): Record<string, unknown> {
  const { property, amenities = [], canonicalUrl, telephone, publishedReviewCount, publishedReviews = [] } = options;
  // Prefer per-property contactPhone, fall back to template-level telephone
  const rawPhone = property.contactPhone || telephone;
  const validTelephone = rawPhone && !isPlaceholderValue(rawPhone) ? rawPhone : undefined;

  const name = typeof property.name === 'string'
    ? property.name
    : (property.name.en || property.name.ro || '');

  const description = property.description
    ? (typeof property.description === 'string'
        ? property.description
        : (property.description.en || property.description.ro || ''))
    : undefined;

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
    ...(property.location.country && { addressCountry: normalizeCountry(property.location.country) }),
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
  const isMetric = property.baseCurrency === 'EUR' || property.baseCurrency === 'RON';
  const floorSizeUnit = isMetric ? 'MTK' : 'FTK';

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
    ...(property.squareFeet && {
      floorSize: {
        '@type': 'QuantitativeValue',
        value: property.squareFeet,
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
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: baseUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: propertyName,
        item: `${baseUrl}/properties/${propertySlug}`,
      },
    ],
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

export function getCanonicalUrl(slug: string, customDomain?: string | null): string {
  if (customDomain) {
    // Custom domain serves the property at the root
    const domain = customDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return `https://${domain}`;
  }
  return `${normalizeHost()}/properties/${slug}`;
}

export function getBaseUrl(customDomain?: string | null): string {
  if (customDomain) {
    const domain = customDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return `https://${domain}`;
  }
  return normalizeHost();
}
