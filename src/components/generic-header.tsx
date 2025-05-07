// src/components/generic-header.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Home, MapPin, Image as ImageIcon, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CurrencySwitcher } from '@/components/currency-switcher'; // Import CurrencySwitcher

interface HeaderProps {
  propertyName: string;
  propertySlug: string;
}

export function Header({ propertyName, propertySlug }: HeaderProps) {
  const basePath = `/properties/${propertySlug}`;
  const [isScrolled, setIsScrolled] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  const menuItems = [
    { href: '#experience', label: 'Experience', icon: Home },
    { href: '#features', label: 'Features', icon: ImageIcon },
    { href: '#location', label: 'Location', icon: MapPin },
    { href: '#rules', label: 'Rules', icon: ListChecks },
  ];

  useEffect(() => {
    setHasMounted(true);
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const headerBaseClasses = "fixed top-0 left-0 z-50 w-full transition-all duration-300 ease-in-out";
  const scrolledHeaderClasses = "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b";
  const initialHeaderClasses = "bg-black/50";

  // Define text/icon color classes based on scroll state
  const textAndIconColorClasses = hasMounted && isScrolled ? "text-primary" : "text-white";
  const spanColorClasses = hasMounted && isScrolled ? "text-foreground" : "text-white";
  const navLinkColorClasses = hasMounted && isScrolled ? "text-muted-foreground hover:text-foreground" : "text-white/80 hover:text-white";
  const buttonVariant = hasMounted && isScrolled ? "default" as const : "secondary" as const;
  const buttonExtraClasses = hasMounted && !isScrolled ? "text-primary bg-white hover:bg-gray-100" : "";
  const mobileTriggerColorClasses = hasMounted && isScrolled ? "text-foreground hover:bg-accent" : "text-white hover:bg-white/10";

  const currentHeaderClasses = cn(headerBaseClasses, hasMounted && isScrolled ? scrolledHeaderClasses : initialHeaderClasses);

  return (
    <header className={currentHeaderClasses}>
      {/* Add container for padding */}
      <div className="container flex h-16 items-center justify-between">
         {/* Link back to the specific property page */}
        <Link href={basePath} className="flex items-center gap-2">
           {/* Placeholder SVG for logo or property-specific logo */}
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("h-6 w-6 transition-colors", textAndIconColorClasses)}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span className={cn("text-lg font-semibold transition-colors", spanColorClasses)}>{propertyName}</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="ml-auto hidden items-center gap-4 md:flex">
          {menuItems.map(item => (
            <Link
              key={item.label}
              href={item.href} // Use section ID for internal page links
              className={cn("text-sm font-medium transition-colors", navLinkColorClasses)}
            >
              {item.label}
            </Link>
          ))}
          {/* Pass dynamic text color class to CurrencySwitcher */}
          <CurrencySwitcher className={cn(navLinkColorClasses, "border-white/20 hover:bg-white/10 data-[state=open]:bg-black/50")} />
          <Link href={`${basePath}#booking`} passHref>
            <Button
              size="sm"
              variant={buttonVariant}
              className={cn(buttonExtraClasses)}
            >
              Book Now
            </Button>
          </Link>
        </nav>

        {/* Mobile Navigation Sheet */}
        <Sheet>
          <SheetTrigger asChild>
             <Button
              variant="ghost"
              size="icon"
              className={cn("md:hidden transition-colors", mobileTriggerColorClasses)} // Apply dynamic color to trigger
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-background text-foreground">
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
                    href={item.href} // Use section ID for internal page links
                    className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
               {/* Mobile currency switcher - Styling here might need less dynamic changes */}
               <div className="px-2.5">
                 <CurrencySwitcher className="text-muted-foreground border-border hover:bg-accent/10 data-[state=open]:bg-accent/20"/>
               </div>
            </nav>
            <div className="mt-8">
              <Link href={`${basePath}#booking`} passHref>
                <Button className="w-full">Book Now</Button>
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}