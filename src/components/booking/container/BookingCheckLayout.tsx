'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowLeft, ChevronDown, ChevronUp, Share2, CalendarIcon, Copy } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/hooks/useLanguage';
import { motion, AnimatePresence } from 'framer-motion';
import type { Property } from '@/types';
import { TouchTarget } from '@/components/ui/touch-target';
import { SafeImage } from '@/components/ui/safe-image';
import { useScrollToElement, useScrollRestoration } from '@/hooks/useScrollToElement';
import { useBooking } from '@/contexts/BookingContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

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
  const [isPriceBreakdownExpanded, setIsPriceBreakdownExpanded] = useState(false);
  const scrollToElement = useScrollToElement();
  const { saveScrollPosition, restoreScrollPosition } = useScrollRestoration();
  
  // Get pricing data from context
  const { pricingDetails, numberOfGuests } = useBooking();
  const { selectedCurrency, convertToSelectedCurrency, formatPrice } = useCurrency();
  const { toast } = useToast();
  
  // Process image source for component
  const primaryImage = (() => {
    console.log(`[BookingCheckLayout] Image resolution for ${property.slug}:`, {
      heroImage,
      hasPropertyImages: property.images && property.images.length > 0,
      propertyImagesCount: property.images?.length || 0,
      firstPropertyImage: property.images?.[0],
      fallbackImageUrl
    });
    
    // First priority: use hero image if available
    if (heroImage) {
      const processedHeroImage = !heroImage.startsWith('/') && !heroImage.startsWith('http') 
        ? `/${heroImage}` 
        : heroImage;
      console.log(`[BookingCheckLayout] Using hero image: ${processedHeroImage}`);
      return processedHeroImage;
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
        const processedImageUrl = !imageUrl.startsWith('/') && !imageUrl.startsWith('http')
          ? `/${imageUrl}`
          : imageUrl;
        console.log(`[BookingCheckLayout] Using property image: ${processedImageUrl}`);
        return processedImageUrl;
      }
    }
    
    // Fallback to default image
    console.log(`[BookingCheckLayout] Using fallback image: ${fallbackImageUrl}`);
    return fallbackImageUrl;
  })();

  const propertyName = typeof property.name === 'string' ? property.name : tc(property.name);
  
  // Share functionality
  const handleShare = async () => {
    try {
      // Build URL with current context data
      const urlParams = new URLSearchParams();
      if (checkInDate) urlParams.set('checkIn', checkInDate.toISOString().split('T')[0]);
      if (checkOutDate) urlParams.set('checkOut', checkOutDate.toISOString().split('T')[0]);
      if (numberOfGuests) urlParams.set('guests', numberOfGuests.toString());
      
      const shareUrl = `${window.location.origin}/properties/${property.slug}/booking/check?${urlParams.toString()}`;
      
      if (typeof navigator !== 'undefined' && navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        // Mobile native share
        await navigator.share({ 
          url: shareUrl, 
          title: `Book ${propertyName}`,
          text: `Check out this booking for ${propertyName}` 
        });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        // Desktop clipboard
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: "Link copied!",
          description: "Booking link has been copied to your clipboard.",
          duration: 3000,
        });
      } else {
        // Fallback for older browsers
        console.log('Share URL:', shareUrl);
        toast({
          title: "Share URL",
          description: "Please copy the URL from the browser address bar.",
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
      toast({
        title: "Share failed",
        description: "Unable to share the booking link. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };
  
  // Calculate pricing breakdown for display
  const pricingBreakdown = React.useMemo(() => {
    if (!pricingDetails) return null;
    
    const baseCurrency = pricingDetails.currency;
    
    return {
      accommodationTotal: convertToSelectedCurrency(pricingDetails.accommodationTotal || 0, baseCurrency),
      cleaningFee: convertToSelectedCurrency(pricingDetails.cleaningFee || 0, baseCurrency),
      subtotal: convertToSelectedCurrency(pricingDetails.subtotal || 0, baseCurrency),
      total: convertToSelectedCurrency(pricingDetails.totalPrice || pricingDetails.total || 0, baseCurrency),
      dailyRates: pricingDetails.dailyRates 
        ? Object.entries(pricingDetails.dailyRates).reduce((acc, [date, price]) => {
            acc[date] = convertToSelectedCurrency(price, baseCurrency);
            return acc;
          }, {} as Record<string, number>)
        : {},
      lengthOfStayDiscount: pricingDetails.lengthOfStayDiscount 
        ? {
            discountPercentage: pricingDetails.lengthOfStayDiscount.discountPercentage,
            discountAmount: convertToSelectedCurrency(pricingDetails.lengthOfStayDiscount.discountAmount || 0, baseCurrency)
          }
        : null,
      couponDiscount: pricingDetails.couponDiscount 
        ? {
            discountPercentage: pricingDetails.couponDiscount.discountPercentage,
            discountAmount: convertToSelectedCurrency(pricingDetails.couponDiscount.discountAmount || 0, baseCurrency)
          }
        : null,
    };
  }, [pricingDetails, convertToSelectedCurrency, selectedCurrency]);
  
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
            
            {/* Combined Dates and Nights */}
            {selectedDates && (
              <div className="space-y-1">
                <p className="text-sm text-foreground font-medium">
                  {selectedDates}{numberOfNights ? `, ${numberOfNights} nights` : ''}
                </p>
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
                  
                  {/* Combined Dates and Nights */}
                  {selectedDates && (
                    <div className="space-y-2">
                      <p className="text-sm text-foreground font-medium">
                        {selectedDates}{numberOfNights ? `, ${numberOfNights} nights` : ''}
                      </p>
                    </div>
                  )}
                  
                  {/* Total Price with Details and Share */}
                  {totalPrice && (
                    <div className="pt-4 border-t border-border space-y-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xl font-semibold text-primary">{totalPrice}</span>
                      </div>
                      
                      {/* Control Buttons */}
                      <div className="flex items-center gap-2">
                        {pricingBreakdown && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsPriceBreakdownExpanded(!isPriceBreakdownExpanded)}
                            className="flex-1 text-xs"
                          >
                            {isPriceBreakdownExpanded ? (
                              <>
                                <ChevronUp className="h-3 w-3 mr-1" />
                                Hide Details
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3 mr-1" />
                                Show Details
                              </>
                            )}
                          </Button>
                        )}
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleShare}
                          className="px-3"
                        >
                          <Share2 className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      {/* Expandable Price Breakdown */}
                      <AnimatePresence initial={false}>
                        {isPriceBreakdownExpanded && pricingBreakdown && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="pt-3 border-t border-border">
                              <div className="space-y-2 text-xs">
                                <h4 className="font-medium text-sm text-foreground mb-3">Price Breakdown</h4>
                                
                                {/* Accommodation */}
                                <div className="flex justify-between">
                                  <span>Accommodation ({numberOfNights} nights)</span>
                                  <span>{formatPrice(pricingBreakdown.accommodationTotal, selectedCurrency)}</span>
                                </div>

                                {/* Daily rates if available */}
                                {Object.keys(pricingBreakdown.dailyRates).length > 0 && (
                                  <div className="pl-3 space-y-1 text-xs text-muted-foreground">
                                    {Object.entries(pricingBreakdown.dailyRates)
                                      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                                      .map(([date, price]) => (
                                        <div key={date} className="flex justify-between">
                                          <span className="flex items-center">
                                            <CalendarIcon className="h-2.5 w-2.5 mr-1" /> {date}
                                          </span>
                                          <span>{formatPrice(price, selectedCurrency)}</span>
                                        </div>
                                      ))
                                    }
                                  </div>
                                )}

                                {/* Cleaning fee */}
                                <div className="flex justify-between">
                                  <span>Cleaning fee</span>
                                  <span>+{formatPrice(pricingBreakdown.cleaningFee, selectedCurrency)}</span>
                                </div>

                                <Separator className="my-2" />

                                {/* Subtotal */}
                                <div className="flex justify-between font-medium">
                                  <span>Subtotal</span>
                                  <span>{formatPrice(pricingBreakdown.subtotal, selectedCurrency)}</span>
                                </div>

                                {/* Discounts */}
                                {pricingBreakdown.lengthOfStayDiscount && (
                                  <div className="flex justify-between text-green-600">
                                    <span>Stay discount ({pricingBreakdown.lengthOfStayDiscount.discountPercentage}%)</span>
                                    <span>-{formatPrice(pricingBreakdown.lengthOfStayDiscount.discountAmount, selectedCurrency)}</span>
                                  </div>
                                )}

                                {pricingBreakdown.couponDiscount && (
                                  <div className="flex justify-between text-green-600">
                                    <span>Coupon discount ({pricingBreakdown.couponDiscount.discountPercentage}%)</span>
                                    <span>-{formatPrice(pricingBreakdown.couponDiscount.discountAmount, selectedCurrency)}</span>
                                  </div>
                                )}

                                <Separator className="my-2" />

                                {/* Final Total */}
                                <div className="flex justify-between font-bold text-sm">
                                  <span>Total ({selectedCurrency})</span>
                                  <span>{formatPrice(pricingBreakdown.total, selectedCurrency)}</span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
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