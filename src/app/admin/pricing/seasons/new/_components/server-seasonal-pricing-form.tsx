import { fetchProperty } from '../../../server-actions-hybrid';
import { ClientSeasonalPricingForm } from './client-seasonal-pricing-form';

interface ServerSeasonalPricingFormProps {
  propertyId: string;
}

/**
 * Server component for the seasonal pricing form
 *
 * This component fetches property data on the server
 * and passes it to the client form component.
 *
 * Uses Firebase Client SDK via server actions for data fetching,
 * matching the pattern used throughout the admin interface.
 */
export async function ServerSeasonalPricingForm({ propertyId }: ServerSeasonalPricingFormProps) {
  // Get property details for the form
  let property = null;
  let error = null;

  try {
    property = await fetchProperty(propertyId);
    if (!property) {
      console.log(`[Server] Property ${propertyId} not found, using defaults`);
    }
  } catch (err) {
    console.error(`[Server] Error fetching property ${propertyId}:`, err);
    error = 'Failed to fetch property details';
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