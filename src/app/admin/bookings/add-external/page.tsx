// src/app/admin/bookings/add-external/page.tsx
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminPage } from '@/components/admin';
import { ExternalBookingForm } from '../_components/external-booking-form';
import { fetchPropertiesForBookingForm } from '../actions';

export const dynamic = 'force-dynamic';

export default async function AddExternalBookingPage() {
  const properties = await fetchPropertiesForBookingForm();

  return (
    <AdminPage
      title="Add External Booking"
      description="Record a booking from Airbnb, Booking.com, or other platforms"
    >
      <div className="-mt-4">
        <Button variant="link" className="px-0 text-muted-foreground" asChild>
          <Link href="/admin/bookings">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Bookings
          </Link>
        </Button>
      </div>
      <ExternalBookingForm mode="create" properties={properties} />
    </AdminPage>
  );
}
