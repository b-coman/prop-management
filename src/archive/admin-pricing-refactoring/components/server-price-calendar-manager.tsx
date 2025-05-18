import { isFirestoreAdminAvailable } from '@/lib/firebaseAdminBasic';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { ClientPriceCalendarManager } from './client-price-calendar-manager';

interface ServerPriceCalendarManagerProps {
  propertyId: string;
}

// Define PriceCalendarMonth type to match what the client component expects
interface PriceCalendarMonth {
  id: string;
  propertyId: string;
  month: string; // YYYY-MM format
  year: number;
  days: Record<string, any>;
  summary: {
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    unavailableDays: number;
    modifiedDays: number;
    hasCustomPrices: boolean;
    hasSeasonalRates: boolean;
  };
  generatedAt: any; // Timestamp
  [key: string]: any;
}

/**
 * Server component for price calendar management
 * 
 * This component:
 * 1. Checks Firestore availability
 * 2. Renders client component for generating price calendars
 */
export async function ServerPriceCalendarManager({ propertyId }: ServerPriceCalendarManagerProps) {
  // Check if Firestore is available
  const firestoreAvailable = await isFirestoreAdminAvailable();
  
  // For price calendars, we're just showing the generation UI, not loading data
  if (!firestoreAvailable) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Database Connection Error</AlertTitle>
          <AlertDescription>
            Could not connect to the Firestore database. Price calendar generation is unavailable.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  // We're providing an empty array since the client component
  // is primarily for generating new calendars, not displaying existing ones
  return (
    <ClientPriceCalendarManager 
      priceCalendars={[]}
      propertyId={propertyId}
      isLoading={false}
      error={null}
    />
  );
}