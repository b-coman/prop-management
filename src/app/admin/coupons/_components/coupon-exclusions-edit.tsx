"use client";

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Plus, Trash2, Loader2, Save, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { updateCouponExclusionsAction } from '../actions'; // Import the server action
import type { DateRange } from 'react-day-picker';
import { Badge } from '@/components/ui/badge'; // Import Badge
import { ScrollArea } from '@/components/ui/scroll-area'; // Import ScrollArea

interface CouponExclusionsEditProps {
  couponId: string;
  currentExclusionPeriods: Array<{ start: Date; end: Date }>;
}

export function CouponExclusionsEdit({
  couponId,
  currentExclusionPeriods,
}: CouponExclusionsEditProps) {
  // Initialize local state with dates converted to Date objects
  const [exclusions, setExclusions] = useState<Array<{ start?: Date; end?: Date }>>(
    currentExclusionPeriods.map(p => ({ start: p.start, end: p.end }))
  );
  const [newPeriod, setNewPeriod] = useState<DateRange | undefined>(undefined);
  const [isAdding, setIsAdding] = useState(false); // State to control add popover
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleAddExclusion = () => {
    if (newPeriod?.from && newPeriod?.to) {
        // Basic validation: end date must be >= start date
         if (newPeriod.to < newPeriod.from) {
            toast({ title: "Invalid Date Range", description: "End date must be on or after start date.", variant: "destructive" });
            return;
         }
       setExclusions([...exclusions, { start: newPeriod.from, end: newPeriod.to }]);
       setNewPeriod(undefined); // Reset for next addition
       setIsAdding(false); // Close popover
    } else {
         toast({ title: "Incomplete Date Range", description: "Please select both a start and end date.", variant: "destructive" });
    }
  };

  const handleRemoveExclusion = (index: number) => {
    setExclusions(exclusions.filter((_, i) => i !== index));
  };

  const handleSaveChanges = () => {
    // Validate all periods before saving
    const validExclusions = exclusions.filter(p => p.start && p.end && p.end >= p.start) as Array<{ start: Date; end: Date }>;

     if (validExclusions.length !== exclusions.length) {
        toast({ title: "Invalid Periods Found", description: "Some exclusion periods have invalid dates. Please correct them before saving.", variant: "destructive" });
        // Optionally highlight invalid periods
        return;
     }

    startTransition(async () => {
      const result = await updateCouponExclusionsAction({
        couponId,
        // Ensure dates are correctly formatted if needed by action, here we pass Date objects
        exclusionPeriods: validExclusions,
      });

      if (result.success) {
        toast({
          title: "Exclusion Periods Updated",
          description: `Exclusions saved successfully.`,
        });
      } else {
        toast({
          title: "Update Failed",
          description: result.error || "Could not update exclusion periods.",
          variant: "destructive",
        });
        // Optionally revert local state on failure:
        // setExclusions(currentExclusionPeriods.map(p => ({ start: p.start, end: p.end })));
      }
    });
  };

  return (
    <div className="space-y-3">
       {isPending && (
            <div className="flex items-center justify-center text-muted-foreground text-sm">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
            </div>
        )}
      {/* Display Existing Exclusions */}
      <ScrollArea className="h-24 w-full rounded-md border p-2"> {/* Scrollable area */}
        {exclusions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">No exclusion periods defined.</p>
        ) : (
          <ul className="space-y-1">
            {exclusions.map((period, index) => (
              <li key={index} className="flex items-center justify-between text-sm bg-secondary/50 p-1 rounded">
                 <span>
                     {period.start ? format(period.start, 'LLL dd, y') : '...'} -{' '}
                     {period.end ? format(period.end, 'LLL dd, y') : '...'}
                     {(!period.start || !period.end || (period.start && period.end && period.end < period.start)) && (
                         <Badge variant="destructive" className="ml-2">Invalid</Badge>
                     )}
                 </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={() => handleRemoveExclusion(index)}
                  disabled={isPending}
                  aria-label={`Remove exclusion period ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      {/* Add New Exclusion Period */}
      <div className="flex items-center gap-2">
        <Popover open={isAdding} onOpenChange={setIsAdding}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              <Plus className="mr-1 h-4 w-4" /> Add Exclusion
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={newPeriod}
              onSelect={setNewPeriod}
              numberOfMonths={1} // Keep it compact
              initialFocus
            />
             <div className="p-2 border-t text-right">
                <Button size="sm" onClick={handleAddExclusion}>Add Period</Button>
             </div>
          </PopoverContent>
        </Popover>

         {/* Save Changes Button */}
         <Button
             size="sm"
             onClick={handleSaveChanges}
             disabled={isPending || JSON.stringify(exclusions) === JSON.stringify(currentExclusionPeriods.map(p => ({ start: p.start, end: p.end })))} // Disable if no changes
             className="ml-auto" // Push save button to the right
         >
           {isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Save Exclusions
         </Button>
      </div>
    </div>
  );
}
