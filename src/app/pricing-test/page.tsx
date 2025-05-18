'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertCircle } from 'lucide-react';

export default function PricingTestPage() {
  const [propertyId, setPropertyId] = useState('prahova-mountain-chalet');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(4);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  async function checkPricing() {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await fetch('/api/check-pricing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyId,
          checkIn,
          checkOut,
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
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-2">Pricing System Test</h1>
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

      <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-6 flex items-start">
        <AlertCircle className="text-amber-500 h-5 w-5 mt-0.5 mr-2 flex-shrink-0" />
        <div>
          <h3 className="font-medium text-amber-800">Basic Pricing Test</h3>
          <p className="text-amber-700 text-sm">
            This page uses the original pricing API. For the enhanced version with new features like
            length-of-stay discounts and date-specific pricing, use the Dynamic Pricing Test.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Check Pricing</CardTitle>
            <CardDescription>Test the dynamic pricing system</CardDescription>
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
                <Input 
                  id="checkIn" 
                  type="date" 
                  value={checkIn} 
                  onChange={(e) => setCheckIn(e.target.value)} 
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="checkOut">Check-out Date</Label>
                <Input 
                  id="checkOut" 
                  type="date" 
                  value={checkOut} 
                  onChange={(e) => setCheckOut(e.target.value)} 
                />
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
          </CardContent>
          
          <CardFooter>
            <Button onClick={checkPricing} disabled={loading}>
              {loading ? 'Checking...' : 'Check Pricing'}
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>Pricing calculation results</CardDescription>
          </CardHeader>
          
          <CardContent>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4">
                {error}
              </div>
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
                  <>
                    <Separator />
                    
                    <div className="space-y-3">
                      <h3 className="font-semibold">Pricing Details</h3>
                      
                      <div className="grid grid-cols-2 text-sm">
                        <span>Number of nights:</span>
                        <span className="font-medium">{result.pricing.numberOfNights}</span>
                        
                        <span>Accommodation total:</span>
                        <span className="font-medium">{result.pricing.accommodationTotal} {result.pricing.currency}</span>
                        
                        <span>Cleaning fee:</span>
                        <span className="font-medium">{result.pricing.cleaningFee} {result.pricing.currency}</span>
                        
                        <span>Subtotal:</span>
                        <span className="font-medium">{result.pricing.subtotal} {result.pricing.currency}</span>
                        
                        {result.pricing.lengthOfStayDiscount && (
                          <>
                            <span>Length of stay discount:</span>
                            <span className="font-medium text-green-600">
                              -{result.pricing.lengthOfStayDiscount.discountAmount} {result.pricing.currency}
                              {' '}({result.pricing.lengthOfStayDiscount.discountPercentage}%)
                            </span>
                          </>
                        )}
                        
                        {result.pricing.couponDiscount && (
                          <>
                            <span>Coupon discount:</span>
                            <span className="font-medium text-green-600">
                              -{result.pricing.couponDiscount.discountAmount} {result.pricing.currency}
                              {' '}({result.pricing.couponDiscount.discountPercentage}%)
                            </span>
                          </>
                        )}
                        
                        <span className="font-semibold pt-2">Total:</span>
                        <span className="font-bold text-lg pt-2">{result.pricing.total} {result.pricing.currency}</span>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <h3 className="font-semibold mb-2">Daily Rates</h3>
                        <div className="space-y-1 text-sm">
                          {result.pricing.dailyRates && Object.entries(result.pricing.dailyRates).map(([date, price]: [string, any]) => (
                            <div key={date} className="flex justify-between bg-slate-50 px-3 py-1 rounded">
                              <span>{date}</span>
                              <span className="font-medium">{price} {result.pricing.currency}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            
            {!result && !error && (
              <div className="text-center text-slate-500 py-8">
                Enter details and click "Check Pricing" to see results
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}