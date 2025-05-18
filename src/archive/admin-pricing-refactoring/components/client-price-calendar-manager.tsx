'use client';

import { PriceCalendarMonth } from '@/lib/server/pricing-data';
import { 
  Table, 
  TableHeader, 
  TableRow, 
  TableHead, 
  TableBody, 
  TableCell 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { generatePriceCalendar } from '../actions-client';
import { CalendarIcon, RefreshCw } from 'lucide-react';

interface ClientPriceCalendarManagerProps {
  priceCalendars: PriceCalendarMonth[];
  propertyId: string;
  isLoading: boolean;
  error: string | null;
}

/**
 * Client component for displaying and managing price calendars
 * 
 * This component:
 * 1. Displays price calendar data in a table
 * 2. Provides UI for generating new price calendars
 */
export function ClientPriceCalendarManager({
  priceCalendars,
  propertyId,
  isLoading,
  error
}: ClientPriceCalendarManagerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Format month string (YYYY-MM) to readable format
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long'
    });
  };

  // Format timestamp to readable date
  const formatTimestamp = (timestamp: any) => {
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Handle manual price calendar generation
  const handleGenerateCalendar = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    setSuccessMessage(null);
    
    try {
      const result = await generatePriceCalendar(propertyId);
      if (result.success) {
        setSuccessMessage(`Successfully generated price calendars for ${result.months} months`);
      } else {
        setGenerationError(result.error || 'Failed to generate price calendars');
      }
    } catch (err: any) {
      console.error('Error generating price calendars:', err);
      setGenerationError(err.message || 'An unexpected error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return <div className="py-6 text-center text-slate-500">Loading price calendars...</div>;
  }

  if (error) {
    return <div className="py-6 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Price Calendars Table */}
      {priceCalendars.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-slate-500 mb-4">No price calendars generated for this property</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead>Price Range</TableHead>
              <TableHead>Avg. Price</TableHead>
              <TableHead>Unavailable Days</TableHead>
              <TableHead>Special Pricing</TableHead>
              <TableHead>Last Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {priceCalendars.map((calendar) => (
              <TableRow key={calendar.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center">
                    <CalendarIcon className="h-4 w-4 mr-2 text-slate-400" />
                    {formatMonth(calendar.month)}
                  </div>
                </TableCell>
                <TableCell>
                  {calendar.summary.minPrice} - {calendar.summary.maxPrice}
                </TableCell>
                <TableCell>{Math.round(calendar.summary.avgPrice)}</TableCell>
                <TableCell>{calendar.summary.unavailableDays}</TableCell>
                <TableCell>
                  <div className="flex space-x-1 flex-wrap">
                    {calendar.summary.hasSeasonalRates && (
                      <Badge className="bg-blue-100 text-blue-800">
                        Seasonal
                      </Badge>
                    )}
                    {calendar.summary.hasCustomPrices && (
                      <Badge className="bg-purple-100 text-purple-800">
                        Custom
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-slate-500">
                  {formatTimestamp(calendar.generatedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Separator className="my-6" />
                
      {/* Manual Generation Section */}
      <div className="bg-slate-50 p-4 rounded-md">
        <h3 className="text-lg font-medium mb-2">Manual Calendar Generation</h3>
        <p className="text-sm text-slate-600 mb-4">
          Generate price calendars for this property for the next 12 months. 
          This will create or update the pre-calculated price calendars based on
          current seasonal pricing and date overrides.
        </p>
        
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded p-3 mb-4 text-green-800">
            {successMessage}
          </div>
        )}
        
        {generationError && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-red-800">
            {generationError}
          </div>
        )}
        
        <Button 
          onClick={handleGenerateCalendar}
          disabled={isGenerating}
          className="flex items-center"
        >
          {isGenerating && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
          {isGenerating ? 'Generating...' : 'Generate Price Calendars'}
        </Button>
      </div>
    </div>
  );
}