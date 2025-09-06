/**
 * Hold Form V2 - Date holding form for V2 booking system
 * 
 * @file-status: ACTIVE
 * @v2-role: FORMS - Hold form for V2 booking system
 * @created: 2025-05-31
 * @description: V2-native hold form with preserved functionality from V1
 * @dependencies: V2 BookingProvider, form validation, sanitization, Stripe
 * @preserves: All V1 functionality, validation, error handling, hold logic
 */

"use client";

import React, { useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, ArrowRight, Clock } from 'lucide-react';
import { useBooking } from '../contexts';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { IconInputField } from '@/components/ui/icon-input-field';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { cn } from '@/lib/utils';
import { sanitizeEmail, sanitizePhone, sanitizeText } from '@/lib/sanitize';
import type { Property, PriceCalculationResult } from '@/types';
import { TouchTarget } from '@/components/ui/touch-target';
import { InteractionFeedback } from '@/components/ui/interaction-feedback';

// Schema for the hold form (preserved from V1)
const holdFormSchema = z.object({
  firstName: z.string().min(1, "First name is required.").transform(sanitizeText),
  lastName: z.string().min(1, "Last name is required.").transform(sanitizeText),
  email: z.string().email("Invalid email address.").transform(sanitizeEmail),
  phone: z.string().min(1, "Phone number is required.").transform(sanitizePhone),
});

interface HoldFormV2Props {
  onSubmit: (values: z.infer<typeof holdFormSchema>, pricingDetails: PriceCalculationResult | null, selectedCurrency: string) => Promise<void>;
  isProcessing: boolean;
  isPending: boolean;
  formError?: string | null;
  pricingDetails: PriceCalculationResult | null;
  selectedCurrency: string;
}

/**
 * Hold form component for date reservations - V2 implementation
 * Preserves all V1 functionality while using V2 context
 */
export function HoldFormV2({
  onSubmit,
  isProcessing,
  isPending,
  formError,
  pricingDetails,
  selectedCurrency
}: HoldFormV2Props) {
  // Get data from V2 booking context
  const {
    property,
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

  // Hold fee configuration (preserved from V1)
  const holdFeeAmount = property.holdFeeAmount || 50; // Default hold fee
  const holdDurationHours = property.holdDurationHours || 24;
  const holdFeeRefundable = property.holdFeeRefundable ?? true;

  const form = useForm<z.infer<typeof holdFormSchema>>({
    resolver: zodResolver(holdFormSchema),
    defaultValues: {
      firstName: firstName || "",
      lastName: lastName || "",
      email: email || "",
      phone: phone || "",
    },
  });

  // Pre-populate form with context values when they change
  useEffect(() => {
    form.setValue('firstName', firstName || "");
    form.setValue('lastName', lastName || "");
    form.setValue('email', email || "");
    form.setValue('phone', phone || "");
  }, [firstName, lastName, email, phone, form]);

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

  const handleSubmit = async (values: z.infer<typeof holdFormSchema>) => {
    await onSubmit(values, pricingDetails, selectedCurrency);
  };

  const isLoading = isProcessing || isPending;
  const isFormDisabled = isLoading || !checkInDate || !checkOutDate || !pricingDetails;

  // Format hold fee display (simplified for now, can be enhanced with currency context later)
  const displayHoldFee = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: selectedCurrency
  }).format(holdFeeAmount);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Hold These Dates
        </CardTitle>
        <CardDescription>
          Reserve your dates for {holdDurationHours} hours with a holding fee of {displayHoldFee}.
          {holdFeeRefundable && " This fee is fully refundable if you complete your booking."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Name Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <IconInputField
                        placeholder="Enter your first name" 
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          handleFieldChange('firstName', e.target.value);
                        }}
                        disabled={isLoading}
                      />
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
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <IconInputField
                        placeholder="Enter your last name" 
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          handleFieldChange('lastName', e.target.value);
                        }}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
                />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <IconInputField
                        type="email"
                        placeholder="Enter your email address" 
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          handleFieldChange('email', e.target.value);
                        }}
                        disabled={isLoading}
                      />
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
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <IconInputField
                        type="tel"
                        placeholder="Enter your phone number" 
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          handleFieldChange('phone', e.target.value);
                        }}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
                />
            </div>

            {/* Error Display */}
            {formError && (
              <ErrorMessage error={formError} className="my-3" />
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
                    Processing Hold...
                  </>
                ) : (
                  <>
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Pay {displayHoldFee} to Hold Dates
                  </>
                )}
              </Button>
            </InteractionFeedback>

            {/* Hold Details */}
            <div className="text-sm text-muted-foreground text-center space-y-1">
              <p>• Hold expires in {holdDurationHours} hours</p>
              <p>• {holdFeeRefundable ? 'Fully refundable' : 'Non-refundable'} if you complete booking</p>
              <p>• Secure payment via Stripe</p>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}