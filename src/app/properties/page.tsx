import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { PropertyList } from '@/components/property-list';
import { placeholderProperties } from '@/data/properties'; // Using placeholder data

export default function PropertiesPage() {
  // In a real app, fetch properties from Firestore or your data source
  const properties = placeholderProperties;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-grow container py-12 md:py-16 lg:py-20">
        <h1 className="mb-8 text-center text-4xl font-bold tracking-tight md:mb-12 md:text-5xl">
          Our Properties
        </h1>
        <PropertyList properties={properties} />
      </main>
      <Footer />
    </div>
  );
}
