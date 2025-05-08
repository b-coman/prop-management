// src/components/booking/guest-info-form.tsx
"use client";

import * as React from 'react';
import {
  TicketPercent,
  X,
  Loader2,
  Mail, // Added for clarity
  Phone as PhoneIcon, // Added for clarity and renamed Phone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import type { Property, CurrencyCode, PriceCalculationResult } from '@/types';
import { validateAndApplyCoupon } from '@/services/couponService';
import { useCurrency } from '@/contexts/CurrencyContext';

interface GuestInfoFormProps {
  property: Property;
  // numberOfGuests and setNumberOfGuests removed - managed by parent AvailabilityCheck
  firstName: string;
  setFirstName: (value: string) => void;
  lastName: string;
  setLastName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  checkInDate: Date | null; // Still needed for coupon validation
  checkOutDate: Date | null; // Still needed for coupon validation
  appliedCoupon: { code: string; discountPercentage: number } | null;
  setAppliedCoupon: React.Dispatch<React.SetStateAction<{ code: string; discountPercentage: number } | null>>;
  pricingDetailsInBaseCurrency: PriceCalculationResult | null; // Needed for display inside summary/form
  isProcessingBooking: boolean; // To disable inputs/buttons during submission
  // displayGuests prop removed as guest count is handled by parent
}

// Helper Input component (can be moved to ui if used elsewhere)
const FormInput = ({ label, icon: Icon, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string, icon?: React.ElementType }) => (
    <div className="space-y-1">
        <Label htmlFor={props.id || props.name} className="flex items-center gap-1 text-xs text-muted-foreground">
           {Icon && <Icon className="h-3 w-3" />}
           {label}
        </Label>
        <Input id={props.id || props.name} {...props} />
    </div>
);


export function GuestInfoForm({
  property,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  email,
  setEmail,
  phone,
  setPhone,
  checkInDate,
  checkOutDate,
  appliedCoupon,
  setAppliedCoupon,
  pricingDetailsInBaseCurrency, // Keep for display within this form area if needed, or remove if summary handles it
  isProcessingBooking,
}: GuestInfoFormProps) {
  const [couponCode, setCouponCode] = React.useState(appliedCoupon?.code || '');
  const [couponError, setCouponError] = React.useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = React.useState(false);
  const { toast } = useToast();
  // Currency context might not be needed here if summary handles display, but keep if price is shown here too
  const { selectedCurrency, formatPrice } = useCurrency();

  const handleGuestInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'firstName') setFirstName(value);
    else if (name === 'lastName') setLastName(value);
    else if (name === 'email') setEmail(value);
    else if (name === 'phone') setPhone(value);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code.');
      return;
    }
    if (!checkInDate || !checkOutDate) {
      setCouponError('Please select valid booking dates first.');
      return;
    }

    setIsApplyingCoupon(true);
    setCouponError(null);
    setAppliedCoupon(null); // Clear previous coupon

    try {
      const result = await validateAndApplyCoupon(couponCode.trim(), checkInDate, checkOutDate, property.slug);
      if (result.error) {
        setCouponError(result.error);
      } else if (result.discountPercentage) {
        setAppliedCoupon({ code: couponCode.trim().toUpperCase(), discountPercentage: result.discountPercentage });
        toast({
          title: "Coupon Applied!",
          description: `Successfully applied ${result.discountPercentage}% discount.`,
        });
      }
    } catch (error) {
      console.error('Error applying coupon:', error);
      setCouponError('Could not apply coupon. Please try again.');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError(null);
    toast({ title: "Coupon Removed" });
  };

  // Guest count input is removed from here

  return (
    <div className="space-y-4">
      {/* Guest Information */}
      <h3 className="font-semibold text-base pt-2">Your Information</h3>
       {/* Names - side by side on larger screens */}
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
           <FormInput label="First Name" name="firstName" value={firstName} onChange={handleGuestInfoChange} required disabled={isProcessingBooking} />
           <FormInput label="Last Name" name="lastName" value={lastName} onChange={handleGuestInfoChange} required disabled={isProcessingBooking} />
       </div>
        {/* Email and Phone - side by side on larger screens */}
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
         <FormInput label="Email" name="email" type="email" value={email} onChange={handleGuestInfoChange} icon={Mail} required disabled={isProcessingBooking} />
         <FormInput label="Phone Number" name="phone" type="tel" value={phone} onChange={handleGuestInfoChange} icon={PhoneIcon} required disabled={isProcessingBooking} />
       </div>

       {/* Coupon Code */}
       <div className="space-y-1 pt-2">
         <Label htmlFor="coupon">Discount Coupon (Optional)</Label>
         <div className="flex gap-2 mt-1">
           <Input id="coupon" placeholder="Enter code" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} disabled={isApplyingCoupon || !!appliedCoupon || isProcessingBooking} className="flex-grow" />
           {!appliedCoupon ? (
             <Button type="button" variant="outline" onClick={handleApplyCoupon} disabled={isApplyingCoupon || !couponCode.trim() || isProcessingBooking} className="shrink-0">
               {isApplyingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : <TicketPercent className="h-4 w-4" />}
             </Button>
           ) : (
             <Button type="button" variant="ghost" size="icon" onClick={handleRemoveCoupon} disabled={isProcessingBooking} className="shrink-0"><X className="h-4 w-4 text-destructive" /></Button>
           )}
         </div>
         <div className="h-4 text-xs mt-1">
           {couponError && <p className="text-destructive">{couponError}</p>}
           {appliedCoupon && <p className="text-green-600">Applied: {appliedCoupon.code} ({appliedCoupon.discountPercentage}%)</p>}
         </div>
       </div>
       {/* Removed guest count modification controls */}
        {/* Price details might be displayed in BookingSummary or here depending on final layout */}
       {/* Example of showing price if needed here:
       {pricingDetailsInBaseCurrency && (
           <div className="mt-4 border-t pt-4">
               <p className="font-bold">Total: {formatPrice(pricingDetailsInBaseCurrency.total, selectedCurrency)}</p>
           </div>
       )} */}

    </div>
  );
}
