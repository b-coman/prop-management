// src/components/generic-header-multipage.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Home, MapPin, Image as ImageIcon, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CurrencySwitcher } from '@/components/currency-switcher';
import type { MenuItem } from '@/lib/overridesSchemas-multipage';

interface HeaderProps {
  propertyName: string;
  propertySlug: string;
  // New props for dynamic menu
  menuItems: MenuItem[];
  logoSrc?: string;
  logoAlt?: string;
}

export function Header({ 
  propertyName, 
  propertySlug,
  menuItems,
  logoSrc = '', // Default empty for fallback SVG
  logoAlt = 'Property Logo'
}: HeaderProps) {
  const basePath = `/properties/${propertySlug}`;
  const [isScrolled, setIsScrolled] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  // Add propertySlug to URLs that don't start with http:// or https://
  const processMenuUrl = (url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // If it's just a path like "/details", prepend the property path
    return `${basePath}${url}`;
  };

  // Process menu items to add property slug to paths
  const processedMenuItems = menuItems.map(item => ({
    ...item,
    url: processMenuUrl(item.url)
  }));

  // Find button items (if any)
  const buttonItems = processedMenuItems.filter(item => item.isButton);
  const regularMenuItems = processedMenuItems.filter(item => !item.isButton);

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
        <Link href={`${basePath}`} className="flex items-center gap-2">
          {/* Use custom logo if provided, otherwise fallback to SVG */}
          {logoSrc ? (
            <div className="h-8 w-auto relative">
              <img
                src={logoSrc}
                alt={logoAlt}
                className="h-8 w-auto"
                onError={(e) => {
                  // Handle image load error by falling back to SVG
                  e.currentTarget.style.display = 'none';
                  // Make sure parent element is visible for the fallback
                  const parentElement = e.currentTarget.parentElement;
                  if (parentElement) {
                    const svgElement = document.createElement('svg');
                    svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                    svgElement.setAttribute('viewBox', '0 0 24 24');
                    svgElement.setAttribute('fill', 'none');
                    svgElement.setAttribute('stroke', 'currentColor');
                    svgElement.setAttribute('stroke-width', '2');
                    svgElement.setAttribute('stroke-linecap', 'round');
                    svgElement.setAttribute('stroke-linejoin', 'round');
                    svgElement.setAttribute('class', `h-6 w-6 ${textAndIconColorClasses}`);
                    svgElement.innerHTML = `
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                      <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    `;
                    parentElement.appendChild(svgElement);
                  }
                }}
              />
            </div>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("h-6 w-6", textAndIconColorClasses)}>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          )}
          <span className={cn("text-lg font-semibold", spanColorClasses)}>{propertyName}</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="ml-auto hidden items-center gap-4 md:flex">
          {/* Regular menu items */}
          {regularMenuItems.map(item => (
            <Link
              key={item.label}
              href={item.url}
              className={cn("text-sm font-medium transition-colors", navLinkColorClasses)}
            >
              {item.label}
            </Link>
          ))}
          
          {/* Currency Switcher */}
          <CurrencySwitcher className={currencySwitcherClasses} />
          
          {/* Button Items (usually Book Now) */}
          {buttonItems.map(buttonItem => (
            <Link key={buttonItem.label} href={buttonItem.url} passHref>
              <Button
                size="sm"
                variant={buttonVariant}
                className={cn(buttonExtraClasses)}
              >
                {buttonItem.label}
              </Button>
            </Link>
          ))}
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
              {logoSrc ? (
                <div className="h-8 w-auto relative">
                  <img
                    src={logoSrc}
                    alt={logoAlt}
                    className="h-8 w-auto"
                    onError={(e) => {
                      // Handle image load error by falling back to SVG
                      e.currentTarget.style.display = 'none';
                      // Make sure parent element is visible for the fallback
                      const parentElement = e.currentTarget.parentElement;
                      if (parentElement) {
                        const svgElement = document.createElement('svg');
                        svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                        svgElement.setAttribute('viewBox', '0 0 24 24');
                        svgElement.setAttribute('fill', 'none');
                        svgElement.setAttribute('stroke', 'currentColor');
                        svgElement.setAttribute('stroke-width', '2');
                        svgElement.setAttribute('stroke-linecap', 'round');
                        svgElement.setAttribute('stroke-linejoin', 'round');
                        svgElement.setAttribute('class', 'h-6 w-6 text-primary');
                        svgElement.innerHTML = `
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                          <polyline points="9 22 9 12 15 12 15 22"></polyline>
                        `;
                        parentElement.appendChild(svgElement);
                      }
                    }}
                  />
                </div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              )}
              <span className="text-xl font-bold text-primary">{propertyName}</span>
            </Link>
            <nav className="grid gap-6 text-lg font-medium">
              {/* All menu items in mobile view */}
              {processedMenuItems.map(item => {
                // Get an appropriate icon based on the URL or label
                let Icon = Home;
                if (item.url.includes('location')) Icon = MapPin;
                if (item.url.includes('gallery')) Icon = ImageIcon;
                if (item.url.includes('rules')) Icon = ListChecks;

                return (
                  <Link
                    key={item.label}
                    href={item.url}
                    className={cn(
                      "flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground",
                      item.isButton && "text-primary font-semibold"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
              
              {/* Mobile currency switcher */}
              <div className="px-2.5">
                <CurrencySwitcher className="text-muted-foreground border-border hover:bg-accent/10 data-[state=open]:bg-accent/20"/>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}