// src/app/admin/bookings/_components/booking-table.tsx
"use client";

import * as React from 'react';
import Link from 'next/link';
import type { Booking, SerializableTimestamp } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Eye, Ban, CheckCheck, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { format, parseISO, formatDistanceToNow, isPast, differenceInCalendarDays } from 'date-fns';
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
  propertyNames: Record<string, string>;
  sortColumn?: string | null;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: (column: string) => void;
}

// Helper function to parse date safely
const parseDateSafe = (dateStr: SerializableTimestamp | null | undefined): Date | null => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    try { return parseISO(String(dateStr)); } catch { return null; }
};

const SOURCE_LABELS: Record<string, string> = {
  'airbnb': 'Airbnb',
  'booking.com': 'Booking.com',
  'vrbo': 'Vrbo',
  'direct': 'Direct',
  'stripe': 'Stripe',
};

/** Format a date compactly: "Jun 26" for current year, "Jun 26, 2027" otherwise */
function formatDateCompact(date: Date): string {
  const currentYear = new Date().getFullYear();
  return date.getFullYear() === currentYear
    ? format(date, 'MMM d')
    : format(date, 'MMM d, y');
}

/** Format guest count: "2 guests" or "2 adults, 1 child" */
function formatGuests(booking: Booking): string {
  const adults = booking.numberOfAdults || booking.numberOfGuests || 1;
  const children = booking.numberOfChildren || 0;
  if (children > 0) {
    return `${adults} adult${adults !== 1 ? 's' : ''}, ${children} child${children !== 1 ? 'ren' : ''}`;
  }
  const total = adults + children;
  return `${total} guest${total !== 1 ? 's' : ''}`;
}

/** Format currency amount */
function formatAmount(total: number | undefined, currency: string | undefined): string {
  if (total == null) return '-';
  const cur = currency || 'RON';
  return `${cur} ${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function SortableHeader({ label, columnKey, sortColumn, sortDirection, onSort }: {
  label: string;
  columnKey: string;
  sortColumn?: string | null;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: (column: string) => void;
}) {
  const isActive = sortColumn === columnKey;
  const Icon = isActive
    ? (sortDirection === 'asc' ? ArrowUp : ArrowDown)
    : ArrowUpDown;

  return (
    <div
      className={cn('flex items-center cursor-pointer select-none', onSort && 'hover:text-foreground')}
      onClick={() => onSort?.(columnKey)}
    >
      {label}
      <Icon className={cn('ml-1 h-3.5 w-3.5', isActive ? 'opacity-100' : 'opacity-40')} />
    </div>
  );
}

export function BookingTable({ bookings, propertyNames, sortColumn, sortDirection, onSort }: BookingTableProps) {
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
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allState === 'all' ? true : allState === 'some' ? 'indeterminate' : false}
                onCheckedChange={toggleAll}
                aria-label="Select all bookings"
              />
            </TableHead>
            <TableHead>
              <SortableHeader label="Guest" columnKey="guest" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
            </TableHead>
            <TableHead>Property</TableHead>
            <TableHead>
              <SortableHeader label="Dates" columnKey="checkInDate" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
            </TableHead>
            <TableHead className="text-right">
              <SortableHeader label="Amount" columnKey="amount" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label="Status" columnKey="status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                No bookings found.
              </TableCell>
            </TableRow>
          ) : bookings.map((booking) => {
            const checkInDate = parseDateSafe(booking.checkInDate);
            const checkOutDate = parseDateSafe(booking.checkOutDate);
            const holdUntilDate = parseDateSafe(booking.holdUntil);
            const isHoldExpired = holdUntilDate ? isPast(holdUntilDate) : false;
            const status = booking.status || 'unknown';
            const sourceLabel = booking.source ? SOURCE_LABELS[booking.source] || booking.source : null;
            const nights = checkInDate && checkOutDate ? differenceInCalendarDays(checkOutDate, checkInDate) : null;
            const propertyName = propertyNames[booking.propertyId] || booking.propertyId;

            return (
              <TableRow key={booking.id} data-state={isSelected(booking.id) ? 'selected' : undefined}>
                <TableCell>
                  <Checkbox
                    checked={isSelected(booking.id)}
                    onCheckedChange={() => toggle(booking.id)}
                    aria-label={`Select booking ${booking.id.substring(0, 6)}`}
                  />
                </TableCell>
                {/* Guest: name + source badge + guest count */}
                <TableCell>
                  <p className="font-medium">{booking.guestInfo.firstName} {booking.guestInfo.lastName || ''}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {sourceLabel && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal">{sourceLabel}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{formatGuests(booking)}</span>
                  </div>
                </TableCell>
                {/* Property: short name */}
                <TableCell>
                  <Link href={`/admin/properties/${booking.propertyId}/edit`} className="hover:underline text-sm">
                    {propertyName}
                  </Link>
                </TableCell>
                {/* Dates: compact range + nights */}
                <TableCell>
                  <p>
                    {checkInDate ? formatDateCompact(checkInDate) : '-'}
                    {' – '}
                    {checkOutDate ? formatDateCompact(checkOutDate) : '-'}
                  </p>
                  {nights != null && (
                    <p className="text-xs text-muted-foreground">{nights} night{nights !== 1 ? 's' : ''}</p>
                  )}
                </TableCell>
                {/* Amount */}
                <TableCell className="text-right font-medium tabular-nums">
                  {formatAmount(booking.pricing?.total, booking.pricing?.currency)}
                </TableCell>
                {/* Status + hold expiry inline */}
                <TableCell>
                  <BookingStatusUpdate bookingId={booking.id} currentStatus={status} />
                  {status === 'on-hold' && holdUntilDate && (
                    <p className={cn('text-xs mt-0.5', isHoldExpired ? 'text-destructive font-semibold' : 'text-muted-foreground')}>
                      {formatDistanceToNow(holdUntilDate, { addSuffix: true })}
                      {isHoldExpired && ' (Expired)'}
                    </p>
                  )}
                </TableCell>
                {/* Actions */}
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
