// src/app/admin/properties/[slug]/edit/page.tsx
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PropertyForm } from '../../_components/property-form'; // Reusable form component
import { getPropertyBySlug } from '@/app/properties/[slug]/page'; // Reuse existing fetch function

interface EditPropertyPageProps {
  params: { slug: string };
}

export const dynamic = 'force-dynamic'; // Ensure fresh data for editing

export default async function EditPropertyPage({ params }: EditPropertyPageProps) {
  const { slug } = params;
  const property = await getPropertyBySlug(slug);

  if (!property) {
    notFound();
  }

  // Convert Firestore Timestamps/SerializableTimestamps to Date objects for the form if needed
  // (Assuming PropertyForm expects Date objects for date fields)
  // Example:
  // const initialDataForForm = {
  //   ...property,
  //   createdAt: property.createdAt instanceof Timestamp ? property.createdAt.toDate() : property.createdAt,
  //   updatedAt: property.updatedAt instanceof Timestamp ? property.updatedAt.toDate() : property.updatedAt,
  // };

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-4xl mx-auto"> {/* Increased max-width */}
        <CardHeader>
          <CardTitle>Edit Property: {property.name}</CardTitle>
          <CardDescription>
            Update the details for this property listing. Slug: {property.slug}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Pass mode='edit' and the fetched property data */}
          <PropertyForm mode="edit" initialData={property} />
        </CardContent>
      </Card>
    </div>
  );
}
