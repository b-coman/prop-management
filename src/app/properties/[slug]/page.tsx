import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar'; // Import Calendar
import { Input } from '@/components/ui/input'; // Import Input for guest count
import { Label } from '@/components/ui/label'; // Import Label
import { placeholderProperties } from '@/data/properties'; // Using placeholder data
import type { Property } from '@/types';
import { BedDouble, Bath, Users, Wifi, ParkingCircle, Tv, Utensils, Clock, XCircle, CheckCircle, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { BookingForm } from '@/components/booking-form'; // Import BookingForm

// Generate static paths for properties if needed (optional)
// export async function generateStaticParams() {
//   // Fetch all property slugs
//   const properties = placeholderProperties; // Replace with actual data fetching
//   return properties.map((property) => ({
//     slug: property.slug,
//   }));
// }

// Function to get property data by slug (replace with actual data fetching)
async function getPropertyBySlug(slug: string): Promise<Property | undefined> {
  // In a real app, fetch from Firestore based on the slug
  await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network delay
  return placeholderProperties.find((p) => p.slug === slug);
}

interface PropertyDetailsPageProps {
  params: { slug: string };
}

export default async function PropertyDetailsPage({ params }: PropertyDetailsPageProps) {
  const property = await getPropertyBySlug(params.slug);

  if (!property) {
    notFound();
  }

  const featuredImage = property.images.find(img => img.isFeatured) || property.images[0];
  const galleryImages = property.images.filter(img => !img.isFeatured);

   const amenityIcons: { [key: string]: React.ReactNode } = {
    wifi: <Wifi className="h-4 w-4 mr-1" />,
    kitchen: <Utensils className="h-4 w-4 mr-1" />,
    parking: <ParkingCircle className="h-4 w-4 mr-1" />,
    tv: <Tv className="h-4 w-4 mr-1" />,
    'beach access': <CheckCircle className="h-4 w-4 mr-1 text-green-500" />, // Example specific icon
    fireplace: <Home className="h-4 w-4 mr-1" />, // Using Home as placeholder
    'hot tub': <Bath className="h-4 w-4 mr-1" />, // Using Bath as placeholder
    'ski access': <CheckCircle className="h-4 w-4 mr-1 text-green-500" />, // Example specific icon
    'washer/dryer': <CheckCircle className="h-4 w-4 mr-1 text-green-500" />, // Example specific icon
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-grow container py-12 md:py-16">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-12">
          {/* Left Column: Images & Details */}
          <div className="lg:col-span-2">
            <h1 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">{property.name}</h1>
             <div className="mb-6 flex items-center text-muted-foreground">
              <MapPin className="h-4 w-4 mr-1" />
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
                    data-ai-hint="vacation rental main image"
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
                    data-ai-hint="vacation rental interior exterior"
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

            <Separator className="my-8" />

            {/* Property Details */}
            <div className="prose max-w-none dark:prose-invert">
              <h2 className="text-2xl font-semibold mb-4">About this property</h2>
              <p className="mb-6">{property.description}</p>

              <h3 className="text-xl font-semibold mb-3">Key Features</h3>
              <div className="grid grid-cols-2 gap-4 mb-6 text-sm md:grid-cols-3">
                <div className="flex items-center"><Users className="h-4 w-4 mr-2 text-primary" /> Max {property.maxGuests} Guests</div>
                <div className="flex items-center"><BedDouble className="h-4 w-4 mr-2 text-primary" /> {property.bedrooms} Bedrooms</div>
                <div className="flex items-center"><BedDouble className="h-4 w-4 mr-2 text-primary" /> {property.beds} Beds</div>
                <div className="flex items-center"><Bath className="h-4 w-4 mr-2 text-primary" /> {property.bathrooms} Bathrooms</div>
                <div className="flex items-center"><Home className="h-4 w-4 mr-2 text-primary" /> {property.squareFeet} sq ft</div>
              </div>

              <h3 className="text-xl font-semibold mb-3">Amenities</h3>
              <ul className="grid grid-cols-2 gap-2 mb-6 text-sm list-none pl-0 md:grid-cols-3">
                {property.amenities.map((amenity) => (
                  <li key={amenity} className="flex items-center">
                     {amenityIcons[amenity.toLowerCase()] || <CheckCircle className="h-4 w-4 mr-1 text-green-500" />}
                    {amenity}
                  </li>
                ))}
              </ul>

               <Separator className="my-6" />

              <h3 className="text-xl font-semibold mb-3">House Rules</h3>
              <ul className="list-none pl-0 mb-6 space-y-2 text-sm">
                 {property.houseRules.map((rule, index) => (
                   <li key={index} className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-primary shrink-0" />
                    {rule}
                  </li>
                 ))}
              </ul>

               <h3 className="text-xl font-semibold mb-3">Check-in / Check-out</h3>
               <div className="flex gap-4 mb-6 text-sm">
                  <div className="flex items-center"> <Clock className="h-4 w-4 mr-1 text-primary"/>Check-in: {property.checkInTime}</div>
                  <div className="flex items-center"> <Clock className="h-4 w-4 mr-1 text-primary"/>Check-out: {property.checkOutTime}</div>
               </div>


              <h3 className="text-xl font-semibold mb-3">Cancellation Policy</h3>
              <p className="text-sm text-muted-foreground">{property.cancellationPolicy}</p>
            </div>
          </div>

          {/* Right Column: Booking Card */}
           <div className="lg:col-span-1">
            <Card className="sticky top-24 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl">
                   <span className="text-2xl font-bold text-primary">${property.pricePerNight}</span> / night
                </CardTitle>
                 {/* Basic review placeholder */}
                 <div className="text-sm text-muted-foreground mt-1">
                    ⭐ 4.8 (12 reviews) {/* Replace with actual review data */}
                 </div>
              </CardHeader>
              <CardContent>
                 <BookingForm property={property} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
