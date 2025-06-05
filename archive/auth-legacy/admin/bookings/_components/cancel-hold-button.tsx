// src/app/admin/bookings/_components/cancel-hold-button.tsx
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
import { Ban, Loader2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { cancelBookingHoldAction } from '../actions';

interface CancelHoldButtonProps {
  bookingId: string;
}

export function CancelHoldButton({ bookingId }: CancelHoldButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleCancelHold = () => {
    startTransition(async () => {
      const result = await cancelBookingHoldAction({ bookingId });
      if (result.success) {
        toast({
          title: "Hold Cancelled",
          description: `Hold for booking ${bookingId.substring(0, 6)}... has been cancelled and dates released.`,
        });
        // Revalidation is handled by the action
      } else {
        toast({
          title: "Cancellation Failed",
          description: result.error || "Could not cancel the booking hold.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="icon" title="Cancel Hold" disabled={isPending}>
           {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Booking Hold?</AlertDialogTitle>
          <AlertDialogDescription>
            This will cancel the hold for booking ID {bookingId.substring(0, 6)}... and make the dates available again. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep Hold</AlertDialogCancel>
          <AlertDialogAction onClick={handleCancelHold} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
             {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Yes, Cancel Hold
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}