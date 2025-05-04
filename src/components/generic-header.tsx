
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Home, MapPin, Image as ImageIcon, ListChecks } from 'lucide-react'; // Adjusted icons

interface HeaderProps {
  propertyName: string;
  propertySlug: string;
}

export function Header({ propertyName, propertySlug }: HeaderProps) {
  const basePath = `/properties/${propertySlug}`;

  // Define menu items specific to the property page layout
  const menuItems = [
    { href: '#experience', label: 'Experience', icon: Home }, // Assuming section IDs exist
    { href: '#features', label: 'Features', icon: ImageIcon },
    { href: '#location', label: 'Location', icon: MapPin },
    { href: '#house-rules', label: 'Rules', icon: ListChecks },
    // Add more relevant links for the property page
  ];


  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
         {/* Link back to the specific property page (or homepage?) */}
        <Link href={basePath} className="flex items-center gap-2">
           {/* Placeholder SVG for logo or property-specific logo */}
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span className="text-lg font-semibold text-primary">{propertyName}</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 md:flex">
           {menuItems.map(item => (
             <Link
               key={item.label}
               href={item.href} // Use section IDs directly
               className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
             >
               {item.label}
             </Link>
           ))}
           {/* Add other relevant actions like "Book Now" */}
            <Link href={`${basePath}#booking-form`} passHref> {/* Adjust target ID if needed */}
             <Button size="sm">Book Now</Button>
           </Link>
        </nav>

        {/* Mobile Navigation */}
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
             {/* Property Name in mobile menu */}
             <Link href={basePath} className="flex items-center gap-2 mb-8">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
               </svg>
               <span className="text-xl font-bold text-primary">{propertyName}</span>
            </Link>
            <nav className="grid gap-6 text-lg font-medium">
               {menuItems.map(item => {
                 const Icon = item.icon;
                 return (
                   <Link
                     key={item.label}
                     href={item.href}
                     className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                   >
                     <Icon className="h-5 w-5" />
                     {item.label}
                   </Link>
                 );
               })}
               {/* Add other links like Home if needed */}
                {/* <Link href="/" className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground">
                 <Home className="h-5 w-5" />
                 Home
                </Link> */}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
