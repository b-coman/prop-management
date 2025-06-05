/**
 * Booking Form V2 - Complete booking form for V2 booking system
 * 
 * @file-status: ACTIVE
 * @v2-role: FORMS - Main booking form for V2 booking system
 * @created: 2025-05-31
 * @description: V2-native booking form with preserved functionality from V1
 * @dependencies: V2 BookingProvider, form validation, sanitization, Stripe integration
 * @preserves: All V1 functionality, validation, error handling, coupon system, Stripe
 */

"use client";

import React, { useEffect, useState } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, ArrowRight, Mail, Phone as PhoneIcon, TicketPercent, X, CreditCard } from 'lucide-react';
import { useBooking } from '../contexts';
import { useLanguage } from '@/lib/language-system';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { sanitizeEmail, sanitizePhone, sanitizeText } from '@/lib/sanitize';
import type { Property, PriceCalculationResult } from '@/types';
import { TouchTarget } from '@/components/ui/touch-target';
import { InteractionFeedback } from '@/components/ui/interaction-feedback';

// Schema will be created inside component with translations
type BookingFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  couponCode?: string;
};

interface BookingFormV2Props {
  onSubmit: (values: BookingFormValues, pricingDetails: PriceCalculationResult | null, appliedCoupon: any | null, selectedCurrency: string) => Promise<void>;
  isProcessing: boolean;
  isPending: boolean;
  formError?: string | null;
  lastErrorType?: string;
  canRetryError?: boolean;
  pricingDetails: PriceCalculationResult | null;
  selectedCurrency: string;
}

/**
 * Complete booking form component - V2 implementation
 * Preserves all V1 functionality including Stripe integration and coupon system
 */
