"use client";

import React from 'react';
import { Loader2, ArrowRight, Mail, Phone as PhoneIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface HoldFormProps {
  property: any;
  isProcessing: boolean;
  isPending: boolean;
  formError: string | null;
  pricingDetails: any;
  selectedCurrency: string;
  onSubmit: (selectedCurrency: string, formData?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  }) => Promise<void>;
}

/**
 * HoldForm component for holding dates with a fee
 * 
 * This is a placeholder component that would be implemented with actual form logic
 * in a real application.
 */
export function HoldForm({
  property,
  isProcessing,
  isPending,
  formError,
  pricingDetails,
  selectedCurrency,
  onSubmit
}: HoldFormProps) {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(selectedCurrency, {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890'
    });
  };
  
  const holdFee = '$10';
  const holdDuration = property.holdDurationHours || 24;
  
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Hold Dates</CardTitle>
        <CardDescription>
          Reserve these dates for {holdDuration} hours with a small holding fee of {holdFee}.
          {property.holdFeeRefundable && " This fee is refundable if you complete your booking."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
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
                disabled={isProcessing || isPending}
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
                disabled={isProcessing || isPending}
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
                disabled={isProcessing || isPending}
              />
            </div>
            <div>
              <Label className="flex items-center gap-1 text-xs">
                <PhoneIcon className="h-3 w-3" />
                Phone Number
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input 
                type="tel" 
                placeholder="Your phone number"
                disabled={isProcessing || isPending}
              />
            </div>
          </div>
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isProcessing || isPending}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                Pay {holdFee} to Hold Dates
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}