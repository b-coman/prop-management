'use client';

import { useState, useEffect } from 'react';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { collection, query, where, getDocs, orderBy, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface PriceCalendarDay {
  baseOccupancyPrice: number;
  prices: Record<string, number>;
  available: boolean;
  minimumStay: number;
  priceSource: string;
  sourceDetails?: any;
}

interface PriceCalendarSummary {
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  unavailableDays: number;
  modifiedDays: number;
  hasCustomPrices: boolean;
  hasSeasonalRates: boolean;
}

interface PriceCalendar {
  id: string;
  propertyId: string;
  month: string; // YYYY-MM format
  year: number;
  days: Record<string, PriceCalendarDay>;
  summary: PriceCalendarSummary;
  generatedAt: { toDate: () => Date }; // Simplified Timestamp
}

interface ClientPriceCalendarManagerProps {
  propertyId: string;
}

export default function ClientPriceCalendarManager({ propertyId }: ClientPriceCalendarManagerProps) {
  const [calendars, setCalendars] = useState<PriceCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadCalendars = async () => {
      if (!propertyId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const calendarCollection = collection(db, 'priceCalendar');
        const q = query(
          calendarCollection, 
          where('propertyId', '==', propertyId),
          orderBy('month')
        );
        
        const querySnapshot = await getDocs(q);
        
        const fetchedCalendars: PriceCalendar[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedCalendars.push({
            id: doc.id,
            propertyId: data.propertyId,
            month: data.month,
            year: data.year,
            days: data.days || {},
            summary: data.summary || {
              minPrice: 0,
              maxPrice: 0,
              avgPrice: 0,
              unavailableDays: 0,
              modifiedDays: 0,
              hasCustomPrices: false,
              hasSeasonalRates: false,
            },
            generatedAt: data.generatedAt || { toDate: () => new Date() }
          });
        });
        
        setCalendars(fetchedCalendars);
        
        // Auto-select the first month if nothing is selected
        if (!selectedMonth && fetchedCalendars.length > 0) {
          setSelectedMonth(fetchedCalendars[0].month);
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

  // Generate a placeholder calendar for display when no real calendars exist
  const generatePlaceholderCalendar = () => {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const monthStr = month.toString().padStart(2, '0');
    
    const days: Record<string, PriceCalendarDay> = {};
    const daysInMonth = new Date(year, month, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      days[day.toString()] = {
        baseOccupancyPrice: 100,
        prices: {
          '3': 120,
          '4': 140
        },
        available: true,
        minimumStay: 1,
        priceSource: 'base'
      };
    }
    
    return {
      id: `placeholder_${propertyId}_${year}-${monthStr}`,
      propertyId,
      month: `${year}-${monthStr}`,
      year,
      days,
      summary: {
        minPrice: 100,
        maxPrice: 100,
        avgPrice: 100,
        unavailableDays: 0,
        modifiedDays: 0,
        hasCustomPrices: false,
        hasSeasonalRates: false
      },
      generatedAt: { toDate: () => new Date() }
    };
  };

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

  // Handle generating price calendars
  const handleGenerateCalendar = async () => {
    setIsGenerating(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      // Create a placeholder calendar in Firestore
      const calendarCollection = collection(db, 'priceCalendar');
      
      // Generate calendars for the next 3 months
      const currentDate = new Date();
      let successCount = 0;
      
      for (let i = 0; i < 3; i++) {
        const targetDate = new Date(currentDate);
        targetDate.setMonth(currentDate.getMonth() + i);
        
        const year = targetDate.getFullYear();
        const month = targetDate.getMonth() + 1;
        const monthStr = month.toString().padStart(2, '0');
        const calendarId = `${propertyId}_${year}-${monthStr}`;
        
        // Basic calendar structure
        const calendar = {
          id: calendarId,
          propertyId,
          month: `${year}-${monthStr}`,
          year,
          days: {},
          summary: {
            minPrice: 100,
            maxPrice: 150,
            avgPrice: 125,
            unavailableDays: 0,
            modifiedDays: 0,
            hasCustomPrices: false,
            hasSeasonalRates: false
          },
          generatedAt: Timestamp.now()
        };
        
        // Add days to the calendar
        const daysInMonth = new Date(year, month, 0).getDate();
        const calendarDays: Record<string, PriceCalendarDay> = {};
        for (let day = 1; day <= daysInMonth; day++) {
          // Simple price calculation - base 100 + weekend adjustment
          const date = new Date(year, month - 1, day);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const basePrice = isWeekend ? 120 : 100;
          
          calendarDays[day.toString()] = {
            baseOccupancyPrice: basePrice,
            prices: {
              '3': basePrice + 20,
              '4': basePrice + 40
            },
            available: true,
            minimumStay: 1,
            priceSource: isWeekend ? 'weekend' : 'base'
          };
        }
        calendar.days = calendarDays;
        
        // Add to Firestore
        await addDoc(calendarCollection, calendar);
        successCount++;
      }
      
      setSuccessMessage(`Successfully generated ${successCount} price calendars`);
      
      // Reload calendars
      const q = query(
        calendarCollection, 
        where('propertyId', '==', propertyId),
        orderBy('month')
      );
      
      const querySnapshot = await getDocs(q);
      
      const fetchedCalendars: PriceCalendar[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedCalendars.push({
          id: doc.id,
          propertyId: data.propertyId,
          month: data.month,
          year: data.year,
          days: data.days || {},
          summary: data.summary || {
            minPrice: 0,
            maxPrice: 0,
            avgPrice: 0,
            unavailableDays: 0,
            modifiedDays: 0,
            hasCustomPrices: false,
            hasSeasonalRates: false,
          },
          generatedAt: data.generatedAt || { toDate: () => new Date() }
        });
      });
      
      setCalendars(fetchedCalendars);
      
      // Auto-select the first month if nothing is selected
      if (!selectedMonth && fetchedCalendars.length > 0) {
        setSelectedMonth(fetchedCalendars[0].month);
      }
    } catch (err) {
      console.error('Error generating price calendars:', err);
      setError('An unexpected error occurred while generating price calendars');
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return <div className="py-6 text-center text-slate-500">Loading price calendars...</div>;
  }

  if (error) {
    return <div className="py-6 text-center text-red-500">{error}</div>;
  }

  // Use a placeholder if no calendars exist
  const displayCalendars = calendars.length > 0 ? calendars : [generatePlaceholderCalendar()];
  const displaySelectedCalendar = selectedCalendar || displayCalendars[0];

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-md mb-4">
          {successMessage}
        </div>
      )}
      
      <Tabs value={selectedMonth || displayCalendars[0]?.month || ''} onValueChange={setSelectedMonth}>
        <TabsList className="overflow-x-auto whitespace-nowrap max-w-full p-0 flex flex-wrap h-auto">
          {displayCalendars.map(calendar => (
            <TabsTrigger 
              key={calendar.month} 
              value={calendar.month}
              className="h-10"
            >
              {formatMonth(calendar.month)}
            </TabsTrigger>
          ))}
        </TabsList>
        
        {displaySelectedCalendar && (
          <TabsContent value={displaySelectedCalendar.month} className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{formatMonth(displaySelectedCalendar.month)}</CardTitle>
                <CardDescription>
                  {calendars.length > 0 
                    ? `Price calendar generated on ${format(displaySelectedCalendar.generatedAt.toDate(), 'PPP p')}`
                    : 'Example price calendar (not yet generated)'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-slate-50 rounded-md">
                    <h3 className="text-sm font-semibold mb-2">Price Summary</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-slate-500">Minimum price:</div>
                      <div>{displaySelectedCalendar.summary.minPrice.toFixed(2)}</div>
                      <div className="text-slate-500">Maximum price:</div>
                      <div>{displaySelectedCalendar.summary.maxPrice.toFixed(2)}</div>
                      <div className="text-slate-500">Average price:</div>
                      <div>{displaySelectedCalendar.summary.avgPrice.toFixed(2)}</div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-md">
                    <h3 className="text-sm font-semibold mb-2">Calendar Stats</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-slate-500">Unavailable days:</div>
                      <div>{displaySelectedCalendar.summary.unavailableDays}</div>
                      <div className="text-slate-500">Modified days:</div>
                      <div>{displaySelectedCalendar.summary.modifiedDays}</div>
                      <div className="text-slate-500">Special pricing:</div>
                      <div>
                        {displaySelectedCalendar.summary.hasSeasonalRates && 'Seasonal rates'}
                        {displaySelectedCalendar.summary.hasSeasonalRates && displaySelectedCalendar.summary.hasCustomPrices && ', '}
                        {displaySelectedCalendar.summary.hasCustomPrices && 'Custom overrides'}
                        {!displaySelectedCalendar.summary.hasSeasonalRates && !displaySelectedCalendar.summary.hasCustomPrices && 'None'}
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
                      {Object.entries(displaySelectedCalendar.days).map(([day, dayData]) => (
                        <TableRow key={day}>
                          <TableCell className="font-medium">
                            {format(new Date(parseInt(displaySelectedCalendar.year.toString()), parseInt(displaySelectedCalendar.month.split('-')[1]) - 1, parseInt(day)), 'PPP')}
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
                
                <Separator className="my-6" />
                
                <div className="bg-slate-50 p-4 rounded-md">
                  <h3 className="text-lg font-medium mb-2">Generate Price Calendars</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Generate price calendars for this property for the next 3 months. 
                    This will create or update the pre-calculated price calendars with sample data.
                  </p>
                  <Button 
                    onClick={handleGenerateCalendar}
                    disabled={isGenerating}
                  >
                    {isGenerating ? 'Generating...' : 'Generate Price Calendars'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}