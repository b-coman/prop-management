
import Image from 'next/image';
import type { Property } from '@/types';
import { PrahovaHeader } from './prahova-header'; // Specific header for Prahova
import { PrahovaFooter } from './prahova-footer'; // Specific footer for Prahova
import { BookingForm } from '@/components/booking-form'; // Reusable booking form
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { BedDouble, Bath, Users, Wifi, ParkingCircle, Tv, Utensils, Clock, CheckCircle, MapPin, Home, MountainSnow, Trees } from 'lucide-react'; // Added specific icons

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
    <div className="flex min-h-screen flex-col bg-[#f8f5f2]"> {/* Specific background color */}
      <PrahovaHeader /> {/* Use Prahova specific header */}
      <main className="flex-grow container py-12 md:py-16">
         {/* Optional Hero Section specific to Prahova */}
         <section className="mb-12 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-800 md:text-5xl lg:text-6xl mb-4">
              {property.name}
            </h1>
            <p className="text-lg text-gray-600">
              Your tranquil escape in the heart of the mountains.
            </p>
         </section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-12">
          {/* Left Column: Images & Details */}
          <div className="lg:col-span-2">
             <div className="mb-6 flex items-center text-muted-foreground">
              <MapPin className="h-4 w-4 mr-1 text-green-700" />
              <span>{property.location.city}, {property.location.state}, {property.location.country}</span>
            </div>

             {/* Image Gallery */}
            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              {featuredImage && (
                 <div className="relative aspect-video w-full overflow-hidden rounded-lg shadow-md md:col-span-2">
                  <Image
                    src={featuredImage.url}
                    alt={featuredImage.alt || `Featured image of ${property.name}`}
                    layout="fill"
                    objectFit="cover"
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
                    layout="fill"
                    objectFit="cover"
                     data-ai-hint={image['data-ai-hint']}
                  />
                </div>
              ))}
               {/* Add more placeholders if fewer than 3 images */}
              {Array.from({ length: Math.max(0, 2 - galleryImages.length) }).map((_, i) => (
                <div key={`placeholder-${i}`} className="relative aspect-video w-full overflow-hidden rounded-lg shadow-md bg-muted flex items-center justify-center">
                   <Home className="h-12 w-12 text-muted-foreground/50" />
                </div>
              ))}
            </div>

            <Separator className="my-8 border-gray-300" />

            {/* Property Details */}
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

              <h3 className="text-xl font-semibold mb-3 text-gray-800">House Rules</h3>
              <ul className="list-none pl-0 mb-6 space-y-2 text-sm">
                 {property.houseRules.map((rule, index) => (
                   <li key={index} className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-700 shrink-0" />
                    {rule}
                  </li>
                 ))}
              </ul>

               <h3 className="text-xl font-semibold mb-3 text-gray-800">Check-in / Check-out</h3>
               <div className="flex gap-4 mb-6 text-sm">
                  <div className="flex items-center"> <Clock className="h-4 w-4 mr-1 text-green-700"/>Check-in: {property.checkInTime}</div>
                  <div className="flex items-center"> <Clock className="h-4 w-4 mr-1 text-green-700"/>Check-out: {property.checkOutTime}</div>
               </div>


              <h3 className="text-xl font-semibold mb-3 text-gray-800">Cancellation Policy</h3>
              <p className="text-sm text-muted-foreground">{property.cancellationPolicy}</p>
            </div>
          </div>

          {/* Right Column: Booking Card */}
           <div className="lg:col-span-1">
            <Card id="booking-form" className="sticky top-24 shadow-lg bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-xl">
                   <span className="text-2xl font-bold text-green-800">${property.pricePerNight}</span> / night
                </CardTitle>
                 {/* Basic review placeholder */}
                 <div className="text-sm text-gray-500 mt-1">
                    ⭐ 4.9 (15 reviews) {/* Replace with actual review data */}
                 </div>
              </CardHeader>
              <CardContent>
                 {/* Pass specific styling or props if needed */}
                 <BookingForm property={property} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <PrahovaFooter /> {/* Use Prahova specific footer */}
    </div>
  );
}

    