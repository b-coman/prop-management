'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatPrice } from '@/lib/utils';

// Interface for the day data
interface DayData {
  basePrice: number;
  adjustedPrice: number;
  available: boolean;
  minimumStay: number;
  priceSource: string;
  date?: string;
  isWeekend?: boolean;
  seasonId?: string;
  seasonName?: string;
  overrideId?: string;
  reason?: string;
}

interface EditDayDialogProps {
  isOpen: boolean;
  onClose: () => void;
  dayData: DayData;
  dayNumber: number;
  monthStr: string;
  year: number;
  month: number;
  propertyId: string;
  onUpdate: (updatedData: any) => Promise<void>;
}

export function EditDayDialog({
  isOpen,
  onClose,
  dayData,
  dayNumber,
  monthStr,
  year,
  month,
  propertyId,
  onUpdate
}: EditDayDialogProps) {
  // Ensure dayNumber is a valid integer between 1-31
  const validDayNumber = Math.min(Math.max(1, parseInt(String(dayNumber), 10) || 1), 31);
  
  // Get month name without year (in case monthStr contains the year)
  const cleanMonthStr = monthStr.replace(/\s+\d{4}$/, '');
  
  // Format date for UI
  const displayDate = `${cleanMonthStr} ${validDayNumber}, ${year}`;
  
  // Format date for API - ISO format
  const dateStr = `${year}-${month.toString().padStart(2, '0')}-${validDayNumber.toString().padStart(2, '0')}`;
  
  console.log("Formatted dates:", { displayDate, dateStr, monthStr, cleanMonthStr, validDayNumber });
  
  // State for form fields
  const [price, setPrice] = useState(dayData.adjustedPrice.toString());
  const [available, setAvailable] = useState(dayData.available);
  const [minimumStay, setMinimumStay] = useState(dayData.minimumStay.toString());
  const [reason, setReason] = useState(dayData.reason || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle form submission
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      
      // Prepare the update data
      const updateData: any = {
        date: dateStr,
        customPrice: parseFloat(price),
        available,
        minimumStay: parseInt(minimumStay, 10),
        reason,
        propertyId
      };
      
      // If there's already an override ID, include it
      if (dayData.overrideId) {
        updateData.id = dayData.overrideId;
      }
      
      await onUpdate(updateData);
      onClose();
    } catch (error) {
      console.error('Error updating day:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Day: {displayDate}</DialogTitle>
          <DialogDescription>
            {dayData.priceSource !== 'base' && `${dayData.priceSource === 'override' ? 'Custom override' : dayData.priceSource === 'season' ? `Season: ${dayData.seasonName}` : 'Weekend pricing'}`}
          </DialogDescription>
          <p className="text-sm text-muted-foreground mt-1">
            Base price: {formatPrice(dayData.basePrice)}
          </p>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="price" className="text-right">
              Custom Price
            </Label>
            <Input
              id="price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              className="col-span-3"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="minimumStay" className="text-right">
              Minimum Stay
            </Label>
            <Input
              id="minimumStay"
              value={minimumStay}
              onChange={(e) => setMinimumStay(e.target.value)}
              type="number"
              min="1"
              className="col-span-3"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="available" className="text-right">
              Available
            </Label>
            <div className="flex items-center space-x-2 col-span-3">
              <Switch
                id="available"
                checked={available}
                onCheckedChange={setAvailable}
              />
              <Label htmlFor="available">
                {available ? 'Available for booking' : 'Not available'}
              </Label>
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="reason" className="text-right">
              Reason
            </Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Holiday, event, etc."
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            type="button" 
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}