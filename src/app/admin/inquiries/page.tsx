// src/app/admin/inquiries/page.tsx
import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getInquiries } from '@/services/inquiryService';
import { InquiriesWithFilter } from './_components/inquiries-with-filter';
import { AdminPage, TableSkeleton } from '@/components/admin';

export const dynamic = 'force-dynamic';

async function InquiriesContent() {
  const inquiries = await getInquiries();

  return (
    <Card>
      <CardContent className="pt-6">
        <InquiriesWithFilter inquiries={inquiries} />
      </CardContent>
    </Card>
  );
}

export default function ManageInquiriesPage() {
  return (
    <AdminPage
      title="Inquiries"
      description="View and respond to guest inquiries about your properties"
    >
      <Suspense fallback={<Card><CardContent className="pt-6"><TableSkeleton columns={6} rows={5} /></CardContent></Card>}>
        <InquiriesContent />
      </Suspense>
    </AdminPage>
  );
}
