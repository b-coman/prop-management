'use client';

import { useState, useEffect } from 'react';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PriceCalendar } from '@/lib/pricing/price-calendar-generator';
import { getPriceCalendars } from '../actions';

interface PriceCalendarManagerProps {
  propertyId: string;
}

export default function PriceCalendarManager({ propertyId }: PriceCalendarManagerProps) {
  const [calendars, setCalendars] = useState<PriceCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    const loadCalendars = async () => {
      if (!propertyId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const result = await getPriceCalendars(propertyId);
        
        if (result.success) {
          setCalendars(result.calendars);
          
          // Auto-select the first month if nothing is selected
          if (!selectedMonth && result.calendars.length > 0) {
            setSelectedMonth(result.calendars[0].month);
          }
        } else {
          setError(result.error || 'Failed to load price calendars');
        }
      } catch (err) {
        console.error('Error loading price calendars:', err);
        setError('An unexpected error occurred while loading price calendars');
      } finally {
        setLoading(false);
      }
    };

    loadCalendars();
  }, [propertyId, selectedMonth]);

  // Format month for display
  const formatMonth = (monthStr: string) => {
    try {
      return format(parseISO(`${monthStr}-01`), 'MMMM yyyy');
    } catch (error) {
      return monthStr;
    }
  };

  // Get selected calendar
  const selectedCalendar = calendars.find(cal => cal.month === selectedMonth);

  // Format price source for display
  const formatPriceSource = (source: string) => {
    switch (source) {
      case 'base':
        return 'Base Price';
      case 'weekend':
        return 'Weekend Rate';
      case 'season':
        return 'Seasonal Rate';
      case 'override':
        return 'Custom Override';
      default:
        return source;
    }
  };

  if (loading) {
    return <div className="py-6 text-center text-slate-500">Loading price calendars...</div>;
  }

  if (error) {
    return <div className="py-6 text-center text-red-500">{error}</div>;
  }

  if (calendars.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-slate-500 mb-4">No price calendars found for this property</p>
        <p className="text-sm text-slate-400">
          Generate price calendars using the button below to see pricing for this property
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={selectedMonth || ''} onValueChange={setSelectedMonth}>
        <TabsList className="overflow-x-auto whitespace-nowrap max-w-full p-0 flex flex-wrap h-auto">
          {calendars.map(calendar => (
            <TabsTrigger 
              key={calendar.month} 
              value={calendar.month}
              className="h-10"
            >
              {formatMonth(calendar.month)}
            </TabsTrigger>
          ))}
        </TabsList>
        
        {selectedCalendar && (
          <TabsContent value={selectedCalendar.month} className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{formatMonth(selectedCalendar.month)}</CardTitle>
                <CardDescription>
                  Price calendar generated on {format(selectedCalendar.generatedAt.toDate(), 'PPP p')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-slate-50 rounded-md">
                    <h3 className="text-sm font-semibold mb-2">Price Summary</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-slate-500">Minimum price:</div>
                      <div>{selectedCalendar.summary.minPrice.toFixed(2)}</div>
                      <div className="text-slate-500">Maximum price:</div>
                      <div>{selectedCalendar.summary.maxPrice.toFixed(2)}</div>
                      <div className="text-slate-500">Average price:</div>
                      <div>{selectedCalendar.summary.avgPrice.toFixed(2)}</div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-md">
                    <h3 className="text-sm font-semibold mb-2">Calendar Stats</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-slate-500">Unavailable days:</div>
                      <div>{selectedCalendar.summary.unavailableDays}</div>
                      <div className="text-slate-500">Modified days:</div>
                      <div>{selectedCalendar.summary.modifiedDays}</div>
                      <div className="text-slate-500">Special pricing:</div>
                      <div>
                        {selectedCalendar.summary.hasSeasonalRates && 'Seasonal rates'}
                        {selectedCalendar.summary.hasSeasonalRates && selectedCalendar.summary.hasCustomPrices && ', '}
                        {selectedCalendar.summary.hasCustomPrices && 'Custom overrides'}
                        {!selectedCalendar.summary.hasSeasonalRates && !selectedCalendar.summary.hasCustomPrices && 'None'}
                      </div>
                    </div>
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Day</TableHead>
                        <TableHead>Base Price</TableHead>
                        <TableHead>Availability</TableHead>
                        <TableHead>Min. Stay</TableHead>
                        <TableHead>Pricing Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(selectedCalendar.days).map(([day, dayData]) => (
                        <TableRow key={day}>
                          <TableCell className="font-medium">
                            {format(new Date(parseInt(selectedCalendar.year), parseInt(selectedCalendar.month.split('-')[1]) - 1, parseInt(day)), 'PPP')}
                          </TableCell>
                          <TableCell>{dayData.baseOccupancyPrice.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge className={dayData.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                              {dayData.available ? 'Available' : 'Unavailable'}
                            </Badge>
                          </TableCell>
                          <TableCell>{dayData.minimumStay} night{dayData.minimumStay !== 1 ? 's' : ''}</TableCell>
                          <TableCell>
                            <Badge className={
                              dayData.priceSource === 'base' ? 'bg-slate-100 text-slate-800' :
                              dayData.priceSource === 'weekend' ? 'bg-blue-100 text-blue-800' :
                              dayData.priceSource === 'season' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-purple-100 text-purple-800'
                            }>
                              {formatPriceSource(dayData.priceSource)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}