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

export function BookingTable({ bookings, sortColumn, sortDirection, onSort }: BookingTableProps) {
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
            <TableHead>ID / Property</TableHead>
            <TableHead>
              <SortableHeader label="Guest" columnKey="guest" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label="Dates" columnKey="checkInDate" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label="Status" columnKey="status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
            </TableHead>
            <TableHead>Hold Expires</TableHead>
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
                  {sourceLabel && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal">{sourceLabel}</Badge>
                  )}
                  {!sourceLabel && booking.guestInfo.email && (
                    <p className="text-xs text-muted-foreground">{booking.guestInfo.email}</p>
                  )}
                </TableCell>
                <TableCell>
                   {checkInDate ? format(checkInDate, 'MMM d, y') : '-'} to{' '}
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
