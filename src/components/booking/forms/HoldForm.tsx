"use client";

import React, { useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, ArrowRight, Mail, Phone as PhoneIcon } from 'lucide-react';
import { useBooking } from '@/contexts/BookingContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { cn } from '@/lib/utils';
import { sanitizeEmail, sanitizePhone, sanitizeText } from '@/lib/sanitize';
import type { Property, PriceCalculationResult } from '@/types';
import { useCurrency } from '@/contexts/CurrencyContext';
import { TouchTarget } from '@/components/ui/touch-target';
import { InteractionFeedback, ErrorShake } from '@/components/ui/interaction-feedback';

// Schema for the hold form
const holdFormSchema = z.object({
  firstName: z.string().min(1, "First name is required.").transform(sanitizeText),
  lastName: z.string().min(1, "Last name is required.").transform(sanitizeText),
  email: z.string().email("Invalid email address.").transform(sanitizeEmail),
  phone: z.string().min(1, "Phone number is required.").transform(sanitizePhone),
});

interface HoldFormProps {
  property: Property;
  isProcessing: boolean;
  isPending: boolean;
  formError: string | null;
  setFormError: (error: string | null) => void;
  pricingDetails: PriceCalculationResult;
  selectedCurrency: string;
  // Pass form values directly along with selectedCurrency
  onSubmit: (selectedCurrency: string, formData?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  }) => Promise<void>;
}

export function HoldForm({
  property,
  isProcessing = false,
  isPending = false,
  formError,
  setFormError,
  pricingDetails,
  selectedCurrency,
  onSubmit
}: HoldFormProps) {
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

  const { convertToSelectedCurrency, formatPrice } = useCurrency();

  const holdFeeAmount = property.holdFeeAmount || 0;
  const displayHoldFee = formatPrice(
    convertToSelectedCurrency(holdFeeAmount, property.baseCurrency || 'EUR'),
    selectedCurrency as any
  );

  // Initialize form with react-hook-form
  const holdForm = useForm<z.infer<typeof holdFormSchema>>({
    resolver: zodResolver(holdFormSchema),
    defaultValues: {
      firstName: firstName || "",
      lastName: lastName || "",
      email: email || "",
      phone: phone || "",
    },
  });
  
  // Client-side logging for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log(`📋 [CLIENT] HoldForm rendering - isProcessing=${isProcessing}, isPending=${isPending}`);
      console.log(`📋 [CLIENT] HoldForm form values:`, { firstName, lastName, email, phone });
    }
  }, [isProcessing, isPending, firstName, lastName, email, phone]);

  // Update form when booking context values change
  useEffect(() => {
    holdForm.reset({
      firstName: firstName || '',
      lastName: lastName || '',
      email: email || '',
      phone: phone || '',
    });
  }, [firstName, lastName, email, phone, holdForm]);

  // Handle form submission
  const handleSubmit = async (values: z.infer<typeof holdFormSchema>) => {
    try {
      // Log form submission
      if (typeof window !== 'undefined') {
        console.log('📝 [CLIENT] HoldForm submitting with values:', values);
      }

      // Validate the form values directly
      if (!values.firstName || !values.lastName || !values.email || !values.phone) {
        if (typeof window !== 'undefined') {
          console.error('❌ [CLIENT] Form validation failed - missing required fields');
        }
        return;
      }

      // Save form values to context
      setFirstName(values.firstName);
      setLastName(values.lastName);
      setEmail(values.email);
      setPhone(values.phone);

      // Pass the form values directly to the submit function
      // This bypasses any context synchronization issues
      await onSubmit(selectedCurrency, {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone
      });
    } catch (error) {
      if (typeof window !== 'undefined') {
        console.error('❌ [CLIENT] Error submitting hold form:', error);
      }
    }
  };

  const isFormDisabled = isProcessing || isPending || !checkInDate || !checkOutDate || !property.holdFeeAmount;

  return (
    <ErrorShake shake={!!formError} onShakeComplete={() => setFormError(null)}>
      <Card className="mt-4 booking-form-card">
        <CardHeader>
          <CardTitle>Hold Dates</CardTitle>
          <CardDescription>
            Reserve these dates for {property.holdDurationHours || 24} hours with a small holding fee of {displayHoldFee}.
            {property.holdFeeRefundable && " This fee is refundable if you complete your booking."}
          </CardDescription>
        </CardHeader>
        <CardContent>
        <Form {...holdForm}>
          <form onSubmit={holdForm.handleSubmit(handleSubmit)} className="space-y-6">
            <h3 className="font-semibold text-base pt-2">Your Information</h3>

            {/* Names - side by side on larger screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={holdForm.control} name="firstName" render={({ field }) => (
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
                      className={holdForm.formState.errors.firstName && "border-destructive focus-visible:ring-destructive/25"}
                      disabled={isFormDisabled}
                      required 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={holdForm.control} name="lastName" render={({ field }) => (
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
                      className={holdForm.formState.errors.lastName && "border-destructive focus-visible:ring-destructive/25"}
                      disabled={isFormDisabled} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Email and Phone - side by side on larger screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={holdForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1 text-xs">
                    <Mail className={cn("h-3 w-3", holdForm.formState.errors.email && "text-destructive")} />
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
                      className={holdForm.formState.errors.email && "border-destructive focus-visible:ring-destructive/25"}
                      disabled={isFormDisabled} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={holdForm.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1 text-xs">
                    <PhoneIcon className={cn("h-3 w-3", holdForm.formState.errors.phone && "text-destructive")} />
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
                      className={holdForm.formState.errors.phone && "border-destructive focus-visible:ring-destructive/25"}
                      disabled={isFormDisabled}
                      required
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {formError && (
              <ErrorMessage
                error={formError}
                className="my-3"
              />
            )}
            
            <TouchTarget size="lg">
              <InteractionFeedback
                variant="hover"
                state={isProcessing ? 'loading' : 'idle'}
              >
                <Button 
                  type="submit" 
                  variant="cta"
                  className="w-full h-full" 
                  disabled={isFormDisabled}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Pay {displayHoldFee} to Hold Dates
                    </>
                  )}
                </Button>
              </InteractionFeedback>
            </TouchTarget>
          </form>
        </Form>
      </CardContent>
      </Card>
    </ErrorShake>
  );
}