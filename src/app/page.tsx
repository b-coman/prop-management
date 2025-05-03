import Link from 'next/link';
import { Header } from '@/components/header'; // Keep header if needed globally, or remove if properties handle their own nav
import { Footer } from '@/components/footer'; // Keep footer if needed globally, or remove
import { Button } from '@/components/ui/button';

export default function Home() {
  // This page is now just a simple entry point or could be a portal.
  // You might want a global Header/Footer here, or have each property handle its own fully.

  return (
    <div className="flex min-h-screen flex-col">
      {/* Optional: Keep a minimal global header/footer or remove them */}
      {/* <Header /> */}

      <main className="flex-grow container flex flex-col items-center justify-center text-center py-20">
        <h1 className="text-4xl font-bold mb-6">Welcome to Our Rentals</h1>
        <p className="text-lg text-muted-foreground mb-10">
          Explore our unique properties:
        </p>
        <div className="flex flex-col sm:flex-row gap-6">
          <Button asChild size="lg">
            <Link href="/properties/prahova-mountain-chalet">
              Prahova Mountain Chalet
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/properties/coltei-apartment-bucharest">
              Coltei Apartment Bucharest
            </Link>
          </Button>
          {/* Add more buttons if you have more properties */}
        </div>
         {/* Optionally add a link to a generic property list if you still want one */}
         {/* <div className="mt-12">
           <Link href="/properties" className="text-primary hover:underline">
             View all properties
           </Link>
         </div> */}
      </main>

      {/* <Footer /> */}
    </div>
  );
}
