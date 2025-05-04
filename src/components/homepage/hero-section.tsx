
import Image from 'next/image';
import type { Property } from '@/types';
import { InitialBookingForm } from '@/components/booking/initial-booking-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star } from 'lucide-react';

interface HeroSectionProps {
  // Accept the full Property object, even if only parts are used here
  property: Property;
}

export function HeroSection({ property }: HeroSectionProps) {
  const featuredImage = property.images?.find(img => img.isFeatured) || property.images?.[0];

  return (
    <section className="relative h-[60vh] md:h-[75vh] w-full">
      {/* Background Image */}
      {featuredImage ? (
        <Image
          src={featuredImage.url}
          alt={featuredImage.alt || `Featured image of ${property.name}`}
          fill
          style={{ objectFit: 'cover' }}
          priority
          className="brightness-75" // Add slight dimming for text contrast
          data-ai-hint={featuredImage['data-ai-hint'] || 'mountain view sunset chalet'}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-700 flex items-center justify-center">
           {/* Fallback background */}
           <span className="text-white/50 text-lg">Image coming soon</span>
        </div>
      )}

       {/* Overlay Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
        {/* Booking Form Card */}
        <Card className="w-full max-w-md bg-background/90 backdrop-blur-sm shadow-xl border-border p-4 md:p-6">
          <CardHeader className="p-0 mb-4 text-center">
             {/* Price and Rating */}
            <div className="flex items-center justify-center gap-4 mb-2">
                 <Badge variant="secondary" className="text-lg px-3 py-1">
                    ${property.pricePerNight}<span className="text-xs font-normal ml-1">/night</span>
                 </Badge>
                 {property.ratings && property.ratings.count > 0 && (
                    <Badge variant="secondary" className="text-lg px-3 py-1 flex items-center">
                         <Star className="h-4 w-4 mr-1 text-amber-500 fill-amber-500" />
                        {property.ratings.average.toFixed(1)}
                        <span className="text-xs font-normal ml-1">({property.ratings.count} reviews)</span>
                    </Badge>
                 )}
            </div>
            {/* Optional: Add a small title or tagline here if needed */}
            {/* <CardTitle className="text-xl">Book Your Stay</CardTitle> */}
          </CardHeader>
          <CardContent className="p-0">
             {/* Pass the full property object to InitialBookingForm */}
            <InitialBookingForm property={property} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
