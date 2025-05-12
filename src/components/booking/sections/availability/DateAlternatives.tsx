"use client";

import React, { useState } from 'react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export interface DateAlternative {
  checkIn: Date;
  checkOut: Date;
  nights: number;
  label: string;
  id: string;
}

interface DateAlternativesProps {
  alternatives: DateAlternative[];
  onSelectAlternative: (alternative: DateAlternative) => Promise<void>;
  isProcessing: boolean;
}

/**
 * DateAlternatives component for showing alternative date suggestions
 * 
 * This component displays a list of suggested alternative dates when
 * the user's chosen dates are unavailable.
 */
export function DateAlternatives({
  alternatives,
  onSelectAlternative,
  isProcessing
}: DateAlternativesProps) {
  // Track which alternative is being processed
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Helper to check if a specific alternative is being processed
  const isProcessingAlternative = (id: string) => {
    return isProcessing && processingId === id;
  };
  
  // Handler for selecting an alternative
  const handleSelectAlternative = async (alternative: DateAlternative) => {
    if (isProcessing) return;
    
    try {
      setProcessingId(alternative.id);
      await onSelectAlternative(alternative);
    } finally {
      setProcessingId(null);
    }
  };
  
  if (alternatives.length === 0) {
    return null;
  }
  
  return (
    <Card className="bg-amber-50 border-amber-200">
      <CardHeader>
        <CardTitle className="text-lg text-amber-900">Alternative Dates</CardTitle>
        <CardDescription className="text-amber-800">
          The following dates are available options:
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {alternatives.map((alternative) => (
          <Button
            key={alternative.id}
            variant="outline"
            className="w-full justify-between bg-white hover:bg-gray-50 border-gray-300"
            onClick={() => handleSelectAlternative(alternative)}
            disabled={isProcessing}
          >
            {isProcessingAlternative(alternative.id) ? (
              <div className="flex items-center justify-center w-full">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span>Checking availability...</span>
              </div>
            ) : (
              <>
                <span>
                  {format(alternative.checkIn, 'MMM d, yyyy')} - {format(alternative.checkOut, 'MMM d, yyyy')} ({alternative.nights} nights)
                </span>
                <Badge variant="secondary">{alternative.label}</Badge>
              </>
            )}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}