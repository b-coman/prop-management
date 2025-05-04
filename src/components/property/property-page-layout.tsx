
// src/components/property/property-page-layout.tsx
import Image from 'next/image';
import type { Property } from '@/types';
import { Header } from '@/components/header'; // Use the generic header
import { Footer } from '@/components/footer'; // Use the generic footer
import { InitialBookingForm } from '@/components/booking/initial-booking-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  BedDouble, Bath, Users, Wifi, ParkingCircle, Tv, Utensils, Clock, CheckCircle, MapPin, Home, MountainSnow, Trees, ListChecks, Wind, Building
} from 'lucide-react';

interface PropertyPageLayoutProps {
  property: Property;
}

export function PropertyPageLayout({ property }: PropertyPageLayoutProps) {
  const featuredImage = property.images?.find(img => img.isFeatured) || property.images?.[0];
  const galleryImages = property.images?.filter(img => !img.isFeatured) || [];

  // Generic mapping for common amenities
  const amenityIcons: { [key: string]: React.ReactNode } = {
    wifi: <Wifi className="h-4 w-4 mr-1" />,
    kitchen: <Utensils className="h-4 w-4 mr-1" />,
    parking: <ParkingCircle className="h-4 w-4 mr-1" />,
    tv: <Tv className="h-4 w-4 mr-1" />,
    fireplace: <Home className="h-4 w-4 mr-1" />, // Generic home icon
    'mountain view': <MountainSnow className="h-4 w-4 mr-1" />,
    garden: <Trees className="h-4 w-4 mr-1" />,
    'air conditioning': <Wind className="h-4 w-4 mr-1" />,
    'washer/dryer': <CheckCircle className="h-4 w-4 mr-1 text-primary" />, // Use primary color
    elevator: <Building className="h-4 w-4 mr-1" />,
  };

  const houseRules = property.houseRules || []; // Ensure houseRules is an array

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Use Generic Header */}
      <Header />

      {/* Hero Section with Overlay Booking Form */}
      <section className="relative h-[60vh] md:h-[70vh] w-full">
        {featuredImage ? (
          <Image
            src={featuredImage.url}
            alt={featuredImage.alt || `Featured image of ${property.name}`}
            fill
            style={{ objectFit: "cover" }}
            priority
            className="brightness-75" // Add slight dimming
            data-ai-hint={featuredImage['data-ai-hint']}
          />
        ) : (
          <div className="absolute inset-0 bg-muted flex items-center justify-center">
            <Home className="h-24 w-24 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <Card className="w-full max-w-md bg-background/90 backdrop-blur-sm shadow-xl border-border p-4 md:p-6 mx-4">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl text-center mb-1">
                <span className="text-2xl font-bold text-foreground">${property.pricePerNight}</span> / night
              </CardTitle>
              {property.ratings && property.ratings.count > 0 && (
                 <div className="text-sm text-muted-foreground text-center">
                    ⭐ {property.ratings.average.toFixed(1)} ({property.ratings.count} reviews)
                 </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <InitialBookingForm property={property} />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Main Content - Below the Hero */}
      <main className="flex-grow container py-12 md:py-16">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">

          {/* Left/Main Column: Property Details */}
          <div className="lg:w-2/3 space-y-8">
            {/* Title and Location */}
            <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-2">
                 {property.name}
                </h1>
                {property.location && (
                  <div className="flex items-center text-muted-foreground mb-6">
                    <MapPin className="h-4 w-4 mr-1 text-primary" />
                    <span>{property.location.city}, {property.location.state}, {property.location.country}</span>
                  </div>
                )}
            </div>

            {/* Description */}
            <div className="prose max-w-none dark:prose-invert text-foreground/90">
              <h2 className="text-2xl font-semibold mb-3 text-foreground">About this property</h2>
              <p>{property.description}</p>
            </div>

            <Separator />

            {/* Key Features */}
            <div>
              <h3 className="text-xl font-semibold mb-4 text-foreground">Key Features</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center"><Users className="h-4 w-4 mr-2 text-primary" /> Max {property.maxGuests} Guests</div>
                <div className="flex items-center"><BedDouble className="h-4 w-4 mr-2 text-primary" /> {property.bedrooms} Bedrooms</div>
                <div className="flex items-center"><BedDouble className="h-4 w-4 mr-2 text-primary" /> {property.beds} Beds</div>
                <div className="flex items-center"><Bath className="h-4 w-4 mr-2 text-primary" /> {property.bathrooms} Bathrooms</div>
                 {property.squareFeet && <div className="flex items-center"><Home className="h-4 w-4 mr-2 text-primary" /> {property.squareFeet} sqm</div>}
              </div>
            </div>

            <Separator />

            {/* Amenities */}
            {property.amenities && property.amenities.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold mb-4 text-foreground">Amenities</h3>
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm list-none pl-0">
                  {property.amenities.map((amenity) => (
                    <li key={amenity} className="flex items-center">
                      {amenityIcons[amenity.toLowerCase()] || <CheckCircle className="h-4 w-4 mr-1 text-primary" />}
                      {amenity}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            {/* House Rules */}
            {houseRules.length > 0 && (
              <div id="house-rules">
                <h3 className="text-xl font-semibold mb-4 text-foreground flex items-center">
                  <ListChecks className="h-5 w-5 mr-2 text-primary" /> House Rules
                </h3>
                <ul className="list-none pl-0 space-y-2 text-sm">
                  {houseRules.map((rule, index) => (
                    <li key={index} className="flex items-center">
                      <CheckCircle className="h-4 w-4 mr-2 text-primary shrink-0" />
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
            )}

             <Separator />

            {/* Check-in / Check-out */}
            <div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Check-in / Check-out</h3>
              <div className="flex gap-4 text-sm">
                 {property.checkInTime && <div className="flex items-center"> <Clock className="h-4 w-4 mr-1 text-primary"/>Check-in: {property.checkInTime}</div>}
                 {property.checkOutTime && <div className="flex items-center"> <Clock className="h-4 w-4 mr-1 text-primary"/>Check-out: {property.checkOutTime}</div>}
              </div>
            </div>

            {/* Cancellation Policy */}
             {property.cancellationPolicy && (
                 <>
                   <Separator />
                   <div>
                     <h3 className="text-xl font-semibold mb-3 text-foreground">Cancellation Policy</h3>
                     <p className="text-sm text-muted-foreground">{property.cancellationPolicy}</p>
                   </div>
                 </>
             )}

             {/* Location Section Placeholder */}
             <Separator />
             <div id="location">
                 <h2 className="text-xl font-semibold mb-4 text-foreground">Location</h2>
                  {property.location && (
                     <p className="text-muted-foreground mb-4">
                        Located in {property.location.city}, {property.location.state}. Exact address provided after booking.
                     </p>
                  )}
                  {/* Placeholder for map */}
                 <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                     <MapPin className="h-12 w-12 text-muted-foreground/50" />
                 </div>
             </div>

              {/* Contact Section Placeholder */}
             <Separator />
             <div id="contact">
                 <h2 className="text-xl font-semibold mb-4 text-foreground">Contact Host</h2>
                  <p className="text-muted-foreground mb-4">
                     Have questions? Reach out to the property owner.
                  </p>
                  {/* TODO: Implement contact functionality or link */}
                  <Button variant="outline">Contact Owner</Button>
             </div>
          </div>

          {/* Right/Sidebar Column: Image Gallery */}
          <div className="lg:w-1/3 space-y-4 lg:sticky lg:top-24 lg:self-start" id="gallery">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Gallery</h2>
            {galleryImages.length > 0 ? (
                 galleryImages.map((image, index) => (
                 <div key={index} className="relative aspect-[4/3] w-full overflow-hidden rounded-lg shadow-md">
                    <Image
                     src={image.url}
                     alt={image.alt || `Gallery image ${index + 1} of ${property.name}`}
                     fill
                     style={{objectFit: "cover"}}
                      data-ai-hint={image['data-ai-hint']}
                    />
                 </div>
                 ))
             ) : (
                // Show featured image if no other gallery images exist
                featuredImage && (
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg shadow-md">
                         <Image
                             src={featuredImage.url}
                             alt={featuredImage.alt || `Featured image of ${property.name}`}
                             fill
                             style={{objectFit: "cover"}}
                              data-ai-hint={featuredImage['data-ai-hint']}
                         />
                     </div>
                 )
             )}
             {/* Placeholder if no images at all */}
             {!featuredImage && galleryImages.length === 0 && (
                 <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg shadow-md bg-muted flex items-center justify-center">
                     <Home className="h-12 w-12 text-muted-foreground/50" />
                 </div>
             )}

          </div>
        </div>
      </main>
      {/* Use Generic Footer */}
      <Footer />
    </div>
  );
}

