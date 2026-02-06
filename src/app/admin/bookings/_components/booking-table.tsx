// src/app/admin/bookings/_components/booking-table.tsx
"use client";

import * as React from 'react';
import Link from 'next/link';
import type { Booking, SerializableTimestamp } from "@/types";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, CalendarClock, Ban, CheckCheck, Clock } from "lucide-react"; // Icons
import { format, parseISO, formatDistanceToNow, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { ExtendHoldDialog } from './extend-hold-dialog'; // Assume this exists
import { CancelHoldButton } from './cancel-hold-button'; // Assume this exists
import { ConvertHoldButton } from './convert-hold-button'; // Assume this exists
import { BookingStatusUpdate } from './booking-status-update'; // Assume this exists for general status changes
import { useToast } from '@/hooks/use-toast';

interface BookingTableProps {
  bookings: Booking[];
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

// Helper function to parse date safely
const parseDateSafe = (dateStr: SerializableTimestamp | null | undefined): Date | null => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    try { return parseISO(String(dateStr)); } catch { return null; }
};

export function BookingTable({ bookings }: BookingTableProps) {
  const { toast } = useToast();

  return (
    <Table>
      <TableCaption>A list of property bookings.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>ID / Property</TableHead>
          <TableHead>Guest</TableHead>
          <TableHead>Dates</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Hold Expires</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings.map((booking) => {
          const createdAtDate = parseDateSafe(booking.createdAt);
          const checkInDate = parseDateSafe(booking.checkInDate);
          const checkOutDate = parseDateSafe(booking.checkOutDate);
          const holdUntilDate = parseDateSafe(booking.holdUntil);
          const isHoldExpired = holdUntilDate ? isPast(holdUntilDate) : false;
          const status = booking.status || 'unknown';

          return (
            <TableRow key={booking.id}>
              <TableCell className="font-medium">
                 <p className="text-xs text-muted-foreground break-all" title={booking.id}>{booking.id.substring(0, 6)}...</p>
                 <Link href={`/admin/properties/${booking.propertyId}/edit`} className="hover:underline text-primary text-sm">
                    {booking.propertyId}
                 </Link>
              </TableCell>
              <TableCell>
                <p>{booking.guestInfo.firstName} {booking.guestInfo.lastName || ''}</p>
                <p className="text-xs text-muted-foreground">{booking.guestInfo.email}</p>
              </TableCell>
              <TableCell>
                 {checkInDate ? format(checkInDate, 'MMM d, y') : '-'} to
                 {checkOutDate ? format(checkOutDate, 'MMM d, y') : '-'}
              </TableCell>
              <TableCell>
                 {/* Use a dedicated status update component */}
                 <BookingStatusUpdate bookingId={booking.id} currentStatus={status} />
              </TableCell>
              <TableCell>
                {status === 'on-hold' && holdUntilDate ? (
                    <span className={cn(isHoldExpired && "text-destructive font-semibold")}>
                        {formatDistanceToNow(holdUntilDate, { addSuffix: true })}
                        {isHoldExpired && " (Expired)"}
                    </span>
                 ) : ('-')}
              </TableCell>
              <TableCell className="text-right space-x-1">
                 {/* Common Actions */}
                 <Button variant="outline" size="icon" asChild title="View Details">
                     <Link href={`/admin/bookings/${booking.id}`}>
                       <Eye className="h-4 w-4" />
                     </Link>
                 </Button>

                  {/* Hold-Specific Actions */}
                 {status === 'on-hold' && (
                    <>
                         <ExtendHoldDialog bookingId={booking.id} currentHoldUntil={holdUntilDate} />
                         <CancelHoldButton bookingId={booking.id} />
                         <ConvertHoldButton bookingId={booking.id} />
                    </>
                 )}

                 {/* Add other actions like 'Cancel Confirmed Booking' if needed */}

              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}