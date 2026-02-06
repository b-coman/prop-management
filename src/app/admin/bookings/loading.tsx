import { Card, CardContent } from '@/components/ui/card';
import { AdminPage, TableSkeleton } from '@/components/admin';

export default function BookingsLoading() {
  return (
    <AdminPage
      title="Bookings"
      description="View, confirm, cancel, and manage booking holds"
    >
      <Card>
        <CardContent className="pt-6">
          <TableSkeleton columns={6} rows={5} />
        </CardContent>
      </Card>
    </AdminPage>
  );
}
