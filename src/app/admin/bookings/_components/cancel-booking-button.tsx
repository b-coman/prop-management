// src/app/admin/bookings/_components/cancel-booking-button.tsx
"use client";

import * as React from 'react';
import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { Ban, CalendarIcon, Loader2 } from 'lucide-react';

import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { cancelBookingAction } from '../actions';

interface CancelBookingButtonProps {
  bookingId: string;
}

export function CancelBookingButton({ bookingId }: CancelBookingButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [cancelDate, setCancelDate] = useState<Date>(new Date());
  const { toast } = useToast();

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelBookingAction({
        bookingId,
        cancelledAt: format(cancelDate, 'yyyy-MM-dd'),
      });
      if (result.success) {
        toast({
          title: 'Booking Cancelled',
          description: `Booking ${bookingId.substring(0, 8)}... has been cancelled and dates released.`,
        });
      } else {
        toast({
          title: 'Cancellation Failed',
          description: result.error || 'Could not cancel the booking.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={isPending}>
          <Ban className="h-4 w-4 mr-1" />
          Cancel Booking
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
          <AlertDialogDescription>
            This will cancel booking {bookingId.substring(0, 8)}... and release the blocked dates. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-2">
          <Label className="text-sm font-medium">Cancellation Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('w-full justify-start text-left font-normal mt-1.5')}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(cancelDate, 'PPP')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={cancelDate}
                onSelect={(d) => { if (d) setCancelDate(d); }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground mt-1">When the cancellation occurred on the platform</p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep Booking</AlertDialogCancel>
          <Button variant="destructive" onClick={handleCancel} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Yes, Cancel Booking
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
