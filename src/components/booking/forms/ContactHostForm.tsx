"use client";

import React, { useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Mail, Phone as PhoneIcon, Send } from 'lucide-react';
import { useBooking } from '@/contexts/BookingContext';
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

// Schema for the inquiry form
const inquiryFormSchema = z.object({
  firstName: z.string().min(1, "First name is required.").transform(sanitizeText),
  lastName: z.string().min(1, "Last name is required.").transform(sanitizeText),
  email: z.string().email("Invalid email address.").transform(sanitizeEmail),
  phone: z.string().optional().transform(val => val ? sanitizePhone(val) : undefined),
  message: z.string().min(10, "Message must be at least 10 characters.").max(1000, "Message must be at most 1000 characters.").transform(sanitizeText),
});

interface ContactHostFormProps {
  onSubmit: (values: z.infer<typeof inquiryFormSchema>, pricingDetails: PriceCalculationResult | null, selectedCurrency: string) => Promise<void>;
  isProcessing: boolean;
  isPending: boolean;
  pricingDetails: PriceCalculationResult | null;
  selectedCurrency: string;
}

/**
 * Contact host form component for inquiries
 */
export function ContactHostForm({
  onSubmit,
  isProcessing,
  isPending,
  pricingDetails,
  selectedCurrency
}: ContactHostFormProps) {
  // Get guest information from booking context
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
  
  // Initialize form with react-hook-form
  const inquiryForm = useForm<z.infer<typeof inquiryFormSchema>>({
    resolver: zodResolver(inquiryFormSchema),
    defaultValues: {
      firstName: firstName || "",
      lastName: lastName || "",
      email: email || "",
      phone: phone || "",
      message: message || "",
    },
  });
  
  // Update form when context values change
  useEffect(() => {
    inquiryForm.reset({
      firstName: firstName || '',
      lastName: lastName || '',
      email: email || '',
      phone: phone || '',
      message: message || '',
    });
  }, [firstName, lastName, email, phone, message, inquiryForm]);
  
  // Handle form submission
  const handleSubmit = async (values: z.infer<typeof inquiryFormSchema>) => {
    // Save values to context
    setFirstName(values.firstName);
    setLastName(values.lastName);
    setEmail(values.email);
    if (values.phone) setPhone(values.phone);
    setMessage(values.message);
    
    // Call the parent submit handler
    await onSubmit(values, pricingDetails, selectedCurrency);
  };
  
  return (
    <Card className="mt-4 booking-form-card">
      <CardHeader><CardTitle>Contact Host</CardTitle></CardHeader>
      <CardContent>
        <Form {...inquiryForm}>
          <form onSubmit={inquiryForm.handleSubmit(handleSubmit)} className="space-y-4">
            <h3 className="font-semibold text-base pt-2">Your Information</h3>

            {/* Names - side by side on larger screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={inquiryForm.control} name="firstName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1 text-xs">
                    First Name
                    <span className="text-destructive ml-1">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Your first name" {...field}
                      onChange={e => { field.onChange(e); setFirstName(e.target.value);}}
                      className={inquiryForm.formState.errors.firstName && "border-destructive focus-visible:ring-destructive/25"}
                      disabled={isPending}
                      required />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={inquiryForm.control} name="lastName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1 text-xs">
                    Last Name
                    <span className="text-destructive ml-1">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Your last name" {...field}
                      onChange={e => { field.onChange(e); setLastName(e.target.value);}}
                      className={inquiryForm.formState.errors.lastName && "border-destructive focus-visible:ring-destructive/25"}
                      disabled={isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Email and Phone - side by side on larger screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={inquiryForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1 text-xs">
                    <Mail className={cn("h-3 w-3", inquiryForm.formState.errors.email && "text-destructive")} />
                    Email
                    <span className="text-destructive ml-1">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="your.email@example.com" {...field}
                      onChange={e => { field.onChange(e); setEmail(e.target.value);}}
                      className={inquiryForm.formState.errors.email && "border-destructive focus-visible:ring-destructive/25"}
                      disabled={isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={inquiryForm.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1 text-xs text-muted-foreground">
                    <PhoneIcon className={cn("h-3 w-3", inquiryForm.formState.errors.phone && "text-destructive")} />
                    Phone (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="Your phone number" {...field}
                      onChange={e => { field.onChange(e); setPhone(e.target.value);}}
                      className={inquiryForm.formState.errors.phone && "border-destructive focus-visible:ring-destructive/25"}
                      disabled={isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={inquiryForm.control} name="message" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1 text-xs">
                  Message
                  <span className="text-destructive ml-1">*</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Your questions or custom request..."
                    {...field}
                    onChange={e => { field.onChange(e); setMessage(e.target.value);}}
                    rows={4}
                    disabled={isPending}
                    className={inquiryForm.formState.errors.message && "border-destructive focus-visible:ring-destructive/25"}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <TouchTarget size="lg">
              <InteractionFeedback
                variant="hover"
                state={isPending || isProcessing ? 'loading' : 'idle'}
              >
                <Button type="submit" className="w-full h-full" disabled={isPending || isProcessing}>
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  {isPending ? "Sending..." : "Send Inquiry"}
                </Button>
              </InteractionFeedback>
            </TouchTarget>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}