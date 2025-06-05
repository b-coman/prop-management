
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
import { TouchTarget } from '@/components/ui/touch-target';

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
  const { tc, t, currentLanguage } = useLanguage();

  // Removed session storage clearing - now handled by navigation flow

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

    // Construct the URL for the availability check page (path-based language detection)
    const checkIn = format(date!.from!, 'yyyy-MM-dd');
    const checkOut = format(date!.to!, 'yyyy-MM-dd');
    const params = new URLSearchParams({
      checkIn,
      checkOut,
    });

    // Current language is now available from component-level hook
    
    // Build path-based URL: /booking/check/slug/[language]?params
    let bookingPath = `/booking/check/${property.slug}`;
    if (currentLanguage && currentLanguage !== 'en') {
      bookingPath += `/${currentLanguage}`;
    }
    
    // Navigate to the new availability check page with path-based language
    router.push(`${bookingPath}?${params.toString()}`);
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
        let element: HTMLElement | null = document.activeElement as HTMLElement | null;
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
  
  // Simplified layout - no longer using complex position calculations
  const isBottomLarge = () => {
    const position = getFormPosition();
    const formSize = getFormSize();
    return position === 'bottom' && formSize === 'large';
  };

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
            <TouchTarget>
              <Button
                id="date"
                variant={'outline'}
                className={cn(
                  'w-full h-full justify-start text-left font-normal min-h-[46px]', // Taller minimum height
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
            </TouchTarget>
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
          <TouchTarget>
            <Button
              id="check-availability-btn"
              type="button"
              variant="cta"
              size="compact"
              onClick={handleCheckAvailability}
              className="w-full h-full whitespace-nowrap text-xs md:text-xs lg:text-sm"
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
          </TouchTarget>
       </div>
    </div>
  );
}

    