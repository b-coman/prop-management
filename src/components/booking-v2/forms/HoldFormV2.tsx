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
import { useLanguage } from '@/lib/language-system';
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

// Schema will be created inside component with translations
type HoldFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

interface HoldFormV2Props {
  onSubmit: (values: HoldFormValues, pricingDetails: PriceCalculationResult | null, selectedCurrency: string) => Promise<void>;
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
  const { t } = useLanguage();
  
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

  // Create schema with translations
  const holdFormSchema = z.object({
    firstName: z.string().min(1, t('booking.firstNameRequired', 'First name is required.')).transform(sanitizeText),
    lastName: z.string().min(1, t('booking.lastNameRequired', 'Last name is required.')).transform(sanitizeText),
    email: z.string().email(t('booking.invalidEmail', 'Invalid email address.')).transform(sanitizeEmail),
    phone: z.string().min(1, t('booking.phoneRequired', 'Phone number is required.')).transform(sanitizePhone),
  });

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
          {t('booking.holdTheseDates', 'Hold These Dates')}
        </CardTitle>
        <CardDescription>
          {t('booking.holdDescription', `Reserve your dates for {{hours}} hours with a holding fee of {{fee}}.`, {
            hours: holdDurationHours,
            fee: displayHoldFee
          })}
          {holdFeeRefundable && ` ${t('booking.holdRefundable', 'This fee is fully refundable if you complete your booking.')}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Guest Information Fields - Vertical Layout */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem className="flex flex-col space-y-3">
                      <FormLabel className="text-sm font-medium text-slate-700">{t('booking.firstName', 'First Name')}</FormLabel>
                      <FormControl>
                        <IconInputField
                          placeholder={t('booking.enterFirstName', 'Enter your first name')} 
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
                    <FormItem className="flex flex-col space-y-3">
                      <FormLabel className="text-sm font-medium text-slate-700">{t('booking.lastName', 'Last Name')}</FormLabel>
                      <FormControl>
                        <IconInputField
                          placeholder={t('booking.enterLastName', 'Enter your last name')} 
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
                    <FormItem className="flex flex-col space-y-3">
                      <FormLabel className="text-sm font-medium text-slate-700">{t('booking.email', 'Email')}</FormLabel>
                      <FormControl>
                        <IconInputField
                          type="email"
                          placeholder={t('booking.enterEmail', 'Enter your email address')} 
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
                    <FormItem className="flex flex-col space-y-3">
                      <FormLabel className="text-sm font-medium text-slate-700">{t('booking.phone', 'Phone')}</FormLabel>
                      <FormControl>
                        <IconInputField
                          type="tel"
                          placeholder={t('booking.enterPhone', 'Enter your phone number')} 
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
                    {t('booking.processingHold', 'Processing Hold...')}
                  </>
                ) : (
                  <>
                    <ArrowRight className="mr-2 h-4 w-4" />
                    {t('booking.payToHold', `Pay {{fee}} to Hold Dates`, { fee: displayHoldFee })}
                  </>
                )}
              </Button>
            </InteractionFeedback>

            {/* Hold Details */}
            <div className="text-sm text-muted-foreground text-center space-y-1">
              <p>• {t('booking.holdExpires', `Hold expires in {{hours}} hours`, { hours: holdDurationHours })}</p>
              <p>• {holdFeeRefundable ? t('booking.fullyRefundable', 'Fully refundable') : t('booking.nonRefundable', 'Non-refundable')} {t('booking.ifYouCompleteBooking', 'if you complete booking')}</p>
              <p>• {t('booking.securePaymentStripe', 'Secure payment via Stripe')}</p>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}