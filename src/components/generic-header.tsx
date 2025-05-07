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
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const headerBaseClasses = "fixed top-0 left-0 z-50 w-full transition-all duration-300 ease-in-out";
  const scrolledHeaderClasses = "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b";
  const initialHeaderClasses = "bg-black/50"; // Solid semi-transparent black

  const textAndIconBaseClasses = "transition-colors";
  const scrolledTextAndIconClasses = "text-primary";
  const initialTextAndIconClasses = "text-white";
  
  const spanBaseClasses = "text-lg font-semibold transition-colors";
  const scrolledSpanClasses = "text-foreground";
  const initialSpanClasses = "text-white";

  const navLinkBaseClasses = "text-sm font-medium transition-colors";
  const scrolledNavLinkClasses = "text-muted-foreground hover:text-foreground";
  const initialNavLinkClasses = "text-white/80 hover:text-white";

  const buttonBaseClasses = ""; // Base classes for button if any
  const scrolledButtonVariant = "default" as const;
  const initialButtonVariant = "secondary" as const;
  const initialButtonExtraClasses = "text-primary bg-white hover:bg-gray-100";


  const mobileTriggerBaseClasses = "md:hidden transition-colors";
  const scrolledMobileTriggerClasses = "text-foreground hover:bg-accent";
  const initialMobileTriggerClasses = "text-white hover:bg-white/10";

  // Determine classes based on mounted and scrolled state
  const currentHeaderClasses = cn(headerBaseClasses, hasMounted && isScrolled ? scrolledHeaderClasses : initialHeaderClasses);
  const currentTextAndIconClasses = cn(textAndIconBaseClasses, hasMounted && isScrolled ? scrolledTextAndIconClasses : initialTextAndIconClasses);
  const currentSpanClasses = cn(spanBaseClasses, hasMounted && isScrolled ? scrolledSpanClasses : initialSpanClasses);
  const currentNavLinkClasses = cn(navLinkBaseClasses, hasMounted && isScrolled ? scrolledNavLinkClasses : initialNavLinkClasses);
  const currentButtonVariant = hasMounted && isScrolled ? scrolledButtonVariant : initialButtonVariant;
  const currentButtonClasses = cn(buttonBaseClasses, hasMounted && !isScrolled ? initialButtonExtraClasses : "");
  const currentMobileTriggerClasses = cn(mobileTriggerBaseClasses, hasMounted && isScrolled ? scrolledMobileTriggerClasses : initialMobileTriggerClasses);


  return (
    <header className={currentHeaderClasses}>
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
         {/* Link back to the specific property page */}
        <Link href={basePath} className="flex items-center gap-2">
           {/* Placeholder SVG for logo or property-specific logo */}
           {/* Change text color based on scroll state */}
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("h-6 w-6", currentTextAndIconClasses)}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span className={currentSpanClasses}>{propertyName}</span>
        </Link>

        <nav className="ml-auto hidden items-center gap-4 md:flex">
          {menuItems.map(item => (
            <Link
              key={item.label}
              href={item.href} // Use section ID for internal page links
              className={currentNavLinkClasses}
            >
              {item.label}
            </Link>
          ))}
          <CurrencySwitcher /> 
          <Link href={`${basePath}#booking`} passHref>
            <Button
              size="sm"
              variant={currentButtonVariant}
              className={currentButtonClasses}
            >
              Book Now
            </Button>
          </Link>
        </nav>

        <Sheet>
          <SheetTrigger asChild>
             <Button
              variant="ghost"
              size="icon"
              className={currentMobileTriggerClasses}
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
               <div className="px-2.5">
                 <CurrencySwitcher />
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