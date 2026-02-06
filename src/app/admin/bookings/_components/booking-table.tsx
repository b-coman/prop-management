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
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Eye, Ban, CheckCheck } from "lucide-react";
import { format, parseISO, formatDistanceToNow, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { ExtendHoldDialog } from './extend-hold-dialog';
import { CancelHoldButton } from './cancel-hold-button';
import { ConvertHoldButton } from './convert-hold-button';
import { BookingStatusUpdate } from './booking-status-update';
import { useToast } from '@/hooks/use-toast';
import { useRowSelection } from '@/hooks/use-row-selection';
import { BulkActionBar } from '@/components/admin/BulkActionBar';
import type { BulkAction } from '@/components/admin/BulkActionBar';
import { bulkCancelBookings, bulkCompleteBookings } from '../bulk-actions';

interface BookingTableProps {
  bookings: Booking[];
}

// Helper function to parse date safely
const parseDateSafe = (dateStr: SerializableTimestamp | null | undefined): Date | null => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    try { return parseISO(String(dateStr)); } catch { return null; }
};

export function BookingTable({ bookings }: BookingTableProps) {
  const { toast } = useToast();
  const rowIds = React.useMemo(() => bookings.map(b => b.id), [bookings]);
  const { selectedIds, selectedCount, isSelected, toggle, toggleAll, clearSelection, allState } = useRowSelection(rowIds);

  const bulkActions: BulkAction[] = React.useMemo(() => [
    {
      label: 'Cancel Selected',
      icon: Ban,
      variant: 'destructive' as const,
      confirm: {
        title: 'Cancel selected bookings?',
        description: `This will cancel ${selectedCount} booking(s) and release their availability. Only pending and on-hold bookings will be affected.`,
      },
      onExecute: bulkCancelBookings,
    },
    {
      label: 'Mark Completed',
      icon: CheckCheck,
      variant: 'default' as const,
      confirm: {
        title: 'Mark selected bookings as completed?',
        description: `This will mark ${selectedCount} booking(s) as completed. Only confirmed bookings with past checkout dates will be affected.`,
      },
      onExecute: bulkCompleteBookings,
    },
  ], [selectedCount]);

  return (
    <>
      <BulkActionBar
        selectedIds={selectedIds}
        entityName="booking(s)"
        actions={bulkActions}
        onClearSelection={clearSelection}
      />
      <Table>
        <TableCaption>A list of property bookings.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allState === 'all' ? true : allState === 'some' ? 'indeterminate' : false}
                onCheckedChange={toggleAll}
                aria-label="Select all bookings"
              />
            </TableHead>
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
            const checkInDate = parseDateSafe(booking.checkInDate);
            const checkOutDate = parseDateSafe(booking.checkOutDate);
            const holdUntilDate = parseDateSafe(booking.holdUntil);
            const isHoldExpired = holdUntilDate ? isPast(holdUntilDate) : false;
            const status = booking.status || 'unknown';

            return (
              <TableRow key={booking.id} data-state={isSelected(booking.id) ? 'selected' : undefined}>
                <TableCell>
                  <Checkbox
                    checked={isSelected(booking.id)}
                    onCheckedChange={() => toggle(booking.id)}
                    aria-label={`Select booking ${booking.id.substring(0, 6)}`}
                  />
                </TableCell>
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
                   <Button variant="outline" size="icon" asChild title="View Details">
                       <Link href={`/admin/bookings/${booking.id}`}>
                         <Eye className="h-4 w-4" />
                       </Link>
                   </Button>

                   {status === 'on-hold' && (
                      <>
                           <ExtendHoldDialog bookingId={booking.id} currentHoldUntil={holdUntilDate} />
                           <CancelHoldButton bookingId={booking.id} />
                           <ConvertHoldButton bookingId={booking.id} />
                      </>
                   )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}
