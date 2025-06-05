// src/app/admin/bookings/_components/booking-status-update.tsx
"use client";

import * as React from "react";
import { useState, useTransition } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Booking } from '@/types';
import { updateBookingStatus } from '@/services/bookingService'; // Use service function directly if action not needed
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Loader2 } from "lucide-react";

interface BookingStatusUpdateProps {
  bookingId: string;
  currentStatus: Booking['status'];
}

// Helper function to get status color
const getStatusColor = (status?: string): string => {
   switch (status) {
     case 'pending': return 'bg-gray-100 text-gray-800 border-gray-300';
     case 'on-hold': return 'bg-orange-100 text-orange-800 border-orange-300';
     case 'confirmed': return 'bg-green-100 text-green-800 border-green-300';
     case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
     case 'payment_failed': return 'bg-red-200 text-red-900 border-red-400';
     case 'completed': return 'bg-blue-100 text-blue-800 border-blue-300';
     default: return 'bg-gray-100 text-gray-800 border-gray-300';
   }
 };

const statusOptions: Booking['status'][] = ["pending", "on-hold", "confirmed", "cancelled", "completed", "payment_failed"];

export function BookingStatusUpdate({ bookingId, currentStatus }: BookingStatusUpdateProps) {
  const [status, setStatus] = useState<Booking['status']>(currentStatus);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleStatusChange = (newStatus: string) => {
    const validStatus = newStatus as Booking['status'];
    if (!validStatus || validStatus === status) return;

    startTransition(async () => {
      try {
        await updateBookingStatus(bookingId, validStatus);
        setStatus(validStatus);
        toast({ title: "Status Updated", description: `Booking status changed to ${validStatus}.` });
      } catch (error) {
        toast({ title: "Update Failed", description: error instanceof Error ? error.message : "Could not update status.", variant: "destructive" });
        // Revert local state on failure
        setStatus(currentStatus);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      <Select value={status} onValueChange={handleStatusChange} disabled={isPending}>
        <SelectTrigger className={cn("w-[130px] h-8 text-xs capitalize focus:ring-0 focus:ring-offset-0", getStatusColor(status))} disabled={isPending}>
          <SelectValue placeholder="Set status" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option} value={option} className="capitalize text-xs">
               {option.replace('_', ' ')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}