import Image from 'next/image';
import Link from 'next/link';
import type { Property } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BedDouble, Bath, Users, Home } from 'lucide-react';

interface PropertyCardProps {
  property: Property;
}

export function PropertyCard({ property }: PropertyCardProps) {
  const featuredImage = property.images.find(img => img.isFeatured) || property.images[0];

  return (
    <Card className="overflow-hidden shadow-md transition-shadow hover:shadow-lg">
      <CardHeader className="p-0">
        <Link href={`/properties/${property.slug}`} className="block relative aspect-video w-full">
          {featuredImage ? (
            <Image
              src={featuredImage.url}
              alt={featuredImage.alt || `Image of ${property.name}`}
              layout="fill"
              objectFit="cover"
              className="transition-transform duration-300 group-hover:scale-105"
              data-ai-hint="vacation rental property exterior"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
              <Home className="h-12 w-12" />
            </div>
          )}
        </Link>
      </CardHeader>
      <CardContent className="p-4">
        <CardTitle className="mb-2 text-lg font-semibold">
          <Link href={`/properties/${property.slug}`} className="hover:text-primary transition-colors">
            {property.name}
          </Link>
        </CardTitle>
        <p className="mb-3 text-sm text-muted-foreground">{property.shortDescription}</p>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Users className="h-3 w-3" /> {property.maxGuests} Guests
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <BedDouble className="h-3 w-3" /> {property.bedrooms} Bedrooms
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Bath className="h-3 w-3" /> {property.bathrooms} Bathrooms
          </Badge>
        </div>
        <p className="text-lg font-bold text-primary">
          ${property.pricePerNight} <span className="text-sm font-normal text-muted-foreground">/ night</span>
        </p>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button asChild className="w-full" variant="default">
          <Link href={`/properties/${property.slug}`}>View Details</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
