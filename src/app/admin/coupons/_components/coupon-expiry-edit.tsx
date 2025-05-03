
"use client";

import { useState, useTransition } from 'react';
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
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setNewExpiryDate(date);
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
        // Optionally revert local state: setNewExpiryDate(currentExpiryDate);
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
          {newExpiryDate ? format(newExpiryDate, 'PPP') : <span>No expiry</span>}
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
