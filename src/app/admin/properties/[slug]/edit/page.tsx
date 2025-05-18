// src/app/admin/properties/[slug]/edit/page.tsx
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PropertyForm } from '../../_components/property-form'; // Reusable form component
import { getPropertyBySlug } from '@/lib/property-utils'; // Import utility function

interface EditPropertyPageProps {
  params: { slug: string };
}

export const dynamic = 'force-dynamic'; // Ensure fresh data for editing

export default async function EditPropertyPage({ params }: EditPropertyPageProps) {
  // Await the params object to ensure it's fully resolved
  const resolvedParams = await Promise.resolve(params);
  const { slug } = resolvedParams;
  // getPropertyBySlug now automatically serializes timestamps
  const property = await getPropertyBySlug(slug);

  if (!property) {
    notFound();
  }

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
          {/* Pass mode='edit' and the property data (timestamps are already serialized) */}
          <PropertyForm mode="edit" initialData={property} />
        </CardContent>
      </Card>
    </div>
  );
}
