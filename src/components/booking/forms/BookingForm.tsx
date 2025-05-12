"use client";

import React, { useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, ArrowRight, Mail, Phone as PhoneIcon, TicketPercent, X } from 'lucide-react';
import { useBooking } from '@/contexts/BookingContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { sanitizeEmail, sanitizePhone, sanitizeText } from '@/lib/sanitize';
import type { Property, PriceCalculationResult } from '@/types';

// Schema for the booking form
const bookingFormSchema = z.object({
  firstName: z.string().min(1, "First name is required.").transform(sanitizeText),
  lastName: z.string().min(1, "Last name is required.").transform(sanitizeText),
  email: z.string().email("Invalid email address.").transform(sanitizeEmail),
  phone: z.string().min(1, "Phone number is required.").transform(sanitizePhone),
  couponCode: z.string().optional(),
});

interface BookingFormProps {
  property: Property;
  isProcessing: boolean;
  isPending: boolean;
  formError: string | null;
  lastErrorType?: string;
  canRetryError: boolean;
  pricingDetails: PriceCalculationResult;
  appliedCoupon: { code: string; discountPercentage: number } | null;
  setAppliedCoupon: (coupon: { code: string; discountPercentage: number } | null) => void;
  selectedCurrency: string;
  onSubmit: (pricingDetails: PriceCalculationResult, appliedCoupon: { code: string; discountPercentage: number } | null, selectedCurrency: string) => Promise<void>;
}

