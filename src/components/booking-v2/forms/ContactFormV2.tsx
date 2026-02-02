/**
 * Contact Form V2 - Inquiry form for V2 booking system
 * 
 * @file-status: ACTIVE
 * @v2-role: FORMS - Contact/inquiry form for V2 booking system
 * @created: 2025-05-31
 * @description: V2-native contact form with preserved functionality from V1
 * @dependencies: V2 BookingProvider, form validation, sanitization
 * @preserves: All V1 functionality, validation, error handling
 */

"use client";

import React, { useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Send, Mail } from 'lucide-react';
import { useBooking } from '../contexts';
import { useLanguage } from '@/lib/language-system';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { IconInputField } from '@/components/ui/icon-input-field';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { sanitizeEmail, sanitizePhone, sanitizeText } from '@/lib/sanitize';
import type { PriceCalculationResult } from '@/types';
import { TouchTarget } from '@/components/ui/touch-target';
import { InteractionFeedback } from '@/components/ui/interaction-feedback';

// Schema will be created inside component with translations
type InquiryFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  message: string;
};

interface ContactFormV2Props {
  onSubmit: (values: InquiryFormValues, pricingDetails: PriceCalculationResult | null, selectedCurrency: string) => Promise<void>;
  isProcessing: boolean;
  isPending: boolean;
  pricingDetails: PriceCalculationResult | null;
  selectedCurrency: string;
}

/**
 * Contact form component for inquiries - V2 implementation
 * Preserves all V1 functionality while using V2 context
 */
export function ContactFormV2({
  onSubmit,
  isProcessing,
  isPending,
  pricingDetails,
  selectedCurrency
}: ContactFormV2Props) {
  const { t } = useLanguage();
  
  // Get guest information from V2 booking context
  const {
    firstName,
    lastName,
    email,
    phone,
    message,
    setFirstName,
    setLastName,
    setEmail,
    setPhone,
    setMessage
  } = useBooking();

  // Create schema with translations
  const inquiryFormSchema = z.object({
    firstName: z.string().min(1, t('booking.firstNameRequired', 'First name is required.')).transform(sanitizeText),
    lastName: z.string().min(1, t('booking.lastNameRequired', 'Last name is required.')).transform(sanitizeText),
    email: z.string().email(t('booking.invalidEmail', 'Invalid email address.')).transform(sanitizeEmail),
    phone: z.string().optional().transform(val => val ? sanitizePhone(val) : undefined),
    message: z.string()
      .min(10, t('booking.messageMinLength', 'Message must be at least 10 characters.'))
      .max(1000, t('booking.messageMaxLength', 'Message must be at most 1000 characters.'))
      .transform(sanitizeText),
  });

  const form = useForm<z.infer<typeof inquiryFormSchema>>({
    resolver: zodResolver(inquiryFormSchema),
    defaultValues: {
      firstName: firstName || "",
      lastName: lastName || "",
      email: email || "",
      phone: phone || "",
      message: message || "",
    },
  });

  // Pre-populate form with context values when they change
  useEffect(() => {
    form.setValue('firstName', firstName || "");
    form.setValue('lastName', lastName || "");
    form.setValue('email', email || "");
    form.setValue('phone', phone || "");
    form.setValue('message', message || "");
  }, [firstName, lastName, email, phone, message, form]);

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
      case 'message':
        setMessage(value);
        break;
    }
  };

  const handleSubmit = async (values: z.infer<typeof inquiryFormSchema>) => {
    await onSubmit(values, pricingDetails, selectedCurrency);
  };

  const isLoading = isProcessing || isPending;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          {t('booking.contactPropertyOwner', 'Contact Property Owner')}
        </CardTitle>
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
                      <FormLabel className="text-sm font-medium text-slate-700">{t('booking.phoneOptional', 'Phone (Optional)')}</FormLabel>
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

            {/* Message Field */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-3">
                    <FormLabel className="text-sm font-medium text-slate-700">{t('booking.yourMessage', 'Your Message')}</FormLabel>
                    <FormControl>
                      <TouchTarget>
                        <Textarea 
                          placeholder={t('booking.messagePlaceholder', 'Tell us about your inquiry, special requests, or questions...')}
                          className="min-h-[120px] resize-none"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            handleFieldChange('message', e.target.value);
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

            {/* Submit Button */}
            <InteractionFeedback>
              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('booking.sendingMessage', 'Sending Message...')}
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {t('booking.sendMessage', 'Send Message')}
                  </>
                )}
              </Button>
            </InteractionFeedback>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}