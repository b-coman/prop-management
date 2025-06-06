// src/components/homepage/location-highlights.tsx
import { MapPin } from 'lucide-react'; // Added MapPin for fallback
import Image from 'next/image';
import type { Property } from '@/types'; // Import Property type to get Location
import { useLanguage } from '@/hooks/useLanguage';

interface Location {
    city?: string;
    state?: string;
    country?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
}

interface Attraction {
    name: string | { [key: string]: string };
    description: string | { [key: string]: string };
    distance?: string;
    image?: string | null;
     'data-ai-hint'?: string;
}

interface LocationHighlightsContent {
    title: string | { [key: string]: string };
    propertyLocation: Location; // Use the Location type
    attractions: Attraction[];
    'data-ai-hint'?: string;
}

interface LocationHighlightsProps {
    content: LocationHighlightsContent;
    language?: string;
}

export function LocationHighlights({ content, language = 'en' }: LocationHighlightsProps) {
    const { tc, t } = useLanguage();
    
    // Don't render if content is missing
    if (!content) {
        console.warn("[LocationHighlights] Rendering skipped: Missing content");
        return null;
    }

    // Extract properties with defaults to prevent destructuring errors
    const {
        title = "",
        propertyLocation = {},
        attractions = []
    } = content;

    // Don't render if required info is missing
    if (!title || !propertyLocation || !attractions || attractions.length === 0) {
        console.warn("[LocationHighlights] Rendering skipped: Missing required props (title, propertyLocation, or attractions).");
        return null;
    }

    // Retrieve API key from environment variable using the standard Next.js way
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    // Add console logs to check values - keep for debugging if needed
    // console.log("[LocationHighlights] Rendering component.");
    // console.log("[LocationHighlights] Google Maps API Key:", apiKey ? "Found (value hidden)" : "MISSING"); // Log if key exists, hide the actual key
    // console.log("[LocationHighlights] Property Coordinates:", propertyLocation.coordinates);

    return (
        <section className="py-16 md:py-24 bg-background" id="location">
            <div className="container mx-auto px-4">
                 <div className="max-w-3xl mx-auto text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4">
                        {tc(title, language)}
                    </h2>
                    {propertyLocation.city && propertyLocation.state && (
                        <p className="text-lg text-muted-foreground mb-4">
                        {t('location.nestledIn', { city: propertyLocation.city, state: propertyLocation.state })}
                        </p>
                    )}
                     {/* Actual map embed using apiKey */}
                    {propertyLocation.coordinates && apiKey ? (
                      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center my-8 max-w-2xl mx-auto border border-border overflow-hidden">
                       <iframe
                         src={`https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${propertyLocation.coordinates.latitude},${propertyLocation.coordinates.longitude}`} // Use coordinates
                         width="100%"
                         height="100%"
                         style={{ border: 0 }}
                         allowFullScreen={false}
                         loading="lazy"
                         referrerPolicy="no-referrer-when-downgrade"
                         title="Property Location Map"
                       ></iframe>
                      </div>
                    ) : (
                      // Display placeholder if coordinates or API key are missing
                      <div className="aspect-video bg-muted rounded-lg flex flex-col items-center justify-center my-8 max-w-2xl mx-auto border border-border">
                        <MapPin className="h-12 w-12 text-muted-foreground/50 mb-2" />
                         <p className="text-sm text-muted-foreground">
                            { !apiKey ? t('location.mapKeyMissing') : !propertyLocation.coordinates ? t('location.coordinatesUnavailable') : t('location.mapUnavailable')}
                         </p>
                      </div>
                    )}
                    <p className="text-lg text-muted-foreground">
                       {t('location.discoverNearby')}
                    </p>
                </div>

                 {/* Use a fluid grid layout */}
                <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                    {attractions.map((attraction, index) => (
                        <div key={index} className="flex flex-col items-center text-center p-4 bg-card rounded-lg shadow-md border border-border">
                             {/* Attraction Image */}
                            <div className="mb-4 h-40 w-full relative rounded-lg overflow-hidden bg-muted">
                                {attraction.image ? (
                                    <Image
                                        src={attraction.image}
                                        alt={tc(attraction.name, language)}
                                        fill
                                        style={{objectFit: 'cover'}}
                                        className="rounded-lg"
                                        data-ai-hint={attraction['data-ai-hint'] || 'landmark nature attraction'}
                                    />
                                ) : (
                                     <div className="flex items-center justify-center h-full w-full">
                                         <MapPin className="h-12 w-12 text-muted-foreground/50" />
                                     </div>
                                )}
                             </div>
                            <h3 className="text-lg font-semibold text-foreground mb-1">{tc(attraction.name, language)}</h3>
                             {attraction.distance && (
                                 <p className="text-xs text-muted-foreground mb-2">{attraction.distance}</p>
                             )}
                            <p className="text-muted-foreground text-sm flex-grow">
                                {tc(attraction.description, language)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
