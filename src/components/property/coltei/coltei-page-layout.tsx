
import Image from 'next/image';
import type { Property } from '@/types';
import { ColteiHeader } from './coltei-header';
import { ColteiFooter } from './coltei-footer';
import { InitialBookingForm } from '@/components/booking/initial-booking-form'; // Import the new initial form
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { BedDouble, Bath, Users, Wifi, ParkingCircle, Tv, Utensils, Clock, CheckCircle, MapPin, Home, Building, Wind, ListChecks } from 'lucide-react';

interface ColteiPageLayoutProps {
  property: Property;
}

export function ColteiPageLayout({ property }: ColteiPageLayoutProps) {
  const featuredImage = property.images.find(img => img.isFeatured) || property.images[0];
  const galleryImages = property.images.filter(img => !img.isFeatured);

  const amenityIcons: { [key: string]: React.ReactNode } = {
    wifi: <Wifi className="h-4 w-4 mr-1" />,
    kitchen: <Utensils className="h-4 w-4 mr-1" />,
    tv: <Tv className="h-4 w-4 mr-1" />,
    'air conditioning': <Wind className="h-4 w-4 mr-1" />,
    'washer/dryer': <CheckCircle className="h-4 w-4 mr-1 text-blue-600" />,
    elevator: <Building className="h-4 w-4 mr-1" />,
  };

  return (
    <div className="flex min-h-screen flex-col bg-blue-50">
      <ColteiHeader />
      <main className="flex-grow container py-12 md:py-16">
        {/* Optional Hero Section specific to Coltei */}
         <section className="mb-12 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-blue-900 md:text-5xl lg:text-6xl mb-4">
              {property.name}
            </h1>
            <p className="text-lg text-blue-700">
              Your modern & central base to explore Bucharest.
            </p>
         </section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-12">
          {/* Left Column: Images & Details */}
          <div className="lg:col-span-2">
             <div className="mb-6 flex items-center text-muted-foreground">
              <MapPin className="h-4 w-4 mr-1 text-blue-700" />
              <span>{property.location.city}, {property.location.state}, {property.location.country}</span>
            </div>

             {/* Image Gallery */}
            <div id="gallery" className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              {featuredImage && (
                 <div className="relative aspect-video w-full overflow-hidden rounded-lg shadow-md md:col-span-2">
                  <Image
                    src={featuredImage.url}
                    alt={featuredImage.alt || `Featured image of ${property.name}`}
                    fill
                    style={{objectFit: "cover"}}
                    priority
                    data-ai-hint={featuredImage['data-ai-hint']}
                  />
                </div>
              )}
              {galleryImages.map((image, index) => (
                <div key={index} className="relative aspect-video w-full overflow-hidden rounded-lg shadow-md">
                  <Image
                    src={image.url}
                    alt={image.alt || `Gallery image ${index + 1} of ${property.name}`}
                    fill
                    style={{objectFit: "cover"}}
                     data-ai-hint={image['data-ai-hint']}
                  />
                </div>
              ))}
               {/* Add more placeholders if fewer than 3 images */}
              {Array.from({ length: Math.max(0, 2 - galleryImages.length) }).map((_, i) => (
                <div key={`placeholder-${i}`} className="relative aspect-video w-full overflow-hidden rounded-lg shadow-md bg-muted flex items-center justify-center">
                   <Building className="h-12 w-12 text-muted-foreground/50" />
                </div>
              ))}
            </div>

            <Separator className="my-8 border-blue-200" />

            {/* Property Details */}
            <div className="prose max-w-none dark:prose-invert text-gray-700">
              <h2 className="text-2xl font-semibold mb-4 text-blue-900">About this Apartment</h2>
              <p className="mb-6">{property.description}</p>

              <h3 className="text-xl font-semibold mb-3 text-blue-900">Key Features</h3>
              <div className="grid grid-cols-2 gap-4 mb-6 text-sm md:grid-cols-3">
                <div className="flex items-center"><Users className="h-4 w-4 mr-2 text-blue-700" /> Max {property.maxGuests} Guests</div>
                <div className="flex items-center"><BedDouble className="h-4 w-4 mr-2 text-blue-700" /> {property.bedrooms} Bedrooms</div>
                <div className="flex items-center"><BedDouble className="h-4 w-4 mr-2 text-blue-700" /> {property.beds} Beds</div>
                <div className="flex items-center"><Bath className="h-4 w-4 mr-2 text-blue-700" /> {property.bathrooms} Bathrooms</div>
                <div className="flex items-center"><Home className="h-4 w-4 mr-2 text-blue-700" /> {property.squareFeet} sqm</div>
              </div>

              <h3 className="text-xl font-semibold mb-3 text-blue-900">Amenities</h3>
              <ul className="grid grid-cols-2 gap-2 mb-6 text-sm list-none pl-0 md:grid-cols-3">
                {property.amenities.map((amenity) => (
                  <li key={amenity} className="flex items-center">
                     {amenityIcons[amenity.toLowerCase()] || <CheckCircle className="h-4 w-4 mr-1 text-blue-600" />}
                    {amenity}
                  </li>
                ))}
              </ul>

               <Separator className="my-6 border-blue-200" />

               {/* House Rules Section */}
               <div id="house-rules" className="mb-8">
                  <h3 className="text-xl font-semibold mb-3 text-blue-900 flex items-center">
                     <ListChecks className="h-5 w-5 mr-2 text-blue-700" /> House Rules
                  </h3>
                  <ul className="list-none pl-0 space-y-2 text-sm">
                    {property.houseRules.map((rule, index) => (
                      <li key={index} className="flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2 text-blue-700 shrink-0" />
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>

               <Separator className="my-6 border-blue-200" />

               <h3 className="text-xl font-semibold mb-3 text-blue-900">Check-in / Check-out</h3>
               <div className="flex gap-4 mb-6 text-sm">
                  <div className="flex items-center"> <Clock className="h-4 w-4 mr-1 text-blue-700"/>Check-in: {property.checkInTime}</div>
                  <div className="flex items-center"> <Clock className="h-4 w-4 mr-1 text-blue-700"/>Check-out: {property.checkOutTime}</div>
               </div>


              <h3 className="text-xl font-semibold mb-3 text-blue-900">Cancellation Policy</h3>
              <p className="text-sm text-muted-foreground">{property.cancellationPolicy}</p>
            </div>

             {/* Location Section Placeholder */}
            <Separator className="my-8 border-blue-200" />
            <div id="location" className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-blue-900">Location</h2>
                 <p className="text-muted-foreground mb-4">
                    Located in {property.location.city}, {property.location.state}. Exact address provided after booking.
                 </p>
                 <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <MapPin className="h-12 w-12 text-muted-foreground/50" />
                </div>
            </div>

             {/* Contact Section Placeholder */}
            <Separator className="my-8 border-blue-200" />
            <div id="contact" className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-blue-900">Contact Host</h2>
                 <p className="text-muted-foreground mb-4">
                    Have questions? Reach out to the property owner.
                 </p>
                 <Button variant="outline">Contact Owner</Button>
            </div>
          </div>

          {/* Right Column: Booking Card - Now uses InitialBookingForm */}
           <div className="lg:col-span-1">
            <Card id="booking-form" className="sticky top-24 shadow-lg bg-white border-blue-100">
              <CardHeader>
                <CardTitle className="text-xl">
                   <span className="text-2xl font-bold text-blue-800">${property.pricePerNight}</span> / night
                </CardTitle>
                 <div className="text-sm text-gray-500 mt-1">
                    ⭐ {property.ratings?.average || 'N/A'} ({property.ratings?.count || 0} reviews)
                 </div>
              </CardHeader>
              <CardContent>
                 <InitialBookingForm property={property} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <ColteiFooter />
    </div>
  );
}
