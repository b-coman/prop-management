// src/app/admin/bookings/page.tsx
import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { fetchBookings } from './actions';
import { BookingTable } from './_components/booking-table';
import { AdminPage, EmptyState, TableSkeleton } from '@/components/admin';
import { CalendarCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function BookingsContent() {
  const bookings = await fetchBookings();

  return (
    <Card>
      <CardContent className="pt-6">
        {bookings.length > 0 ? (
          <BookingTable bookings={bookings} />
        ) : (
          <EmptyState
            icon={CalendarCheck}
            title="No bookings yet"
            description="Bookings will appear here when guests make reservations"
          />
        )}
      </CardContent>
    </Card>
  );
}

export default function ManageBookingsPage() {
  return (
    <AdminPage
      title="Bookings"
      description="View, confirm, cancel, and manage booking holds"
    >
      <Suspense fallback={<Card><CardContent className="pt-6"><TableSkeleton columns={6} rows={5} /></CardContent></Card>}>
        <BookingsContent />
      </Suspense>
    </AdminPage>
  );
}