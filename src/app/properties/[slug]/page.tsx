import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Property } from '@/types';
import { placeholderProperties } from '@/data/properties'; // Using placeholder data
import { PrahovaPageLayout } from '@/components/property/prahova/prahova-page-layout';
import { ColteiPageLayout } from '@/components/property/coltei/coltei-page-layout';

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
  if (property.slug === 'prahova-mountain-chalet') {
    return <PrahovaPageLayout property={property} />;
  }

  if (property.slug === 'coltei-apartment-bucharest') {
    return <ColteiPageLayout property={property} />;
  }

  // Fallback for other properties or a default template if needed
  // For now, return notFound if the slug doesn't match known properties
  // Or render a default structure if desired
  // return <DefaultPropertyLayout property={property} />;
  notFound();

}

// Note: DefaultPropertyLayout would be a component you create
// if you want a standard template for properties not explicitly handled above.
// Example:
//
// import { Header } from '@/components/header'; // Generic header
// import { Footer } from '@/components/footer'; // Generic footer
// import { BookingForm } from '@/components/booking-form';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Separator } from '@/components/ui/separator';
// // ... other imports
//
// function DefaultPropertyLayout({ property }: { property: Property }) {
//   // ... standard layout structure using generic Header/Footer and property data ...
//   return (
//     <div className="flex min-h-screen flex-col">
//       <Header /> {/* Use generic header */}
//       <main className="flex-grow container py-12 md:py-16">
//         {/* Content similar to the previous [slug]/page.tsx structure */}
//         <h1>{property.name}</h1>
//         {/* ... rest of the default details */}
//         <BookingForm property={property} />
//       </main>
//       <Footer /> {/* Use generic footer */}
//     </div>
//   );
// }
