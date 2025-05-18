"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Check, X, Calendar, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { format, isWithinInterval, isBefore, startOfDay, addMonths, differenceInDays, isSameDay } from 'date-fns';
import { CustomDateRangePicker } from './CustomDateRangePicker';
import { getUnavailableDatesForProperty } from '@/services/availabilityService';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AvailabilityPreviewProps {
  propertySlug: string;
  onClose?: () => void;
}

export function AvailabilityPreview({ propertySlug, onClose }: AvailabilityPreviewProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for unavailable dates
  const [unavailableDates, setUnavailableDates] = useState<Date[]>([]);
  
  // State for date selections
  const [checkInDate, setCheckInDate] = useState<Date | null>(null);
  const [checkOutDate, setCheckOutDate] = useState<Date | null>(null);
  const [numberOfNights, setNumberOfNights] = useState(0);
  
  // Multiple date range checking
  const [dateRanges, setDateRanges] = useState<Array<{
    id: string;
    start: Date | null;
    end: Date | null;
    nights: number;
    isAvailable: boolean | null;
    isChecking: boolean;
  }>>([]);
  
  // Preview timeframe selection
  const [previewMonths, setPreviewMonths] = useState(6);
  
  // Load unavailable dates on mount
  useEffect(() => {
    console.log(`[AvailabilityPreview] Loading unavailable dates for ${propertySlug}`);
    
    const loadDates = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Use the existing service function to load dates
        const dates = await getUnavailableDatesForProperty(propertySlug, previewMonths);
        console.log(`[AvailabilityPreview] Loaded ${dates.length} unavailable dates for ${previewMonths} months`);
        
        // Store dates in state
        setUnavailableDates(dates);
      } catch (error) {
        console.error('[AvailabilityPreview] Error loading unavailable dates:', error);
        setError('Failed to load availability data. Please try again.');
        toast({
          title: "Error",
          description: "Failed to load availability data. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadDates();
  }, [propertySlug, previewMonths, toast]);
  
  // Handle date change for the main date picker
  const handleDateChange = useCallback((start: Date | null, end: Date | null) => {
    console.log('[AvailabilityPreview] Date changed:', { start, end });
    setCheckInDate(start);
    setCheckOutDate(end);
    
    if (start && end) {
      const nights = differenceInDays(end, start);
      setNumberOfNights(nights);
    } else {
      setNumberOfNights(0);
    }
  }, []);
  
  // Check date range availability
  const checkDateRangeAvailability = useCallback((start: Date | null, end: Date | null) => {
    if (!start || !end) return null;
    
    // Check if any day in the range is unavailable
    let current = new Date(start.getTime());
    
    while (current < end) {
      const currentDateStr = format(startOfDay(current), 'yyyy-MM-dd');
      
      // Check if this date is in the unavailableDates array
      if (unavailableDates.some(d => format(startOfDay(d), 'yyyy-MM-dd') === currentDateStr)) {
        return false;
      }
      
      // Move to the next day
      current.setDate(current.getDate() + 1);
    }
    
    return true;
  }, [unavailableDates]);
  
  // Add a new date range to check
  const addDateRange = useCallback(() => {
    if (!checkInDate || !checkOutDate) {
      toast({
        title: "Missing Dates",
        description: "Please select both check-in and check-out dates first.",
        variant: "destructive",
      });
      return;
    }
    
    // Check if we already have this exact date range
    const exists = dateRanges.some(range => 
      (range.start && range.end) && 
      (isSameDay(range.start, checkInDate!) && isSameDay(range.end, checkOutDate!))
    );
    
    if (exists) {
      toast({
        title: "Duplicate Range",
        description: "This date range is already in your list.",
        variant: "destructive",
      });
      return;
    }
    
    // Check availability for this range
    const isAvailable = checkDateRangeAvailability(checkInDate, checkOutDate);
    
    // Add new date range to the list
    setDateRanges(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        start: checkInDate,
        end: checkOutDate,
        nights: numberOfNights,
        isAvailable,
        isChecking: false
      }
    ]);
    
    toast({
      title: "Date Range Added",
      description: `Added ${format(checkInDate, 'MMM d, yyyy')} - ${format(checkOutDate, 'MMM d, yyyy')} to your list.`,
      variant: "default",
    });
  }, [checkInDate, checkOutDate, numberOfNights, dateRanges, toast, checkDateRangeAvailability]);
  
  // Remove a date range
  const removeDateRange = useCallback((id: string) => {
    setDateRanges(prev => prev.filter(range => range.id !== id));
  }, []);
  
  // Refresh availability data
  const refreshAvailability = useCallback(async () => {
    console.log(`[AvailabilityPreview] Refreshing availability data for ${propertySlug}`);
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Reload dates from API
      const dates = await getUnavailableDatesForProperty(propertySlug, previewMonths);
      console.log(`[AvailabilityPreview] Reloaded ${dates.length} unavailable dates`);
      
      // Update state
      setUnavailableDates(dates);
      
      // Re-check all saved date ranges
      setDateRanges(prev => prev.map(range => {
        if (range.start && range.end) {
          const isAvailable = checkDateRangeAvailability(range.start, range.end);
          return {
            ...range,
            isAvailable
          };
        }
        return range;
      }));
      
      toast({
        title: "Availability Updated",
        description: "Latest availability data has been loaded.",
        variant: "default",
      });
    } catch (error) {
      console.error('[AvailabilityPreview] Error refreshing availability:', error);
      setError('Failed to refresh availability data. Please try again.');
      toast({
        title: "Error",
        description: "Failed to refresh availability data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [propertySlug, previewMonths, toast, checkDateRangeAvailability]);
  
  // Handle preview period change
  const handlePreviewMonthsChange = useCallback((value: string) => {
    const months = parseInt(value, 10);
    setPreviewMonths(months);
  }, []);
  
  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Availability Preview</span>
          <Badge variant="outline" className="ml-2">
            {propertySlug}
          </Badge>
        </CardTitle>
        <CardDescription>
          Check availability for different date ranges in this property
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="date-picker">
          <TabsList className="mb-4">
            <TabsTrigger value="date-picker">Date Selection</TabsTrigger>
            <TabsTrigger value="saved-ranges">
              Saved Ranges {dateRanges.length > 0 && `(${dateRanges.length})`}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="date-picker" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium">Select Date Range to Check</h3>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm">Preview period:</span>
                <Select
                  value={previewMonths.toString()}
                  onValueChange={handlePreviewMonthsChange}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="Months" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 months</SelectItem>
                    <SelectItem value="6">6 months</SelectItem>
                    <SelectItem value="12">12 months</SelectItem>
                    <SelectItem value="24">24 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                <p>Loading availability data...</p>
              </div>
            ) : error ? (
              <div className="p-4 border border-red-200 bg-red-50 rounded-md">
                <p className="text-red-700">{error}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={refreshAvailability}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Retry
                </Button>
              </div>
            ) : (
              <div className="bg-white p-4 border rounded-md">
                <CustomDateRangePicker
                  checkInDate={checkInDate}
                  checkOutDate={checkOutDate}
                  onDateChange={handleDateChange}
                  numberOfNights={numberOfNights}
                  showNights={true}
                  unavailableDates={unavailableDates}
                  className="mb-4"
                />
                
                {checkInDate && checkOutDate && (
                  <div className="mt-4">
                    <div className="flex items-center mb-4">
                      <div 
                        className={`p-3 rounded-md flex items-center w-full ${
                          checkDateRangeAvailability(checkInDate, checkOutDate) 
                            ? 'bg-green-100' 
                            : 'bg-red-100'
                        }`}
                      >
                        {checkDateRangeAvailability(checkInDate, checkOutDate) ? (
                          <>
                            <Check className="h-5 w-5 text-green-600 mr-2" />
                            <div>
                              <h4 className="font-medium text-green-800">Available!</h4>
                              <p className="text-sm text-green-700">These dates are available for booking.</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <X className="h-5 w-5 text-red-600 mr-2" />
                            <div>
                              <h4 className="font-medium text-red-800">Not Available</h4>
                              <p className="text-sm text-red-700">The selected dates are not available.</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <Button onClick={addDateRange} className="w-full">
                      Save This Date Range
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex justify-between mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshAvailability}
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh Availability
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="saved-ranges">
            {dateRanges.length === 0 ? (
              <div className="p-8 text-center border border-dashed rounded-md">
                <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                <h3 className="text-lg font-medium mb-1">No Saved Date Ranges</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Save date ranges to compare availability across multiple periods
                </p>
                <Button variant="outline" onClick={() => document.querySelector('[data-value="date-picker"]')?.click()}>
                  Add Your First Date Range
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  {dateRanges.map((range) => (
                    <div 
                      key={range.id} 
                      className={`p-4 border rounded-md flex items-center justify-between ${
                        range.isAvailable ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        {range.isAvailable ? (
                          <Check className="h-5 w-5 text-green-600 mt-1" />
                        ) : (
                          <X className="h-5 w-5 text-red-600 mt-1" />
                        )}
                        <div>
                          <p className="font-medium">
                            {range.start && range.end 
                              ? `${format(range.start, 'MMM d, yyyy')} - ${format(range.end, 'MMM d, yyyy')}`
                              : 'Invalid date range'
                            }
                          </p>
                          <p className="text-sm text-gray-600">
                            {range.nights} {range.nights === 1 ? 'night' : 'nights'}
                          </p>
                          <p className={`text-sm font-medium ${range.isAvailable ? 'text-green-700' : 'text-red-700'}`}>
                            {range.isAvailable ? 'Available' : 'Not Available'}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDateRange(range.id)}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4 text-gray-500" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" onClick={() => setDateRanges([])}>
                  Clear All Ranges
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onClose}>
          Close Preview
        </Button>
        <Button variant="default" onClick={refreshAvailability} disabled={isLoading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
      </CardFooter>
    </Card>
  );
}