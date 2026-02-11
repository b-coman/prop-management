'use client';

import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { AvailabilityDayData } from '../_lib/availability-types';
import { CalendarDays, Globe, LogOut, User } from 'lucide-react';

interface DayDetailPopoverProps {
  dayData: AvailabilityDayData;
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusBadgeVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  confirmed: 'default',
  completed: 'secondary',
  'on-hold': 'outline',
};

export function DayDetailPopover({ dayData, children, open, onOpenChange }: DayDetailPopoverProps) {
  const { status, bookingDetails, externalFeedName, checkoutBooking } = dayData;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start" side="bottom">
        {/* Checkout note — shown above main content */}
        {checkoutBooking && (
          <div className={`flex items-center gap-2 text-sm ${
            status === 'booked' || status === 'on-hold' || status === 'external-block' ? 'mb-3 pb-3 border-b' : ''
          }`}>
            <LogOut className={`h-3.5 w-3.5 ${
              checkoutBooking.barColor === 'amber' ? 'text-amber-600' : 'text-emerald-600'
            }`} />
            <span className="text-muted-foreground">
              Checkout: <span className="font-medium text-foreground">{checkoutBooking.guestName}</span>
            </span>
          </div>
        )}

        {(status === 'booked' || status === 'on-hold') && bookingDetails && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">
                {status === 'on-hold' ? 'Hold Details' : 'Booking Details'}
              </span>
              <Badge variant={statusBadgeVariant[bookingDetails.status] || 'outline'}>
                {bookingDetails.status}
              </Badge>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{bookingDetails.guestName}</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{bookingDetails.checkIn} &rarr; {bookingDetails.checkOut}</span>
              </div>
              {bookingDetails.source && (
                <div className="text-xs text-muted-foreground">
                  Source: {bookingDetails.source}
                </div>
              )}
              {status === 'on-hold' && bookingDetails.holdUntil && (
                <div className="text-xs text-amber-600">
                  Hold expires: {new Date(bookingDetails.holdUntil).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}

        {status === 'external-block' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-semibold">External Block</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Blocked by external calendar: <span className="font-medium text-foreground">{externalFeedName}</span>
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
