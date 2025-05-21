"use client";

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface GuestSelectorProps {
  value: number;
  onChange: (value: number) => void;
  minGuests?: number;
  maxGuests: number;
  disabled?: boolean;
  className?: string;
}

/**
 * GuestSelector component for selecting the number of guests
 * 
 * This component provides a simple interface with plus/minus buttons to 
 * increment or decrement the guest count within the allowed range.
 */
export function GuestSelector({
  value,
  onChange,
  minGuests = 1,
  maxGuests,
  disabled = false,
  className = '',
}: GuestSelectorProps) {
  // Handler for decrementing the guest count
  const decrementGuests = async () => {
    if (value > minGuests) {
      // Calculate the new guest count
      const newCount = value - 1;
      
      // Call the onChange handler to update the UI
      onChange(newCount);
      
      // Log that we're making a direct API call
      console.log(`[GuestSelector] 👥 Making direct API call for ${newCount} guests`);
      
      try {
        // Get the current property slug from URL
        const url = window.location.pathname;
        const match = url.match(/\/booking\/check\/([^\/\?]+)/);
        const propertyId = match ? match[1] : null;
        
        if (!propertyId) {
          console.error(`[GuestSelector] ❌ Cannot make API call: property ID not found in URL`);
          return;
        }
        
        // Get check-in and check-out dates from URL
        const urlParams = new URLSearchParams(window.location.search);
        const checkIn = urlParams.get('checkIn');
        const checkOut = urlParams.get('checkOut');
        
        if (!checkIn || !checkOut) {
          console.error(`[GuestSelector] ❌ Cannot make API call: dates not found in URL`);
          return;
        }
        
        // Prepare the API request
        const apiUrl = `${window.location.origin}/api/check-pricing`;
        const body = {
          propertyId,
          checkIn: new Date(checkIn).toISOString(),
          checkOut: new Date(checkOut).toISOString(),
          guests: newCount
        };
        
        console.log(`[GuestSelector] 🚀 Direct API call to ${apiUrl}`, body);
        
        // Make the API call directly
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body)
        });
        
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`[GuestSelector] ✅ Direct API call successful:`, data);
        
        // Display a message to show the price updating
        const priceEl = document.querySelector('.booking-summary');
        if (priceEl) {
          priceEl.classList.add('updating');
          setTimeout(() => priceEl.classList.remove('updating'), 1000);
        }
      } catch (error) {
        console.error(`[GuestSelector] ❌ Error making direct API call:`, error);
      }
    }
  };

  // Handler for incrementing the guest count
  const incrementGuests = async () => {
    if (value < maxGuests) {
      // Calculate the new guest count
      const newCount = value + 1;
      
      // Call the onChange handler to update the UI
      onChange(newCount);
      
      // Log that we're making a direct API call
      console.log(`[GuestSelector] 👥 Making direct API call for ${newCount} guests`);
      
      try {
        // Get the current property slug from URL
        const url = window.location.pathname;
        const match = url.match(/\/booking\/check\/([^\/\?]+)/);
        const propertyId = match ? match[1] : null;
        
        if (!propertyId) {
          console.error(`[GuestSelector] ❌ Cannot make API call: property ID not found in URL`);
          return;
        }
        
        // Get check-in and check-out dates from URL
        const urlParams = new URLSearchParams(window.location.search);
        const checkIn = urlParams.get('checkIn');
        const checkOut = urlParams.get('checkOut');
        
        if (!checkIn || !checkOut) {
          console.error(`[GuestSelector] ❌ Cannot make API call: dates not found in URL`);
          return;
        }
        
        // Prepare the API request
        const apiUrl = `${window.location.origin}/api/check-pricing`;
        const body = {
          propertyId,
          checkIn: new Date(checkIn).toISOString(),
          checkOut: new Date(checkOut).toISOString(),
          guests: newCount
        };
        
        console.log(`[GuestSelector] 🚀 Direct API call to ${apiUrl}`, body);
        
        // Make the API call directly
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body)
        });
        
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`[GuestSelector] ✅ Direct API call successful:`, data);
        
        // Display a message to show the price updating
        const priceEl = document.querySelector('.booking-summary');
        if (priceEl) {
          priceEl.classList.add('updating');
          setTimeout(() => priceEl.classList.remove('updating'), 1000);
        }
      } catch (error) {
        console.error(`[GuestSelector] ❌ Error making direct API call:`, error);
      }
    }
  };

  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="mb-1 block text-sm font-medium">Guests</Label>
      <div className="flex items-center justify-between rounded-md border px-3 h-10 w-full bg-white mt-px">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={decrementGuests}
          disabled={value <= minGuests || disabled}
          aria-label="Decrease guests"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="mx-2 font-medium w-10 text-center" id="guests">
          {value}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={incrementGuests}
          disabled={value >= maxGuests || disabled}
          aria-label="Increase guests"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {/* This invisible element ensures same spacing as date selectors */}
      <div className="h-[21px] invisible">.</div>
    </div>
  );
}