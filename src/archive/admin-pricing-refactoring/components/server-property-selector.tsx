import { Card, CardContent } from '@/components/ui/card';
import { getAdminProperties, isFirestoreAdminAvailable } from '@/lib/firebaseAdminBasic';
import { ClientPropertySelector } from './client-property-selector';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

// Define Property type to match what the client component expects
interface Property {
  id: string;
  name: string;
  location: string | any;
  status: string;
  pricePerNight?: number;
  [key: string]: any;
}

/**
 * Server component to fetch and display properties for selection
 *
 * This component:
 * 1. Fetches properties server-side using the Firebase Admin SDK
 * 2. Renders a client component for user interaction
 */
export async function ServerPropertySelector() {
  // Check if Firestore is available
  const firestoreAvailable = await isFirestoreAdminAvailable();

  // Fetch properties if Firestore is available
  let properties: Property[] = [];
  let fetchError: string | null = null;

  if (!firestoreAvailable) {
    fetchError = 'Firestore not available. Please check your Firebase configuration.';
    console.error('[Server] Firestore not available for properties');
    
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Database Connection Error</AlertTitle>
            <AlertDescription>
              Could not connect to the Firestore database. Please check your configuration.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  try {
    // Fetch properties using our isolated Firebase Admin implementation
    const propertiesData = await getAdminProperties();
    
    // Convert to expected format
    properties = propertiesData.map(prop => ({
      id: prop.id,
      name: prop.name || prop.id,
      location: prop.location || '',
      status: prop.status || 'active',
      pricePerNight: prop.pricePerNight,
      // Include all other fields
      ...prop
    }));
    
    console.log(`[Server] Fetched ${properties.length} properties`);
  } catch (error) {
    console.error('[Server] Error fetching properties:', error);
    fetchError = 'Failed to fetch properties from database';
    
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {fetchError}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // If we have no properties, show an error
  if (properties.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Properties Found</AlertTitle>
            <AlertDescription>
              No properties found in the database. Please ensure you have at least one property created.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <ClientPropertySelector
      properties={properties}
      isLoading={false}
      error={null}
    />
  );
}