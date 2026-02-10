// src/components/property/full-map.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { FullMapBlock } from '@/lib/overridesSchemas-multipage';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

// Extend the Window interface to include our callback
declare global {
  interface Window {
    initFullMap?: () => void;
    google?: any;
  }
}

interface FullMapProps {
  content: FullMapBlock;
}

export function FullMap({ content }: FullMapProps) {
  const { t, tc } = useLanguage();

  // Add safety check for missing content
  if (!content) {
    console.warn("FullMap received invalid content");
    return null;
  }

  const { 
    title = "Our Location", 
    description, 
    address = "Location address unavailable", 
    coordinates, 
    zoom = 14, 
    showDirections = true 
  } = content;
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapId = 'property-full-map';
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Set isClient to true when component mounts
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load Google Maps script
  useEffect(() => {
    // Only run on client-side
    if (!isClient) return;

    // Skip if coordinates are missing
    if (!coordinates || !coordinates.lat || !coordinates.lng) {
      console.warn('Missing map coordinates');
      return;
    }

    // Check if Google Maps API is already loaded
    if (window.google && window.google.maps) {
      setMapLoaded(true);
      initMap();
      return;
    }

    // Get API key from environment variable
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key is missing');
      return;
    }

    // Setup callback function
    window.initFullMap = () => {
      setMapLoaded(true);
      initMap();
    };

    // Add Google Maps script to document
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initFullMap`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    
    // Save the script reference for cleanup
    scriptRef.current = script;
    
    // Cleanup function
    return () => {
      if (scriptRef.current && document.head.contains(scriptRef.current)) {
        document.head.removeChild(scriptRef.current);
      }
      
      // Delete the global callback
      if (window.initFullMap) {
        delete window.initFullMap;
      }
    };
  }, [isClient, coordinates]); // Add coordinates as dependency

  const initMap = () => {
    // Only run on client-side
    if (!isClient || !coordinates) return;

    try {
      if (!window.google || !window.google.maps) {
        console.warn('Google Maps not loaded yet');
        return;
      }
      
      const mapElement = document.getElementById(mapId);
      if (!mapElement) {
        console.warn(`Map element with id ${mapId} not found`);
        return;
      }

      const mapOptions = {
        center: { lat: coordinates.lat, lng: coordinates.lng },
        zoom: zoom,
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: true,
        zoomControl: true,
      };

      const map = new window.google.maps.Map(mapElement, mapOptions);
      
      // Add marker
      new window.google.maps.Marker({
        position: { lat: coordinates.lat, lng: coordinates.lng },
        map: map,
        title: tc(address),
        animation: window.google.maps.Animation.DROP,
      });
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  };

  const openDirections = () => {
    // Only run on client-side
    if (!isClient || !coordinates) return;
    
    try {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${coordinates.lat},${coordinates.lng}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error opening directions:', error);
    }
  };

  return (
    <section className="py-8 md:py-12 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-6">
          <h2 className="text-3xl font-bold mb-4">{tc(title)}</h2>
          {description && <p className="text-muted-foreground">{tc(description)}</p>}
        </div>

        <div className="mb-4 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="text-primary" />
            <span className="text-lg">{tc(address)}</span>
          </div>

          {showDirections && (
            <Button 
              variant="outline" 
              onClick={openDirections}
              className="gap-2"
            >
              <Navigation size={16} />
              {t('map.getDirections', 'Get Directions')}
            </Button>
          )}
        </div>

        {isClient && coordinates ? (
          <div 
            id={mapId} 
            className="w-full h-[400px] rounded-lg border shadow-sm"
            style={{ 
              background: '#f0f0f0', // Placeholder background
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {!mapLoaded && <p>{t('map.loading', 'Loading map...')}</p>}
          </div>
        ) : (
          <div className="w-full h-[400px] rounded-lg border shadow-sm bg-muted flex items-center justify-center">
            <p className="text-muted-foreground">{t('map.unavailable', 'Map unavailable')}</p>
          </div>
        )}
      </div>
    </section>
  );
}