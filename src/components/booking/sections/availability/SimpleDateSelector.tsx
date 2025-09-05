"use client";

import React from 'react';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface SimpleDateSelectorProps {
  date: Date | null;
  onChange: (date: Date | null) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  className?: string;
  unavailableDates?: Date[];
}

/**
 * A simple date selector component with popover calendar
 */
export const SimpleDateSelector = React.memo(function SimpleDateSelector({
  date,
  onChange,
  label,
  placeholder = "Select date",
  disabled = false,
  minDate,
  className,
  unavailableDates = []
}: SimpleDateSelectorProps) {
  const [open, setOpen] = React.useState(false);

  // Log when the calendar is opened to confirm unavailable dates are loaded
  React.useEffect(() => {
    if (open && unavailableDates.length > 0) {
      console.log(`[SimpleDateSelector] Calendar opened with ${unavailableDates.length} unavailable dates`);
    }
  }, [open, unavailableDates.length]);
  
  // Calculate the default month to display
  // If a date is selected, use that date's month
  // Otherwise, use the current month
  const defaultMonth = date || undefined;

  return (
    <div className={cn("space-y-1", className)}>
      <Label className="mb-1 block text-sm font-medium">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-between text-left font-normal h-10",
              !date && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <div className="flex items-center">
              <Calendar className="mr-2 h-4 w-4" />
              {date ? format(date, 'MMM dd, yyyy') : placeholder}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            mode="single"
            selected={date || undefined}
            onSelect={(day) => onChange(day || null)}
            initialFocus
            defaultMonth={defaultMonth}
            disabled={minDate ? { before: minDate } : { before: new Date() }}
            modifiers={{
              unavailable: unavailableDates
            }}
            modifiersStyles={{
              unavailable: {
                textDecoration: 'line-through',
                color: 'hsl(var(--muted-foreground))',
                opacity: 0.6,
                pointerEvents: 'none' as const
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
});
