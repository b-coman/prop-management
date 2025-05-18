import { getAdminSeasonalPricing, isFirestoreAdminAvailable } from '@/lib/firebaseAdminBasic';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { ClientSeasonalPricingTable } from './client-seasonal-pricing-table';

interface ServerSeasonalPricingTableProps {
  propertyId: string;
}

// Define SeasonalPricing type to match what the client component expects
interface SeasonalPricing {
  id: string;
  propertyId: string;
  name: string;
  seasonType: 'minimum' | 'low' | 'standard' | 'medium' | 'high';
  startDate: string;
  endDate: string;
  priceMultiplier: number;
  minimumStay?: number;
  enabled: boolean;
  [key: string]: any;
}

/**
 * Server component to fetch and display seasonal pricing data
 * 
 * This component:
 * 1. Fetches seasonal pricing data server-side using the Firebase Admin SDK
 * 2. Renders a client component for user interaction
 */
export async function ServerSeasonalPricingTable({ propertyId }: ServerSeasonalPricingTableProps) {
  // Check if Firestore is available
  const firestoreAvailable = await isFirestoreAdminAvailable();
  
  // Fetch seasonal pricing if Firestore is available
  let seasonalPricing: SeasonalPricing[] = [];
  let fetchError: string | null = null;
  
  if (!firestoreAvailable) {
    fetchError = 'Firestore not available. Please check your Firebase configuration.';
    console.error('[Server] Firestore not available for seasonal pricing');
    
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
    // Fetch seasonal pricing using our isolated Firebase Admin implementation
    const pricingData = await getAdminSeasonalPricing(propertyId);
    
    // Convert to expected format
    seasonalPricing = pricingData.map(season => ({
      id: season.id,
      propertyId: season.propertyId,
      name: season.name,
      seasonType: season.seasonType || 'standard',
      startDate: season.startDate,
      endDate: season.endDate,
      priceMultiplier: season.priceMultiplier,
      minimumStay: season.minimumStay,
      enabled: season.enabled !== false, // Default to true if not specified
      // Include all other fields
      ...season
    }));
    
    console.log(`[Server] Fetched ${seasonalPricing.length} seasonal pricing rules for property ${propertyId}`);
  } catch (error) {
    console.error(`[Server] Error fetching seasonal pricing for property ${propertyId}:`, error);
    fetchError = 'Failed to fetch seasonal pricing data from database';
    
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
    <ClientSeasonalPricingTable 
      seasonalPricing={seasonalPricing}
      propertyId={propertyId}
      isLoading={false}
      error={null}
    />
  );
}