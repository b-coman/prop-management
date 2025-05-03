import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Home, Info, User } from 'lucide-react'; // Adjusted icons

export function Header() {
  // This header might become very minimal if each property page has its own navigation.
  // Or it could be a global header with links to properties, login, etc.
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
           {/* Placeholder SVG for logo or use a global logo */}
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          {/* Use a global brand name or remove if property pages handle branding */}
          <span className="text-xl font-bold text-primary">RentalSpot</span>
        </Link>

        {/* Desktop Navigation - Simplified */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/" className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground">
            Home
          </Link>
           {/* Link directly to properties */}
           <Link href="/properties/prahova-mountain-chalet" className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground">
             Prahova Chalet
           </Link>
           <Link href="/properties/coltei-apartment-bucharest" className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground">
             Coltei Apartment
           </Link>
          {/* Add other global links like About, Contact, Login */}
          {/* <Link href="/about" className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground">
            About
          </Link> */}
           {/* Changed: Wrap Button inside Link */}
           {/* <Link href="/login">
             <Button variant="outline">
               Login
             </Button>
           </Link> */}
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
             {/* Keep global branding in mobile menu */}
             <Link href="/" className="flex items-center gap-2 mb-8">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
               </svg>
               <span className="text-xl font-bold text-primary">RentalSpot</span>
            </Link>
            <nav className="grid gap-6 text-lg font-medium">
              <Link href="/" className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground">
                <Home className="h-5 w-5" />
                Home
              </Link>
               <Link href="/properties/prahova-mountain-chalet" className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground">
                 {/* Use a relevant icon */}
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                 Prahova Chalet
               </Link>
               <Link href="/properties/coltei-apartment-bucharest" className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground">
                 {/* Use a relevant icon */}
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3-1-3l-4-4-4 4s-1 1-1 3a7 7 0 0 0 7 7Z"/><path d="M10.76 14.55a.5.5 0 0 0 .74.71l1.09-1.04a.5.5 0 1 0-.7-.74l-1.04 1.09ZM12.5 16.5a.5.5 0 0 0 .5.5h.5a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5h-.5a.5.5 0 0 0-.5.5Zm3.79-1.91a.5.5 0 0 0 .71-.7l-1.04-1.09a.5.5 0 1 0-.74.7l1.09 1.04Z"/></svg>
                 Coltei Apartment
               </Link>
              {/* Add other global links */}
              {/* <Link href="/about" className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground">
                <Info className="h-5 w-5" />
                About
              </Link> */}
              {/* <Link href="/login" className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground">
                <User className="h-5 w-5" />
                Login
              </Link> */}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
