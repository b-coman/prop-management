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
import { cn } from '@/lib/utils';
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
  showCouponField?: boolean; // New prop to control whether to show the coupon field
  // displayGuests prop removed as guest count is handled by parent
}

// Helper Input component (can be moved to ui if used elsewhere)
const FormInput = ({ 
  label, 
  icon: Icon, 
  error,
  ...props 
}: React.InputHTMLAttributes<HTMLInputElement> & { 
  label: string, 
  icon?: React.ElementType,
  error?: string 
}) => {
    // Detect if the field is required to show proper styling
    const isRequired = props.required;
    const isInvalid = !!error;
    
    return (
      <div className="space-y-1">
          <Label
            htmlFor={props.id || props.name}
            className={cn(
              "flex items-center gap-1 text-xs",
              isInvalid ? "text-destructive" : "text-muted-foreground"
            )}
          >
             {Icon && <Icon className={cn("h-3 w-3", isInvalid && "text-destructive")} />}
             {label}
             {isRequired && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Input
            id={props.id || props.name}
            {...props}
            required={false} // Disable browser validation
            // Ensure onChange is being properly handled
            onChange={(e) => {
              if (typeof window !== 'undefined') {
                console.log(`⌨️ [CLIENT] Input direct change: ${props.name}="${e.target.value}"`);
              }
              if (props.onChange) {
                props.onChange(e);
              }
            }}
            className={cn(
              props.className,
              isInvalid && "border-destructive focus-visible:ring-destructive/25"
            )}
          />
          {error && (
            <div className="flex items-center gap-2 mt-1">
              <div className="h-4 w-4 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-destructive text-xs font-bold">!</span>
              </div>
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
      </div>
    );
};


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
  isProcessingBooking = false, // Default to false to ensure inputs aren't disabled
  showCouponField = true, // Default to showing the coupon field
}: GuestInfoFormProps) {

  // Debug log for form state - only runs on client
  if (typeof window !== 'undefined') {
    console.log(`🔍 [CLIENT] GuestInfoForm rendering with isProcessingBooking=${isProcessingBooking}`);
    console.log(`🔍 [CLIENT] Current form values:`, { firstName, lastName, email, phone });
  }
  const [couponCode, setCouponCode] = React.useState(appliedCoupon?.code || '');
  const [couponError, setCouponError] = React.useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = React.useState(false);
  const { toast } = useToast();
  // Custom validation states
  const [fieldErrors, setFieldErrors] = React.useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  }>({});
  // Currency context might not be needed here if summary handles display, but keep if price is shown here too
  const { selectedCurrency, formatPrice } = useCurrency();

  const handleGuestInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const isClient = typeof window !== 'undefined';

    if (isClient) {
      console.log(`📝 [CLIENT] Input change - ${name}: "${value}"`);
    }

    // Clear error when field is being edited
    if (fieldErrors[name as keyof typeof fieldErrors]) {
      setFieldErrors(prev => ({ ...prev, [name]: undefined }));
    }

    // Use try-catch to debug potential errors in state updates
    try {
      if (name === 'firstName') {
        if (isClient) console.log(`📝 [CLIENT] Setting firstName to "${value}"`);
        setFirstName(value);
      }
      else if (name === 'lastName') {
        if (isClient) console.log(`📝 [CLIENT] Setting lastName to "${value}"`);
        setLastName(value);
      }
      else if (name === 'email') {
        if (isClient) console.log(`📝 [CLIENT] Setting email to "${value}"`);
        setEmail(value);
      }
      else if (name === 'phone') {
        if (isClient) console.log(`📝 [CLIENT] Setting phone to "${value}"`);
        setPhone(value);
      }
    } catch (error) {
      if (isClient) console.error(`❌ [CLIENT] Error updating field ${name}:`, error);
    }
  };
  
  // Validate individual field
  const validateField = (name: string, value: string): string | undefined => {
    switch (name) {
      case 'firstName':
      case 'lastName':
        return !value.trim() ? 'This field is required' : undefined;
      case 'email':
        return !value.trim() 
          ? 'Email is required' 
          : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) 
            ? 'Please enter a valid email address' 
            : undefined;
      case 'phone':
        // Phone is required but format is flexible
        return !value.trim() ? 'Phone number is required' : undefined;
      default:
        return undefined;
    }
  };
  
  // Check field on blur
  const handleFieldBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const error = validateField(name, value);
    if (error) {
      setFieldErrors(prev => ({ ...prev, [name]: error }));
    }
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
           <FormInput
             label="First Name"
             name="firstName"
             value={firstName || ''}
             onChange={handleGuestInfoChange}
             onBlur={handleFieldBlur}
             placeholder="Your first name"
             required
             disabled={!!isProcessingBooking}
             error={fieldErrors.firstName}
           />
           <FormInput
             label="Last Name"
             name="lastName"
             value={lastName || ''}
             onChange={handleGuestInfoChange}
             onBlur={handleFieldBlur}
             placeholder="Your last name"
             required
             disabled={!!isProcessingBooking}
             error={fieldErrors.lastName}
           />
       </div>
        {/* Email and Phone - side by side on larger screens */}
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
         <FormInput
           label="Email"
           name="email"
           type="email"
           value={email || ''}
           onChange={handleGuestInfoChange}
           onBlur={handleFieldBlur}
           placeholder="your.email@example.com"
           icon={Mail}
           required
           disabled={!!isProcessingBooking}
           error={fieldErrors.email}
         />
         <FormInput
           label="Phone Number"
           name="phone"
           type="tel"
           value={phone || ''}
           onChange={handleGuestInfoChange}
           onBlur={handleFieldBlur}
           placeholder="Your phone number"
           icon={PhoneIcon}
           required
           disabled={!!isProcessingBooking}
           error={fieldErrors.phone}
         />
       </div>

       {/* Coupon Code - Only show if showCouponField is true */}
       {showCouponField && (
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
           <div className="mt-1">
             {couponError && (
               <div className="flex items-center gap-2">
                 <div className="h-4 w-4 rounded-full bg-red-100 flex items-center justify-center">
                   <span className="text-destructive text-xs font-bold">!</span>
                 </div>
                 <p className="text-xs text-destructive">{couponError}</p>
               </div>
             )}
             {appliedCoupon && (
               <div className="flex items-center gap-2">
                 <div className="h-4 w-4 rounded-full bg-green-100 flex items-center justify-center">
                   <span className="text-green-600 text-xs font-bold">✓</span>
                 </div>
                 <p className="text-xs text-green-600">Applied: {appliedCoupon.code} ({appliedCoupon.discountPercentage}%)</p>
               </div>
             )}
           </div>
         </div>
       )}
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