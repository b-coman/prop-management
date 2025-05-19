'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function BookingCheckSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header Skeleton */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border md:hidden">
        <div className="container px-4 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-16" />
            <div className="flex-1 text-center">
              <Skeleton className="h-4 w-32 mx-auto" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Desktop Header Skeleton */}
      <div className="hidden md:block border-b border-border bg-background">
        <div className="container py-4">
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-[300px,1fr] lg:grid-cols-[350px,1fr] gap-0 md:gap-8 lg:gap-12">
          {/* Desktop Sidebar Skeleton */}
          <aside className="hidden md:block sticky top-24 h-fit py-8">
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-[var(--card-radius)] overflow-hidden">
                {/* Image skeleton */}
                <Skeleton className="aspect-[4/3] w-full" />
                
                {/* Content skeleton */}
                <div className="p-[var(--card-padding)] space-y-4">
                  <Skeleton className="h-6 w-48" />
                  
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  
                  <div className="pt-4 border-t border-border">
                    <div className="flex items-baseline justify-between">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
          
          {/* Main Content Skeleton */}
          <main className="py-6 md:py-8">
            <div className="space-y-6">
              {/* Date picker skeleton */}
              <div className="space-y-3">
                <Skeleton className="h-6 w-32" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full rounded-[var(--input-radius)]" />
                  <Skeleton className="h-10 w-full rounded-[var(--input-radius)]" />
                </div>
              </div>
              
              {/* Guests selector skeleton */}
              <div className="space-y-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full rounded-[var(--input-radius)]" />
              </div>
              
              {/* Check availability button skeleton */}
              <Skeleton className="h-10 w-full rounded-[var(--button-radius)]" />
              
              {/* Pricing summary skeleton */}
              <div className="border border-border rounded-[var(--card-radius)] p-[var(--card-padding)]">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-32" />
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="flex justify-between">
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Booking options skeleton */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Skeleton className="h-32 rounded-[var(--card-radius)]" />
                <Skeleton className="h-32 rounded-[var(--card-radius)]" />
                <Skeleton className="h-32 rounded-[var(--card-radius)]" />
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export function AvailabilityCheckerSkeleton() {
  return (
    <div className="space-y-6 w-full">
      {/* Date selection skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-10 w-full rounded-[var(--input-radius)]" />
          <Skeleton className="h-10 w-full rounded-[var(--input-radius)]" />
        </div>
      </div>
      
      {/* Guest selector skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-10 w-full rounded-[var(--input-radius)]" />
      </div>
      
      {/* Action button skeleton */}
      <Skeleton className="h-10 w-full rounded-[var(--button-radius)]" />
    </div>
  );
}

export function BookingSummarySkeleton() {
  return (
    <div className="border border-border rounded-[var(--card-radius)] p-[var(--card-padding)]">
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="space-y-2">
          {/* Price breakdown items */}
          <div className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        <div className="pt-3 border-t border-border">
          <div className="flex justify-between items-baseline">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function BookingOptionsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="relative">
          <Skeleton className="h-32 rounded-[var(--card-radius)]" />
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-6">
      {/* Form header */}
      <Skeleton className="h-7 w-48" />
      
      {/* Name fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full rounded-[var(--input-radius)]" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full rounded-[var(--input-radius)]" />
        </div>
      </div>
      
      {/* Contact fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full rounded-[var(--input-radius)]" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-[var(--input-radius)]" />
        </div>
      </div>
      
      {/* Message field */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-24 w-full rounded-[var(--input-radius)]" />
      </div>
      
      {/* Submit button */}
      <Skeleton className="h-10 w-full rounded-[var(--button-radius)]" />
    </div>
  );
}