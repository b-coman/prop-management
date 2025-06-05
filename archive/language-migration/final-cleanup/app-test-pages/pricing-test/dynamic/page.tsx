'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, addDays, differenceInDays } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BookingSummary } from '@/components/booking/booking-summary';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, AlertCircle } from 'lucide-react';

export default function DynamicPricingTestPage() {
  const [propertyId, setPropertyId] = useState('prahova-mountain-chalet');
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [guests, setGuests] = useState(4);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize with current date + 3 days by default
  useEffect(() => {
    const today = new Date();
    setCheckIn(addDays(today, 3));
    setCheckOut(addDays(today, 10));
  }, []);
  
  async function checkPricing() {
    if (!checkIn || !checkOut) {
      setError('Please select both check-in and check-out dates');
      return;
    }
    
    if (checkIn >= checkOut) {
      setError('Check-out date must be after check-in date');
      return;
    }
    
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await fetch('/api/check-pricing-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyId,
          checkIn: format(checkIn, 'yyyy-MM-dd'),
          checkOut: format(checkOut, 'yyyy-MM-dd'),
          guests
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to check pricing');
      }
      
      setResult(data);
    } catch (error) {
      console.error('Error checking pricing:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  }
  
  const numberOfNights = checkIn && checkOut ? differenceInDays(checkOut, checkIn) : 0;
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-2">Dynamic Pricing Test</h1>
      <div className="flex mb-6 space-x-4">
        <Link href="/pricing-test">
          <Button variant="outline" className="border-blue-300 bg-blue-50">Basic Pricing Test</Button>
        </Link>
        <Link href="/pricing-test/dynamic">
          <Button variant="outline" className="border-green-300 bg-green-50">Dynamic Pricing Test</Button>
        </Link>
        <Link href="/manage-pricing">
          <Button variant="outline" className="border-purple-300 bg-purple-50">Pricing Management</Button>
        </Link>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6 flex items-start">
        <AlertCircle className="text-green-500 h-5 w-5 mt-0.5 mr-2 flex-shrink-0" />
        <div>
          <h3 className="font-medium text-green-800">Enhanced Dynamic Pricing Test</h3>
          <p className="text-green-700 text-sm">
            This page uses the new pricing API with support for seasonal rates, date-specific overrides,
            length-of-stay discounts, and other advanced features. Use the Pricing Admin to manage price rules.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Check Dynamic Pricing</CardTitle>
            <CardDescription>Test the dynamic pricing and availability system</CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="propertyId">Property ID</Label>
              <Input 
                id="propertyId" 
                value={propertyId} 
                onChange={(e) => setPropertyId(e.target.value)} 
                placeholder="e.g. prahova-mountain-chalet"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checkIn">Check-in Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {checkIn ? format(checkIn, 'PPP') : <span>Select date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={checkIn}
                      onSelect={setCheckIn}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="checkOut">Check-out Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {checkOut ? format(checkOut, 'PPP') : <span>Select date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={checkOut}
                      onSelect={setCheckOut}
                      initialFocus
                      disabled={(date) => (
                        checkIn ? date < checkIn : false
                      )}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="guests">Number of Guests</Label>
              <Input 
                id="guests" 
                type="number" 
                min={1} 
                value={guests} 
                onChange={(e) => setGuests(parseInt(e.target.value))} 
              />
            </div>

            <Separator />
            
            <div className="pt-2">
              <p className="text-sm text-slate-500 mb-2">
                Trip details: {numberOfNights} nights, {guests} guests
              </p>
              
              <Button onClick={checkPricing} disabled={loading || !checkIn || !checkOut} className="w-full">
                {loading ? 'Checking...' : 'Check Pricing & Availability'}
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>Pricing and availability results</CardDescription>
          </CardHeader>
          
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {result && (
              <div className="space-y-4">
                <div className="flex items-center">
                  <span className="font-semibold mr-2">Availability:</span>
                  {result.available ? (
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">Available</span>
                  ) : (
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                      Not Available
                      {result.reason === 'minimum_stay' && ` (Minimum stay: ${result.minimumStay} nights)`}
                    </span>
                  )}
                </div>
                
                {!result.available && result.reason === 'unavailable_dates' && (
                  <div>
                    <span className="font-semibold">Unavailable dates:</span>
                    <div className="text-sm mt-1">
                      {result.unavailableDates.map((date: string) => (
                        <div key={date} className="bg-red-50 px-2 py-1 rounded mb-1">{date}</div>
                      ))}
                    </div>
                  </div>
                )}
                
                {result.available && result.pricing && (
                  <Tabs defaultValue="summary">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="summary">Summary</TabsTrigger>
                      <TabsTrigger value="daily">Daily Rates</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="summary" className="pt-4">
                      <BookingSummary
                        numberOfNights={numberOfNights}
                        numberOfGuests={guests}
                        pricingDetails={null} // Not using traditional model
                        propertyBaseCcy={result.pricing.currency}
                        appliedCoupon={null}
                        dynamicPricing={result.pricing}
                      />
                      
                      <div className="mt-6 p-4 bg-slate-50 rounded-md">
                        <h3 className="font-semibold mb-2">Pricing Details</h3>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Number of nights:</span>
                            <span className="font-medium">{numberOfNights}</span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span>Accommodation total:</span>
                            <span className="font-medium">{result.pricing.accommodationTotal} {result.pricing.currency}</span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span>Cleaning fee:</span>
                            <span className="font-medium">{result.pricing.cleaningFee} {result.pricing.currency}</span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span className="font-medium">{result.pricing.subtotal} {result.pricing.currency}</span>
                          </div>
                          
                          {result.pricing.lengthOfStayDiscount && (
                            <div className="flex justify-between">
                              <span>Length of stay discount ({result.pricing.lengthOfStayDiscount.discountPercentage}%):</span>
                              <span className="font-medium text-green-600">
                                -{result.pricing.lengthOfStayDiscount.discountAmount} {result.pricing.currency}
                              </span>
                            </div>
                          )}
                          
                          <Separator className="my-2" />
                          
                          <div className="flex justify-between font-bold">
                            <span>Total:</span>
                            <span>{result.pricing.total} {result.pricing.currency}</span>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="daily" className="pt-4">
                      <div className="space-y-1">
                        <h3 className="font-semibold mb-2">Daily Rates</h3>
                        <div className="space-y-1 text-sm">
                          {result.pricing.dailyRates && Object.entries(result.pricing.dailyRates).sort().map(([date, price]: [string, any]) => (
                            <div key={date} className="flex justify-between bg-slate-50 px-3 py-2 rounded">
                              <span>{date}</span>
                              <span className="font-medium">{price} {result.pricing.currency}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            )}
            
            {!result && !error && (
              <div className="text-center text-slate-500 py-8">
                Enter details and click "Check Pricing & Availability" to see results
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}