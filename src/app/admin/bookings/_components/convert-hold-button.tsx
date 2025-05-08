// src/app/admin/bookings/_components/convert-hold-button.tsx
"use client";

import * as React from 'react';
import { useState, useTransition } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CheckCheck, Loader2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { convertHoldToBookingAction } from '../actions';

interface ConvertHoldButtonProps {
  bookingId: string;
}

export function ConvertHoldButton({ bookingId }: ConvertHoldButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleConvertHold = () => {
    startTransition(async () => {
      const result = await convertHoldToBookingAction({ bookingId });
      if (result.success) {
        toast({
          title: "Hold Converted",
          description: `Hold for booking ${bookingId.substring(0, 6)}... manually converted to 'confirmed'.`,
        });
        // Revalidation is handled by the action
      } else {
        toast({
          title: "Conversion Failed",
          description: result.error || "Could not convert the hold to a booking.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="secondary" size="icon" title="Convert Hold to Confirmed Booking" disabled={isPending}>
           {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4 text-green-600" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Convert Hold to Confirmed Booking?</AlertDialogTitle>
          <AlertDialogDescription>
            This will change the status of booking {bookingId.substring(0, 6)}... to 'confirmed'. Ensure payment has been handled separately if needed. This action cannot be undone easily.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConvertHold} disabled={isPending} className="bg-green-600 hover:bg-green-700 text-white">
             {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Yes, Convert to Confirmed
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}