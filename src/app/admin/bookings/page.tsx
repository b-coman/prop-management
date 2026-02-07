// src/app/admin/bookings/page.tsx
import { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
      actions={
        <Button asChild>
          <Link href="/admin/bookings/add-external">
            <Plus className="h-4 w-4 mr-1" />
            Add Booking
          </Link>
        </Button>
      }
    >
      <Suspense fallback={<Card><CardContent className="pt-6"><TableSkeleton columns={6} rows={5} /></CardContent></Card>}>
        <BookingsContent />
      </Suspense>
    </AdminPage>
  );
}