// src/app/admin/properties/new/page.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PropertyForm } from '../_components/property-form'; // Reusable form component

export default function NewPropertyPage() {
  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-4xl mx-auto"> {/* Increased max-width */}
        <CardHeader>
          <CardTitle>Create New Property</CardTitle>
          <CardDescription>
            Fill out the form below to add a new rental property listing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Pass mode='create' and no initialData */}
          <PropertyForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
