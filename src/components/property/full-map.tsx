// src/components/property/full-map.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
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

  const {
    title = "Our Location",
    description,
    address = "Location address unavailable",
    coordinates,
    zoom = 14,
    showDirections = true
  } = content || {};

  const lat = coordinates?.lat;
  const lng = coordinates?.lng;

  const [mapLoaded, setMapLoaded] = useState(false);
  const mapId = 'property-full-map';
  const mapInstanceRef = useRef<any>(null);

  const initMap = useCallback(() => {
    if (!lat || !lng) return;
    if (!window.google?.maps) return;

    const mapElement = document.getElementById(mapId);
    if (!mapElement) return;

    try {
      const map = new window.google.maps.Map(mapElement, {
        center: { lat, lng },
        zoom,
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: true,
        zoomControl: true,
      });

      new window.google.maps.Marker({
        position: { lat, lng },
        map,
        title: typeof address === 'string' ? address : address?.en || '',
        animation: window.google.maps.Animation.DROP,
      });

      mapInstanceRef.current = map;
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }, [lat, lng, zoom, address]);

  // Load Google Maps script
  useEffect(() => {
    if (!lat || !lng) return;

    // Already loaded
    if (window.google?.maps) {
      setMapLoaded(true);
      initMap();
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key is missing');
      return;
    }

    // Check if script is already being loaded by another instance
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existingScript) {
      // Wait for the existing script to load
      const checkLoaded = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(checkLoaded);
          setMapLoaded(true);
          initMap();
        }
      }, 100);
      return () => clearInterval(checkLoaded);
    }

    // Setup callback
    window.initFullMap = () => {
      setMapLoaded(true);
      initMap();
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initFullMap`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    // Don't remove the script or callback on cleanup — Google Maps API
    // cannot be loaded twice and the callback must remain available
  }, [lat, lng, initMap]);

  const openDirections = () => {
    if (!lat || !lng) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
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

        {lat && lng ? (
          <div
            id={mapId}
            className="w-full h-[400px] rounded-lg border shadow-sm"
            style={{
              background: '#f0f0f0',
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
