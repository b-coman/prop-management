"use client";

import React from 'react';
import { Loader2, Mail, Phone as PhoneIcon, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ContactHostFormProps {
  onSubmit: (values: any) => Promise<void>;
  isProcessing: boolean;
  isPending: boolean;
  pricingDetails: any | null;
  selectedCurrency: string;
}

/**
 * ContactHostForm component for inquiring about dates
 * 
 * This is a placeholder component that would be implemented with actual form logic
 * in a real application.
 */
export function ContactHostForm({
  onSubmit,
  isProcessing,
  isPending,
  pricingDetails,
  selectedCurrency
}: ContactHostFormProps) {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      message: 'Hello, I am interested in booking your property.'
    });
  };
  
  return (
    <Card>
      <CardHeader><CardTitle>Contact Host</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <h3 className="font-semibold text-base pt-2">Your Information</h3>

          {/* Names - side by side on larger screens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1 block text-sm font-medium">
                First Name
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input 
                placeholder="Your first name" 
                disabled={isPending}
                required 
              />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium">
                Last Name
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input 
                placeholder="Your last name" 
                disabled={isPending} 
              />
            </div>
          </div>

          {/* Email and Phone - side by side on larger screens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-1 text-xs">
                <Mail className="h-3 w-3" />
                Email
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input 
                type="email" 
                placeholder="your.email@example.com" 
                disabled={isPending} 
              />
            </div>
            <div>
              <Label className="flex items-center gap-1 text-xs text-muted-foreground">
                <PhoneIcon className="h-3 w-3" />
                Phone (Optional)
              </Label>
              <Input 
                type="tel" 
                placeholder="Your phone number" 
                disabled={isPending} 
              />
            </div>
          </div>
          
          <div>
            <Label className="flex items-center gap-1 text-xs">
              Message
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Textarea
              placeholder="Your questions or custom request..."
              rows={4}
              disabled={isPending}
            />
          </div>
          
          <Button type="submit" disabled={isPending || isProcessing}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {isPending ? "Sending..." : "Send Inquiry"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}