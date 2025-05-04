
import Image from 'next/image';
import type { Property } from '@/types';
import { PrahovaHeader } from './prahova-header';
import { PrahovaFooter } from './prahova-footer';
import { InitialBookingForm } from '@/components/booking/initial-booking-form'; // Import the new initial form
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { BedDouble, Bath, Users, Wifi, ParkingCircle, Tv, Utensils, Clock, CheckCircle, MapPin, Home, MountainSnow, Trees, ListChecks } from 'lucide-react';

interface PrahovaPageLayoutProps {
  property: Property;
}

export function PrahovaPageLayout({ property }: PrahovaPageLayoutProps) {
  const featuredImage = property.images.find(img => img.isFeatured) || property.images[0];
  const galleryImages = property.images.filter(img => !img.isFeatured);

  const amenityIcons: { [key: string]: React.ReactNode } = {
    wifi: <Wifi className="h-4 w-4 mr-1" />,
    kitchen: <Utensils className="h-4 w-4 mr-1" />,
    parking: <ParkingCircle className="h-4 w-4 mr-1" />,
    tv: <Tv className="h-4 w-4 mr-1" />,
    fireplace: <Home className="h-4 w-4 mr-1" />, // Consider a fire icon if available
    'mountain view': <MountainSnow className="h-4 w-4 mr-1" />,
    garden: <Trees className="h-4 w-4 mr-1" />,
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f5f2]">
      <PrahovaHeader />

      {/* Hero Section with Overlay Booking Form */}
      <section className="relative h-[60vh] md:h-[70vh] w-full">
         {featuredImage && (
          <Image
            src={featuredImage.url}
            alt={featuredImage.alt || `Featured image of ${property.name}`}
            fill
            style={{objectFit: "cover"}}
            priority
            className="brightness-75" // Add slight dimming
            data-ai-hint={featuredImage['data-ai-hint']}
          />
         )}
         <div className="absolute inset-0 flex items-center justify-center">
          <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm shadow-xl border-gray-200 p-4 md:p-6 mx-4"> {/* Adjusted padding and max-width */}
              <CardHeader className="p-0 mb-4"> {/* Removed default padding */}
                <CardTitle className="text-xl text-center mb-1">
                  <span className="text-2xl font-bold text-green-800">${property.pricePerNight}</span> / night
                </CardTitle>
                 <div className="text-sm text-gray-500 text-center">
                    ⭐ {property.ratings?.average || 'N/A'} ({property.ratings?.count || 0} reviews)
                 </div>
              </CardHeader>
              <CardContent className="p-0"> {/* Removed default padding */}
                 <InitialBookingForm property={property} />
              </CardContent>
            </Card>
         </div>
      </section>

      {/* Main Content - Below the Hero */}
      <main className="flex-grow container py-12 md:py-16">
          {/* Removed the top title section */}
         {/* <section className="mb-12 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-800 md:text-5xl lg:text-6xl mb-4">
              {property.name}
            </h1>
            <p className="text-lg text-gray-600">
              Your tranquil escape in the heart of the mountains.
            </p>
         </section> */}

          <div className="mb-6 flex items-center text-muted-foreground">
            <MapPin className="h-4 w-4 mr-1 text-green-700" />
            <span>{property.location.city}, {property.location.state}, {property.location.country}</span>
          </div>

          {/* Content Grid (Details & Images) */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-12">

             {/* Left Column: Property Details */}
             <div className="lg:col-span-2">

                 <div className="prose max-w-none dark:prose-invert text-gray-700">
                  <h2 className="text-2xl font-semibold mb-4 text-gray-800">About this Chalet</h2>
                  <p className="mb-6">{property.description}</p>

                   <h3 className="text-xl font-semibold mb-3 text-gray-800">Key Features</h3>
                  <div className="grid grid-cols-2 gap-4 mb-6 text-sm md:grid-cols-3">
                    <div className="flex items-center"><Users className="h-4 w-4 mr-2 text-green-700" /> Max {property.maxGuests} Guests</div>
                    <div className="flex items-center"><BedDouble className="h-4 w-4 mr-2 text-green-700" /> {property.bedrooms} Bedrooms</div>
                    <div className="flex items-center"><BedDouble className="h-4 w-4 mr-2 text-green-700" /> {property.beds} Beds</div>
                    <div className="flex items-center"><Bath className="h-4 w-4 mr-2 text-green-700" /> {property.bathrooms} Bathrooms</div>
                    <div className="flex items-center"><Home className="h-4 w-4 mr-2 text-green-700" /> {property.squareFeet} sqm</div>
                  </div>

                   <h3 className="text-xl font-semibold mb-3 text-gray-800">Amenities</h3>
                  <ul className="grid grid-cols-2 gap-2 mb-6 text-sm list-none pl-0 md:grid-cols-3">
                    {property.amenities.map((amenity) => (
                      <li key={amenity} className="flex items-center">
                         {amenityIcons[amenity.toLowerCase()] || <CheckCircle className="h-4 w-4 mr-1 text-green-600" />}
                        {amenity}
                      </li>
                    ))}
                  </ul>

                   <Separator className="my-6 border-gray-300" />

                   {/* House Rules Section */}
                  <div id="house-rules" className="mb-8">
                    <h3 className="text-xl font-semibold mb-3 text-gray-800 flex items-center">
                      <ListChecks className="h-5 w-5 mr-2 text-green-700" /> House Rules
                    </h3>
                    <ul className="list-none pl-0 space-y-2 text-sm">
                      {property.houseRules.map((rule, index) => (
                        <li key={index} className="flex items-center">
                          <CheckCircle className="h-4 w-4 mr-2 text-green-700 shrink-0" />
                          {rule}
                        </li>
                      ))}
                    </ul>
                  </div>

                   <Separator className="my-6 border-gray-300" />

                    <h3 className="text-xl font-semibold mb-3 text-gray-800">Check-in / Check-out</h3>
                   <div className="flex gap-4 mb-6 text-sm">
                      <div className="flex items-center"> <Clock className="h-4 w-4 mr-1 text-green-700"/>Check-in: {property.checkInTime}</div>
                      <div className="flex items-center"> <Clock className="h-4 w-4 mr-1 text-green-700"/>Check-out: {property.checkOutTime}</div>
                   </div>


                   <h3 className="text-xl font-semibold mb-3 text-gray-800">Cancellation Policy</h3>
                  <p className="text-sm text-muted-foreground">{property.cancellationPolicy}</p>
                </div>

                 {/* Location Section Placeholder */}
                <Separator className="my-8 border-gray-300" />
                <div id="location" className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4 text-gray-800">Location</h2>
                     <p className="text-muted-foreground mb-4">
                        Located in {property.location.city}, {property.location.state}. Exact address provided after booking.
                     </p>
                     {/* Placeholder for map */}
                    <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                        <MapPin className="h-12 w-12 text-muted-foreground/50" />
                    </div>
                </div>

                  {/* Contact Section Placeholder */}
                <Separator className="my-8 border-gray-300" />
                <div id="contact" className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4 text-gray-800">Contact Host</h2>
                     <p className="text-muted-foreground mb-4">
                        Have questions? Reach out to the property owner.
                     </p>
                     <Button variant="outline">Contact Owner</Button>
                </div>

             </div>

             {/* Right Column: Image Gallery */}
             <div className="lg:col-span-1 space-y-4" id="gallery">
                 <h2 className="text-2xl font-semibold text-gray-800 mb-0">Gallery</h2>
                 {galleryImages.map((image, index) => (
                  <div key={index} className="relative aspect-[4/3] w-full overflow-hidden rounded-lg shadow-md"> {/* Adjusted aspect ratio */}
                    <Image
                      src={image.url}
                      alt={image.alt || `Gallery image ${index + 1} of ${property.name}`}
                      fill
                      style={{objectFit: "cover"}}
                       data-ai-hint={image['data-ai-hint']}
                    />
                  </div>
                ))}
                 {/* Add more placeholders if fewer than required */}
                {Array.from({ length: Math.max(0, 3 - galleryImages.length) }).map((_, i) => (
                  <div key={`placeholder-${i}`} className="relative aspect-[4/3] w-full overflow-hidden rounded-lg shadow-md bg-muted flex items-center justify-center">
                     <Home className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                ))}
             </div>

          </div>
      </main>
      <PrahovaFooter />
    </div>
  );
}
