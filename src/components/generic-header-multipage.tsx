// src/components/generic-header-multipage.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Home, MapPin, Image as ImageIcon, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CurrencySwitcherSimple } from '@/components/currency-switcher-simple';
import { LanguageSelector } from '@/components/language-selector';
import type { MenuItem } from '@/lib/overridesSchemas-multipage';
import { applyThemeToHeader } from '@/lib/themes/theme-utils';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/hooks/useLanguage';

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
  
  // Get current theme from context
  const { theme } = useTheme();
  
  // Get language utilities
  const { currentLang, getLocalizedPath, tc } = useLanguage();

  // Add propertySlug to URLs that don't start with http:// or https://
  const processMenuUrl = (url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // If it's just a path like "/details", prepend the property path and localize
    const fullPath = `${basePath}${url}`;
    return getLocalizedPath(fullPath);
  };

  // Process menu items to add property slug to paths and localize
  const processedMenuItems = menuItems.map(item => ({
    ...item,
    url: processMenuUrl(item.url),
    // If label is an object with language keys, get the current language
    label: typeof item.label === 'object' && item.label[currentLang] 
      ? item.label[currentLang] 
      : (typeof item.label === 'object' && (item.label as any).en ? (item.label as any).en : item.label)
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

  // Apply theme-based header styling when scroll state or theme changes
  useEffect(() => {
    if (hasMounted) {
      applyThemeToHeader(isScrolled, theme.id);
    }
    
    return () => {
      // Clean up when component unmounts
      if (typeof document !== 'undefined') {
        const styleEl = document.getElementById('theme-header-styles');
        if (styleEl) styleEl.remove();
      }
    };
  }, [isScrolled, theme.id, hasMounted]);

  // Fixed positioning for header with improved styling
  const headerBaseClasses = "fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300 ease-in-out h-16";

  // Define classes for scrolled state
  const scrolledHeaderClasses = "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b";
  const scrolledTextAndIconColorClasses = "text-foreground";
  const scrolledSpanColorClasses = "text-foreground";
  const scrolledNavLinkColorClasses = "text-muted-foreground hover:text-foreground";
  const scrolledButtonVariant = "default" as const;
  const scrolledButtonExtraClasses = "";
  const scrolledMobileTriggerColorClasses = "text-foreground hover:bg-accent";

  // Define classes for initial (unscrolled) state
  // Add transparent-header class to create the overlay effect
  const initialHeaderClasses = "transparent-header bg-transparent backdrop-blur-sm"; 
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
  
  // Style only used for scrolled state
  const headerStyle = undefined;
  const textAndIconColorClasses = hasMounted && isScrolled ? scrolledTextAndIconColorClasses : initialTextAndIconColorClasses;
  const spanColorClasses = hasMounted && isScrolled ? scrolledSpanColorClasses : initialSpanColorClasses;
  const navLinkColorClasses = hasMounted && isScrolled ? scrolledNavLinkColorClasses : initialNavLinkColorClasses;
  const buttonVariant = hasMounted && isScrolled ? scrolledButtonVariant : initialButtonVariant;
  const buttonExtraClasses = hasMounted && isScrolled ? scrolledButtonExtraClasses : initialButtonExtraClasses;
  const mobileTriggerColorClasses = hasMounted && isScrolled ? scrolledMobileTriggerColorClasses : initialMobileTriggerColorClasses;

  // Dynamic styles for currency switcher based on scroll state
  const currencySwitcherClasses = cn(
    hasMounted && isScrolled ? 
      // Scrolled state - use theme colors
      "text-muted-foreground hover:text-foreground hover:bg-accent/10 focus:ring-border" : 
      // Unscrolled state - use dark background for contrast with white text  
      "text-white hover:text-white hover:bg-black/20 focus:ring-white/30"
  );
  
  // Dynamic styles for language selector based on scroll state
  const languageSelectorClasses = cn(
    hasMounted && isScrolled ? 
      // Scrolled state - use theme colors
      "text-muted-foreground hover:text-foreground hover:bg-accent/10 focus:ring-border" : 
      // Unscrolled state - use dark background for contrast with white text  
      "text-white hover:text-white hover:bg-black/20 focus:ring-white/30"
  );
  
  // Determine if we should show the language label based on scroll state
  const showLanguageLabel = !(hasMounted && isScrolled);
  
  return (
    <>
      <header className={currentHeaderClasses} style={headerStyle} id="site-header">
        {/* Use container class for max-width and centering, and add padding */}
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        {/* Link back to the specific property page */}
        <Link href={getLocalizedPath(basePath)} className="flex items-center gap-2">
          {/* Use custom logo if provided, otherwise fallback to SVG */}
          {logoSrc ? (
            logoSrc.endsWith('logo-dynamic.svg') ? (
              // For dynamic logo, inline the SVG content to allow currentColor to work
              <div className={textAndIconColorClasses}>
                <svg 
                  version="1.0" 
                  xmlns="http://www.w3.org/2000/svg"
                  width="80"
                  height="32"
                  viewBox="0 0 2500 2500"
                  preserveAspectRatio="xMidYMid meet"
                  className="h-8 w-auto fill-current"
                >
                  <g transform="translate(0.000000,2500.000000) scale(0.100000,-0.100000)" stroke="none">
                    <path d="M5300 13469 c-2335 -1936 -4253 -3528 -4263 -3537 -16 -17 28 -22 828 -91 567 -50 849 -71 857 -64 7 5 74 57 148 115 462 357 2558 1983 3260 2528 316 246 1250 970 2075 1610 825 640 1619 1256 1764 1369 237 184 265 203 283 192 11 -7 1319 -933 2907 -2058 1587 -1125 2947 -2089 3021 -2141 74 -53 203 -144 285 -203 83 -59 741 -526 1464 -1038 l1314 -931 76 0 c42 0 243 7 446 15 204 8 505 19 670 25 165 6 480 17 700 25 220 8 582 22 805 30 1540 55 1885 68 1889 71 2 2 2 5 0 7 -4 4 -1707 1162 -1914 1302 -71 49 -166 113 -210 143 -110 75 -4412 3006 -4657 3173 -109 74 -950 646 -1869 1273 -920 626 -1686 1143 -1703 1147 -17 5 -238 38 -491 74 -253 35 -1124 159 -1935 275 -812 115 -1482 210 -1490 210 -8 0 -1925 -1585 -4260 -3521z"/>
                    <path d="M18990 15018 c-476 -462 -928 -900 -1005 -974 l-139 -134 399 0 400 1 609 591 608 590 122 -119 c66 -66 338 -330 604 -588 l484 -468 391 2 c216 1 393 4 394 5 3 3 -1987 1931 -1996 1933 -3 1 -395 -377 -871 -839z"/>
                    <path d="M19597 14553 l-257 -248 0 -691 0 -690 502 -340 c276 -186 508 -343 515 -347 11 -7 13 175 13 1035 l0 1044 -250 242 c-137 133 -253 242 -258 242 -4 0 -124 -111 -265 -247z"/>
                    <path d="M8740 12555 l0 -675 665 0 665 0 0 675 0 675 -665 0 -665 0 0 -675z"/>
                    <path d="M10360 12557 l0 -673 665 -2 665 -2 0 675 0 675 -665 0 -665 0 0 -673z"/>
                    <path d="M8740 10861 l0 -668 88 -6 c48 -3 347 -6 665 -7 l577 -1 0 676 0 675 -665 0 -665 0 0 -669z"/>
                    <path d="M10360 10855 l0 -675 665 0 665 0 0 675 0 675 -665 0 -665 0 0 -675z"/>
                    <path d="M830 9957 c0 -5 460 -388 750 -624 1111 -904 2074 -1574 3011 -2096 1883 -1048 3747 -1543 5599 -1486 988 30 1946 203 2918 528 372 125 604 215 1132 441 721 310 1001 410 1740 627 785 229 1694 396 2555 467 443 37 555 41 1210 41 690 -1 836 -7 1370 -56 1100 -101 2310 -353 3040 -634 61 -24 -23 24 -205 117 -862 437 -1849 846 -2805 1161 -2688 886 -5015 1023 -6825 402 -268 -93 -439 -163 -1265 -525 -544 -238 -866 -356 -1280 -469 -1563 -427 -3184 -535 -4860 -326 -1953 245 -3915 948 -5410 1940 -199 132 -465 325 -602 437 -40 33 -73 57 -73 55z"/>
                  </g>
                </svg>
              </div>
            ) : (
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
            )
          ) : (
            <span className={cn("block", textAndIconColorClasses)}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </span>
          )}
          <span className={cn("text-lg font-semibold", spanColorClasses)}>{tc(propertyName)}</span>
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
          
          {/* Language Selector */}
          <LanguageSelector 
            className={languageSelectorClasses}
            variant="ghost"
            size="sm"
            showLabel={showLanguageLabel}
          />
          
          {/* Currency Switcher */}
          <CurrencySwitcherSimple 
            className={currencySwitcherClasses} 
          />
          
          {/* Button Items (usually Book Now) */}
          {buttonItems.map(buttonItem => (
            <Button
              key={buttonItem.label}
              size="sm"
              variant={buttonVariant}
              className={cn(buttonExtraClasses)}
              data-theme-aware="true"
              asChild
            >
              <Link href={buttonItem.url}>
                {buttonItem.label}
              </Link>
            </Button>
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
            <Link href={getLocalizedPath(basePath)} className="flex items-center gap-2 mb-8">
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
                        svgElement.setAttribute('class', 'h-6 w-6 text-muted-foreground');
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
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-muted-foreground">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              )}
              <span className="text-xl font-bold text-foreground">{propertyName}</span>
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
              
              {/* Mobile language selector */}
              <div className="px-2.5">
                <LanguageSelector 
                  className="text-muted-foreground border-border hover:bg-accent/10 w-full justify-start"
                  variant="ghost"
                  size="sm"
                  showLabel={true}
                />
              </div>
              
              {/* Mobile currency switcher */}
              <div className="px-2.5">
                <CurrencySwitcherSimple 
                  className="text-muted-foreground border-border hover:bg-accent/10"
                />
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
    </>
  );
}