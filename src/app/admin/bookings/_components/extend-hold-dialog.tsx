// src/app/admin/bookings/_components/extend-hold-dialog.tsx
"use client";

import * as React from 'react';
import { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarClock, Loader2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { extendBookingHoldAction } from '../actions';
import { format } from 'date-fns';

interface ExtendHoldDialogProps {
  bookingId: string;
  currentHoldUntil: Date | null;
}

export function ExtendHoldDialog({ bookingId, currentHoldUntil }: ExtendHoldDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoursToAdd, setHoursToAdd] = useState<number>(24); // Default to extend by 24 hours
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleExtendHold = () => {
    if (hoursToAdd <= 0) {
      toast({ title: "Invalid Input", description: "Please enter a positive number of hours.", variant: "destructive" });
      return;
    }

    startTransition(async () => {
      const result = await extendBookingHoldAction({ bookingId, hoursToAdd });
      if (result.success && result.newHoldUntil) {
        toast({
          title: "Hold Extended",
          description: `Hold for booking ${bookingId.substring(0, 6)}... extended to ${format(new Date(result.newHoldUntil), 'PPp')}.`,
        });
        setIsOpen(false); // Close dialog on success
      } else {
        toast({
          title: "Extension Failed",
          description: result.error || "Could not extend booking hold.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Extend Hold Period" disabled={!currentHoldUntil}>
          <CalendarClock className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Extend Hold Period</DialogTitle>
          <DialogDescription>
            Booking ID: {bookingId.substring(0, 6)}...<br />
            Current Expiry: {currentHoldUntil ? format(currentHoldUntil, 'PPp') : 'N/A'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="hours" className="text-right">
              Extend By (Hours)
            </Label>
            <Input
              id="hours"
              type="number"
              value={hoursToAdd}
              onChange={(e) => setHoursToAdd(parseInt(e.target.value, 10) || 0)}
              className="col-span-3"
              min="1"
              disabled={isPending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => setIsOpen(false)} disabled={isPending}>Cancel</Button>
          <Button type="button" onClick={handleExtendHold} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Extend Hold
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}