// src/app/admin/properties/[slug]/edit/page.tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ImageIcon, ArrowRight } from 'lucide-react';
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
      <Link
        href={`/admin/properties/${slug}/images`}
        className="block max-w-4xl mx-auto mb-4"
      >
        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Property Images</p>
                <p className="text-xs text-muted-foreground">Upload and organize photos</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>
      <Card className="max-w-4xl mx-auto"> {/* Increased max-width */}
        <CardHeader>
          <CardTitle>Edit Property: {typeof property.name === 'string' ? property.name : property.name.en}</CardTitle>
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
