
"use client";

import { useState, useTransition, useEffect } from 'react'; // Added useEffect
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { updateCouponExpiryAction } from '../actions'; // Import the server action

interface CouponExpiryEditProps {
  couponId: string;
  currentExpiryDate: Date;
}

export function CouponExpiryEdit({ couponId, currentExpiryDate }: CouponExpiryEditProps) {
  const [newExpiryDate, setNewExpiryDate] = useState<Date | undefined>(currentExpiryDate);
  const [formattedDate, setFormattedDate] = useState<string | null>(null); // State for client-side formatted date
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  // Format date on the client side after hydration
  useEffect(() => {
    if (newExpiryDate) {
      setFormattedDate(format(newExpiryDate, 'PPP'));
    } else {
      setFormattedDate('No expiry');
    }
  }, [newExpiryDate]); // Re-run if newExpiryDate changes

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setNewExpiryDate(date); // Update the date state
    startTransition(async () => {
      const result = await updateCouponExpiryAction({ couponId, validUntil: date });
      if (result.success) {
        toast({
          title: "Expiry Date Updated",
          description: `Coupon expiry date changed to ${format(date, 'PPP')}.`,
        });
        setIsOpen(false); // Close popover on success
      } else {
        toast({
          title: "Update Failed",
          description: result.error || "Could not update expiry date.",
          variant: "destructive",
        });
        // Revert local state if API failed
        setNewExpiryDate(currentExpiryDate);
      }
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-[180px] justify-start text-left font-normal",
            !newExpiryDate && "text-muted-foreground"
          )}
          disabled={isPending}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {/* Render placeholder until formattedDate is ready */}
          {formattedDate !== null ? formattedDate : <span>Loading date...</span>}
           <Pencil className="ml-auto h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        <Calendar
          mode="single"
          selected={newExpiryDate}
          onSelect={handleDateSelect}
          disabled={(date) =>
             isPending || date < new Date(new Date().setHours(0, 0, 0, 0))
          } // Disable past dates and while pending
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
