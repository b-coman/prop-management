// src/app/admin/bookings/page.tsx
import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchBookings } from './actions'; // Import the fetch function
import { BookingTable } from './_components/booking-table'; // Import the table component
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic'; // Ensure fresh data on each request

async function BookingsContent() {
  const bookings = await fetchBookings();

  return (
     <Card className="mx-auto">
        <CardHeader>
          <CardTitle>Manage Bookings</CardTitle>
          <CardDescription>
            View, confirm, cancel, and manage booking holds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bookings.length > 0 ? (
            <BookingTable bookings={bookings} />
          ) : (
            <p className="text-center text-muted-foreground">No bookings found.</p>
          )}
        </CardContent>
      </Card>
  );
}


export default function ManageBookingsPage() {
 return (
    <div className="container mx-auto py-10">
       <Suspense fallback={<div className="flex justify-center items-center min-h-[200px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading bookings...</span></div>}>
           <BookingsContent />
       </Suspense>
    </div>
  );
}