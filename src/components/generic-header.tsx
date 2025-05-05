"use client"; // Add 'use client' because we need hooks (useState, useEffect)

import { useState, useEffect } from 'react'; // Import hooks
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Home, MapPin, Image as ImageIcon, ListChecks } from 'lucide-react'; // Adjusted icons
import { cn } from '@/lib/utils'; // Import cn for conditional classes

interface HeaderProps {
  propertyName: string;
  propertySlug: string;
}

export function Header({ propertyName, propertySlug }: HeaderProps) {
  const basePath = `/properties/${propertySlug}`;
  const [isScrolled, setIsScrolled] = useState(false);
  const [hasMounted, setHasMounted] = useState(false); // State to track client mount

  // Define menu items specific to the property page layout
  const menuItems = [
    { href: '#experience', label: 'Experience', icon: Home }, // Assuming section IDs exist
    { href: '#features', label: 'Features', icon: ImageIcon },
    { href: '#location', label: 'Location', icon: MapPin },
    { href: '#rules', label: 'Rules', icon: ListChecks }, // Updated ID from house-rules
    // Add more relevant links for the property page
  ];

  useEffect(() => {
    setHasMounted(true); // Indicate client has mounted

    const handleScroll = () => {
      // Set state based on scroll position (e.g., scrolled more than 50px)
      setIsScrolled(window.scrollY > 50);
    };

    // Add event listener
    window.addEventListener('scroll', handleScroll);
    // Call handler once initially after mount to set correct state
    handleScroll();

    // Clean up event listener
    return () => window.removeEventListener('scroll', handleScroll);
  }, []); // Empty dependency array ensures this runs once on mount

  // Base classes applied on both server and initial client render
  const baseHeaderClasses = "fixed top-0 left-0 z-50 w-full transition-all duration-300 ease-in-out";
  const baseTextAndIconColor = "transition-colors";
  const baseSpanColor = "text-lg font-semibold transition-colors";
  const baseNavLink = "text-sm font-medium transition-colors";
  const baseMobileTrigger = "transition-colors";

  // Determine dynamic classes only after mount
  const dynamicHeaderClasses = hasMounted && (isScrolled
    ? "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b" // Style when scrolled
    : "bg-black/50 border-transparent"); // Initial style (transparent)

  const dynamicTextAndIconColor = hasMounted && (isScrolled ? "text-primary" : "text-white");
  const dynamicSpanColor = hasMounted && (isScrolled ? "text-foreground" : "text-white");
  const dynamicNavLink = hasMounted && (isScrolled ? "text-muted-foreground hover:text-foreground" : "text-white/80 hover:text-white");
  const dynamicBookNowButtonVariant = hasMounted && isScrolled ? "default" : "secondary";
  const dynamicBookNowButtonClasses = hasMounted && !isScrolled ? "text-primary bg-white hover:bg-gray-100" : "";
  const dynamicMobileTrigger = hasMounted && (isScrolled ? "text-foreground hover:bg-accent" : "text-white hover:bg-white/10");

  return (
    <header className={cn(baseHeaderClasses, dynamicHeaderClasses)}>
      <div className="w-full px-4 flex h-16 items-center">
        <Link href={basePath} className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("h-6 w-6", baseTextAndIconColor, dynamicTextAndIconColor)}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span className={cn(baseSpanColor, dynamicSpanColor)}>{propertyName}</span>
        </Link>

        <nav className="ml-auto hidden items-center gap-6 md:flex">
          {menuItems.map(item => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(baseNavLink, dynamicNavLink)}
            >
              {item.label}
            </Link>
          ))}
          <Link href={`${basePath}#booking`} passHref>
            <Button
              size="sm"
              variant={dynamicBookNowButtonVariant}
              className={dynamicBookNowButtonClasses}
            >
              Book Now
            </Button>
          </Link>
        </nav>

        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              className={cn(baseMobileTrigger, dynamicMobileTrigger)}
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
                    href={item.href}
                    className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
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
