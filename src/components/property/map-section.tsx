
// src/components/property/map-section.tsx
import type { Property } from '@/types';
import { MapPin } from 'lucide-react';

interface MapSectionProps {
  location?: Property['location']; // Pass the location object
}

export function MapSection({ location }: MapSectionProps) {
   if (!location) {
       return null; // Don't render if no location info
   }
    // Retrieve API key from environment variable
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <section className="py-8 md:py-12" id="map">
      <div className="container mx-auto px-4">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Location</h2>
        {location.city && location.state && (
          <p className="text-muted-foreground mb-4">
            Located in {location.city}, {location.state}. Exact address provided after booking.
          </p>
        )}
        {/* Actual map embed using apiKey */}
        {location.coordinates && apiKey ? (
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border border-border overflow-hidden">
           <iframe
             src={`https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${location.coordinates.latitude},${location.coordinates.longitude}`} // Use coordinates
             width="100%"
             height="100%"
             style={{ border: 0 }}
             allowFullScreen={false}
             loading="lazy"
             referrerPolicy="no-referrer-when-downgrade"
             title="Property Location Map" // Added title for accessibility
           ></iframe>
          </div>
        ) : (
          // Display placeholder if coordinates or API key are missing
          <div className="aspect-video bg-muted rounded-lg flex flex-col items-center justify-center border border-border">
            <MapPin className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              { !apiKey ? "Map API key is missing." : !location.coordinates ? "Coordinates unavailable." : "Map Unavailable"}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

