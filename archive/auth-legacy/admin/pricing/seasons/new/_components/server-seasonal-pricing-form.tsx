import { getProperty, isFirestoreAdminAvailable } from '@/lib/server/pricing-data';
import { ClientSeasonalPricingForm } from './client-seasonal-pricing-form';

interface ServerSeasonalPricingFormProps {
  propertyId: string;
}

/**
 * Server component for the seasonal pricing form
 * 
 * This component fetches property data on the server
 * and passes it to the client form component
 */
export async function ServerSeasonalPricingForm({ propertyId }: ServerSeasonalPricingFormProps) {
  // Get property details for the form
  let property = null;
  let error = null;
  
  if (isFirestoreAdminAvailable()) {
    try {
      property = await getProperty(propertyId);
    } catch (err) {
      console.error(`[Server] Error fetching property ${propertyId}:`, err);
      error = 'Failed to fetch property details';
    }
  }
  
  // If property doesn't exist, provide default values
  const defaultProperty = {
    id: propertyId,
    name: `Property ${propertyId}`,
    pricePerNight: 100
  };

  return (
    <ClientSeasonalPricingForm 
      propertyId={propertyId}
      propertyName={property?.name || defaultProperty.name}
      basePrice={property?.pricePerNight || defaultProperty.pricePerNight}
      error={error}
    />
  );
}