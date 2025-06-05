'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarIcon, RefreshCw, Calendar as CalendarCheck } from 'lucide-react';
import { generatePriceCalendar, fetchPriceCalendars } from '../server-actions-hybrid';
import { PriceCalendarDisplay } from './price-calendar-display';
import { Separator } from '@/components/ui/separator';

interface PriceCalendarManagerProps {
  propertyId: string;
}

export function PriceCalendarManager({ propertyId }: PriceCalendarManagerProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null);
  const [priceCalendars, setPriceCalendars] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch price calendars when the component mounts
  useEffect(() => {
    const loadPriceCalendars = async () => {
      setIsLoading(true);
      try {
        const calendars = await fetchPriceCalendars(propertyId);
        setPriceCalendars(calendars);
      } catch (error) {
        console.error('Error fetching price calendars:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPriceCalendars();
  }, [propertyId]);

  const handleGenerateCalendars = async () => {
    try {
      setIsGenerating(true);
      const result = await generatePriceCalendar(propertyId);

      if (result.success) {
        setLastGenerated(new Date());

        // Fetch the updated calendars
        const calendars = await fetchPriceCalendars(propertyId);
        setPriceCalendars(calendars);

        router.refresh(); // Refresh the page data
      }
    } catch (error) {
      console.error('Error generating price calendars:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center space-y-4">
            <CalendarIcon className="h-16 w-16 text-muted-foreground" />
            <h3 className="text-lg font-medium">Price Calendar Generation</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Generate price calendars for future dates based on your seasonal pricing and date overrides.
              This will calculate prices for the next 12 months.
            </p>

            <Button
              onClick={handleGenerateCalendars}
              disabled={isGenerating}
              className="mt-4"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Price Calendars'
              )}
            </Button>

            {lastGenerated && (
              <p className="text-xs text-muted-foreground mt-2">
                Last generated: {lastGenerated.toLocaleString()}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
        <h4 className="font-medium text-amber-800 mb-2">Price Calendar Information</h4>
        <p className="text-sm text-amber-700">
          Price calendars are pre-calculated to improve booking performance. After making changes to
          seasonal pricing or date overrides, you should regenerate your price calendars to ensure
          accurate pricing for future bookings.
        </p>
      </div>

      <Separator className="my-8" />

      <div className="space-y-4">
        <div className="flex items-center">
          <CalendarCheck className="mr-2 h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-medium">Existing Price Calendars</h3>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading price calendars...
          </div>
        ) : (
          <PriceCalendarDisplay priceCalendars={priceCalendars} />
        )}
      </div>
    </div>
  );
}