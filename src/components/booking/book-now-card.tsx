// src/components/booking/book-now-card.tsx
"use client";

import * as React from 'react';
import { CreditCard } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { InteractionFeedback } from '@/components/ui/interaction-feedback';

interface BookNowCardProps {
  isSelected: boolean;
  onSelect: () => void;
}

export function BookNowCard({ isSelected, onSelect }: BookNowCardProps) {
  return (
    <InteractionFeedback variant="ripple">
      <Card
        className={cn(
          "relative cursor-pointer transition-all duration-300 ease-in-out",
          "border-[var(--card-border-width)] hover:shadow-[var(--card-shadow)]",
          "transform hover:scale-[1.02] active:scale-[0.98]",
          isSelected 
            ? "border-primary shadow-lg scale-105 bg-primary/5" 
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        )}
        onClick={onSelect}
      >
      <CardHeader className="items-center text-center">
        <div className={cn(
          "p-3 rounded-full mb-3 transition-all duration-300",
          isSelected 
            ? "bg-primary/20 text-primary" 
            : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
        )}>
          <CreditCard className="h-8 w-8" />
        </div>
        <CardTitle className="text-lg font-semibold text-foreground">Book Now</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Complete your booking with full payment.
        </CardDescription>
      </CardHeader>
      
      {/* Indicator badge */}
      {isSelected && (
        <div className="absolute top-3 right-3">
          <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
        </div>
      )}
      </Card>
    </InteractionFeedback>
  );
}