export function BookingFormV2({
  onSubmit,
  isProcessing,
  isPending,
  formError,
  lastErrorType,
  canRetryError = false,
  pricingDetails,
  selectedCurrency
}: BookingFormV2Props) {
  const { t } = useLanguage();
  
  // Create schema with translations
  const bookingFormSchema = z.object({
    firstName: z.string().min(1, t('booking.firstNameRequired', 'First name is required.')).transform(sanitizeText),
    lastName: z.string().min(1, t('booking.lastNameRequired', 'Last name is required.')).transform(sanitizeText),
    email: z.string().email(t('booking.invalidEmail', 'Invalid email address.')).transform(sanitizeEmail),
    phone: z.string().min(1, t('booking.phoneRequired', 'Phone number is required.')).transform(sanitizePhone),
    couponCode: z.string().optional(),
  });
  
  // Get data from V2 booking context
  const {
    property,
    checkInDate,
    checkOutDate,
    firstName,
    lastName,
    email,
    phone,
    appliedCoupon,
    setFirstName,
    setLastName,
    setEmail,
    setPhone,
    setAppliedCoupon
  } = useBooking();

  const { toast } = useToast();
  
  // Coupon state (preserved from V1)
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState(appliedCoupon?.code || '');

  const form = useForm<z.infer<typeof bookingFormSchema>>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      firstName: firstName || "",
      lastName: lastName || "",
      email: email || "",
      phone: phone || "",
      couponCode: appliedCoupon?.code || "",
    },
  });

  // Pre-populate form with context values when they change
  useEffect(() => {
    form.setValue('firstName', firstName || "");
    form.setValue('lastName', lastName || "");
    form.setValue('email', email || "");
    form.setValue('phone', phone || "");
    form.setValue('couponCode', appliedCoupon?.code || "");
    setCouponCode(appliedCoupon?.code || "");
  }, [firstName, lastName, email, phone, appliedCoupon, form]);

  // Handle form value changes without useEffect to prevent infinite loops
  const handleFieldChange = (field: string, value: string) => {
    switch (field) {
      case 'firstName':
        setFirstName(value);
        break;
      case 'lastName':
        setLastName(value);
        break;
      case 'email':
        setEmail(value);
        break;
      case 'phone':
        setPhone(value);
        break;
    }
  };

  // Handle coupon application (preserved from V1)
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
          title: t('booking.couponApplied', 'Coupon Applied!'),
          description: `Successfully applied ${result.discountPercentage}% discount.`,
        });
      }
    } catch (error) {
      console.error('[V2] Error applying coupon:', error);
      setCouponError('Could not apply coupon. Please try again.');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError(null);
    toast({ title: t('booking.couponRemoved', 'Coupon Removed') });
  };

  const handleSubmit = async (values: z.infer<typeof bookingFormSchema>) => {
    await onSubmit(values, pricingDetails, appliedCoupon, selectedCurrency);
  };

  const isLoading = isProcessing || isPending;
  const isFormDisabled = isLoading || !checkInDate || !checkOutDate || !pricingDetails;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Complete Your Booking
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Guest Information Section */}
            <div>
              <h3 className="font-semibold text-base mb-4">Guest Information</h3>
              
              {/* Name Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('booking.firstName', 'First Name')}</FormLabel>
                      <FormControl>
                        <TouchTarget>
                          <Input 
                            placeholder={t('booking.enterFirstName', 'Enter your first name')} 
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              handleFieldChange('firstName', e.target.value);
                            }}
                            disabled={isLoading}
                          />
                        </TouchTarget>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('booking.lastName', 'Last Name')}</FormLabel>
                      <FormControl>
                        <TouchTarget>
                          <Input 
                            placeholder={t('booking.enterLastName', 'Enter your last name')} 
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              handleFieldChange('lastName', e.target.value);
                            }}
                            disabled={isLoading}
                          />
                        </TouchTarget>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Contact Fields */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('booking.emailAddress', 'Email Address')}</FormLabel>
                      <FormControl>
                        <TouchTarget>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              type="email"
                              placeholder={t('booking.enterEmail', 'Enter your email address')} 
                              className="pl-10"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                handleFieldChange('email', e.target.value);
                              }}
                              disabled={isLoading}
                            />
                          </div>
                        </TouchTarget>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('booking.phoneNumber', 'Phone Number')}</FormLabel>
                      <FormControl>
                        <TouchTarget>
                          <div className="relative">
                            <PhoneIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              type="tel"
                              placeholder={t('booking.enterPhone', 'Enter your phone number')} 
                              className="pl-10"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                handleFieldChange('phone', e.target.value);
                              }}
                              disabled={isLoading}
                            />
                          </div>
                        </TouchTarget>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Coupon Section (preserved from V1) */}
            <div className="space-y-4">
              <h3 className="font-semibold text-base">Discount Coupon (Optional)</h3>
              
              <div className="flex gap-2">
                <Input 
                  placeholder={t('booking.enterCouponCode', 'Enter coupon code')} 
                  value={couponCode} 
                  onChange={(e) => setCouponCode(e.target.value)} 
                  disabled={isApplyingCoupon || !!appliedCoupon || isFormDisabled} 
                  className="flex-grow" 
                />
                {!appliedCoupon ? (
                  <TouchTarget>
                    <InteractionFeedback
                      variant="scale"
                      state={isApplyingCoupon ? 'loading' : 'idle'}
                    >
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleApplyCoupon} 
                        disabled={isApplyingCoupon || !couponCode.trim() || isFormDisabled} 
                        className="shrink-0"
                      >
                        {isApplyingCoupon ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <TicketPercent className="h-4 w-4 mr-2" />
                            Apply
                          </>
                        )}
                      </Button>
                    </InteractionFeedback>
                  </TouchTarget>
                ) : (
                  <TouchTarget>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={handleRemoveCoupon} 
                      disabled={isFormDisabled} 
                      className="shrink-0"
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </TouchTarget>
                )}
              </div>

              {/* Coupon Status */}
              <div>
                {couponError && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <div className="h-4 w-4 rounded-full bg-red-100 flex items-center justify-center">
                      <span className="text-destructive text-xs font-bold">!</span>
                    </div>
                    <p>{couponError}</p>
                  </div>
                )}
                {appliedCoupon && (
                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <div className="h-4 w-4 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-green-600 text-xs font-bold">✓</span>
                    </div>
                    <p>
                      Applied: {appliedCoupon.code} ({appliedCoupon.discountPercentage}% discount)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Error Display */}
            {formError && (
              <ErrorMessage
                error={formError}
                className="my-3"
                errorType={lastErrorType}
                onRetry={canRetryError ? () => onSubmit(form.getValues(), pricingDetails, appliedCoupon, selectedCurrency) : undefined}
              />
            )}

            {/* Submit Button */}
            <InteractionFeedback>
              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isFormDisabled}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Continue to Payment
                  </>
                )}
              </Button>
            </InteractionFeedback>

            {/* Payment Security Notice */}
            <div className="text-sm text-muted-foreground text-center space-y-1">
              <p>• Secure payment processing via Stripe</p>
              <p>• Your payment information is encrypted and secure</p>
              <p>• You'll receive confirmation via email</p>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}