
// src/components/booking/initial-booking-form.tsx
"use client";

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, isAfter } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Calendar as CalendarIcon, SearchCheck, Loader2 } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import type { Property } from '@/types';

interface InitialBookingFormProps {
  property: Property;
  size?: 'compressed' | 'large'; // Add optional size prop
  language?: string;
}

export function InitialBookingForm({ property, size = 'compressed', language = 'en' }: InitialBookingFormProps) {
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { tc, t } = useLanguage();

  // Clear any existing booking storage when this initial form loads
  // This ensures we start fresh when booking a new stay
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Clear any property-specific booking storage
      console.log("InitialBookingForm mounted - clearing old booking storage");

      // Simple session storage cleanup approach
      // Look for and remove any booking-related items
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('booking_')) {
          console.log(`Clearing old booking storage: ${key}`);
          sessionStorage.removeItem(key);
          // Re-adjust index because we removed an item
          i--;
        }
      }
    }
  }, []);

  // Check if date range is valid (end date is after start date)
  const isDateRangeValid = (): boolean => {
    if (!date?.from || !date?.to) {
      return false;
    }
    // Ensure end date is strictly after start date
    return isAfter(date.to, date.from);
  };

  const handleCheckAvailability = () => {
    if (!isDateRangeValid()) {
      toast({
        title: t('booking.errors.invalidDates'),
        description: t('booking.errors.invalidDatesDescription'),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    // Construct the URL for the availability check page (only dates)
    const checkIn = format(date!.from!, 'yyyy-MM-dd');
    const checkOut = format(date!.to!, 'yyyy-MM-dd');
    const params = new URLSearchParams({
      checkIn,
      checkOut,
    });

    // Navigate to the new availability check page
    router.push(`/booking/check/${property.slug}?${params.toString()}`);
    // Note: setIsLoading(false) will happen implicitly when navigation occurs
  };

  const isButtonDisabled = !isDateRangeValid() || isLoading;

  /**
   * Get the form's position from the hero section data attribute
   * This determines layout patterns based on where the form is positioned
   */
  const getFormPosition = (): string => {
    if (typeof window === 'undefined') return 'bottom';
    
    try {
      // Find the hero section by walking up from any element or by direct ID
      const heroSection = document.getElementById('hero') || (() => {
        // Walk up the DOM to find the hero section
        let element: HTMLElement | null = document.activeElement;
        while (element && element.id !== 'hero') {
          element = element.parentElement;
        }
        return element;
      })();
      
      // If we found the hero, get its position attribute
      if (heroSection) {
        return heroSection.getAttribute('data-form-position') || 'bottom';
      }
    } catch (e) {
      console.error('[BookingForm] Error detecting form position:', e);
    }
    
    return 'bottom'; // Default if we can't determine
  };
  
  // Get the form's size to determine layout
  const getFormSize = (): string => {
    if (typeof window === 'undefined') return size || 'compressed';
    
    try {
      const heroSection = document.getElementById('hero');
      if (heroSection) {
        return heroSection.getAttribute('data-form-size') || size || 'compressed';
      }
    } catch (e) {
      console.error('[BookingForm] Error detecting form size:', e);
    }
    
    return size || 'compressed';
  };
  
  // Check if we're in a corner position (affects layout)
  const isCornerPosition = () => {
    const position = getFormPosition();
    return position.includes('left') || position.includes('right');
  };
  
  // Check if we're using the large size
  const isLargeSize = () => {
    return getFormSize() === 'large';
  };
  
  // Determine if we should use horizontal layout based on position + size + screen width
  const useHorizontalLayout = () => {
    const position = getFormPosition();
    const isLarge = isLargeSize();
    const isDesktopOrTablet = typeof window !== 'undefined' && window.innerWidth >= 768;
    
    // Special case for bottom position with large size - always use horizontal layout on non-mobile
    if (position === 'bottom' && isLarge && isDesktopOrTablet) {
      console.log('[InitialBookingForm] Using horizontal layout for bottom + large position');
      return true;
    }
    
    // Standard conditions for other positions:
    // 1. Not in a corner position
    // 2. Using large size 
    // 3. On medium or larger screens
    const result = !isCornerPosition() && isLarge && isDesktopOrTablet;
    
    console.log('[InitialBookingForm] Layout decision:', {
      position,
      isLarge,
      isDesktopOrTablet,
      useHorizontal: result
    });
    
    return result;
  };
  
  // Determine if this is specifically the bottom + large combination
  const isBottomLarge = () => {
    // Since we have a prop directly from the parent with size,
    // let's prioritize both the DOM attribute and the direct prop
    const position = getFormPosition();
    const directSizeProp = size === 'large'; // Use the direct prop passed from parent
    const domSizeAttr = typeof window !== 'undefined' && 
                        document.getElementById('hero')?.getAttribute('data-form-size') === 'large';
    
    // If either source indicates large size, consider it large
    const isLarge = directSizeProp || domSizeAttr;
    const result = position === 'bottom' && isLarge;
    
    // Add debug logging to see what position and size are being detected
    console.log('[InitialBookingForm] Position/Size Detection:', { 
      position, 
      directSizeProp,
      domSizeAttr,
      isLarge,
      isBottomLarge: result,
      fromProps: { size, property: property.slug }
    });
    
    return result;
  };

  // Conditionally apply classes based on size prop, position, and screen size
  const formContainerClasses = cn(
    'space-y-4', // Default vertical spacing
    useHorizontalLayout()
      ? cn(
          'md:flex md:flex-row md:items-center md:space-y-0 md:w-full', // Base horizontal layout
          isBottomLarge() 
            ? 'md:space-x-6 md:justify-between' // More spacing for bottom + large
            : 'md:space-x-3' // Standard spacing for other horizontal layouts
        )
      : 'flex flex-col items-stretch w-full' // Vertical stack for corners and mobile
  );

  const datePickerContainerClasses = cn(
    'grid gap-2',
    useHorizontalLayout() && cn(
      'md:flex-grow md:flex md:items-end', // Align date picker to bottom for consistent baseline
      isBottomLarge() && 'md:max-w-[70%] md:flex-1' // Limit width in bottom + large but allow it to grow
    )
  );

  const buttonContainerClasses = cn(
    'w-full', // Full width by default
    useHorizontalLayout() && cn(
      'md:w-auto md:shrink-0', // Fixed width in horizontal layouts
      isBottomLarge() && 'md:min-w-[200px] md:self-end' // Align button to bottom for consistent baseline
    )
  );

  // Apply height matching for the date picker and button
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    console.log('[InitialBookingForm] Adding height matching for date picker and button');
    
    // Function to match heights
    const matchElementHeights = () => {
      // Find the date picker and button directly by ID
      const datePicker = document.querySelector('#date');
      const button = document.querySelector('#check-availability-btn');
      
      if (datePicker && button) {
        console.log('[DIRECT DEBUG] Date picker and button found - matching heights');
        
        // Ensure the button and date picker have the same height
        const datePickerHeight = datePicker.getBoundingClientRect().height;
        (button as HTMLElement).style.height = `${datePickerHeight}px`;
        
        console.log('[DIRECT DEBUG] Applied height matching:', datePickerHeight);
      } else {
        console.log('[DIRECT DEBUG] Date picker or button not found yet');
      }
    };
    
    // Try matching heights at different intervals
    setTimeout(matchElementHeights, 100);
    setTimeout(matchElementHeights, 500);
    setTimeout(matchElementHeights, 1000);
  }, [size, date]);
  
  // No need for direct inline styles with our simplified layout approach
  
  return (
    <div className="flex flex-col md:flex-row md:items-end md:space-x-3 lg:space-x-6 w-full InitialBookingForm">
      {/* Date Range Picker */}
      <div className="w-full md:flex-1 lg:max-w-[65%] md:max-w-[60%]">
         {/* Hide this label completely with aggressive styling */}
         <Label htmlFor="date" className="sr-only" style={{ 
           position: 'absolute', 
           width: '1px', 
           height: '1px', 
           padding: '0', 
           margin: '-1px', 
           overflow: 'hidden', 
           clip: 'rect(0, 0, 0, 0)', 
           whiteSpace: 'nowrap', 
           border: '0' 
         }}>
             {t('booking.checkInCheckOut')}
         </Label>
         <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={'outline'}
              className={cn(
                'w-full justify-start text-left font-normal min-h-[46px]', // Taller minimum height
                !date && 'text-muted-foreground', // Placeholder text styling
                isBottomLarge() && 'md:px-6 md:py-3 md:border-2 md:text-base md:font-medium md:rounded-md md:bg-background/50 hover:md:bg-background/80' // Larger input appearance for bottom-large with subtle background effect
              )}
              disabled={isLoading}
            >
              <CalendarIcon className={cn("mr-2 h-4 w-4 flex-shrink-0", isBottomLarge() && "md:h-5 md:w-5")} />
              <span className="inline-block w-full overflow-hidden text-ellipsis whitespace-nowrap">
                {date?.from ? (
                  date.to ? (
                    <span className="font-medium relative bg-background/80 px-1 py-0.5 rounded text-foreground">
                      {format(date.from, 'MMM d')} - {format(date.to, 'MMM d')}
                    </span>
                  ) : (
                    <span className="font-medium relative bg-background/80 px-1 py-0.5 rounded text-foreground">{format(date.from, 'MMM d')}</span>
                  )
                ) : (
                  t('booking.selectDates')
                )}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from || new Date()}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={1}
                  disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }} // Only disable past dates
              />
          </PopoverContent>
        </Popover>
      </div>

      {/* Check Availability Button */}
      <div className="w-full md:w-[110px] lg:w-[120px] md:flex-shrink-0 mt-4 md:mt-0 md:mr-1 lg:mr-2">
          <Button
            id="check-availability-btn"
            type="button"
            variant="cta"
            size="compact"
            onClick={handleCheckAvailability}
            className="w-full whitespace-nowrap text-xs md:text-xs lg:text-sm"
            disabled={isButtonDisabled}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                {t('booking.checkingAvailability')}
              </>
            ) : (
              <>
                <SearchCheck className="mr-1 h-3 w-3" />
                {t('booking.checkDates')}
              </>
            )}
          </Button>
       </div>
    </div>
  );
}

    