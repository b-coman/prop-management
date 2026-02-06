// src/app/admin/bookings/page.tsx
import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { fetchBookings } from './actions';
import { BookingsWithFilter } from './_components/bookings-with-filter';
import { AdminPage, TableSkeleton } from '@/components/admin';

export const dynamic = 'force-dynamic';

async function BookingsContent() {
  const bookings = await fetchBookings();

  return (
    <Card>
      <CardContent className="pt-6">
        <BookingsWithFilter bookings={bookings} />
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