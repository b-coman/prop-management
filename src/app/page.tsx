import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { PropertyList } from '@/components/property-list';
import { Button } from '@/components/ui/button';
import { placeholderProperties } from '@/data/properties'; // Using placeholder data
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, CreditCard, CheckCircle } from 'lucide-react';

export default function Home() {
  // Use placeholder data for now. In a real app, fetch from Firestore.
  const properties = placeholderProperties;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative h-[60vh] w-full overflow-hidden bg-gradient-to-r from-primary/80 to-accent/60 text-primary-foreground">
           <Image
              src="https://picsum.photos/seed/hero/1600/900"
              alt="Beautiful vacation rental view"
              layout="fill"
              objectFit="cover"
              className="absolute inset-0 z-0 opacity-30"
              priority
              data-ai-hint="scenic landscape vacation rental"
            />
           <div className="container relative z-10 flex h-full flex-col items-center justify-center text-center">
            <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
              Your Perfect Getaway Awaits
            </h1>
            <p className="mb-8 max-w-2xl text-lg text-primary-foreground/80 md:text-xl">
              Discover unique properties, book directly, and create unforgettable memories.
            </p>
            <Button size="lg" asChild variant="secondary">
              <Link href="/properties">Explore Properties</Link>
            </Button>
          </div>
        </section>

        {/* Featured Properties Section */}
        <section className="py-16 lg:py-24 bg-secondary">
          <div className="container">
            <h2 className="mb-10 text-center text-3xl font-bold tracking-tight md:text-4xl">
              Featured Properties
            </h2>
            <PropertyList properties={properties} />
            <div className="mt-10 text-center">
              <Button asChild variant="outline">
                <Link href="/properties">View All Properties</Link>
              </Button>
            </div>
          </div>
        </section>

         {/* How It Works Section */}
        <section id="book-now" className="py-16 lg:py-24 bg-background">
          <div className="container">
            <h2 className="mb-12 text-center text-3xl font-bold tracking-tight md:text-4xl">
              Book Your Stay in 3 Easy Steps
            </h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <Card className="text-center shadow-md">
                <CardHeader>
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <CardTitle>1. Check Availability</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Select your desired dates on our interactive calendar to see available properties.</p>
                </CardContent>
              </Card>
              <Card className="text-center shadow-md">
                <CardHeader>
                   <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <CreditCard className="h-6 w-6" />
                  </div>
                  <CardTitle>2. Book & Pay Securely</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Fill in your details and complete the payment securely through Stripe.</p>
                </CardContent>
              </Card>
              <Card className="text-center shadow-md">
                <CardHeader>
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <CardTitle>3. Get Confirmation</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Receive instant booking confirmation via email and get ready for your trip!</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
