import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Home, BedDouble, Info } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
           {/* Placeholder SVG for logo */}
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span className="text-xl font-bold text-primary">RentalSpot</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/" className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground">
            Home
          </Link>
          <Link href="/properties" className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground">
            Properties
          </Link>
          <Link href="/about" className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground">
            About
          </Link>
           <Button asChild>
             <Link href="/#book-now">Book Now</Link>
           </Button>
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
            <nav className="grid gap-6 text-lg font-medium mt-8">
              <Link href="/" className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground">
                <Home className="h-5 w-5" />
                Home
              </Link>
              <Link href="/properties" className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground">
                <BedDouble className="h-5 w-5" />
                Properties
              </Link>
              <Link href="/about" className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground">
                <Info className="h-5 w-5" />
                About
              </Link>
              <Button asChild size="lg" className="mt-4">
                 <Link href="/#book-now">Book Now</Link>
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
