"use client";

import React from 'react';
import { Loader2, ArrowRight, Mail, Phone as PhoneIcon, TicketPercent, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface BookingFormProps {
  property: any;
  isProcessing: boolean;
  isPending: boolean;
  formError: string | null;
  lastErrorType?: string;
  canRetryError: boolean;
  pricingDetails: any;
  appliedCoupon: { code: string; discountPercentage: number } | null;
  setAppliedCoupon: (coupon: { code: string; discountPercentage: number } | null) => void;
  selectedCurrency: string;
  onSubmit: (pricingDetails: any, appliedCoupon: { code: string; discountPercentage: number } | null, selectedCurrency: string) => Promise<void>;
}

/**
 * BookingForm component for booking with payment
 * 
 * This is a placeholder component that would be implemented with actual form logic
 * in a real application.
 */
export function BookingForm({
  property,
  isProcessing,
  isPending,
  formError,
  lastErrorType,
  canRetryError,
  pricingDetails,
  appliedCoupon,
  setAppliedCoupon,
  selectedCurrency,
  onSubmit
}: BookingFormProps) {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(pricingDetails, appliedCoupon, selectedCurrency);
  };
  
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Complete Booking</CardTitle>
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

          {/* Coupon section */}
          <div className="space-y-1 pt-2">
            <Label htmlFor="coupon" className="text-xs">Discount Coupon (Optional)</Label>
            <div className="flex gap-2 mt-1">
              <Input 
                id="coupon" 
                placeholder="Enter code" 
                disabled={isProcessing || isPending} 
                className="flex-grow" 
              />
              <Button 
                type="button" 
                variant="outline" 
                disabled={isProcessing || isPending} 
                className="shrink-0"
              >
                <TicketPercent className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isProcessing || isPending}
          >
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
            {isProcessing ? 'Processing...' : 'Continue to Payment'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}