
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Property } from '@/types';
import { placeholderProperties } from '@/data/properties';
import { PrahovaPageLayout } from '@/components/property/prahova/prahova-page-layout';
import { ColteiPageLayout } from '@/components/property/coltei/coltei-page-layout';
import { Header } from '@/components/header'; // Assuming a generic header might still be needed, adjust if not
// Removed import: import { TestBookingButton } from '@/components/TestBookingButton'; // Import the test button


// Function to get property data by slug (replace with actual data fetching)
async function getPropertyBySlug(slug: string): Promise<Property | undefined> {
  // In a real app, fetch from Firestore based on the slug
  await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network delay
  return placeholderProperties.find((p) => p.slug === slug);
}

interface PropertyDetailsPageProps {
  params: { slug: string };
}

// Optional: Generate static paths if using SSG
export async function generateStaticParams() {
  const properties = placeholderProperties; // Replace with actual data fetching if needed
  return properties.map((property) => ({
    slug: property.slug,
  }));
}

export default async function PropertyDetailsPage({ params }: PropertyDetailsPageProps) {
  const property = await getPropertyBySlug(params.slug);

  if (!property) {
    notFound();
  }

  // Conditionally render the layout based on the property slug
  const LayoutComponent = property.slug === 'prahova-mountain-chalet'
    ? PrahovaPageLayout
    : property.slug === 'coltei-apartment-bucharest'
      ? ColteiPageLayout
      : null; // Fallback or default layout if needed

  if (LayoutComponent) {
    return (
       <div>
        {/* Removed TestBookingButton component usage */}
         <LayoutComponent property={property} />
       </div>
    );
  }


  // Fallback for properties without a specific layout (or could redirect/show error)
  return (
    <div className="flex min-h-screen flex-col">
      {/* Removed TestBookingButton component usage */}
      {/* Render a generic header/layout or handle differently */}
       <Header />
      <main className="flex-grow container py-12 md:py-16">
        <h1>{property.name}</h1>
        <p>Generic property page - Layout not defined.</p>
      </main>
    </div>
  );
}
