'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/hooks/useLanguage';
import { motion, AnimatePresence } from 'framer-motion';
import type { Property } from '@/types';
import { TouchTarget } from '@/components/ui/touch-target';
import { SafeImage } from '@/components/ui/safe-image';
import { useScrollToElement, useScrollRestoration } from '@/hooks/useScrollToElement';

interface BookingCheckLayoutProps {
  property: Property;
  children: React.ReactNode;
  checkInDate?: Date | null;
  checkOutDate?: Date | null;
  numberOfNights?: number;
  totalPrice?: string;
  selectedDates?: string;
  heroImage?: string | null;
  fallbackImageUrl?: string; // Optional fallback image if neither heroImage nor property.images are available
}

export function BookingCheckLayout({
  property,
  children,
  checkInDate,
  checkOutDate,
  numberOfNights,
  totalPrice,
  selectedDates,
  heroImage,
  fallbackImageUrl = '/images/templates/holiday-house/default-gallery-1.jpg' // Default fallback image
}: BookingCheckLayoutProps) {
  const { tc } = useLanguage();
  const [isPropertyInfoExpanded, setIsPropertyInfoExpanded] = useState(false);
  const scrollToElement = useScrollToElement();
  const { saveScrollPosition, restoreScrollPosition } = useScrollRestoration();
  
  // Process image source for component
  const primaryImage = (() => {
    // First priority: use hero image if available
    if (heroImage) {
      return !heroImage.startsWith('/') && !heroImage.startsWith('http') 
        ? `/${heroImage}` 
        : heroImage;
    }
    
    // Second priority: use first property image if available
    if (property.images && property.images.length > 0) {
      const firstImage = property.images[0];
      let imageUrl = null;
      
      if (typeof firstImage === 'string') {
        imageUrl = firstImage;
      } else if (typeof firstImage === 'object' && firstImage && 'url' in firstImage) {
        imageUrl = firstImage.url;
      }
      
      if (imageUrl) {
        return !imageUrl.startsWith('/') && !imageUrl.startsWith('http')
          ? `/${imageUrl}`
          : imageUrl;
      }
    }
    
    // Fallback to default image
    return fallbackImageUrl;
  })();

  const propertyName = typeof property.name === 'string' ? property.name : tc(property.name);
  
  // Smooth scroll to main content on accordion toggle
  useEffect(() => {
    if (isPropertyInfoExpanded) {
      scrollToElement('property-details', {
        behavior: 'smooth',
        block: 'nearest',
        offset: 60
      });
    }
  }, [isPropertyInfoExpanded, scrollToElement]);
  
  // Save scroll position when accordion state changes
  const handleAccordionToggle = () => {
    if (!isPropertyInfoExpanded) {
      saveScrollPosition();
    }
    setIsPropertyInfoExpanded(!isPropertyInfoExpanded);
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Skip to main content link for accessibility */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      
      {/* Mobile Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border md:hidden">
        <div className="container px-4 py-3">
          <div className="flex items-center gap-3">
            <Link 
              href={`/properties/${property.slug}`}
              className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              <span>Back</span>
            </Link>
            <div className="flex-1 text-center">
              <h1 className="text-sm font-medium truncate text-foreground">{propertyName}</h1>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Sticky Summary */}
      {selectedDates && (
        <div className="sticky top-[53px] z-30 bg-muted/50 backdrop-blur supports-[backdrop-filter]:bg-muted/30 border-b border-border md:hidden">
          <div className="container px-4 py-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{selectedDates}</span>
              {numberOfNights && <span className="text-foreground font-medium">{numberOfNights} nights</span>}
              {totalPrice && <span className="font-semibold text-primary">{totalPrice}</span>}
            </div>
          </div>
        </div>
      )}
      
      {/* Desktop Header */}
      <div className="hidden md:block border-b border-border bg-background">
        <div className="container py-4">
          <Link 
            href={`/properties/${property.slug}`}
            className="group inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            <span>Back to {propertyName}</span>
          </Link>
        </div>
      </div>
      
      {/* Mobile Property Info Accordion */}
      <div className="md:hidden bg-muted/30 border-b border-border">
        <TouchTarget size="lg">
          <button
            onClick={handleAccordionToggle}
            className="w-full h-full px-4 py-3 flex items-center justify-between text-sm font-medium text-foreground hover:bg-muted/50 transition-all duration-200"
            aria-expanded={isPropertyInfoExpanded}
            aria-controls="property-details"
          >
            <span>Property Details</span>
            <motion.div
              animate={{ rotate: isPropertyInfoExpanded ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          </button>
        </TouchTarget>
        
        {/* Expandable Property Info */}
        <AnimatePresence initial={false}>
          {isPropertyInfoExpanded && (
            <motion.div
              id="property-details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <motion.div 
                className="px-4 pb-4 space-y-4"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: 0.1 }}
              >
                {/* Property Image */}
                <div className="aspect-[4/3] overflow-hidden rounded-[var(--card-radius)] shadow-sm">
                  <SafeImage
                    src={primaryImage}
                    alt={`${propertyName} - Property Image`}
                    className="h-full w-full object-cover"
                    width={400}
                    height={300}
                    fallbackText={`${propertyName} - Image not available`}
                    style={{ objectFit: 'cover' }}
                    priority={true}
                  />
                </div>
            
            {/* Selected Dates */}
            {selectedDates && (
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-muted-foreground">Selected Dates</h3>
                <p className="text-sm text-foreground">{selectedDates}</p>
                {numberOfNights && (
                  <p className="text-sm text-muted-foreground">{numberOfNights} nights</p>
                )}
              </div>
            )}
            
                {/* Total Price */}
                {totalPrice && (
                  <div className="pt-3 border-t border-border">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm text-muted-foreground">Total</span>
                      <span className="text-lg font-semibold text-primary">{totalPrice}</span>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Main Content Area */}
      <div className="container px-4">
        <div className="grid grid-cols-1 md:grid-cols-[300px,1fr] lg:grid-cols-[350px,1fr] gap-0 md:gap-8 lg:gap-12">
          {/* Property Context Panel - Desktop Only */}
          <aside className="hidden md:block sticky top-24 h-fit py-8">
            <div className="space-y-6">
              {/* Property Card */}
              <div className="bg-card border border-border rounded-[var(--card-radius)] shadow-[var(--card-shadow)] overflow-hidden">
                {/* Property Image */}
                <div className="aspect-[4/3] overflow-hidden">
                  <SafeImage
                    src={primaryImage}
                    alt={`${propertyName} - Property Image`}
                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                    width={400}
                    height={300}
                    fallbackText={`${propertyName} - Image not available`}
                    style={{ objectFit: 'cover' }}
                    priority={true}
                  />
                </div>
                
                {/* Property Info */}
                <div className="p-[var(--card-padding)] space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">{propertyName}</h2>
                  
                  {/* Selected Dates */}
                  {selectedDates && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Selected Dates</h3>
                      <p className="text-sm text-foreground font-medium">{selectedDates}</p>
                      {numberOfNights && (
                        <p className="text-sm text-muted-foreground">{numberOfNights} nights</p>
                      )}
                    </div>
                  )}
                  
                  {/* Total Price */}
                  {totalPrice && (
                    <div className="pt-4 border-t border-border">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm text-muted-foreground">Total</span>
                        <span className="text-xl font-semibold text-primary">{totalPrice}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>
          
          {/* Main Content */}
          <main id="main-content" className="py-6 md:py-8 animate-in fade-in slide-in-from-bottom-4 duration-500" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}