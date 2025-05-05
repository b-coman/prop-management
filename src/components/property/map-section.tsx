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

  return (
    <section className="py-8 md:py-12" id="map">
      <div className="container mx-auto px-4">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Location</h2>
        {location.city && location.state && (
          <p className="text-muted-foreground mb-4">
            Located in {location.city}, {location.state}. Exact address provided after booking.
          </p>
        )}
        {/* Placeholder for actual map embed */}
        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border border-border">
          <MapPin className="h-12 w-12 text-muted-foreground/50" />
           {/* TODO: Replace with Google Maps iframe or Leaflet map */}
           {/* Example iframe (replace with your actual embed code):
           <iframe
             src={`https://www.google.com/maps/embed/v1/place?key=YOUR_API_KEY&q=${location.coordinates?.latitude},${location.coordinates?.longitude}`} // Requires coordinates
             width="100%"
             height="100%"
             style={{ border: 0 }}
             allowFullScreen={false}
             loading="lazy"
             referrerPolicy="no-referrer-when-downgrade"
           ></iframe>
           */}
        </div>
      </div>
    </section>
  );
}
