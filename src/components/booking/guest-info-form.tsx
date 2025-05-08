// src/components/booking/guest-info-form.tsx
"use client";

import * as React from 'react';
import {
  Users,
  TicketPercent,
  X,
  Mail,
  Phone,
  Loader2,
  Minus,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import type { Property, CurrencyCode, PriceCalculationResult } from '@/types';
import { validateAndApplyCoupon } from '@/services/couponService';
import { useCurrency } from '@/contexts/CurrencyContext'; // Import useCurrency

interface GuestInfoFormProps {
  property: Property;
  numberOfGuests: number; // Still receive the raw state value for logic
  setNumberOfGuests: React.Dispatch<React.SetStateAction<number>>;
  firstName: string;
  setFirstName: (value: string) => void;
  lastName: string;
  setLastName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  checkInDate: Date | null; // Needed for coupon validation
  checkOutDate: Date | null; // Needed for coupon validation
  appliedCoupon: { code: string; discountPercentage: number } | null;
  setAppliedCoupon: React.Dispatch<React.SetStateAction<{ code: string; discountPercentage: number } | null>>;
  pricingDetailsInBaseCurrency: PriceCalculationResult | null;
  isProcessingBooking: boolean;
  displayGuests: number; // Accept the display state
}

export function GuestInfoForm({
  property,
  numberOfGuests, // Raw state for logic
  setNumberOfGuests,
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
  pricingDetailsInBaseCurrency,
  isProcessingBooking,
  displayGuests, // Use the display state for UI
}: GuestInfoFormProps) {
  const [couponCode, setCouponCode] = React.useState(appliedCoupon?.code || '');
  const [couponError, setCouponError] = React.useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = React.useState(false);
  const { toast } = useToast();
  const { selectedCurrency, convertToSelectedCurrency, formatPrice, baseCurrencyForProperty } = useCurrency();
  const propertyBaseCcy = baseCurrencyForProperty(property.baseCurrency);

  // Use the derived state for display and validation logic internally
  // const guestsDisplay = React.useMemo(() => {
  //   return typeof numberOfGuests === 'number' && !isNaN(numberOfGuests) && numberOfGuests > 0
  //     ? numberOfGuests
  //     : (property.baseOccupancy || 1);
  // }, [numberOfGuests, property.baseOccupancy]);
  // Removed guestsDisplay useMemo, will use displayGuests prop for UI consistency

  const handleGuestChange = (change: number) => {
    setNumberOfGuests((prev) => {
      // Use the current value from session storage (prev) or default
      const currentGuests = typeof prev === 'number' && !isNaN(prev) && prev > 0
        ? prev
        : (property.baseOccupancy || 1);
      const newCount = currentGuests + change;
      // Ensure bounds are respected
      return Math.max(1, Math.min(newCount, property.maxGuests));
    });
  };


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
    setAppliedCoupon(null); // Clear previous coupon before applying new one

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

  const pricingDetailsForDisplay = React.useMemo(() => {
    if (pricingDetailsInBaseCurrency) {
      return {
        basePrice: convertToSelectedCurrency(pricingDetailsInBaseCurrency.basePrice, propertyBaseCcy),
        extraGuestFee: convertToSelectedCurrency(pricingDetailsInBaseCurrency.extraGuestFeeTotal, propertyBaseCcy),
        cleaningFee: convertToSelectedCurrency(pricingDetailsInBaseCurrency.cleaningFee, propertyBaseCcy),
        subtotal: convertToSelectedCurrency(pricingDetailsInBaseCurrency.subtotal, propertyBaseCcy),
        discountAmount: convertToSelectedCurrency(pricingDetailsInBaseCurrency.discountAmount, propertyBaseCcy),
        total: convertToSelectedCurrency(pricingDetailsInBaseCurrency.total, propertyBaseCcy),
        numberOfNights: pricingDetailsInBaseCurrency.numberOfNights,
      };
    }
    return null;
  }, [pricingDetailsInBaseCurrency, convertToSelectedCurrency, propertyBaseCcy]);

  return (
    <div className="space-y-6">
       {/* Number of Guests is now handled in AvailabilityCheck, but display pricing based on it */}

       <Separator />

      {/* Price Details */}
      {pricingDetailsForDisplay && (
        <div className="space-y-2 text-sm">
          <h3 className="font-semibold mb-2">Price Details ({selectedCurrency})</h3>
          <div className="flex justify-between"><span>Base price ({pricingDetailsForDisplay.numberOfNights} nights)</span><span>{formatPrice(pricingDetailsForDisplay.basePrice, selectedCurrency)}</span></div>
          {pricingDetailsForDisplay.extraGuestFee > 0 && <div className="flex justify-between text-muted-foreground"><span>Extra guest fee</span><span>+{formatPrice(pricingDetailsForDisplay.extraGuestFee, selectedCurrency)}</span></div>}
          <div className="flex justify-between"><span>Cleaning fee</span><span>+{formatPrice(pricingDetailsForDisplay.cleaningFee, selectedCurrency)}</span></div>
          <Separator className="my-1" />
          <div className="flex justify-between font-medium"><span>Subtotal</span><span>{formatPrice(pricingDetailsForDisplay.subtotal, selectedCurrency)}</span></div>
          {appliedCoupon && <div className="flex justify-between text-green-600"><span>Discount ({appliedCoupon.code})</span><span>-{formatPrice(pricingDetailsForDisplay.discountAmount, selectedCurrency)}</span></div>}
          <Separator className="my-2 font-bold" />
          <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatPrice(pricingDetailsForDisplay.total, selectedCurrency)}</span></div>
        </div>
      )}
      <Separator />

      {/* Guest Information */}
      <div className="space-y-4">
        <h3 className="font-semibold">Your Information</h3>
        {/* Names */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="firstName">First Name</Label>
            <Input id="firstName" name="firstName" value={firstName} onChange={handleGuestInfoChange} required disabled={isProcessingBooking} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lastName">Last Name</Label>
            <Input id="lastName" name="lastName" value={lastName} onChange={handleGuestInfoChange} required disabled={isProcessingBooking} />
          </div>
        </div>
        {/* Email and Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" value={email} onChange={handleGuestInfoChange} required disabled={isProcessingBooking} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" name="phone" type="tel" value={phone} onChange={handleGuestInfoChange} required disabled={isProcessingBooking} />
          </div>
        </div>
      </div>

       {/* Coupon Code */}
       <div className="space-y-1">
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
    </div>
  );
}
