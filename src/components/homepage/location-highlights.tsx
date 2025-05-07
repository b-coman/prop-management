
import { MapPin, Map as MapIcon } from 'lucide-react'; // Added MapIcon
import Image from 'next/image';

interface Location {
    city?: string; // Make optional as it comes from property object
    state?: string; // Make optional
    country?: string; // Make optional
    // Add coordinates if needed for an embedded map
}

interface Attraction {
    name: string;
    description: string;
    distance?: string; // Add distance field
    image?: string | null; // Optional image
     'data-ai-hint'?: string; // Optional AI hint for image generation
}

interface LocationHighlightsProps {
    title: string; // Add title prop
    propertyLocation: Location; // Base location info
    attractions: Attraction[]; // Attractions from overrides
}

export function LocationHighlights({ title, propertyLocation, attractions }: LocationHighlightsProps) {
    // Don't render if required info is missing
    if (!title || !propertyLocation || !attractions || attractions.length === 0) {
        return null;
    }

    return (
        <section className="py-16 md:py-24 bg-background" id="location"> {/* Added ID */}
            <div className="container mx-auto px-4">
                 <div className="max-w-3xl mx-auto text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4">
                        {title} {/* Use title prop */}
                    </h2>
                    {propertyLocation.city && propertyLocation.state && (
                        <p className="text-lg text-muted-foreground mb-4">
                        Nestled in {propertyLocation.city}, {propertyLocation.state}, our property offers easy access to stunning natural wonders and historical sites.
                        </p>
                    )}
                     {/* Placeholder for Map */}
                    <div className="aspect-video bg-muted rounded-lg flex items-center justify-center my-8 max-w-2xl mx-auto border border-border">
                        <MapIcon className="h-12 w-12 text-muted-foreground/50" />
                         {/* TODO: Implement an actual map embed here */}
                    </div>
                    <p className="text-lg text-muted-foreground">
                       Discover these nearby attractions:
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
                                        alt={attraction.name}
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
                            <h3 className="text-lg font-semibold text-foreground mb-1">{attraction.name}</h3>
                             {attraction.distance && (
                                 <p className="text-xs text-muted-foreground mb-2">{attraction.distance}</p>
                             )}
                            <p className="text-muted-foreground text-sm flex-grow"> {/* Added flex-grow */}
                                {attraction.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}