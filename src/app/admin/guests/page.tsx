import { Suspense } from 'react';
import { AdminPage } from '@/components/admin/AdminPage';
import { Card, CardContent } from '@/components/ui/card';
import { TableSkeleton } from '@/components/admin/TableSkeleton';
import { fetchGuestsAction, checkIsSuperAdmin } from './actions';
import { GuestsWithFilter } from './_components/guests-with-filter';

export const dynamic = 'force-dynamic';

async function GuestsContent() {
  const [guests, isSuperAdmin] = await Promise.all([
    fetchGuestsAction(),
    checkIsSuperAdmin(),
  ]);

  return (
    <Card>
      <CardContent className="pt-6">
        <GuestsWithFilter guests={guests} isSuperAdmin={isSuperAdmin} />
      </CardContent>
    </Card>
  );
}

export default function ManageGuestsPage() {
  return (
    <AdminPage
      title="Guests"
      description="View and manage guest records, track repeat visitors, and manage tags"
    >
      <Suspense
        fallback={
          <Card>
            <CardContent className="pt-6">
              <TableSkeleton columns={8} rows={5} />
            </CardContent>
          </Card>
        }
      >
        <GuestsContent />
      </Suspense>
    </AdminPage>
  );
}
