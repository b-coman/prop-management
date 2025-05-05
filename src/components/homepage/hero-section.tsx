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

  // Map position strings to flexbox classes for the overlay container
  const positionClasses: { [key: string]: string } = {
    center: 'justify-center items-center',
    top: 'justify-center items-start pt-20', // Add padding-top for top position
    bottom: 'justify-center items-end pb-10', // Add padding-bottom for bottom position
    'top-left': 'justify-start items-start pt-20',
    'top-right': 'justify-end items-start pt-20',
    'bottom-left': 'justify-start items-end pb-10',
    'bottom-right': 'justify-end items-end pb-10',
  };

  // Classes for the Card based on size
  const cardSizeClasses = cn(
    "w-full bg-background/90 backdrop-blur-sm shadow-xl border-border",
    size === 'large' ? 'max-w-4xl p-3 md:p-4' : 'max-w-sm p-3 md:p-4'
  );

  // Container classes for CardHeader and CardContent based on size
  const innerContainerClasses = cn(
    size === 'large' ? 'flex flex-col md:flex-row md:items-end md:gap-4' : 'space-y-4'
  );

  // Header classes based on size
  const headerClasses = cn(
    "p-0", // Remove default padding
    size === 'large' ? 'mb-0 md:flex-grow-0 md:shrink-0' : 'mb-4 text-center' // Adjust flex properties and margin for large
  );

  // Price/Rating container classes based on size
  const priceRatingContainerClasses = cn(
    "flex items-center gap-2 mb-2 flex-wrap", // Common classes
    size === 'large' ? 'justify-start' : 'justify-center' // Adjust justification for large
  );

  // Content classes based on size
  const contentClasses = cn(
     "p-0", // Remove default padding
     size === 'large' ? 'md:flex-grow' : '' // Allow form to grow in large layout
  );


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
            {/* Booking Form Card - Apply size-specific classes */}
            <Card className={cardSizeClasses} id="booking">
                {/* Inner container for header and content, layout changes based on size */}
                 <div className={innerContainerClasses}>
                    {/* Card Header for Price and Rating */}
                    <CardHeader className={headerClasses}>
                        <div className={priceRatingContainerClasses}>
                            {pricePerNight !== undefined && pricePerNight > 0 && (
                                <Badge variant="secondary" className="text-base md:text-lg px-3 py-1">
                                ${pricePerNight}<span className="text-xs font-normal ml-1">/night</span>
                                </Badge>
                            )}
                            {showRating && ratings && ratings.count > 0 && (
                                <Badge variant="secondary" className="text-base md:text-lg px-3 py-1 flex items-center">
                                <Star className="h-4 w-4 mr-1 text-amber-500 fill-amber-500" />
                                {ratings.average.toFixed(1)}
                                <span className="text-xs font-normal ml-1">({ratings.count} reviews)</span>
                                </Badge>
                            )}
                        </div>
                    </CardHeader>

                    {/* Card Content for the Booking Form */}
                    <CardContent className={contentClasses}>
                        {/* Pass the size prop down to the form */}
                        <InitialBookingForm property={bookingFormProperty} size={size} />
                    </CardContent>
                </div>
            </Card>
          </div>
      )}
    </section>
  );
}
