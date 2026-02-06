import { Card, CardContent } from '@/components/ui/card';
import { AdminPage, TableSkeleton } from '@/components/admin';

export default function InquiriesLoading() {
  return (
    <AdminPage
      title="Inquiries"
      description="View and respond to guest inquiries about your properties"
    >
      <Card>
        <CardContent className="pt-6">
          <TableSkeleton columns={6} rows={5} />
        </CardContent>
      </Card>
    </AdminPage>
  );
}
