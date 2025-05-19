'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

export default function DebugPricingPage() {
  const [loading, setLoading] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);
  const [formData, setFormData] = useState({
    propertyId: 'prahova-mountain-chalet',
    checkIn: format(new Date(2025, 5, 1), 'yyyy-MM-dd'),
    checkOut: format(new Date(2025, 5, 5), 'yyyy-MM-dd'),
    guests: '2'
  });

  const runDebug = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          guests: parseInt(formData.guests)
        })
      });
      const data = await response.json();
      setDebugData(data);
    } catch (error: any) {
      setDebugData({ error: error.message });
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">Pricing Debug Tool</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Debug Parameters</h2>
          <div className="space-y-4">
            <div>
              <Label>Property ID</Label>
              <Input
                value={formData.propertyId}
                onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
              />
            </div>
            
            <div>
              <Label>Check-in Date</Label>
              <Input
                type="date"
                value={formData.checkIn}
                onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
              />
            </div>
            
            <div>
              <Label>Check-out Date</Label>
              <Input
                type="date"
                value={formData.checkOut}
                onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })}
              />
            </div>
            
            <div>
              <Label>Guests</Label>
              <Input
                type="number"
                value={formData.guests}
                onChange={(e) => setFormData({ ...formData, guests: e.target.value })}
              />
            </div>
            
            <Button 
              onClick={runDebug} 
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Running Debug...' : 'Run Debug'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Button
              onClick={() => {
                setFormData({
                  propertyId: 'prahova-mountain-chalet',
                  checkIn: '2025-06-01',
                  checkOut: '2025-06-05',
                  guests: '2'
                });
                runDebug();
              }}
              variant="outline"
              className="w-full"
            >
              Test: June 2025 (Prahova)
            </Button>
            
            <Button
              onClick={() => {
                setFormData({
                  propertyId: 'coltei-apartment-bucharest',
                  checkIn: '2025-07-15',
                  checkOut: '2025-07-20',
                  guests: '4'
                });
                runDebug();
              }}
              variant="outline"
              className="w-full"
            >
              Test: July 2025 (Coltei)
            </Button>
            
            <Button
              onClick={() => {
                const today = new Date();
                const nextWeek = new Date(today);
                nextWeek.setDate(today.getDate() + 7);
                const twoWeeks = new Date(today);
                twoWeeks.setDate(today.getDate() + 14);
                
                setFormData({
                  propertyId: 'prahova-mountain-chalet',
                  checkIn: format(nextWeek, 'yyyy-MM-dd'),
                  checkOut: format(twoWeeks, 'yyyy-MM-dd'),
                  guests: '2'
                });
                runDebug();
              }}
              variant="outline"
              className="w-full"
            >
              Test: Next Week
            </Button>
          </div>
        </Card>
      </div>

      {debugData && (
        <Card className="mt-8 p-6">
          <h2 className="text-xl font-semibold mb-4">Debug Results</h2>
          
          {/* Errors */}
          {debugData.errors && debugData.errors.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-red-600 mb-2">Errors</h3>
              <ul className="list-disc list-inside space-y-1">
                {debugData.errors.map((error: string, index: number) => (
                  <li key={index} className="text-red-600">{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Logs */}
          {debugData.logs && debugData.logs.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Debug Logs</h3>
              <div className="bg-gray-100 p-4 rounded font-mono text-sm space-y-1">
                {debugData.logs.map((log: string, index: number) => (
                  <div key={index}>{log}</div>
                ))}
              </div>
            </div>
          )}

          {/* Property Info */}
          {debugData.property && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Property Information</h3>
              <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
                {JSON.stringify(debugData.property, null, 2)}
              </pre>
            </div>
          )}

          {/* Price Calendars */}
          {debugData.priceCalendars && debugData.priceCalendars.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Price Calendars</h3>
              <div className="space-y-4">
                {debugData.priceCalendars.map((calendar: any, index: number) => (
                  <div key={index} className="border rounded p-4">
                    <h4 className="font-semibold mb-2">{calendar.id}</h4>
                    {calendar.exists ? (
                      <div>
                        <p className="text-green-600">✓ Exists</p>
                        <p>Days: {calendar.data.dayCount}</p>
                        {calendar.data.sampleDays && (
                          <div className="mt-2">
                            <p className="font-medium">Sample days:</p>
                            <ul className="list-disc list-inside text-sm">
                              {calendar.data.sampleDays.map((day: any, dayIndex: number) => (
                                <li key={dayIndex}>
                                  Day {day.day}: {day.available ? 'Available' : 'Unavailable'} - ${day.basePrice}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-red-600">✗ Missing</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full Debug Data */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Full Debug Data</h3>
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
              {JSON.stringify(debugData, null, 2)}
            </pre>
          </div>
        </Card>
      )}
    </div>
  );
}