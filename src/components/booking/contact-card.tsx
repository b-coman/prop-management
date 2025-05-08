// src/components/booking/contact-card.tsx
"use client";

import * as React from 'react';
import { MessageSquare } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ContactCardProps {
  isSelected: boolean;
  onSelect: () => void;
}

export function ContactCard({ isSelected, onSelect }: ContactCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all border-2",
        isSelected ? "border-primary shadow-lg scale-105" : "border-border hover:border-muted-foreground/50"
      )}
      onClick={onSelect}
    >
      <CardHeader className="items-center text-center">
        <MessageSquare className={cn("h-8 w-8 mb-2", isSelected ? "text-primary" : "text-muted-foreground")} />
        <CardTitle className="text-lg">Contact for Details</CardTitle>
        <CardDescription className="text-sm">Ask questions or request a custom offer.</CardDescription>
      </CardHeader>
      {/* Form will be rendered outside/below when selected */}
      {/* {!isSelected && ( // Optionally show button only when not selected
        <CardContent className="text-center pb-4">
          <Button variant={isSelected ? "default" : "outline"} size="sm">
            {isSelected ? "Selected" : "Select"}
          </Button>
        </CardContent>
      )} */}
    </Card>
  );
}
