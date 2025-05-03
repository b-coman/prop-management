
import Image from 'next/image';
import type { Property } from '@/types';
import { PrahovaHeader } from './prahova-header'; // Specific header for Prahova
import { PrahovaFooter } from './prahova-footer'; // Specific footer for Prahova
import { BookingForm } from '@/components/booking-form'; // Reusable booking form
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { BedDouble, Bath, Users, Wifi, ParkingCircle, Tv, Utensils, Clock, CheckCircle, MapPin, Home, MountainSnow, Trees, ListChecks } from 'lucide-react'; // Added ListChecks icon

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
            <div id="gallery" className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
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
                    {/* In a real app, embed Google Maps here */}
                </div>
            </div>

             {/* Contact Section Placeholder */}
            <Separator className="my-8 border-gray-300" />
            <div id="contact" className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-800">Contact Host</h2>
                 <p className="text-muted-foreground mb-4">
                    Have questions? Reach out to the property owner.
                 </p>
                 {/* Placeholder for contact form or details */}
                 <Button variant="outline">Contact Owner</Button>
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
```
  </change>
  <change>
    <file>src/components/property/coltei/coltei-page-layout.tsx</file>
    <description>Add a dedicated 'House Rules' section to the Coltei property page layout, iterating over and displaying the rules from the property data.</description>
    <content><![CDATA[
import Image from 'next/image';
import type { Property } from '@/types';
import { ColteiHeader } from './coltei-header'; // Specific header for Coltei
import { ColteiFooter } from './coltei-footer'; // Specific footer for Coltei
import { BookingForm } from '@/components/booking-form'; // Reusable booking form
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { BedDouble, Bath, Users, Wifi, ParkingCircle, Tv, Utensils, Clock, CheckCircle, MapPin, Home, Building, Wind, ListChecks } from 'lucide-react'; // Added specific icons and ListChecks

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
    'washer/dryer': <CheckCircle className="h-4 w-4 mr-1 text-blue-600" />, // Example specific icon
    elevator: <Building className="h-4 w-4 mr-1" />,
  };

  return (
    <div className="flex min-h-screen flex-col bg-blue-50"> {/* Specific background */}
      <ColteiHeader /> {/* Use Coltei specific header */}
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
                 {/* Placeholder for map */}
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <MapPin className="h-12 w-12 text-muted-foreground/50" />
                    {/* In a real app, embed Google Maps here */}
                </div>
            </div>

             {/* Contact Section Placeholder */}
            <Separator className="my-8 border-blue-200" />
            <div id="contact" className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-blue-900">Contact Host</h2>
                 <p className="text-muted-foreground mb-4">
                    Have questions? Reach out to the property owner.
                 </p>
                 {/* Placeholder for contact form or details */}
                 <Button variant="outline">Contact Owner</Button>
            </div>
          </div>

          {/* Right Column: Booking Card */}
           <div className="lg:col-span-1">
            <Card id="booking-form" className="sticky top-24 shadow-lg bg-white border-blue-100">
              <CardHeader>
                <CardTitle className="text-xl">
                   <span className="text-2xl font-bold text-blue-800">${property.pricePerNight}</span> / night
                </CardTitle>
                 {/* Basic review placeholder */}
                 <div className="text-sm text-gray-500 mt-1">
                    ⭐ 4.7 (21 reviews) {/* Replace with actual review data */}
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
      <ColteiFooter /> {/* Use Coltei specific footer */}
    </div>
  );
}
```
  </change>
  <change>
    <file>src/components/property/prahova/prahova-header.tsx</file>
    <description>Add 'House Rules' link to Prahova header navigation.</description>
    <content><![CDATA[
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Home, MountainSnow, Camera, Map, Phone, ListChecks } from 'lucide-react'; // Specific icons, added ListChecks

export function PrahovaHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 shadow-sm">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/properties/prahova-mountain-chalet" className="flex items-center gap-2">
           {/* Prahova Specific Logo/Icon */}
           <MountainSnow className="h-7 w-7 text-green-700" />
          <span className="text-xl font-bold text-gray-800">Prahova Chalet</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/properties/prahova-mountain-chalet" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
            Home
          </Link>
          <Link href="#gallery" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
            Gallery
          </Link>
           <Link href="#house-rules" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
            Rules
          </Link>
           <Link href="#location" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
            Location
          </Link>
           <Link href="#contact" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
            Contact
          </Link>
           {/* Changed: Wrap Button inside Link */}
           <Link href="#booking-form">
             <Button size="sm" className="bg-green-700 hover:bg-green-800 text-white">
               Book Now
             </Button>
           </Link>
        </nav>

        {/* Mobile Navigation */}
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="outline" size="icon" className="border-gray-300">
              <Menu className="h-5 w-5 text-gray-700" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-white">
             <Link href="/properties/prahova-mountain-chalet" className="flex items-center gap-2 mb-8">
               <MountainSnow className="h-7 w-7 text-green-700" />
               <span className="text-xl font-bold text-gray-800">Prahova Chalet</span>
             </Link>
            <nav className="grid gap-6 text-lg font-medium">
              <Link href="/properties/prahova-mountain-chalet" className="flex items-center gap-4 px-2.5 text-gray-700 hover:text-green-700">
                <Home className="h-5 w-5" />
                Home
              </Link>
              <Link href="#gallery" className="flex items-center gap-4 px-2.5 text-gray-700 hover:text-green-700">
                <Camera className="h-5 w-5" />
                Gallery
              </Link>
               <Link href="#house-rules" className="flex items-center gap-4 px-2.5 text-gray-700 hover:text-green-700">
                 <ListChecks className="h-5 w-5" />
                 Rules
               </Link>
               <Link href="#location" className="flex items-center gap-4 px-2.5 text-gray-700 hover:text-green-700">
                <Map className="h-5 w-5" />
                Location
              </Link>
               <Link href="#contact" className="flex items-center gap-4 px-2.5 text-gray-700 hover:text-green-700">
                <Phone className="h-5 w-5" />
                Contact
              </Link>
               {/* Changed: Wrap Button inside Link */}
              <Link href="#booking-form">
                 <Button size="lg" className="mt-4 bg-green-700 hover:bg-green-800 text-white">
                   Book Now
                 </Button>
              </Link>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
```
  </change>
  <change>
    <file>src/components/property/coltei/coltei-header.tsx</file>
    <description>Add 'House Rules' link to Coltei header navigation.</description>
    <content><![CDATA[
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Home, Building, Camera, Map, Phone, ListChecks } from 'lucide-react'; // Specific icons, added ListChecks

export function ColteiHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 shadow-sm">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/properties/coltei-apartment-bucharest" className="flex items-center gap-2">
           {/* Coltei Specific Logo/Icon */}
           <Building className="h-7 w-7 text-blue-700" />
          <span className="text-xl font-bold text-gray-800">Coltei Apartment</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/properties/coltei-apartment-bucharest" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
            Home
          </Link>
          <Link href="#gallery" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
            Gallery
          </Link>
           <Link href="#house-rules" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
            Rules
          </Link>
           <Link href="#location" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
            Location
          </Link>
           <Link href="#contact" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
            Contact
          </Link>
           {/* Changed: Wrap Button inside Link */}
           <Link href="#booking-form">
             <Button size="sm" className="bg-blue-700 hover:bg-blue-800 text-white">
               Book Now
             </Button>
           </Link>
        </nav>

        {/* Mobile Navigation */}
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="outline" size="icon" className="border-gray-300">
              <Menu className="h-5 w-5 text-gray-700" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-white">
             <Link href="/properties/coltei-apartment-bucharest" className="flex items-center gap-2 mb-8">
                <Building className="h-7 w-7 text-blue-700" />
               <span className="text-xl font-bold text-gray-800">Coltei Apartment</span>
             </Link>
            <nav className="grid gap-6 text-lg font-medium">
              <Link href="/properties/coltei-apartment-bucharest" className="flex items-center gap-4 px-2.5 text-gray-700 hover:text-blue-700">
                <Home className="h-5 w-5" />
                Home
              </Link>
              <Link href="#gallery" className="flex items-center gap-4 px-2.5 text-gray-700 hover:text-blue-700">
                <Camera className="h-5 w-5" />
                Gallery
              </Link>
               <Link href="#house-rules" className="flex items-center gap-4 px-2.5 text-gray-700 hover:text-blue-700">
                 <ListChecks className="h-5 w-5" />
                 Rules
               </Link>
               <Link href="#location" className="flex items-center gap-4 px-2.5 text-gray-700 hover:text-blue-700">
                <Map className="h-5 w-5" />
                Location
              </Link>
               <Link href="#contact" className="flex items-center gap-4 px-2.5 text-gray-700 hover:text-blue-700">
                <Phone className="h-5 w-5" />
                Contact
              </Link>
              {/* Changed: Wrap Button inside Link */}
              <Link href="#booking-form">
                 <Button size="lg" className="mt-4 bg-blue-700 hover:bg-blue-800 text-white">
                   Book Now
                 </Button>
              </Link>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
```
  </change>
  <change>
    <file>src/services/smsService.ts</file>
    <description>Create a new service for sending SMS messages (currently a placeholder).</description>
    <content><![CDATA[
/**
 * @fileoverview Service functions for sending SMS messages.
 * IMPORTANT: This file contains placeholder logic and requires integration with a real SMS provider (e.g., Twilio).
 */
'use server';

import type { Booking } from '@/types';

/**
 * Sends an SMS message.
 * PLACEHOLDER IMPLEMENTATION. Requires actual SMS provider integration.
 *
 * @param phoneNumber The recipient's phone number in E.164 format (e.g., +1234567890).
 * @param message The text message content.
 * @returns A promise that resolves when the SMS sending attempt is complete (or simulated).
 */
export async function sendSms(phoneNumber: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.log(`[SMS Placeholder] Sending SMS to ${phoneNumber}: "${message}"`);

  // --- TODO: Replace with actual SMS provider integration ---
  // Example using Twilio (requires 'twilio' package and configuration):
  //
  // import twilio from 'twilio';
  //
  // const accountSid = process.env.TWILIO_ACCOUNT_SID;
  // const authToken = process.env.TWILIO_AUTH_TOKEN;
  // const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
  //
  // if (!accountSid || !authToken || !twilioPhoneNumber) {
  //   console.error('Twilio environment variables (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER) are not set.');
  //   return { success: false, error: 'SMS service not configured.' };
  // }
  //
  // const client = twilio(accountSid, authToken);
  //
  // try {
  //   const result = await client.messages.create({
  //     body: message,
  //     from: twilioPhoneNumber,
  //     to: phoneNumber,
  //   });
  //   console.log(`[SMS Service] SMS sent successfully. SID: ${result.sid}`);
  //   return { success: true, messageId: result.sid };
  // } catch (error) {
  //   console.error(`[SMS Service] Error sending SMS to ${phoneNumber}:`, error);
  //   return { success: false, error: error instanceof Error ? error.message : 'Unknown SMS error' };
  // }
  // --- End of Twilio Example ---

  // Simulate success for placeholder
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
  console.log(`[SMS Placeholder] SMS sending simulated for ${phoneNumber}.`);
  return { success: true, messageId: `simulated_${Date.now()}` };
}

/**
 * Sends the house rules via SMS to the guest on the day of arrival.
 * This function would typically be triggered by a scheduled task or event listener.
 *
 * @param booking The booking object containing guest and property details.
 * @param houseRules An array of strings representing the house rules.
 * @returns A promise resolving to the result of the sendSms operation.
 */
export async function sendHouseRulesSms(booking: Booking, houseRules: string[]): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const guestPhoneNumber = booking.guestInfo.phone;

  if (!guestPhoneNumber) {
    console.warn(`[SMS Service] No phone number found for booking ${booking.id}. Cannot send house rules.`);
    return { success: false, error: 'Guest phone number missing.' };
  }

  if (!houseRules || houseRules.length === 0) {
    console.warn(`[SMS Service] No house rules provided for booking ${booking.id}. Cannot send SMS.`);
    return { success: false, error: 'House rules missing.' };
  }

  // Format the house rules for the SMS message
  const rulesText = houseRules.map(rule => `- ${rule}`).join('\n');
  const message = `Hi ${booking.guestInfo.firstName},\n\nWelcome! Just a reminder of the house rules for your stay at Property ID ${booking.propertyId}:\n${rulesText}\n\nEnjoy your stay!`;

  // Ensure the message isn't too long for SMS (check provider limits)
  // Basic check (conservative limit)
  if (message.length > 1600) {
    console.warn(`[SMS Service] House rules message for booking ${booking.id} is too long (${message.length} chars). Consider shortening or sending a link.`);
     // Fallback: Send a shorter message with a link (if applicable)
     // message = `Hi ${booking.guestInfo.firstName}, view house rules here: [link]`;
    return { success: false, error: 'Message too long.' };
  }


  return await sendSms(guestPhoneNumber, message);
}

// TODO: Implement a mechanism to trigger `sendHouseRulesSms` on the check-in date.
// This could involve:
// 1. A daily scheduled Cloud Function that queries bookings checking in today.
// 2. Using Firestore triggers and a delay mechanism (e.g., Cloud Tasks).
```
  </change>
  <change>
    <file>package.json</file>
    <description>Add twilio dependency for SMS sending (currently placeholder logic).</description>
    <content><![CDATA[
{
  "name": "nextn",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack -p 9002",
    "genkit:dev": "genkit start -- tsx src/ai/dev.ts",
    "genkit:watch": "genkit start -- tsx --watch src/ai/dev.ts",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@genkit-ai/googleai": "^1.6.2",
    "@genkit-ai/next": "^1.6.2",
    "@hookform/resolvers": "^4.1.3",
    "@radix-ui/react-accordion": "^1.2.3",
    "@radix-ui/react-alert-dialog": "^1.1.6",
    "@radix-ui/react-avatar": "^1.1.3",
    "@radix-ui/react-checkbox": "^1.1.4",
    "@radix-ui/react-dialog": "^1.1.6",
    "@radix-ui/react-dropdown-menu": "^2.1.6",
    "@radix-ui/react-label": "^2.1.2",
    "@radix-ui/react-menubar": "^1.1.6",
    "@radix-ui/react-popover": "^1.1.6",
    "@radix-ui/react-progress": "^1.1.2",
    "@radix-ui/react-radio-group": "^1.2.3",
    "@radix-ui/react-scroll-area": "^1.2.3",
    "@radix-ui/react-select": "^2.1.6",
    "@radix-ui/react-separator": "^1.1.2",
    "@radix-ui/react-slider": "^1.2.3",
    "@radix-ui/react-slot": "^1.1.2",
    "@radix-ui/react-switch": "^1.1.3",
    "@radix-ui/react-tabs": "^1.1.3",
    "@radix-ui/react-toast": "^1.2.6",
    "@radix-ui/react-tooltip": "^1.1.8",
    "@stripe/stripe-js": "^4.5.0",
    "@tanstack-query-firebase/react": "^1.0.5",
    "@tanstack/react-query": "^5.66.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^3.6.0",
    "firebase": "^11.3.0",
    "genkit": "^1.6.2",
    "lucide-react": "^0.475.0",
    "next": "15.2.3",
    "patch-package": "^8.0.0",
    "react": "^18.3.1",
    "react-day-picker": "^8.10.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.54.2",
    "recharts": "^2.15.1",
    "stripe": "^16.10.0",
    "tailwind-merge": "^3.0.1",
    "tailwindcss-animate": "^1.0.7",
    "twilio": "^5.2.2",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "genkit-cli": "^1.6.1",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  }
}
```
  </change>
  <change>
    <file>.env.local</file>
    <description>Add placeholder environment variables for Twilio SMS service.</description>
    <content><![CDATA[
# Firebase Project Configuration (replace with your actual values)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
# NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id # Optional

# Stripe Configuration (replace with your actual keys)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key # Use your actual secret key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key # Use your actual publishable key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret # Use 'stripe listen' CLI for local testing, or get from Stripe dashboard

# Google Generative AI (replace with your actual key if using Genkit/Google AI)
GOOGLE_GENAI_API_KEY=your_google_genai_api_key

# Twilio Configuration (replace with your actual credentials if using Twilio for SMS)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number # Must be E.164 format (e.g., +15551234567)
