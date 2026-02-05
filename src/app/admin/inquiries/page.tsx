// src/app/admin/inquiries/page.tsx
import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getInquiries } from '@/services/inquiryService';
import { InquiryTable } from './_components/inquiry-table';
import { AdminPage, EmptyState, TableSkeleton } from '@/components/admin';
import { MessageSquare } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function InquiriesContent() {
  const inquiries = await getInquiries();

  return (
    <Card>
      <CardContent className="pt-6">
        {inquiries.length > 0 ? (
          <InquiryTable inquiries={inquiries} />
        ) : (
          <EmptyState
            icon={MessageSquare}
            title="No inquiries yet"
            description="Guest inquiries will appear here when they submit questions"
          />
        )}
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
