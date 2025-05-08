// src/components/booking/book-now-card.tsx
"use client";

import * as React from 'react';
import { CreditCard } from 'lucide-react'; // Using CreditCard for now
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BookNowCardProps {
  isSelected: boolean;
  onSelect: () => void;
}

export function BookNowCard({ isSelected, onSelect }: BookNowCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all border-2",
        isSelected ? "border-primary shadow-lg scale-105" : "border-border hover:border-muted-foreground/50"
      )}
      onClick={onSelect}
    >
      <CardHeader className="items-center text-center">
        <CreditCard className={cn("h-8 w-8 mb-2", isSelected ? "text-primary" : "text-muted-foreground")} />
        <CardTitle className="text-lg">Book Now</CardTitle>
        <CardDescription className="text-sm">Complete your booking with full payment.</CardDescription>
      </CardHeader>
       {/* Form will be rendered outside/below when selected */}
       {/* {!isSelected && (
         <CardContent className="text-center pb-4">
            <Button variant={isSelected ? "default" : "outline"} size="sm">
                {isSelected ? "Selected" : "Select"}
            </Button>
         </CardContent>
        )} */}
    </Card>
  );
}