export function BookingForm({
  property,
  isProcessing = false,
  isPending = false,
  formError,
  lastErrorType,
  canRetryError,
  pricingDetails,
  appliedCoupon,
  setAppliedCoupon,
  selectedCurrency,
  onSubmit
}: BookingFormProps) {
  const {
    checkInDate,
    checkOutDate,
    firstName,
    lastName,
    email,
    phone,
    setFirstName,
    setLastName,
    setEmail,
    setPhone
  } = useBooking();

  const { toast } = useToast();
  const [isApplyingCoupon, setIsApplyingCoupon] = React.useState(false);
  const [couponError, setCouponError] = React.useState<string | null>(null);
  const [couponCode, setCouponCode] = React.useState(appliedCoupon?.code || '');

  // Initialize form with react-hook-form
  const bookingForm = useForm<z.infer<typeof bookingFormSchema>>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      firstName: firstName || "",
      lastName: lastName || "",
      email: email || "",
      phone: phone || "",
      couponCode: appliedCoupon?.code || "",
    },
  });
  
  // Client-side logging for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log(`📋 [CLIENT] BookingForm rendering - isProcessing=${isProcessing}, isPending=${isPending}`);
      console.log(`📋 [CLIENT] BookingForm form values:`, { firstName, lastName, email, phone });
    }
  }, [isProcessing, isPending, firstName, lastName, email, phone]);

  // Update form when booking context values change
  useEffect(() => {
    bookingForm.reset({
      firstName: firstName || '',
      lastName: lastName || '',
      email: email || '',
      phone: phone || '',
      couponCode: appliedCoupon?.code || '',
    });
  }, [firstName, lastName, email, phone, appliedCoupon, bookingForm]);

  // Handle form submission
  const handleSubmit = async (values: z.infer<typeof bookingFormSchema>) => {
    // Save values to context
    setFirstName(values.firstName);
    setLastName(values.lastName);
    setEmail(values.email);
    setPhone(values.phone);
    
    // Call the parent submit handler
    await onSubmit(pricingDetails, appliedCoupon, selectedCurrency);
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
      // Import the service dynamically to avoid circular dependencies
      const { validateAndApplyCoupon } = await import('@/services/couponService');
      const result = await validateAndApplyCoupon(couponCode.trim(), checkInDate, checkOutDate, property.slug);
      
      if (result.error) {
        setCouponError(result.error);
      } else if (result.discountPercentage) {
        setAppliedCoupon({ 
          code: couponCode.trim().toUpperCase(), 
          discountPercentage: result.discountPercentage 
        });
        toast({
          title: "Coupon Applied!",
          description: `Successfully applied ${result.discountPercentage}% discount.`,
        });
      }
    } catch (error) {
      if (typeof window !== 'undefined') {
        console.error('Error applying coupon:', error);
      }
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

  const isFormDisabled = isProcessing || isPending || !checkInDate || !checkOutDate;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Complete Booking</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...bookingForm}>
          <form onSubmit={bookingForm.handleSubmit(handleSubmit)} className="space-y-6">
            <h3 className="font-semibold text-base pt-2">Your Information</h3>

            {/* Names - side by side on larger screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={bookingForm.control} name="firstName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1 text-xs">
                    First Name
                    <span className="text-destructive ml-1">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Your first name" 
                      {...field}
                      onChange={e => { 
                        field.onChange(e); 
                        setFirstName(e.target.value);
                      }}
                      className={bookingForm.formState.errors.firstName && "border-destructive focus-visible:ring-destructive/25"}
                      disabled={isFormDisabled}
                      required 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={bookingForm.control} name="lastName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1 text-xs">
                    Last Name
                    <span className="text-destructive ml-1">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Your last name" 
                      {...field}
                      onChange={e => { 
                        field.onChange(e); 
                        setLastName(e.target.value);
                      }}
                      className={bookingForm.formState.errors.lastName && "border-destructive focus-visible:ring-destructive/25"}
                      disabled={isFormDisabled} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Email and Phone - side by side on larger screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={bookingForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1 text-xs">
                    <Mail className={cn("h-3 w-3", bookingForm.formState.errors.email && "text-destructive")} />
                    Email
                    <span className="text-destructive ml-1">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="your.email@example.com" 
                      {...field}
                      onChange={e => { 
                        field.onChange(e); 
                        setEmail(e.target.value);
                      }}
                      className={bookingForm.formState.errors.email && "border-destructive focus-visible:ring-destructive/25"}
                      disabled={isFormDisabled} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={bookingForm.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1 text-xs">
                    <PhoneIcon className={cn("h-3 w-3", bookingForm.formState.errors.phone && "text-destructive")} />
                    Phone Number
                    <span className="text-destructive ml-1">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="tel" 
                      placeholder="Your phone number" 
                      {...field}
                      onChange={e => { 
                        field.onChange(e); 
                        setPhone(e.target.value);
                      }}
                      className={bookingForm.formState.errors.phone && "border-destructive focus-visible:ring-destructive/25"}
                      disabled={isFormDisabled} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Coupon section */}
            <div className="space-y-1 pt-2">
              <FormLabel htmlFor="coupon" className="text-xs">Discount Coupon (Optional)</FormLabel>
              <div className="flex gap-2 mt-1">
                <Input 
                  id="coupon" 
                  placeholder="Enter code" 
                  value={couponCode} 
                  onChange={(e) => setCouponCode(e.target.value)} 
                  disabled={isApplyingCoupon || !!appliedCoupon || isFormDisabled} 
                  className="flex-grow" 
                />
                {!appliedCoupon ? (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleApplyCoupon} 
                    disabled={isApplyingCoupon || !couponCode.trim() || isFormDisabled} 
                    className="shrink-0"
                  >
                    {isApplyingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : <TicketPercent className="h-4 w-4" />}
                  </Button>
                ) : (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleRemoveCoupon} 
                    disabled={isFormDisabled} 
                    className="shrink-0"
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
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
                    <p className="text-xs text-green-600">
                      Applied: {appliedCoupon.code} ({appliedCoupon.discountPercentage}%)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {formError && (
              <ErrorMessage
                error={formError}
                className="my-3"
                errorType={lastErrorType}
                onRetry={canRetryError ? () => onSubmit(pricingDetails, appliedCoupon, selectedCurrency) : undefined}
              />
            )}
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isFormDisabled}
            >
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
              {isProcessing ? 'Processing...' : 'Continue to Payment'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}