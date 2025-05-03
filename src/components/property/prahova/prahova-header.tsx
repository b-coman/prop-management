
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
    <file>src