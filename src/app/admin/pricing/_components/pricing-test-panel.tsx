'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ExternalLinkIcon, AlertTriangleIcon } from 'lucide-react';

export function PricingTestPanel({ propertyId }: { propertyId: string }) {
  const [testTabValue, setTestTabValue] = useState('api');

  // Open property in a new tab for testing
  const openPropertyInNewTab = () => {
    const propertySlug = propertyId.replace(/\s+/g, '-').toLowerCase();
    window.open(`/booking/check/${propertySlug}`, '_blank');
  };

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <AlertTriangleIcon className="h-10 w-10 text-amber-500 mb-3" />
          <h3 className="text-lg font-medium mb-2">Testing Tools Not Available</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            The automated testing scripts are not currently deployed.
            You can manually test pricing and availability by opening the booking page.
          </p>
          <Button variant="outline" onClick={openPropertyInNewTab}>
            <ExternalLinkIcon className="mr-2 h-4 w-4" />
            Open Booking Page
          </Button>
        </div>
      </Card>

      <div className="text-sm text-muted-foreground">
        <p className="font-medium mb-2">Manual Testing Tips:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Check the date picker for blocked dates (shown in gray)</li>
          <li>Verify pricing changes for different seasons</li>
          <li>Test minimum stay requirements on different dates</li>
          <li>Confirm availability reflects your calendar settings</li>
        </ul>
      </div>
    </div>
  );
}