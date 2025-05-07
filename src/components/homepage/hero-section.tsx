
import Image from 'next/image';
import { InitialBookingForm } from '@/components/booking/initial-booking-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Star, Home } from 'lucide-react'; // Added Home icon for placeholder
import type { Property } from '@/types'; // Still needed for the form prop
import type { heroSchema } from '@/lib/overridesSchemas'; // Import the schema
import type { z } from 'zod';
import { cn } from '@/lib/utils'; // Import cn for conditional classes

// Infer the type from the Zod schema
type HeroData = z.infer<typeof heroSchema> & {
  // Add properties that are not in the schema but are passed to the component
  ratings?: { average: number; count: number }; // This comes from Property, not heroSchema directly
  bookingFormProperty: Property; // Pass the whole property object for form and advertised rate
  'data-ai-hint'?: string;
};

interface HeroSectionProps {
  heroData: HeroData;
}

export function HeroSection({ heroData }: HeroSectionProps) {
  const {
    backgroundImage: backgroundImageUrl,
    showRating,
    showBookingForm = true,
    bookingForm,
    bookingFormProperty, // Property object contains advertisedRate, pricePerNight, ratings
    'data-ai-hint': dataAiHint,
  } = heroData;

  // Extract rate info from the property object
  const { advertisedRate, advertisedRateType, pricePerNight, ratings } = bookingFormProperty;
  // Price from override or template default for the hero block itself
  const heroBlockSpecificPrice = heroData.price;


  // Default values for position and size
  const position = bookingForm?.position || 'center';
  const size = bookingForm?.size || 'large';

  const positionClasses: { [key: string]: string } = {
    center: 'justify-center items-center',
    top: 'justify-center items-start pt-20',
    bottom: 'justify-center items-end pb-10',
    'top-left': 'justify-start items-start pt-20',
    'top-right': 'justify-end items-start pt-20',
    'bottom-left': 'justify-start items-end pb-10',
    'bottom-right': 'justify-end items-end pb-10',
  };

  const cardSizeClasses = cn(
    "w-full bg-background/90 backdrop-blur-sm shadow-xl border-border",
    size === 'large' ? 'max-w-4xl p-3 md:p-4' : 'max-w-sm p-3 md:p-4'
  );

  const innerContainerClasses = cn(
    size === 'large' ? 'flex flex-col md:flex-row md:items-end md:gap-4' : 'space-y-4'
  );

  const headerClasses = cn(
    "p-0",
    size === 'large' ? 'mb-0 md:flex-grow-0 md:shrink-0' : 'mb-4 text-center'
  );

  const priceRatingContainerClasses = cn(
    "flex items-center gap-2 mb-2 flex-wrap",
    size === 'large' ? 'justify-start' : 'justify-center'
  );

  const contentClasses = cn(
     "p-0",
     size === 'large' ? 'md:flex-grow' : ''
  );


  return (
    <section className="relative h-[60vh] md:h-[75vh] w-full" id="hero">
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

      {showBookingForm && (
          <div className={cn("absolute inset-0 flex p-4 md:p-8", positionClasses[position])}>
            <Card className={cardSizeClasses} id="booking">
                 <div className={innerContainerClasses}>
                    <CardHeader className={headerClasses}>
                        <div className={priceRatingContainerClasses}>
                            {advertisedRate ? (
                              <Badge variant="secondary" className="text-base md:text-lg px-3 py-1">
                                {advertisedRate}
                                {advertisedRateType === 'starting' && <span className="text-xs font-normal ml-1">starting from</span>}
                                {advertisedRateType === 'special' && <span className="text-xs font-normal ml-1">special deal</span>}
                                {advertisedRateType === 'exact' && <span className="text-xs font-normal ml-1">/night</span>}
                                {!advertisedRateType && pricePerNight > 0 && <span className="text-xs font-normal ml-1">/night</span>}
                              </Badge>
                            ) : heroBlockSpecificPrice !== undefined && heroBlockSpecificPrice > 0 ? (
                              <Badge variant="secondary" className="text-base md:text-lg px-3 py-1">
                                ${heroBlockSpecificPrice}<span className="text-xs font-normal ml-1">/night</span>
                              </Badge>
                            ) : pricePerNight > 0 ? (
                               <Badge variant="secondary" className="text-base md:text-lg px-3 py-1">
                                ${pricePerNight}<span className="text-xs font-normal ml-1">/night</span>
                              </Badge>
                            ) : null}

                            {showRating && ratings && ratings.count > 0 && (
                                <Badge variant="secondary" className="text-base md:text-lg px-3 py-1 flex items-center">
                                <Star className="h-4 w-4 mr-1 text-amber-500 fill-amber-500" />
                                {ratings.average.toFixed(1)}
                                <span className="text-xs font-normal ml-1">({ratings.count} reviews)</span>
                                </Badge>
                            )}
                        </div>
                    </CardHeader>

                    <CardContent className={contentClasses}>
                        <InitialBookingForm property={bookingFormProperty} size={size} />
                    </CardContent>
                </div>
            </Card>
          </div>
      )}
    </section>
  );
}
