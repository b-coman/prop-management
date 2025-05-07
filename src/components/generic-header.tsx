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
    setHasMounted(true); // Indicate component has mounted for client-side rendering
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  // Define base classes
  const headerBaseClasses = "fixed top-0 left-0 z-50 w-full transition-all duration-300 ease-in-out";

  // Define classes for scrolled state
  const scrolledHeaderClasses = "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b";
  const scrolledTextAndIconColorClasses = "text-primary";
  const scrolledSpanColorClasses = "text-foreground";
  const scrolledNavLinkColorClasses = "text-muted-foreground hover:text-foreground";
  const scrolledButtonVariant = "default" as const;
  const scrolledButtonExtraClasses = "";
  const scrolledMobileTriggerColorClasses = "text-foreground hover:bg-accent";

  // Define classes for initial (unscrolled) state
  const initialHeaderClasses = "bg-black/50"; // Semi-transparent black background initially
  const initialTextAndIconColorClasses = "text-white";
  const initialSpanColorClasses = "text-white";
  const initialNavLinkColorClasses = "text-white/80 hover:text-white";
  const initialButtonVariant = "secondary" as const;
  const initialButtonExtraClasses = "text-primary bg-white hover:bg-gray-100";
  const initialMobileTriggerColorClasses = "text-white hover:bg-white/10";

  // Dynamically determine classes based on scroll state and mount state
  const currentHeaderClasses = cn(
    headerBaseClasses,
    hasMounted && isScrolled ? scrolledHeaderClasses : initialHeaderClasses
  );
  const textAndIconColorClasses = hasMounted && isScrolled ? scrolledTextAndIconColorClasses : initialTextAndIconColorClasses;
  const spanColorClasses = hasMounted && isScrolled ? scrolledSpanColorClasses : initialSpanColorClasses;
  const navLinkColorClasses = hasMounted && isScrolled ? scrolledNavLinkColorClasses : initialNavLinkColorClasses;
  const buttonVariant = hasMounted && isScrolled ? scrolledButtonVariant : initialButtonVariant;
  const buttonExtraClasses = hasMounted && isScrolled ? scrolledButtonExtraClasses : initialButtonExtraClasses;
  const mobileTriggerColorClasses = hasMounted && isScrolled ? scrolledMobileTriggerColorClasses : initialMobileTriggerColorClasses;

  // Dynamic styles for currency switcher based on scroll state
  const currencySwitcherClasses = cn(
    "border-white/20 hover:bg-white/10 data-[state=open]:bg-black/50 focus:ring-white/50", // Base classes for transparency
    hasMounted && isScrolled ? "text-muted-foreground hover:text-foreground border-border hover:bg-accent/10 data-[state=open]:bg-accent/20 focus:ring-ring" : "text-white/80 hover:text-white" // Scrolled state uses theme colors
  );


  return (
    <header className={currentHeaderClasses}>
      {/* Use container class for max-width and centering, and add padding */}
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
         {/* Link back to the specific property page */}
        <Link href={basePath} className="flex items-center gap-2">
           {/* Placeholder SVG for logo or property-specific logo */}
           {/* Change text color based on scroll state */}
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("h-6 w-6", textAndIconColorClasses)}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span className={cn("text-lg font-semibold", spanColorClasses)}>{propertyName}</span>
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
          <CurrencySwitcher className={currencySwitcherClasses} />
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
              className={cn("md:hidden", mobileTriggerColorClasses)} // Apply dynamic color to trigger
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
