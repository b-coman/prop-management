
import { MapPin } from 'lucide-react';
import Image from 'next/image'; // Assuming you'll add images later

interface Location {
    city: string;
    state: string;
    // Add coordinates if needed for an embedded map
}

interface Attraction {
    name: string;
    description: string;
    imageUrl?: string; // Optional image
     'data-ai-hint'?: string; // Optional AI hint for image generation
}

interface LocationHighlightsProps {
    propertyLocation: Location;
    attractions: Attraction[];
}

export function LocationHighlights({ propertyLocation, attractions }: LocationHighlightsProps) {
    return (
        <section className="py-16 md:py-24 bg-background">
            <div className="container mx-auto px-4">
                 <div className="max-w-3xl mx-auto text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4">
                        Explore the Surroundings
                    </h2>
                    <p className="text-lg text-muted-foreground mb-4">
                       Nestled in the heart of {propertyLocation.city}, {propertyLocation.state}, our chalet offers easy access to stunning natural wonders and historical sites.
                    </p>
                     {/* Placeholder for Map */}
                    <div className="aspect-video bg-muted rounded-lg flex items-center justify-center my-8 max-w-2xl mx-auto border border-border">
                        <MapPin className="h-12 w-12 text-muted-foreground/50" />
                         {/* TODO: Implement an actual map embed here (e.g., Google Maps iframe or Leaflet) */}
                    </div>
                    <p className="text-lg text-muted-foreground">
                       Discover these nearby attractions:
                    </p>
                </div>


                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {attractions.map((attraction, index) => (
                        <div key={index} className="flex flex-col items-center text-center p-6 bg-card rounded-lg shadow-md border border-border">
                            {/* Placeholder for attraction image or icon */}
                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                {/* Replace with an appropriate icon or image */}
                                <Image
                                    src={`https://picsum.photos/seed/${attraction.name.replace(/\s+/g, '-')}/100/100`}
                                    alt={attraction.name}
                                    width={40}
                                    height={40}
                                    className="rounded-md"
                                     data-ai-hint={attraction['data-ai-hint'] || 'landmark nature'}
                                />
                            </div>
                            <h3 className="text-xl font-semibold text-foreground mb-2">{attraction.name}</h3>
                            <p className="text-muted-foreground text-sm">
                                {attraction.description}
                            </p>
                             {/* Optional: Add link to learn more */}
                             {/* <a href="#" className="text-sm text-primary hover:underline mt-2">Learn More</a> */}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
