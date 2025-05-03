import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Home, Building, Camera, Map, Phone } from 'lucide-react'; // Specific icons

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
          <Link href="/properties/coltei-apartment-bucharest#gallery" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
            Gallery
          </Link>
           <Link href="/properties/coltei-apartment-bucharest#location" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
            Location
          </Link>
           <Link href="/properties/coltei-apartment-bucharest#contact" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
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
              <Link href="/properties/coltei-apartment-bucharest#gallery" className="flex items-center gap-4 px-2.5 text-gray-700 hover:text-blue-700">
                <Camera className="h-5 w-5" />
                Gallery
              </Link>
               <Link href="/properties/coltei-apartment-bucharest#location" className="flex items-center gap-4 px-2.5 text-gray-700 hover:text-blue-700">
                <Map className="h-5 w-5" />
                Location
              </Link>
               <Link href="/properties/coltei-apartment-bucharest#contact" className="flex items-center gap-4 px-2.5 text-gray-700 hover:text-blue-700">
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
