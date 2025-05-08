// src/components/booking/hold-card.tsx
"use client";

import * as React from 'react';
import { Clock } from 'lucide-react'; // Using Clock for now
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HoldCardProps {
  isSelected: boolean;
  onSelect: () => void;
  holdFeeAmount: number;
}

export function HoldCard({ isSelected, onSelect, holdFeeAmount }: HoldCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all border-2",
        isSelected ? "border-primary shadow-lg scale-105" : "border-border hover:border-muted-foreground/50"
      )}
      onClick={onSelect}
    >
      <CardHeader className="items-center text-center">
        <Clock className={cn("h-8 w-8 mb-2", isSelected ? "text-primary" : "text-muted-foreground")} />
        <CardTitle className="text-lg">Hold for 24 Hours</CardTitle>
        <CardDescription className="text-sm">Reserve dates with a small ${holdFeeAmount} fee (applied to booking).</CardDescription>
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
