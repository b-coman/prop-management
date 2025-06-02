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
import { Loader2, Mail, Phone as PhoneIcon, Send } from 'lucide-react';
import { useBooking } from '../contexts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { sanitizeEmail, sanitizePhone, sanitizeText } from '@/lib/sanitize';
import type { PriceCalculationResult } from '@/types';
import { TouchTarget } from '@/components/ui/touch-target';
import { InteractionFeedback } from '@/components/ui/interaction-feedback';

// Schema for the inquiry form (preserved from V1)
const inquiryFormSchema = z.object({
  firstName: z.string().min(1, "First name is required.").transform(sanitizeText),
  lastName: z.string().min(1, "Last name is required.").transform(sanitizeText),
  email: z.string().email("Invalid email address.").transform(sanitizeEmail),
  phone: z.string().optional().transform(val => val ? sanitizePhone(val) : undefined),
  message: z.string().min(10, "Message must be at least 10 characters.").max(1000, "Message must be at most 1000 characters.").transform(sanitizeText),
});

interface ContactFormV2Props {
  onSubmit: (values: z.infer<typeof inquiryFormSchema>, pricingDetails: PriceCalculationResult | null, selectedCurrency: string) => Promise<void>;
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
          Contact Property Owner
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Name Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <TouchTarget>
                        <Input 
                          placeholder="Enter your first name" 
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
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <TouchTarget>
                        <Input 
                          placeholder="Enter your last name" 
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
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <TouchTarget>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            type="email"
                            placeholder="Enter your email address" 
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
                    <FormLabel>Phone (Optional)</FormLabel>
                    <FormControl>
                      <TouchTarget>
                        <div className="relative">
                          <PhoneIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            type="tel"
                            placeholder="Enter your phone number" 
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

            {/* Message Field */}
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Message</FormLabel>
                  <FormControl>
                    <TouchTarget>
                      <Textarea 
                        placeholder="Tell us about your inquiry, special requests, or questions..."
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
                    Sending Message...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Message
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