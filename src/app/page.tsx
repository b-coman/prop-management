// src/app/page.tsx - Property listing page for the main app URL
import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import type { Property } from '@/types';
import { getAdminProperties } from '@/lib/firebaseClientAdmin';
import { getLocalizedString } from '@/lib/multilingual-utils';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, BedDouble, Bath, Star } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'RentalSpot - Vacation Rentals',
  description: 'Browse our curated collection of vacation rental properties.',
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  entire_place: 'Entire Place',
  chalet: 'Chalet',
  cabin: 'Cabin',
  villa: 'Villa',
  apartment: 'Apartment',
  house: 'House',
  cottage: 'Cottage',
  studio: 'Studio',
  bungalow: 'Bungalow',
};

function getPropertyUrl(property: Property): string {
  if (property.useCustomDomain && property.customDomain) {
    return `https://${property.customDomain}`;
  }
  return `/properties/${property.slug || property.id}`;
}

export default async function HomePage() {
  // Detect preferred language
  const cookieStore = await cookies();
  const headersList = await headers();
  const cookieLang = cookieStore.get('preferredLanguage')?.value;
  let lang = DEFAULT_LANGUAGE;
  if (cookieLang && SUPPORTED_LANGUAGES.includes(cookieLang)) {
    lang = cookieLang;
  } else {
    const acceptLang = headersList.get('accept-language');
    if (acceptLang) {
      const primary = acceptLang.split(',')[0].split('-')[0].toLowerCase();
      if (SUPPORTED_LANGUAGES.includes(primary)) {
        lang = primary;
      }
    }
  }

  // Fetch and filter properties
  const allProperties = await getAdminProperties();
  const properties = (allProperties as Property[]).filter(
    (p) => !p.status || p.status === 'active'
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-foreground">RentalSpot</h1>
          <p className="text-muted-foreground mt-1">
            {lang === 'ro'
              ? 'Descoperă proprietățile noastre de vacanță'
              : 'Discover our vacation rental properties'}
          </p>
        </div>
      </header>

      {/* Property grid */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {properties.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-lg text-muted-foreground">
              {lang === 'ro' ? 'Nu sunt proprietăți disponibile.' : 'No properties available.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {properties.map((property) => {
              const name = getLocalizedString(property.name, lang, 'Property');
              const description = getLocalizedString(
                property.shortDescription || property.description,
                lang,
                ''
              );
              const featuredImage =
                property.images?.find((img) => img.isFeatured)?.url ||
                property.images?.[0]?.url;
              const location = [property.location?.city, property.location?.country]
                .filter(Boolean)
                .join(', ');
              const typeLabel = property.propertyType
                ? PROPERTY_TYPE_LABELS[property.propertyType] || property.propertyType
                : null;
              const url = getPropertyUrl(property);
              const isExternal = url.startsWith('https://');

              const cardContent = (
                <Card className="overflow-hidden hover:shadow-md transition-shadow">
                  {/* Image */}
                  <div className="relative aspect-[16/10] bg-muted">
                    {featuredImage && (
                      <Image
                        src={featuredImage}
                        alt={name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    )}
                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex gap-2">
                      {typeLabel && (
                        <Badge variant="secondary" className="bg-white/90 text-foreground backdrop-blur-sm">
                          {typeLabel}
                        </Badge>
                      )}
                    </div>
                    {property.ratings && property.ratings.count > 0 && (
                      <div className="absolute top-3 right-3">
                        <Badge className="bg-white/90 text-foreground backdrop-blur-sm flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {property.ratings.average.toFixed(1)}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-2">
                    <h2 className="text-lg font-semibold text-foreground">{name}</h2>

                    {location && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {location}
                      </p>
                    )}

                    {description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
                    )}

                    {/* Specs */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1">
                      {property.maxGuests && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {property.maxGuests}
                        </span>
                      )}
                      {property.bedrooms && (
                        <span className="flex items-center gap-1">
                          <BedDouble className="h-3.5 w-3.5" />
                          {property.bedrooms}
                        </span>
                      )}
                      {property.bathrooms && (
                        <span className="flex items-center gap-1">
                          <Bath className="h-3.5 w-3.5" />
                          {property.bathrooms}
                        </span>
                      )}
                    </div>

                    {/* Price */}
                    {property.pricePerNight && (
                      <p className="text-base font-semibold text-foreground pt-1">
                        {lang === 'ro' ? 'De la' : 'From'}{' '}
                        {Math.round(property.pricePerNight)} {property.baseCurrency || 'RON'}
                        <span className="text-sm font-normal text-muted-foreground">
                          {' '}/ {lang === 'ro' ? 'noapte' : 'night'}
                        </span>
                      </p>
                    )}
                  </div>
                </Card>
              );

              if (isExternal) {
                return (
                  <a key={property.id} href={url} className="block">
                    {cardContent}
                  </a>
                );
              }
              return (
                <Link key={property.id} href={url} className="block">
                  {cardContent}
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
