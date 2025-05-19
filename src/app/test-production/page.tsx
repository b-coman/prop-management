'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function TestProductionPage() {
  const [results, setResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const runTest = async (testName: string, testFn: () => Promise<any>) => {
    setLoading(prev => ({ ...prev, [testName]: true }));
    try {
      const result = await testFn();
      setResults(prev => ({ ...prev, [testName]: result }));
    } catch (error) {
      setResults(prev => ({ ...prev, [testName]: { error: error.message } }));
    }
    setLoading(prev => ({ ...prev, [testName]: false }));
  };

  const tests = {
    availability: async () => {
      const response = await fetch('/api/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertySlug: 'prahova-mountain-chalet',
          startDate: '2025-06-01',
          endDate: '2025-06-05'
        })
      });
      return response.json();
    },
    pricing: async () => {
      const response = await fetch('/api/check-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: 'prahova-mountain-chalet',
          checkIn: '2025-06-01',
          checkOut: '2025-06-05',
          guests: 2
        })
      });
      return response.json();
    },
    health: async () => {
      const response = await fetch('/api/health');
      return { status: response.status, text: await response.text() };
    },
    readiness: async () => {
      const response = await fetch('/api/readiness');
      return { status: response.status, text: await response.text() };
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Production Testing Dashboard</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        {Object.entries(tests).map(([name, test]) => (
          <Card key={name} className="p-6">
            <h2 className="text-xl font-semibold mb-4 capitalize">{name} Test</h2>
            <Button 
              onClick={() => runTest(name, test)}
              disabled={loading[name]}
              className="mb-4"
            >
              {loading[name] ? 'Running...' : `Run ${name} Test`}
            </Button>
            
            {results[name] && (
              <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
                {JSON.stringify(results[name], null, 2)}
              </pre>
            )}
          </Card>
        ))}
      </div>

      <Card className="mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">Manual API Testing</h2>
        <div className="space-y-4">
          <div>
            <Label>Endpoint</Label>
            <Input placeholder="/api/check-availability" id="endpoint" />
          </div>
          <div>
            <Label>Method</Label>
            <select className="w-full border rounded p-2" id="method">
              <option>GET</option>
              <option>POST</option>
            </select>
          </div>
          <div>
            <Label>Body (JSON)</Label>
            <textarea 
              className="w-full border rounded p-2 h-32 font-mono text-sm" 
              id="body"
              placeholder="{}"
            />
          </div>
          <Button onClick={async () => {
            const endpoint = (document.getElementById('endpoint') as HTMLInputElement).value;
            const method = (document.getElementById('method') as HTMLSelectElement).value;
            const body = (document.getElementById('body') as HTMLTextAreaElement).value;
            
            try {
              const options: RequestInit = { method };
              if (method === 'POST' && body) {
                options.headers = { 'Content-Type': 'application/json' };
                options.body = body;
              }
              const response = await fetch(endpoint, options);
              const result = await response.json();
              setResults(prev => ({ ...prev, manual: result }));
            } catch (error) {
              setResults(prev => ({ ...prev, manual: { error: error.message } }));
            }
          }}>
            Send Request
          </Button>
          
          {results.manual && (
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm mt-4">
              {JSON.stringify(results.manual, null, 2)}
            </pre>
          )}
        </div>
      </Card>

      <Card className="mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">Browser Console Tests</h2>
        <p className="text-gray-600 mb-4">
          Open the browser console and run these commands to test functionality:
        </p>
        <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
{`// Test language switching
document.querySelector('[aria-label*="language"]')?.click();

// Test currency switching
document.querySelector('[aria-label*="currency"]')?.click();

// Test booking form
const checkIn = document.querySelector('[name="check-in"]');
const checkOut = document.querySelector('[name="check-out"]');
if (checkIn) checkIn.click();

// Check for React errors
console.log('React errors:', window.__REACT_DEVTOOLS_GLOBAL_HOOK__);`}
        </pre>
      </Card>
    </div>
  );
}