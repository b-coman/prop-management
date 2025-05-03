"use client";

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { updateCouponBookingValidityAction } from '../actions'; // Import the server action
import type { DateRange } from 'react-day-picker';

interface CouponBookingValidityEditProps {
  couponId: string;
  currentBookingValidFrom: Date | null;
  currentBookingValidUntil: Date | null;
}

export function CouponBookingValidityEdit({
  couponId,
  currentBookingValidFrom,
  currentBookingValidUntil,
}: CouponBookingValidityEditProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: currentBookingValidFrom ?? undefined,
    to: currentBookingValidUntil ?? undefined,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSave = () => {
     if (dateRange?.from && dateRange?.to && dateRange.to < dateRange.from) {
        toast({
            title: "Invalid Date Range",
            description: "Booking validity end date must be on or after the start date.",
            variant: "destructive",
        });
        return;
    }

    startTransition(async () => {
        // Ensure null is sent if date is undefined
       const fromDate = dateRange?.from ?? null;
       const toDate = dateRange?.to ?? null;

       const result = await updateCouponBookingValidityAction({
         couponId,
         bookingValidFrom: fromDate,
         bookingValidUntil: toDate,
       });

      if (result.success) {
        toast({
          title: "Booking Validity Updated",
          description: `Validity period updated successfully.`,
        });
        setIsOpen(false); // Close popover on success
      } else {
        toast({
          title: "Update Failed",
          description: result.error || "Could not update booking validity.",
          variant: "destructive",
        });
        // Optionally revert local state:
        // setDateRange({ from: currentBookingValidFrom ?? undefined, to: currentBookingValidUntil ?? undefined });
      }
    });
  };

   const handleClear = () => {
       setDateRange(undefined); // Clear local state first

       startTransition(async () => {
            const result = await updateCouponBookingValidityAction({
                couponId,
                bookingValidFrom: null,
                bookingValidUntil: null,
            });

            if (result.success) {
                toast({
                    title: "Booking Validity Cleared",
                    description: `Coupon is now valid for any booking dates.`,
                });
                setIsOpen(false);
            } else {
                 toast({
                    title: "Clear Failed",
                    description: result.error || "Could not clear booking validity.",
                    variant: "destructive",
                    
                });
                 // Revert local state if API failed
                 setDateRange({ from: currentBookingValidFrom ?? undefined, to: currentBookingValidUntil ?? undefined });
            }
        });
   };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "w-[250px] justify-start text-left font-normal", // Adjusted width
            !dateRange?.from && !dateRange?.to && "text-muted-foreground" // Style when no dates are set
          )}
          disabled={isPending}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateRange?.from ? (
             dateRange.to ? (
                <>
                 {format(dateRange.from, 'LLL dd, y')} - {format(dateRange.to, 'LLL dd, y')}
                </>
             ) : (
                `From ${format(dateRange.from, 'LLL dd, y')}`
             )
          ) : dateRange?.to ? (
             `Until ${format(dateRange.to, 'LLL dd, y')}`
          ) : (
            <span>Any Dates</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
         <Calendar
          mode="range"
          selected={dateRange}
          onSelect={setDateRange}
          disabled={isPending}
          numberOfMonths={2} // Show two months for range selection
          initialFocus
        />
        <div className="p-3 border-t flex justify-between items-center">
           <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={isPending || (!dateRange?.from && !dateRange?.to)} // Disable clear if already cleared
            >
             <X className="mr-1 h-4 w-4" /> Clear Dates
           </Button>
           <Button onClick={handleSave} disabled={isPending} size="sm">
             <Save className="mr-1 h-4 w-4" /> Save Changes
           </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
