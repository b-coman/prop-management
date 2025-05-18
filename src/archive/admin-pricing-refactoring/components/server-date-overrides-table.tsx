import { getAdminDateOverrides, isFirestoreAdminAvailable } from '@/lib/firebaseAdminBasic';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { ClientDateOverridesTable } from './client-date-overrides-table';

interface ServerDateOverridesTableProps {
  propertyId: string;
}

// Define DateOverride type to match what the client component expects
interface DateOverride {
  id: string;
  propertyId: string;
  date: string;
  customPrice: number;
  reason?: string;
  minimumStay?: number;
  available: boolean;
  flatRate: boolean;
  [key: string]: any;
}

/**
 * Server component to fetch and display date overrides
 * 
 * This component:
 * 1. Fetches date override data server-side using the Firebase Admin SDK
 * 2. Renders a client component for user interaction
 */
export async function ServerDateOverridesTable({ propertyId }: ServerDateOverridesTableProps) {
  // Check if Firestore is available
  const firestoreAvailable = await isFirestoreAdminAvailable();
  
  // Fetch date overrides if Firestore is available
  let dateOverrides: DateOverride[] = [];
  let fetchError: string | null = null;
  
  if (!firestoreAvailable) {
    fetchError = 'Firestore not available. Please check your Firebase configuration.';
    console.error('[Server] Firestore not available for date overrides');
    
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Database Connection Error</AlertTitle>
          <AlertDescription>
            Could not connect to the Firestore database. Please check your configuration.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  try {
    // Fetch date overrides using our isolated Firebase Admin implementation
    const overridesData = await getAdminDateOverrides(propertyId);
    
    // Convert to expected format
    dateOverrides = overridesData.map(override => ({
      id: override.id,
      propertyId: override.propertyId,
      date: override.date,
      customPrice: override.customPrice,
      reason: override.reason,
      minimumStay: override.minimumStay,
      available: override.available !== false, // Default to true if not specified
      flatRate: override.flatRate || false,
      // Include all other fields
      ...override
    }));
    
    console.log(`[Server] Fetched ${dateOverrides.length} date overrides for property ${propertyId}`);
  } catch (error) {
    console.error(`[Server] Error fetching date overrides for property ${propertyId}:`, error);
    fetchError = 'Failed to fetch date overrides from database';
    
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {fetchError}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <ClientDateOverridesTable 
      dateOverrides={dateOverrides}
      propertyId={propertyId}
      isLoading={false}
      error={null}
    />
  );
}