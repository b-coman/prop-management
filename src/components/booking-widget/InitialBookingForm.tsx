/**
 * InitialBookingForm - Date picker form for hero section booking widget
 *
 * @description Simple form that collects date range and redirects to V2 booking page.
 *              Part of the standalone booking widget extracted from V1 booking system.
 * @created 2026-02-04
 * @module components/booking-widget
 */

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
  size?: 'compressed' | 'large';
  language?: string;
}

export function InitialBookingForm({ property, size = 'compressed', language = 'en' }: InitialBookingFormProps) {
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { tc, t, currentLanguage } = useLanguage();

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

    // Build path-based URL: /booking/check/slug/[language]?params
    let bookingPath = `/booking/check/${property.slug}`;
    if (currentLanguage && currentLanguage !== 'en') {
      bookingPath += `/${currentLanguage}`;
    }

    // Navigate to the new availability check page with path-based language
    router.push(`${bookingPath}?${params.toString()}`);
  };

  const isButtonDisabled = !isDateRangeValid() || isLoading;

  /**
   * Get the form's position from the hero section data attribute
   */
  const getFormPosition = (): string => {
    if (typeof window === 'undefined') return 'bottom';

    try {
      const heroSection = document.getElementById('hero') || (() => {
        let element: HTMLElement | null = document.activeElement as HTMLElement | null;
        while (element && element.id !== 'hero') {
          element = element.parentElement;
        }
        return element;
      })();

      if (heroSection) {
        return heroSection.getAttribute('data-form-position') || 'bottom';
      }
    } catch (e) {
      console.error('[BookingForm] Error detecting form position:', e);
    }

    return 'bottom';
  };

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

  const isBottomLarge = () => {
    const position = getFormPosition();
    const formSize = getFormSize();
    return position === 'bottom' && formSize === 'large';
  };

  // Apply height matching for the date picker and button
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const matchElementHeights = () => {
      const datePicker = document.querySelector('#date');
      const button = document.querySelector('#check-availability-btn');

      if (datePicker && button) {
        const datePickerHeight = datePicker.getBoundingClientRect().height;
        (button as HTMLElement).style.height = `${datePickerHeight}px`;
      }
    };

    setTimeout(matchElementHeights, 100);
    setTimeout(matchElementHeights, 500);
    setTimeout(matchElementHeights, 1000);
  }, [size, date]);

  return (
    <div className="w-full InitialBookingForm">
      {/* Date Range Picker */}
      <div>
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
                  'w-full h-full justify-center text-center font-normal min-h-[46px]',
                  !date && 'text-muted-foreground',
                  isBottomLarge() && 'md:px-6 md:py-3 md:border-2 md:text-base md:font-medium md:rounded-md md:bg-background/50 hover:md:bg-background/80'
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
                  disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
              />
          </PopoverContent>
        </Popover>
      </div>

      {/* Check Availability Button */}
      <div>
          <TouchTarget>
            <Button
              id="check-availability-btn"
              type="button"
              variant="cta"
              size="compact"
              onClick={handleCheckAvailability}
              className="w-full h-full whitespace-nowrap"
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
