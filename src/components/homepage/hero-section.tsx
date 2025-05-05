import Image from 'next/image';
import { InitialBookingForm } from '@/components/booking/initial-booking-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Star, Home } from 'lucide-react'; // Added Home icon for placeholder
import type { Property } from '@/types'; // Still needed for the form prop
import { heroSchema } from '@/lib/overridesSchemas'; // Import the schema
import { z } from 'zod';
import { cn } from '@/lib/utils'; // Import cn for conditional classes

// Infer the type from the Zod schema
type HeroData = z.infer<typeof heroSchema> & {
  // Add properties that are not in the schema but are passed to the component
  ratings?: { average: number; count: number };
  bookingFormProperty: Property;
  'data-ai-hint'?: string;
};

interface HeroSectionProps {
  heroData: HeroData;
}

export function HeroSection({ heroData }: HeroSectionProps) {
  const {
    backgroundImage: backgroundImageUrl, // Renamed from backgroundImage
    price: pricePerNight, // Renamed from price
    showRating,
    showBookingForm = true, // Default to true if not specified
    bookingForm,
    ratings,
    bookingFormProperty,
    'data-ai-hint': dataAiHint,
  } = heroData;

  // Default values for position and size
  const position = bookingForm?.position || 'center';
  const size = bookingForm?.size || 'large'; // Default to 'large' if not specified

  // Map position strings to flexbox classes
  const positionClasses: { [key: string]: string } = {
    center: 'justify-center items-center',
    top: 'justify-center items-start',
    bottom: 'justify-center items-end',
    'top-left': 'justify-start items-start',
    'top-right': 'justify-end items-start',
    'bottom-left': 'justify-start items-end',
    'bottom-right': 'justify-end items-end',
  };

  // Map size strings to card classes - remove sizeClasses as layout is now handled in InitialBookingForm
  // const sizeClasses: { [key: string]: string } = {
  //   large: 'max-w-md p-4 md:p-6', // Default size
  //   compressed: 'max-w-sm p-3 md:p-4', // Smaller size
  // };

  return (
    <section className="relative h-[60vh] md:h-[75vh] w-full" id="hero">
      {/* Background Image */}
      {backgroundImageUrl ? (
        <Image
          src={backgroundImageUrl}
          alt={`Featured image of ${bookingFormProperty.name}`}
          fill
          style={{ objectFit: 'cover' }}
          priority
          className="brightness-75"
          data-ai-hint={dataAiHint || 'property hero image'}
        />
      ) : (
        <div className="absolute inset-0 bg-muted flex items-center justify-center">
          <Home className="h-24 w-24 text-muted-foreground/30" />
        </div>
      )}

      {/* Overlay Content - Apply positioning classes */}
      {showBookingForm && (
          <div className={cn("absolute inset-0 flex p-4 md:p-8", positionClasses[position])}>
            {/* Booking Form Card - Remove sizing classes, pass size prop to InitialBookingForm */}
            <Card
                className={cn(
                    "w-full bg-background/90 backdrop-blur-sm shadow-xl border-border",
                     // Apply different padding based on size directly here, or let InitialBookingForm handle internal padding
                    size === 'large' ? 'max-w-4xl p-4 md:p-6' : 'max-w-sm p-3 md:p-4' // Example: adjust max-width for large
                )}
                id="booking"
                >
                 <CardHeader className={cn(
                      "p-0 mb-4",
                       size === 'large' ? 'text-left md:text-center' : 'text-center' // Adjust alignment for large
                 )}>
                    {/* Price and Rating */}
                    <div className={cn(
                         "flex items-center gap-4 mb-2 flex-wrap",
                          size === 'large' ? 'justify-start md:justify-center' : 'justify-center' // Adjust justify for large
                    )}>
                    {pricePerNight !== undefined && pricePerNight > 0 && ( // Check if price is defined and positive
                        <Badge variant="secondary" className="text-lg px-3 py-1">
                        ${pricePerNight}<span className="text-xs font-normal ml-1">/night</span>
                        </Badge>
                    )}
                    {showRating && ratings && ratings.count > 0 && (
                        <Badge variant="secondary" className="text-lg px-3 py-1 flex items-center">
                        <Star className="h-4 w-4 mr-1 text-amber-500 fill-amber-500" />
                        {ratings.average.toFixed(1)}
                        <span className="text-xs font-normal ml-1">({ratings.count} reviews)</span>
                        </Badge>
                    )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {/* Pass the size prop down to the form */}
                    <InitialBookingForm property={bookingFormProperty} size={size} />
                </CardContent>
            </Card>
          </div>
      )}
    </section>
  );
}