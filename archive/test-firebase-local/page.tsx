'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function TestFirebaseLocal() {
  const [results, setResults] = useState<any>({});
  const [loading, setLoading] = useState<string>('');

  const runTest = async (name: string, url: string, options?: RequestInit) => {
    setLoading(name);
    try {
      const response = await fetch(url, options);
      const data = response.headers.get('Content-Type')?.includes('json') 
        ? await response.json() 
        : await response.text();
      setResults(prev => ({
        ...prev,
        [name]: {
          status: response.status,
          data,
          headers: Object.fromEntries(response.headers.entries())
        }
      }));
    } catch (error: any) {
      setResults(prev => ({
        ...prev,
        [name]: { error: error.message }
      }));
    }
    setLoading('');
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Firebase Admin Local Testing</h1>
      
      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Test Firebase Admin Initialization</h2>
          <Button 
            onClick={() => runTest('admin', '/api/test-firebase-admin')}
            disabled={loading === 'admin'}
          >
            {loading === 'admin' ? 'Testing...' : 'Test Admin SDK'}
          </Button>
          {results.admin && (
            <pre className="mt-4 p-4 bg-gray-100 rounded overflow-auto text-sm">
              {JSON.stringify(results.admin, null, 2)}
            </pre>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Test Pricing API</h2>
          <Button 
            onClick={() => runTest('pricing', '/api/check-pricing', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                propertyId: 'prahova-mountain-chalet',
                checkIn: '2025-06-01',
                checkOut: '2025-06-05',
                guests: 2
              })
            })}
            disabled={loading === 'pricing'}
          >
            {loading === 'pricing' ? 'Testing...' : 'Test Pricing'}
          </Button>
          {results.pricing && (
            <pre className="mt-4 p-4 bg-gray-100 rounded overflow-auto text-sm">
              {JSON.stringify(results.pricing, null, 2)}
            </pre>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Test Availability API</h2>
          <Button 
            onClick={() => runTest('availability', '/api/check-availability', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                propertySlug: 'prahova-mountain-chalet',
                startDate: '2025-06-01',
                endDate: '2025-06-05'
              })
            })}
            disabled={loading === 'availability'}
          >
            {loading === 'availability' ? 'Testing...' : 'Test Availability'}
          </Button>
          {results.availability && (
            <pre className="mt-4 p-4 bg-gray-100 rounded overflow-auto text-sm">
              {JSON.stringify(results.availability, null, 2)}
            </pre>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
          <div className="space-y-2 text-sm">
            <p>NODE_ENV: {process.env.NODE_ENV}</p>
            <p>Firebase Service Account: {process.env.FIREBASE_SERVICE_ACCOUNT ? '✓ Set' : '✗ Not set'}</p>
            <p>Firebase Project ID: {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'Not set'}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}