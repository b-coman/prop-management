import Image from 'next/image';
import { InitialBookingForm } from '@/components/booking/initial-booking-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Star, Home } from 'lucide-react'; // Added Home icon for placeholder
import type { Property } from '@/types'; // Still needed for the form prop

interface HeroSectionProps {
  backgroundImageUrl?: string | null;
  pricePerNight: number;
  ratings?: { average: number; count: number };
  bookingFormProperty: Property; // Pass the full property object needed by InitialBookingForm
  'data-ai-hint'?: string;
}

export function HeroSection({
    backgroundImageUrl,
    pricePerNight,
    ratings,
    bookingFormProperty, // Renamed for clarity
    'data-ai-hint': dataAiHint
}: HeroSectionProps) {

  return (
    <section className="relative h-[60vh] md:h-[75vh] w-full" id="hero"> {/* Added ID */}
      {/* Background Image */}
      {backgroundImageUrl ? (
        <Image
          src={backgroundImageUrl}
          alt={`Featured image of ${bookingFormProperty.name}`} // Use name from passed property
          fill
          style={{ objectFit: 'cover' }}
          priority
          className="brightness-75" // Add slight dimming for text contrast
          data-ai-hint={dataAiHint || 'property hero image'}
        />
      ) : (
        <div className="absolute inset-0 bg-muted flex items-center justify-center">
           {/* Fallback background */}
           <Home className="h-24 w-24 text-muted-foreground/30" />
        </div>
      )}

       {/* Overlay Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
        {/* Booking Form Card */}
        <Card className="w-full max-w-md bg-background/90 backdrop-blur-sm shadow-xl border-border p-4 md:p-6" id="booking"> {/* Added ID for linking */}
          <CardHeader className="p-0 mb-4 text-center">
             {/* Price and Rating */}
            <div className="flex items-center justify-center gap-4 mb-2">
                 <Badge variant="secondary" className="text-lg px-3 py-1">
                    ${pricePerNight}<span className="text-xs font-normal ml-1">/night</span>
                 </Badge>
                 {ratings && ratings.count > 0 && (
                    <Badge variant="secondary" className="text-lg px-3 py-1 flex items-center">
                         <Star className="h-4 w-4 mr-1 text-amber-500 fill-amber-500" />
                        {ratings.average.toFixed(1)}
                        <span className="text-xs font-normal ml-1">({ratings.count} reviews)</span>
                    </Badge>
                 )}
            </div>
            {/* Optional: Add a small title or tagline here if needed */}
            {/* <CardTitle className="text-xl">Book Your Stay</CardTitle> */}
          </CardHeader>
          <CardContent className="p-0">
             {/* Pass the necessary property object to InitialBookingForm */}
            <InitialBookingForm property={bookingFormProperty} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
