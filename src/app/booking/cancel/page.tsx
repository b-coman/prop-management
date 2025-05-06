
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import GenericHeader from '@/components/generic-header';
// Removed Footer import: import { Footer } from '@/components/footer';
import { Suspense } from 'react';

function BookingCancelContent() {
    const searchParams = useSearchParams();
    const propertySlug = searchParams.get('property_slug');

    return (
        <div className="flex min-h-screen flex-col">
            <GenericHeader/>
            <main className="flex-grow container py-12 md:py-16 lg:py-20 flex items-center justify-center">
                <Card className="w-full max-w-lg text-center shadow-xl">
                    <CardHeader>
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-destructive">
                            <XCircle className="h-10 w-10" />
                        </div>
                        <CardTitle className="text-3xl font-bold">Booking Cancelled</CardTitle>
                        <CardDescription>
                            Your booking process was cancelled. You have not been charged.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <p className="text-muted-foreground">
                            You can return to the property page to try booking again or explore other options.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            {propertySlug && (
                                // Changed: Wrap Button inside Link
                                <Link href={`/properties/${propertySlug}`}>
                                    <Button variant="outline">Return to Property</Button>
                                </Link>
                            )}
                             {/* Changed: Wrap Button inside Link */}
                            <Link href="/properties">
                               <Button>Explore Other Properties</Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </main>
             {/* Removed Footer usage */}
             {/* <Footer /> */}
             {/* Optional simple footer */}
            <footer className="border-t bg-muted/50">
                <div className="container py-4 text-center text-xs text-muted-foreground">
                    RentalSpot &copy; {new Date().getFullYear()}
                </div>
            </footer>
        </div>
    );
}


export default function BookingCancelPage() {
  return (
    // Wrap with Suspense because useSearchParams() might suspend
    <Suspense fallback={<div>Loading...</div>}>
      <BookingCancelContent />
    </Suspense>
  );
}
